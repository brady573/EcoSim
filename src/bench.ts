/**
 * Headless performance harness for the experimental evolution POC.
 *
 * Measures the quantities the Owner's performance protocol asks for:
 *   - ticks/sec at increasing founder populations
 *   - average and tail (p99) tick time
 *   - per-subsystem cost shares
 *   - procedural phenotype derivation overhead
 *   - memory growth and GC pressure
 *
 * Explicitly separated from rendering: nothing here touches PixiJS, so these
 * numbers are simulation capacity only. Rendering throughput is a different
 * measurement and must not be inferred from this.
 *
 * Deliberately bounded by default so it is safe to run on a phone. Tick counts
 * are small and the default ladder stops at 10k; higher populations need
 * explicit opt-in via --ladder.
 *
 * Run: pnpm bench  |  pnpm bench -- --ladder=1k,5k,10k,25k --ticks=200
 */

import { cpus } from 'node:os';
import { World } from './world/world.js';
import type { WorldConfig } from './world/config.js';
import { Phenotype } from './bio/phenotype.js';
import { TROPHIC_NAME, MOTILITY_NAME } from './bio/role.js';
import { TRAIT_COUNT, BODY_GENES, BODY_GENE_COUNT } from './bio/genome.js';
import { LineageTracker } from './world/history.js';
import { WORLD_ENGINE_VERSION } from './world/version.js';

interface Scenario {
  founders: number;
  ticks: number;
  seed: number;
  /** Enable lineage aggregation so its cost can be measured separately. */
  lineage?: boolean;
  /** World extent. Varying it separates ALGORITHMIC cost from DENSITY cost. */
  world: number;
}

/**
 * Subsystem cost grouping required by the whole-ecosystem amendment: results
 * must separate ecology-field dynamics, organism biology, interaction
 * resolution, lineage bookkeeping, phenotype generation, and rendering.
 */
export type Subsystem =
  | 'ecologyFieldDynamics'
  | 'organismBiology'
  | 'interactionResolution'
  | 'lineageBookkeeping'
  | 'phenotypeGeneration'
  | 'rendering'
  | 'other';

interface ScenarioResult {
  scenario: Scenario;
  ticksPerSec: number;
  meanTickMs: number;
  medianTickMs: number;
  p99TickMs: number;
  maxTickMs: number;
  finalPopulation: number;
  peakPopulation: number;
  meanPopulation: number;
  phaseShares: Record<string, number>;
  phaseMs: Record<string, number>;
  phenotypeDerivations: number;
  /** Derived phenotypes per organism-second of simulated time. */
  phenotypePerKOrganismTick: number;
  heapUsedMB: number;
  heapDeltaMB: number;
  rssMB: number;
  accountingResidualPct: number;
  capHits: number;
  /** Cost by the required subsystem grouping. */
  subsystemMs: Record<Subsystem, number>;
  subsystemShare: Record<Subsystem, number>;
  /**
   * Long-run degradation: mean tick time over the last fifth divided by the
   * mean over the first fifth. 1.0 means flat; >1 means the world got slower
   * as it ran. This is the signal that something accumulates.
   */
  degradationRatio: number;
  midMs: number;
  lastFifthMs: number;
  /** Ecosystem composition at the end of the run. */
  composition: Record<string, number>;
  /** Mean traits/genes/interactions per organism: model complexity at scale. */
  complexity: {
    heritableTraits: number;
    bodyPlanGenes: number;
    interactionKinds: number;
    behaviouralOptions: number;
    meanLivePerOrganism: number;
  };
  /** Lineage bookkeeping cost, measured only when sampling was enabled. */
  lineageSamplingEnabled: boolean;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[idx];
}

