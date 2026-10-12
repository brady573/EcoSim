/**
 * Modular genome v2 — DNA as inherited biological INSTRUCTIONS.
 *
 * WHY THIS EXISTS. The v1 genome is two fixed vectors: 42 normalized traits and
 * 12 discrete body genes. Measured against the engine (see REPORT.md), only
 * THREE of the twelve structural genes change anything with a survival
 * consequence — `eyeCount` moves the sensing radius, `shell` and `spines` move
 * the collision radius. `limbPairs`, `fins`, `antennae`, `tail`, `segments` and
 * all four pigment genes are decorative: they are inherited, they mutate, and
 * nothing in the simulation reads them. Eight of twelve heritable structural
 * genes are appearance with no biology behind them.
 *
 * That is the limitation this module addresses. A v2 genome is a short ordered
 * sequence of MODULES, each one a construction instruction rather than a
 * property assignment:
 *
 *     BUILD light-capture structure x4
 *     BUILD locomotor appendage x2   (develops at maturity)
 *     BUILD sensory organ x1
 *     BUILD defense plate x1
 *
 * THE ONE RULE THAT MAKES THIS NOT DECORATION. Every module maps onto real
 * physiological traits AND carries a maintenance cost. Locomotor appendages
 * raise speed and maneuverability and raise basal upkeep. Sensory organs widen
 * detection and cost upkeep. Defense raises armour and mass and costs speed.
 * A capability that costs nothing would be selected for unconditionally and the
 * genome would be a thermometer, not an organism.
 *
 * DEVELOPMENT. Every module carries an onset, expressed as a fraction of
 * lifespan, and its contribution ramps in over a window after that onset. A
 * juvenile therefore expresses fewer structures than the adult carrying the
 * identical genome. This is the difference between a body plan and a life
 * history, and it is why development belongs in the genome rather than in a
 * hardcoded age table.
 *
 * CONDITION GATING. A module may additionally be gated on the organism's energy
 * fraction. The same genome in a starving body expresses a different phenotype
 * from the same genome in a fed body. Expression is therefore a function of
 * (genome, age, condition), not of genome alone.
 *
 * SCOPE AND HONESTY. A genome can only evolve capabilities the engine can
 * express. This module adds no new mechanism to the simulation: every effect
 * here is routed into the EXISTING 42 traits, so the trophic, competitive and
 * energy machinery is untouched and known. What is new is the heritable
 * structure that produces those trait values — instructions with costs, stages
 * and recombination, rather than independent dials.
 *
 * Null-default by construction: with `genomeV2` unset, no organism carries
 * modules and `expressModules` is never called. Declared behaviour is bit-for-bit
 * unchanged, which is what keeps the parity pins valid.
 */

/**
 * Module kinds — the instruction vocabulary.
 *
 * Deliberately a CLOSED set. An open instruction set that the engine can grow
 * would let a genome invent a capability nothing else can express, which is
 * novelty without consequence. Every kind below routes into traits that already
 * have consumers in the simulation.
 */
export const GENE_MODULE = {
  /** Body segment: mass and storage, upkeep proportional to bulk. */
  SEGMENT: 0,
  /** Photosynthetic surface: raises capture, raises upkeep. */
  LIGHT_CAPTURE: 1,
  /** Locomotor appendage: speed, burst, maneuverability, upkeep. */
  LOCOMOTOR: 2,
  /** Sensory organ: detection range, upkeep. */
  SENSORY: 3,
  /** Anchoring structure: resists displacement, blocks dispersal. */
  ANCHOR: 4,
  /** Defensive plating: armour and mass, costs speed. */
  DEFENSE: 5,
  /** Heterotrophic machinery: digestion and appetite, upkeep. */
  TROPHIC: 6,
} as const;

export const GENE_MODULE_COUNT = 7;

/** Human-readable kind names, used by probes and evidence exports. */
export const MODULE_NAMES: readonly string[] = [
  'segment', 'lightCapture', 'locomotor', 'sensory', 'anchor', 'defense', 'trophic',
];

/**
 * Hard ceiling on module count per genome.
 *
 * Bounded so the SoA block is a fixed stride (no per-organism allocation, no
 * linked lists, no compaction) and so genome length is a real constraint rather
 * than an unbounded tape. Duplication past the ceiling is rejected, which is
 * itself a selective pressure: a genome cannot become infinitely complex.
 */
export const MAX_MODULES = 16;

/** Width of the development ramp, as a fraction of lifespan. */
export const ONSET_WINDOW = 0.18;

