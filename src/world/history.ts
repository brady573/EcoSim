/**
 * Ecological history and lineage tracking for the experimental evolution POC.
 *
 * This module exists so the experiment produces EVIDENCE rather than just a
 * moving picture. It answers the questions the Owner asked for directly:
 * individual life histories, lineage change, population composition,
 * extinction, and adaptation.
 *
 * Cost note: lineage aggregation is O(population) and therefore only runs on
 * sample ticks. Sampling is decoupled from `World.step()` so a benchmark can
 * turn history collection off entirely and measure pure simulation cost.
 */

import { TRAITS } from '../bio/genome.js';
import type { WorldSnapshot } from './world.js';
import type { DisturbanceEvent } from './disturbances.js';

/** Trait indices sampled for lineage adaptation tracking. */
export const TRACKED_TRAITS = [
  0, // METABOLIC_EFFICIENCY
  3, // BASAL_COST
  4, // PHOTOSYNTHETIC_RATE
  12, // SPEED
  17, // MATURITY_AGE
  19, // CLUTCH_SIZE
  23, // SIZE
  24, // ARMOR
  25, // TOXIN
  30, // AGGRESSION
  31, // TIMIDITY
  33, // HERD_INSTINCT
];

/** Aggregate state for one lineage at one sample point. */
export interface LineageSample {
  tick: number;
  abundance: number;
  /** Mean normalized gene value per tracked trait. */
  traitMean: Float32Array;
  /** Mean energy per individual. */
  meanEnergy: number;
  /** Mean generation depth, i.e. how far from its founder. */
  meanGeneration: number;
}

/** What the tracker knows about a lineage across the whole run. */
export interface LineageRecord {
  lineage: number;
  founderTick: number;
  /** Normalized genes of the founding individual, for comparison against. */
  founderGenome: Float32Array;
  /** First and last tick at which the lineage had any living member. */
  firstSeen: number;
  lastSeen: number;
  /** Tick it went extinct, or -1 while alive. */
  extinctAt: number;
  /** Peak abundance ever observed. */
  peakAbundance: number;
  /** Abundance and trait means at the first and last samples, for drift. */
  first: LineageSample | null;
  last: LineageSample | null;
}

/** One point on the population/composition curve. */
export interface HistorySample extends WorldSnapshot {
  /** Fraction of living organisms that are producers. */
  producerShare: number;
  /** Mean damage across the living population: a measure of attrition. */
  meanDamage: number;
  /** Deaths per tick, smoothed over the sampling window. */
  deathRate: number;
  birthRate: number;
}

export class WorldHistory {
  private samples: HistorySample[] = [];
  private prevBirths = 0;
  private prevDeaths = 0;
  /** Wall of samples to retain, so a long run cannot exhaust memory. */
  private readonly cap: number;

  constructor(
    private readonly every: number,
    cap = 40000,
  ) {
    this.cap = cap;
  }

  get enabled(): boolean {
    return this.every > 0;
  }

  get sampleCount(): number {
    return this.samples.length;
  }

  record(tick: number, snap: WorldSnapshot, meanDamage = 0): void {
    if (!this.enabled || tick % this.every !== 0) return;
    if (this.samples.length >= this.cap) return;
    this.samples.push({
      ...snap,
      producerShare: snap.population > 0 ? snap.trophicProducers / snap.population : 0,
      meanDamage,
      deathRate: snap.deaths - this.prevDeaths,
      birthRate: snap.births - this.prevBirths,
    });
    this.prevBirths = snap.births;
    this.prevDeaths = snap.deaths;
  }

  all(): readonly HistorySample[] {
    return this.samples;
  }

  /** Population curve only, for quick plotting. */
  populationCurve(): number[] {
    return this.samples.map((s) => s.population);
  }

  /** Ticks at which the population fell by more than `fraction` in one sample. */
  collapseEvents(fraction = 0.3): Array<{ tick: number; from: number; to: number }> {
    const out: Array<{ tick: number; from: number; to: number }> = [];
    for (let i = 1; i < this.samples.length; i++) {
      const a = this.samples[i - 1].population;
      const b = this.samples[i].population;
      if (a > 20 && (a - b) / a >= fraction) {
        out.push({ tick: this.samples[i].tick, from: a, to: b });
      }
    }
    return out;
  }