function runScenario(s: Scenario, verbose: boolean): ScenarioResult {
  const cfg: Partial<WorldConfig> = {
    founders: s.founders,
    seed: s.seed,
    label: `bench-${s.founders}`,
    worldW: s.world,
    worldH: s.world,
  };
  const w = new World({ config: cfg });
  w.profiling = true;
  w.lineageSampling = s.lineage === true;
  const tracker = w.lineageSampling ? new LineageTracker() : null;

  const tickTimes: number[] = [];
  const pops: number[] = [];
  const derivationsStart = w.store.phenotypeDerivations;

  // Warm up so the first ticks (JIT + first-touch of typed arrays) do not
  // dominate the distribution.
  // Warm up so JIT compilation and first-touch of typed arrays do not land in
  // the measured window. Must also let founder phenotype derivation finish, or
  // its cost leaks into the phase grouping below.
  const warmup = Math.min(40, Math.max(10, Math.floor(s.ticks * 0.2)));
  for (let i = 0; i < warmup; i++) w.step();
  // Everything timed from here on belongs to the measured window only.
  const phenotypeMsAtStart = w.phenotypeMs;
  const lineageMsAtStart = w.lineageMs;
  // Phase totals are cumulative and include the warm-up ticks. Snapshot them so
  // every subsystem share is computed over the SAME window as the phenotype and
  // lineage deltas; mixing windows silently mis-attributes cost.
  const totAtStart = { ...w.totals };

  const heapBefore = process.memoryUsage();
  const t0 = performance.now();
  for (let i = warmup; i < s.ticks; i++) {
    const a = performance.now();
    w.step();
    const b = performance.now();
    tickTimes.push(b - a);
    pops.push(w.store.population);
    if (tracker) w.sampleLineages(tracker, w.tick);
  }
  const wallMs = performance.now() - t0;
  const heapAfter = process.memoryUsage();

  const sorted = [...tickTimes].sort((x, y) => x - y);
  const mean = tickTimes.reduce((s2, v) => s2 + v, 0) / Math.max(1, tickTimes.length);
  const tot = {
    abiotic: w.totals.abiotic - totAtStart.abiotic,
    fields: w.totals.fields - totAtStart.fields,
    spatial: w.totals.spatial - totAtStart.spatial,
    act: w.totals.act - totAtStart.act,
    contests: w.totals.contests - totAtStart.contests,
    deaths: w.totals.deaths - totAtStart.deaths,
    births: w.totals.births - totAtStart.births,
    total: w.totals.total - totAtStart.total,
  };
  const denominator = Math.max(1, tot.total);
  const phaseMs: Record<string, number> = {
    abiotic: tot.abiotic,
    fields: tot.fields,
    spatial: tot.spatial,
    act: tot.act,
    contests: tot.contests,
    deaths: tot.deaths,
    births: tot.births,
  };
  const phaseShares: Record<string, number> = {};
  for (const k of Object.keys(phaseMs)) phaseShares[k] = phaseMs[k] / denominator;

  const measured = Math.max(1, s.ticks - warmup);
  const measuredTicks = tickTimes.length;
  const derivations = w.store.phenotypeDerivations - derivationsStart;
  const meanPop = pops.reduce((s2, v) => s2 + v, 0) / Math.max(1, pops.length);
  const organismTicks = pops.reduce((s2, v) => s2 + v, 0);

  // --- Subsystem grouping -------------------------------------------------
  // Measured-window deltas, NOT cumulative totals: founder phenotype
  // derivation happened during construction and is charged to no tick phase,
  // so using the cumulative value would push `other` negative.
  const phenotypeMs = w.phenotypeMs - phenotypeMsAtStart;
  const lineageMs = w.lineageSampling ? w.lineageMs - lineageMsAtStart : 0;
  const subsystemMs: Record<Subsystem, number> = {
    // Ecology-field dynamics: the abiotic forcing and the substrate fields,
    // plus the spatial index they feed.
    ecologyFieldDynamics: tot.abiotic + tot.fields + tot.spatial,
    // Organism biology: sense, decide, move, metabolise, feed.
    organismBiology: tot.act,
    // Interaction resolution: contested contests.
    interactionResolution: tot.contests,
    // Lineage bookkeeping: aggregate lineage sampling, timed on its own axis.
    lineageBookkeeping: lineageMs,
    // Phenotype generation: procedural body derivation, on its own axis.
    phenotypeGeneration: phenotypeMs,
    // Rendering is deliberately absent: no renderer is loaded here.
    rendering: 0,
    // Deliberately NOT subtracting phenotypeMs: it is timed on a separate axis
    // and was never part of the death/birth phase totals, so subtracting it
    // would double-count and could drive this negative.
    other: tot.deaths + tot.births,
  };
  const subsystemShare = {} as Record<Subsystem, number>;
  const subsystemTotal =
    Object.values(subsystemMs).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(subsystemMs) as Subsystem[]) {
    subsystemShare[k] = subsystemMs[k] / subsystemTotal;
  }

  // --- Long-run degradation ----------------------------------------------
  // Compare the MIDDLE of the run against its end, not the beginning against
  // the end. The opening ticks are still inside JIT warm-up even after the
  // warm-up loop, so a first-vs-last ratio mostly measures compilation and can
  // come out BELOW 1 for a world that is actually slowing down. Middle-vs-last
  // answers the question we actually care about: does throughput decay as the
  // run progresses?
  const tailN = Math.max(1, Math.floor(measuredTicks / 5));
  const midStart = Math.floor(measuredTicks * 0.4);
  const midEnd = Math.floor(measuredTicks * 0.6);
  const mid = tickTimes.slice(midStart, Math.max(midStart + 1, midEnd));
  const tail = tickTimes.slice(measuredTicks - tailN);
  const midMs = mid.reduce((a, b) => a + b, 0) / mid.length;
  const lastFifthMs = tail.reduce((a, b) => a + b, 0) / tail.length;


  const composition: Record<string, number> = {};
  const motility: Record<string, number> = {};
  for (let slot = 0; slot < w.store.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const r = w.roleOf(slot);
    composition[TROPHIC_NAME[r.trophic]] = (composition[TROPHIC_NAME[r.trophic]] ?? 0) + 1;
    motility[MOTILITY_NAME[r.motility]] = (motility[MOTILITY_NAME[r.motility]] ?? 0) + 1;
  }
  for (const k of Object.keys(motility)) composition[`~${k}`] = motility[k];

  const res: ScenarioResult = {
    scenario: s,
    ticksPerSec: (measured / wallMs) * 1000,
    meanTickMs: mean,
    medianTickMs: percentile(sorted, 50),
    p99TickMs: percentile(sorted, 99),
    maxTickMs: sorted[sorted.length - 1] ?? 0,
    finalPopulation: w.store.population,
    peakPopulation: w.peakPopulation,
    meanPopulation: meanPop,
    phaseShares,
    phaseMs,
    phenotypeDerivations: derivations,
    phenotypePerKOrganismTick:
      (derivations / Math.max(1, organismTicks)) * 1000,
    heapUsedMB: heapAfter.heapUsed / 1048576,
    heapDeltaMB: (heapAfter.heapUsed - heapBefore.heapUsed) / 1048576,
    rssMB: heapAfter.rss / 1048576,
    accountingResidualPct: w.accountingResidualFraction() * 100,
    capHits: w.populationCapHits,
    subsystemMs,
    subsystemShare,
    degradationRatio: midMs > 0 ? lastFifthMs / midMs : 1,
    midMs,
    lastFifthMs,
    composition,
    complexity: {
      heritableTraits: TRAIT_COUNT,
      bodyPlanGenes: BODY_GENES.length,
      interactionKinds: 4,
      behaviouralOptions: 7,
      // Phenotype derivations per 1000 organism-ticks, not per live slot:
      // this is the rate that matters for whether birth cost dominates.
      meanLivePerOrganism: (derivations / Math.max(1, organismTicks)) * 1000,
    },
    lineageSamplingEnabled: w.lineageSampling,
  };

  if (verbose) {
    console.log(`\n--- ${s.founders} founders, ${measured} ticks, seed ${s.seed} ---`);
    console.log(`  throughput   ${res.ticksPerSec.toFixed(1)} ticks/s`);
    console.log(
      `  tick ms      mean ${res.meanTickMs.toFixed(3)}  median ${res.medianTickMs.toFixed(3)}  p99 ${res.p99TickMs.toFixed(3)}  max ${res.maxTickMs.toFixed(3)}`,
    );
    console.log(
      `  population   final ${res.finalPopulation}  peak ${res.peakPopulation}  mean ${res.meanPopulation.toFixed(0)}`,
    );
    console.log(
      `  us per organism-tick  ${((res.meanTickMs * 1000) / Math.max(1, res.meanPopulation)).toFixed(3)}`,
    );
    console.log('  phase share  ' + Object.entries(res.phaseShares)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`)
      .join('  '));
    console.log(
      `  phenotype    ${derivations} derivations, ${(res.phenotypePerKOrganismTick).toFixed(3)} per 1k organism-ticks`,
    );
    console.log(
      `  memory       heap ${res.heapUsedMB.toFixed(1)}MB (delta ${res.heapDeltaMB >= 0 ? '+' : ''}${res.heapDeltaMB.toFixed(1)}MB)  rss ${res.rssMB.toFixed(1)}MB`,
    );
    console.log(
      `  integrity    residual ${res.accountingResidualPct.toFixed(5)}%  capHits ${res.capHits}`,
    );
    console.log(
      `  degradation  mid40-60% ${res.midMs.toFixed(3)}ms -> last20% ${res.lastFifthMs.toFixed(3)}ms ` +
        `(ratio ${res.degradationRatio.toFixed(2)}${res.degradationRatio > 1.25 ? '  <-- DEGRADING' : ''})`,
    );
    console.log('  subsystem cost share (required separation):');
    for (const [k, v] of Object.entries(res.subsystemShare).sort((a, b) => (b[1] as number) - (a[1] as number))) {
      const ms = (res.subsystemMs as Record<string, number>)[k];
      console.log(`    ${k.padEnd(22)} ${(v * 100).toFixed(2).padStart(6)}%  ${ms.toFixed(1).padStart(9)}ms`);
    }
    console.log('  ecosystem composition: ' + Object.entries(res.composition)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join('  '));
  }
  return res;
}

/**
 * Micro-benchmark for phenotype derivation in isolation.
 * The Owner's protocol calls this out specifically, so it is measured without
 * the rest of the tick in the way.
 */
function benchPhenotype(iterations = 20000): void {
  // Full stride, not a hand-written 36. This benchmark allocates the genome the
  // simulation actually derives, so a short array would silently exclude the
  // trailing traits (nutrient affinities, dispersal, detritivory) from the
  // measured work and understate phenotype-derivation cost.
  const genome = new Float32Array(TRAIT_COUNT);
  const body = new Uint8Array(BODY_GENE_COUNT);
  for (let i = 0; i < TRAIT_COUNT; i++) genome[i] = Math.random();
  for (let i = 0; i < BODY_GENE_COUNT; i++) body[i] = 1 + Math.floor(Math.random() * 5);

  // Derivation reads a fresh genome each iteration so the work cannot be
  // hoisted or cached away by the engine.
  const sink = { n: 0 };
  for (let i = 0; i < 2000; i++) {
    genome[i % TRAIT_COUNT] = Math.random();
    sink.n += new Phenotype(genome, body, i).spine.length;
  }
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    genome[i % TRAIT_COUNT] = Math.random();
    sink.n += new Phenotype(genome, body, i).spine.length;
  }
  const ms = performance.now() - t0;
  console.log(
    `\nphenotype derivation (isolated): ${((ms / iterations) * 1000).toFixed(2)} us each, ` +
      `${iterations} iterations in ${ms.toFixed(1)}ms (sink ${sink.n})`,
  );
}

function parseArgs(argv: string[]): { ladder: number[]; ticks: number; seeds: number[]; quiet: boolean; world: number } {
  let ladder: number[] = [1000, 5000, 10000];
  let ticks = 120;
  let seeds = [11];
  let world = 4000;
  let quiet = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--ladder=')) ladder = a.slice(9).split(',').map((v) => parseInt(v, 10));
    else if (a.startsWith('--ticks=')) ticks = parseInt(a.slice(8), 10);
    else if (a.startsWith('--seeds=')) seeds = a.slice(8).split(',').map((v) => parseInt(v, 10));
    else if (a === '--quiet') quiet = true;
  }
  return { ladder, ticks, seeds, quiet, world };
}

function main(): void {
  const { ladder, ticks, seeds, quiet, world } = parseArgs(process.argv.slice(2));
  console.log(`=== headless simulation benchmark :: ${WORLD_ENGINE_VERSION} ===`);
  console.log(`node ${process.version} on ${process.platform}/${process.arch}, ${cpus().length} logical cpus`);
  console.log(`ladder ${ladder.join('/')}  ticks ${ticks}  seeds ${seeds.join('/')}  world ${world}^2`);
  console.log(`runtime: node ${process.version} ${process.platform}/${process.arch}`);
  console.log('NOTE: simulation capacity only. No renderer is loaded, so these are not FPS numbers.');

  const all: ScenarioResult[] = [];
  for (const seed of seeds) {
    for (const founders of ladder) {
      all.push(runScenario({ founders, ticks, seed, world }, !quiet));
    }
  }
  // One extra run with lineage aggregation on, so the amendment's
  // "lineage bookkeeping" cost is actually measured rather than reported as 0.
  if (ladder.length > 0) {
    console.log('\n--- lineage bookkeeping enabled ---');
    all.push(runScenario({ founders: ladder[0], ticks, seed: seeds[0], lineage: true, world }, !quiet));
  }

  console.log('\n=== summary ===');
  console.log('(subsystem shares are per-run; rendering is 0 because no renderer is loaded)');
  console.log('founders  ticks/s   mean ms   p99 ms   max ms   final pop   us/org-tick   heap MB');
  for (const r of all) {
    console.log(
      `${String(r.scenario.founders).padStart(8)}  ` +
        `${r.ticksPerSec.toFixed(1).padStart(7)}  ` +
        `${r.meanTickMs.toFixed(3).padStart(8)}  ` +
        `${r.p99TickMs.toFixed(3).padStart(7)}  ` +
        `${r.maxTickMs.toFixed(3).padStart(7)}  ` +
        `${String(r.finalPopulation).padStart(10)}  ` +
        `${((r.meanTickMs * 1000) / Math.max(1, r.meanPopulation)).toFixed(3).padStart(12)}  ` +
        `${r.heapUsedMB.toFixed(1).padStart(8)}`,
    );
  }

  const worstResidual = Math.max(...all.map((r) => Math.abs(r.accountingResidualPct)));
  const capHits = all.reduce((s, r) => s + r.capHits, 0);
  console.log(
    `\nworst |accounting residual| ${worstResidual.toFixed(5)}%  |  population-cap hits ${capHits}` +
      `${capHits > 0 ? '  (cap bound the ecology; interpret results with care)' : ''}`,
  );

  benchPhenotype();
}

main();