/**
 * Per-module record layout. Flat, SoA-friendly, no objects.
 *
 *   kind  Uint8    index into GENE_MODULE
 *   mag   Float32  how much of the structure, in [0,1]
 *   onset Float32  developmental age fraction at which expression begins
 *   gate  Float32  energy fraction required; >= 1 means ungated
 */
export const MODULE_STRIDE_KIND = 0;
export const MODULE_STRIDE_MAG = 1;
export const MODULE_STRIDE_ONSET = 2;
export const MODULE_STRIDE_GATE = 3;
export const MODULE_STRIDE = 4;

export interface ModuleSpec {
  readonly kind: number;
  readonly name: string;
  /** Trait genes this module pushes UP, weighted by magnitude. */
  readonly gain: readonly (readonly [trait: number, weight: number])[];
  /** Trait genes this module pushes DOWN, weighted by magnitude. */
  readonly cost: readonly (readonly [trait: number, weight: number])[];
  /**
   * Basal upkeep per unit magnitude, as a gene delta.
   *
   * Every module carries one. This is what makes evolution have to choose: a
   * capability that costs nothing would be selected for unconditionally, and
   * the genome would become a thermometer rather than an organism.
   */
  readonly upkeep: number;
  /** Which v1 body gene this module feeds, for appearance and gape geometry. */
  readonly bodyGene: number;
  /** Body-gene units produced per unit magnitude. */
  readonly bodyGenePerMag: number;
}

// Trait indices are imported lazily to avoid a cycle: genome.ts does not depend
// on this module, and this module must not create a cycle back through it.
import { TRAIT } from './genome.js';

const T = TRAIT;

/**
 * The instruction table.
 *
 * `gain`/`cost` entries are GENE deltas in normalized [0,1] space applied per
 * unit of expressed magnitude. They are deliberately small: the 42 traits are
 * already free to range over their whole span, and a genome that dominated them
 * would replace trait evolution with module evolution rather than adding a
 * layer above it.
 */
export const MODULE_SPECS: readonly ModuleSpec[] = [
  {
    kind: GENE_MODULE.SEGMENT,
    name: 'segment',
    // Bulk is storage and survivable mass.
    gain: [[T.STORAGE_CAPACITY, 0.06], [T.SIZE, 0.05]],
    // More mass is more upkeep and less agility.
    cost: [[T.BASAL_COST, 0.030], [T.MANEUVERABILITY, 0.05]],
    upkeep: 0.030,
    bodyGene: 0, // SEGMENTS
    bodyGenePerMag: 6,
  },
  {
    kind: GENE_MODULE.LIGHT_CAPTURE,
    name: 'lightCapture',
    gain: [[T.PHOTOSYNTHETIC_RATE, 0.30]],
    cost: [[T.BASAL_COST, 0.022]],
    upkeep: 0.022,
    bodyGene: 0, // more photosynthetic surface reads as more segments
    bodyGenePerMag: 3,
  },
  {
    kind: GENE_MODULE.LOCOMOTOR,
    name: 'locomotor',
    gain: [[T.SPEED, 0.26], [T.BURST_POWER, 0.14], [T.MANEUVERABILITY, 0.12]],
    // Plating and mass aside, locomotion drags: a fast animal pays for it.
    cost: [[T.BASAL_COST, 0.020]],
    upkeep: 0.020,
    bodyGene: 1, // LIMB_PAIRS
    bodyGenePerMag: 4,
  },
  {
    kind: GENE_MODULE.SENSORY,
    name: 'sensory',
    gain: [[T.VISION_RANGE, 0.22], [T.THREAT_SENSE, 0.16], [T.NUTRIENT_SENSE, 0.16]],
    cost: [[T.BASAL_COST, 0.014]],
    upkeep: 0.014,
    bodyGene: 2, // EYE_COUNT
    bodyGenePerMag: 6,
  },
  {
    kind: GENE_MODULE.ANCHOR,
    name: 'anchor',
    // Anchoring buys terrain affinity and hardens the organism in place.
    gain: [[T.TERRAIN_AFFINITY, 0.22]],
    // ...and it is the cost of staying: an anchored organism cannot disperse.
    cost: [[T.DISPERSAL, 0.30], [T.BASAL_COST, 0.010]],
    upkeep: 0.010,
    bodyGene: 6, // ANTENNAE — non-zero mass for the holdfast
    bodyGenePerMag: 2,
  },
  {
    kind: GENE_MODULE.DEFENSE,
    name: 'defense',
    gain: [[T.ARMOR, 0.28], [T.SIZE, 0.03]],
    // Armour is mass. It costs speed and agility as well as upkeep.
    cost: [[T.BASAL_COST, 0.024], [T.SPEED, 0.14], [T.MANEUVERABILITY, 0.10]],
    upkeep: 0.024,
    bodyGene: 3, // SHELL
    bodyGenePerMag: 3,
  },
  {
    kind: GENE_MODULE.TROPHIC,
    name: 'trophic',
    gain: [[T.DIGESTION_RATE, 0.20], [T.FEEDING_APPETITE, 0.16], [T.CARRION_AFFINITY, 0.12]],
    cost: [[T.BASAL_COST, 0.018]],
    upkeep: 0.018,
    bodyGene: 5, // FINS — a feeding-associated outgrowth
    bodyGenePerMag: 3,
  },
];