  reset(): void {
    this.samples = [];
    this.prevBirths = 0;
    this.prevDeaths = 0;
  }
}

/**
 * Tracks lineages: who they are, when they arise, how they drift, and when
 * they go extinct. Lineage identity is inherited across asexual reproduction
 * and reassigned for sexual recombination, so lineages genuinely branch.
 */
export class LineageTracker {
  private readonly records = new Map<number, LineageRecord>();
  private totals!: Float64Array;
  private counts!: Int32Array;
  private energyTotals!: Float64Array;
  private generationTotals!: Float64Array;
  private touched: number[] = [];

  /** Total lineages ever created. */
  totalCreated = 0;
  /** How many have gone extinct. */
  totalExtinct = 0;
  /** Lineages currently holding at least one living organism. */
  live = 0;
  /** Richest lineage abundance ever seen. */
  maxAbundance = 0;
  /** Lineage ids at the last sample, ordered by abundance. */
  rankedLineages: number[] = [];
  /** Living individuals counted in the most recent sample. */
  lastPopulation = 0;

  constructor() {
    this.alloc(1024);
  }

  private alloc(size: number): void {
    const t = new Float64Array(size * TRACKED_TRAITS.length);
    const c = new Int32Array(size);
    const e = new Float64Array(size);
    const g = new Float64Array(size);
    if (this.totals) {
      t.set(this.totals);
      c.set(this.counts);
      e.set(this.energyTotals);
      g.set(this.generationTotals);
    }
    this.totals = t;
    this.counts = c;
    this.energyTotals = e;
    this.generationTotals = g;
  }

  private ensure(id: number): void {
    if (id < 0 || id >= this.counts.length) {
      this.alloc(Math.max(id + 1, this.counts.length * 2));
    }
  }

  /**
   * Sample every lineage from the live population. O(population).
   * `genDepth(slot)` should return how many meioses/generations back to the
   * founder, so mean generation is meaningful.
   */
  sample(
    tick: number,
    lineageOf: (slot: number) => number,
    genomeOf: (slot: number, trait: number) => number,
    energyOf: (slot: number) => number,
    genDepthOf: (slot: number) => number,
    /** Dense iteration bound. */
    count: number,
    /**
     * Liveness test. Vacant recycled slots still hold a stale genome and
     * lineage, so counting them would inflate every abundance and quietly
     * corrupt lineage extinction detection.
     */
    isAlive: (slot: number) => boolean,
  ): void {
    if (this.touched.length > 0) {
      for (let i = 0; i < this.touched.length; i++) {
        const id = this.touched[i];
        this.counts[id] = 0;
        this.energyTotals[id] = 0;
        this.generationTotals[id] = 0;
        for (let t = 0; t < TRACKED_TRAITS.length; t++) this.totals[id * TRACKED_TRAITS.length + t] = 0;
      }
      this.touched.length = 0;
    }

    const nT = TRACKED_TRAITS.length;
    let population = 0;
    for (let slot = 0; slot < count; slot++) {
      if (!isAlive(slot)) continue;
      population++;
      const id = lineageOf(slot);
      this.ensure(id);
      if (this.counts[id] === 0) this.touched.push(id);
      this.counts[id]++;
      this.energyTotals[id] += energyOf(slot);
      this.generationTotals[id] += genDepthOf(slot);
      const base = id * nT;
      for (let t = 0; t < nT; t++) {
        this.totals[base + t] += genomeOf(slot, TRACKED_TRAITS[t]);
      }
    }

    const nT2 = TRACKED_TRAITS.length;
    for (let k = 0; k < this.touched.length; k++) {
      const id = this.touched[k];
      const n = this.counts[id];
      if (n === 0) continue;
      const rec = this.records.get(id) ?? this.createRecord(id, tick);
      const means = new Float32Array(nT2);
      const base = id * nT2;
      for (let t = 0; t < nT2; t++) means[t] = this.totals[base + t] / n;
      const sample: LineageSample = {
        tick,
        abundance: n,
        traitMean: means,
        meanEnergy: this.energyTotals[id] / n,
        meanGeneration: this.generationTotals[id] / n,
      };
      if (!rec.first) rec.first = sample;
      rec.last = sample;
      rec.lastSeen = tick;
      rec.extinctAt = -1;
      if (n > rec.peakAbundance) rec.peakAbundance = n;
    }

    this.live = this.touched.length;
    this.lastPopulation = population;
    if (population > 0 && population > this.maxAbundance) this.maxAbundance = population;
    this.rankedLineages = this.touched
      .filter((id) => this.counts[id] > 0)
      .sort((a, b) => this.counts[b] - this.counts[a])
      .slice(0, 12);
  }