/** Aggregate expressed magnitude per kind, plus total structural mass. */
export interface ModuleTally {
  /** Expressed magnitude per kind, indexed by GENE_MODULE. */
  readonly byKind: Float32Array;
  /** Sum of expressed magnitude across all kinds — the organism's structure. */
  readonly total: number;
  /** Sum of `upkeep * expressed magnitude` — the price of the body. */
  readonly upkeep: number;
}

/**
 * Development curve: how much of a module is expressed at a given age.
 *
 * Zero before onset, ramping linearly across ONSET_WINDOW of lifespan, one
 * after. Linear rather than logistic on purpose — a logistic is a smoother
 * fit for biomass and hides the juvenile/adult distinction that this whole
 * mechanism exists to express.
 */
export function developmentFactor(ageFraction: number, onset: number): number {
  if (ageFraction <= onset) return 0;
  const t = (ageFraction - onset) / ONSET_WINDOW;
  return t >= 1 ? 1 : t;
}

/**
 * Express a genome's modules into trait gene deltas and a body-gene map.
 *
 * @param modules flat per-organism module block, length MAX_MODULES * MODULE_STRIDE
 * @param count   number of populated modules in this block
 * @param ageFraction current age as a fraction of lifespan, in [0,1]
 * @param energyFraction current reserve as a fraction of capacity, in [0,1]
 * @param outDeltas receives one delta per TRAIT gene
 * @param outBodyGenes receives body-gene counts, indexed by BODY_GENE
 * @returns the tally of expressed structure and its upkeep price
 */
export function expressModules(
  modules: Float32Array,
  count: number,
  ageFraction: number,
  energyFraction: number,
  outDeltas: Float32Array,
  outBodyGenes: Uint8Array,
): ModuleTally {
  const byKind = new Float32Array(GENE_MODULE_COUNT);
  let total = 0;
  let upkeep = 0;

  for (let i = 0; i < count; i++) {
    const b = i * MODULE_STRIDE;
    const kind = modules[b + MODULE_STRIDE_KIND] | 0;
    const spec = MODULE_SPECS[kind];
    if (!spec) continue; // unreachable for a validated genome; fail-soft by design

    const onset = modules[b + MODULE_STRIDE_ONSET];
    const gate = modules[b + MODULE_STRIDE_GATE];

    // Developmental gating: not built yet.
    const dev = developmentFactor(ageFraction, onset);
    if (dev <= 0) continue;

    // Conditional gating: built but not expressed while the organism is starved.
    // The same genome yields a different body depending on condition, which is
    // what makes regulation more than a developmental timer.
    if (gate < 1 && energyFraction < gate) continue;

    const expressed = Math.max(0, Math.min(1, modules[b + MODULE_STRIDE_MAG])) * dev;
    if (expressed <= 0) continue;

    byKind[kind] += expressed;
    total += expressed;

    for (const [trait, w] of spec.gain) outDeltas[trait] += w * expressed;
    for (const [trait, w] of spec.cost) outDeltas[trait] -= w * expressed;

    const price = spec.upkeep * expressed;
    upkeep += price;
    // Upkeep is paid as basal cost, so it flows through the same accounting as
    // every other energy draw in the engine rather than a second ledger.
    outDeltas[T.BASAL_COST] += price;

    // Appearance follows biology: a structure that costs upkeep also shows.
    const genes = spec.bodyGenePerMag * expressed;
    outBodyGenes[spec.bodyGene] = Math.min(255, outBodyGenes[spec.bodyGene] + Math.round(genes));
  }

  return { byKind, total, upkeep };
}

/**
 * Validate a module block.
 *
 * A genome that fails here is rejected rather than clamped, because a clamped
 * instruction set produces a plausible organism that is not the one the genome
 * describes — the silent-validity failure mode this repository has hit before.
 */
export function validateModules(modules: Float32Array, count: number): string[] {
  const problems: string[] = [];
  if (count < 0 || count > MAX_MODULES) {
    problems.push(`module count ${count} outside [0,${MAX_MODULES}]`);
    return problems;
  }
  for (let i = 0; i < count; i++) {
    const b = i * MODULE_STRIDE;
    const kind = modules[b + MODULE_STRIDE_KIND];
    if (!Number.isInteger(kind) || kind < 0 || kind >= GENE_MODULE_COUNT) {
      problems.push(`module ${i} has unknown kind ${kind}`);
    }
    for (const [name, off] of [
      ['mag', MODULE_STRIDE_MAG],
      ['onset', MODULE_STRIDE_ONSET],
      ['gate', MODULE_STRIDE_GATE],
    ] as const) {
      const v = modules[b + off];
      if (!Number.isFinite(v)) problems.push(`module ${i} ${name} is not finite (${v})`);
      else if (v < 0 || v > 1) problems.push(`module ${i} ${name}=${v} outside [0,1]`);
    }
  }
  return problems;
}

/** True when a genome describes an organism with no expressed structure. */
export function isDegenerate(modules: Float32Array, count: number): boolean {
  for (let i = 0; i < count; i++) {
    if (modules[i * MODULE_STRIDE + MODULE_STRIDE_MAG] > 0.01) return false;
  }
  return true;
}

// ===========================================================================
// INHERITANCE — how modules are copied, mutated, duplicated and recombined
// ===========================================================================

import { Rng } from '../core/rng.js';

/**
 * Probability that a single module is structurally DUPLICATED on inheritance.
 *
 * Duplication is the operator that makes genuinely new body plans reachable:
 * copying a locomotor appendage turns one into two, which no amount of point
 * mutation on a fixed slot can do. Kept small because every duplicate costs
 * upkeep, so unchecked duplication is self-limiting rather than a runaway.
 */
export const DUP_RATE = 0.012;

/**
 * Probability that a single module is LOST on inheritance.
 *
 * The mirror of duplication and, in a resource-limited world, usually the
 * cheaper one. Loss is what lets a lineage shed a structure it cannot afford.
 */
export const DEL_RATE = 0.012;

/** Per-module gene sigma, scaled by the lineage's mutation rate. */
const MODULE_MUT_SIGMA = 0.22;

/** Write one module record. */
function put(
  dst: Float32Array, i: number, kind: number, mag: number, onset: number, gate: number,
): void {
  const b = i * MODULE_STRIDE;
  dst[b + MODULE_STRIDE_KIND] = kind;
  dst[b + MODULE_STRIDE_MAG] = mag;
  dst[b + MODULE_STRIDE_ONSET] = onset;
  dst[b + MODULE_STRIDE_GATE] = gate;
}

/** Read one module record into a scratch object. Cheaper than an array alloc. */
interface ModuleRec { kind: number; mag: number; onset: number; gate: number }

function read(src: Float32Array, i: number): ModuleRec {
  const b = i * MODULE_STRIDE;
  return {
    kind: src[b + MODULE_STRIDE_KIND] | 0,
    mag: src[b + MODULE_STRIDE_MAG],
    onset: src[b + MODULE_STRIDE_ONSET],
    gate: src[b + MODULE_STRIDE_GATE],
  };
}

/**
 * Seed a founder genome's modules.
 *
 * Founders are seeded with a plausible spread rather than a uniform draw over
 * the whole instruction space: a lineage that starts with four DEFENSE modules
 * and no sensory organ is not a founder, it is a corpse. This is a STARTING
 * CONDITION, not a fitness claim — selection still decides what survives, and
 * nothing rewards any particular founder for being a plausible one.
 */
export function seedFounderModules(rng: Rng, count: number): { modules: Float32Array; count: number } {
  const modules = new Float32Array(MAX_MODULES * MODULE_STRIDE);
  const n = Math.max(2, Math.min(MAX_MODULES, count));
  for (let i = 0; i < n; i++) {
    // Even coverage of the vocabulary at founding, so every instruction type is
    // reachable from the start and novelty does not depend on a lucky founder.
    const kind = i % GENE_MODULE_COUNT;
    put(
      modules, i, kind,
      0.3 + rng.nextFloat() * 0.5,
      rng.nextFloat() * 0.25,
      rng.nextFloat() < 0.25 ? 0.35 + rng.nextFloat() * 0.4 : 1,
    );
  }
  return { modules, count: n };
}