  private createRecord(id: number, tick: number): LineageRecord {
    const rec: LineageRecord = {
      lineage: id,
      founderTick: tick,
      founderGenome: new Float32Array(nT()),
      firstSeen: tick,
      lastSeen: tick,
      extinctAt: -1,
      peakAbundance: 0,
      first: null,
      last: null,
    };
    this.records.set(id, rec);
    this.totalCreated++;
    return rec;
  }

  /** Mark lineages absent from the latest sample as extinct. */
  markExtinction(tick: number): number {
    let newly = 0;
    for (const rec of this.records.values()) {
      if (rec.extinctAt === -1 && rec.lastSeen < tick) {
        rec.extinctAt = tick;
        newly++;
      }
    }
    this.totalExtinct += newly;
    return newly;
  }

  record(id: number): LineageRecord | undefined {
    return this.records.get(id);
  }

  all(): LineageRecord[] {
    return [...this.records.values()];
  }

  extinct(): LineageRecord[] {
    return this.all().filter((r) => r.extinctAt >= 0);
  }

  surviving(): LineageRecord[] {
    return this.all().filter((r) => r.extinctAt === -1);
  }

  /**
   * Largest per-trait shift between a lineage's first and last sample.
   * This is the quantitative form of "did anything adapt".
   */
  biggestDrift(): Array<{ trait: string; delta: number; from: number; to: number }> {
    let best: Array<{ trait: string; delta: number; from: number; to: number }> = [];
    for (const rec of this.records.values()) {
      if (!rec.first || !rec.last) continue;
      for (let t = 0; t < TRACKED_TRAITS.length; t++) {
        const d = rec.last.traitMean[t] - rec.first.traitMean[t];
        if (Math.abs(d) < 0.02) continue;
        best.push({
          trait: TRAITS[TRACKED_TRAITS[t]].name,
          delta: d,
          from: rec.first.traitMean[t],
          to: rec.last.traitMean[t],
        });
      }
    }
    best.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return best.slice(0, 20);
  }
}

function nT(): number {
  return TRACKED_TRAITS.length;
}

/** Align disturbance events with the population curve, for the report. */
export interface ForcingAnnotation {
  event: DisturbanceEvent;
  /** Population before and after the event, when available. */
  populationBefore: number;
  populationAfter: number;
  /** Tick of the largest observed population drop following the event. */
  worstDropTick: number;
  worstDropFraction: number;
}

export function annotateForcing(
  events: readonly DisturbanceEvent[],
  samples: readonly HistorySample[],
  horizonTicks: number,
): ForcingAnnotation[] {
  const out: ForcingAnnotation[] = [];
  for (const ev of events) {
    const before = nearestSample(samples, ev.tick);
    const after = nearestSample(samples, Math.min(horizonTicks, ev.tick + ev.remaining));
    let worstDropTick = ev.tick;
    let worst = 0;
    const limit = ev.tick + ev.remaining + 200;
    for (const s of samples) {
      if (s.tick < ev.tick || s.tick > limit) continue;
      if (before > 20) {
        const frac = (before - s.population) / before;
        if (frac > worst) {
          worst = frac;
          worstDropTick = s.tick;
        }
      }
    }
    out.push({
      event: ev,
      populationBefore: before,
      populationAfter: after,
      worstDropTick,
      worstDropFraction: worst,
    });
  }
  return out;
}

function nearestSample(samples: readonly HistorySample[], tick: number): number {
  if (samples.length === 0) return 0;
  let best = samples[0].population;
  let bestD = Infinity;
  for (const s of samples) {
    const d = Math.abs(s.tick - tick);
    if (d < bestD) {
      bestD = d;
      best = s.population;
    }
  }
  return best;
}