/**
 * Asexual + sexual inheritance of modules.
 *
 * @param rate01  lineage mutation strength in [0,1]; scales point mutation and
 *                is what a fast-mutating lineage pays for its exploration
 * @param dupRate probability per module of structural duplication
 * @param delRate probability per module of structural loss
 * @returns the number of modules written to `out`
 */
export function inheritModules(
  rng: Rng, parent: Float32Array, parentCount: number,
  out: Float32Array, rate01: number, dupRate = DUP_RATE, delRate = DEL_RATE,
): number {
  const sigma = rate01 * MODULE_MUT_SIGMA;
  let n = 0;

  for (let i = 0; i < parentCount; i++) {
    const m = read(parent, i);

    // Structural loss. Losing the last copy of an affordable structure is a
    // real and common outcome; it is not an error state.
    if (rng.chance(delRate)) continue;

    // Point mutation on the instruction's own parameters.
    let mag = m.mag + rng.gaussian(0, sigma);
    let onset = m.onset + rng.gaussian(0, sigma * 0.6);
    let gate = m.gate;
    if (gate < 1) gate += rng.gaussian(0, sigma * 0.5);

    // Rare kind substitution: a different structure at the same slot. Cheap
    // novelty, and bounded because the vocabulary is closed.
    let kind = m.kind;
    if (rng.chance(rate01 * 0.05)) kind = rng.int(GENE_MODULE_COUNT);

    if (n < MAX_MODULES) {
      put(out, n++, kind, clamp01(mag), clamp01(onset), clamp01(gate));
    }

    // Structural duplication, if there is room. Refused at the ceiling, so
    // genome length is a genuine constraint rather than an unbounded tape.
    if (n < MAX_MODULES && rng.chance(dupRate)) {
      put(out, n++, kind, clamp01(mag * (0.8 + rng.nextFloat() * 0.4)), clamp01(onset), clamp01(gate));
    }
  }
  return n;
}

/**
 * Single-point crossover of two module sequences.
 *
 * This is the mechanism the v1 genome lacks entirely: birth draws from ONE
 * parent, so mating has never mixed genes. Crossover is taken at a module
 * boundary rather than inside a record, because a half-copied instruction is not
 * a weaker instruction, it is an undefined one.
 *
 * Compatibility is handled by bounded genome length rather than by a rejection
 * test: each parent's sequence is already within limits, so any prefix of A
 * followed by any suffix of B is also within limits. There is no illegal
 * offspring to reject, which is the simplest form of the compatibility rule the
 * design calls for, and it is stated rather than assumed.
 */
export function recombineModules(
  rng: Rng,
  a: Float32Array, aCount: number,
  b: Float32Array, bCount: number,
  out: Float32Array, rate01: number,
): number {
  if (aCount === 0) {
    for (let i = 0; i < bCount && i < MAX_MODULES; i++) copyRec(read(b, i), out, i);
    return Math.min(bCount, MAX_MODULES);
  }
  if (bCount === 0) {
    for (let i = 0; i < aCount && i < MAX_MODULES; i++) copyRec(read(a, i), out, i);
    return Math.min(aCount, MAX_MODULES);
  }

  // Crossover point strictly inside, so both parents contribute. A whole-
  // genome take is a legitimate outcome of this operator, not a special case.
  const cut = 1 + rng.int(Math.max(1, Math.min(aCount - 1, MAX_MODULES - 1)));
  const sigma = rate01 * MODULE_MUT_SIGMA;

  let n = 0;
  for (let i = 0; i < aCount && n < cut && n < MAX_MODULES; i++) {
    const m = read(a, i);
    put(out, n++, m.kind, clamp01(m.mag + rng.gaussian(0, sigma * 0.5)), clamp01(m.onset), m.gate);
  }
  for (let i = cut; i < bCount && n < MAX_MODULES; i++) {
    const m = read(b, i);
    put(out, n++, m.kind, clamp01(m.mag + rng.gaussian(0, sigma * 0.5)), clamp01(m.onset), m.gate);
  }
  return n;
}

function copyRec(m: ModuleRec, dst: Float32Array, i: number): void {
  put(dst, i, m.kind, m.mag, m.onset, m.gate);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Structural diversity of a genome: distinct module kinds present.
 *
 * Used by probes to show that duplication and deletion actually changed the body
 * plan rather than only reordering a fixed set.
 */
export function distinctKinds(modules: Float32Array, count: number): number {
  let seen = 0;
  for (let k = 0; k < GENE_MODULE_COUNT; k++) {
    for (let i = 0; i < count; i++) {
      if ((modules[i * MODULE_STRIDE + MODULE_STRIDE_KIND] | 0) === k) { seen++; break; }
    }
  }
  return seen;
}
