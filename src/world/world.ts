/**
 * The experimental ecosystem world.
 *
 * One `tick()` is a fixed nine-phase pipeline. Phase order is load-bearing for
 * determinism and for causal correctness, not stylistic:
 *
 *   1 abiotic   slow forcing axis + disturbance ageing
 *   2 fields    nutrient/detritus transport, decay, recycling, organic input
 *   3 spatial   rebuild the neighbour hash
 *   4 act       sense -> decide -> move -> metabolise -> feed  (NO deaths,
 *               NO births in this phase)
 *   5 contests  resolve every queued contested interaction, id-ordered
 *   6 propose   reproduction decisions -> a birth queue
 *   7 deaths    mark dead, convert corpses to detritus, RELEASE slots
 *   8 births    allocate slots and populate newborns
 *   9 account   snapshot metrics
 *
 * Why deaths precede births: interaction targets are slot indices captured in
 * phase 4. If a slot were released in phase 7 and immediately reallocated to a
 * newborn in phase 8, then nothing would break — but if release and realloc
 * happened inside phases 5-6, a contest could be applied to a newborn that
 * shares a slot with a corpse. Separating 7 and 8 makes slot recycling safe by
 * construction rather than by careful bookkeeping.
 *
 * LIMITATIONS are documented per-subsystem and collected in REPORT.md. The
 * important ones: energy is a scalar, not a conserved chemical cycle; there is
 * no individual ageing trajectory beyond linear damage; and crowding is
 * modelled as a local density penalty rather than explicit interference.
 */

import {
  MAX_MODULES, MODULE_STRIDE, inheritModules, recombineModules, seedFounderModules,
} from '../bio/modgenome.js';
import { Rng } from '../core/rng.js';
import { ScalarField } from '../core/field.js';
import { SpatialGrid } from '../core/spatial.js';
import { OrganismStore, BODY_GENE_COUNT, ROLE_STRIDE, NUTRIENT_COUNT } from '../core/soa.js';
import { RollingDigest } from '../core/hash.js';
import { TRAIT, TRAITS, BODY_GENES, TRAIT_COUNT, type TraitSpec } from '../bio/genome.js';
import { Phenotype, resolveCapacity } from '../bio/phenotype.js';
import { HabitatMap } from '../bio/habitat.js';
import { deriveRole, developmentalScale, stageDamageFactor, MOTILITY, TROPHIC, TROPHIC_COUNT, MINERAL_PHENO_CLASS_COUNT, classifyMineralPheno, type RoleReadout } from '../bio/role.js';
import { TraceLog, TRACE, DEATH_CAUSE, type TraceOptions } from '../trace/trace.js';
import { REPRO_GATE, type ReproProbe } from '../trace/reproprobe.js';
import { InteractionQueue, INTERACTION, OUTCOME, type ResolutionRecord } from '../bio/interactions.js';
import { resolveConfig, type WorldConfig, type DormantSenescence } from './config.js';
import { Ledger } from './ledger.js';
import { AbioticDriver, emptyModifiers, type AbioticModifiers } from './disturbances.js';
import { WorldHistory, LineageTracker } from './history.js';

/** Damage at or above which an organism dies. */
export const FATAL_DAMAGE = 100;
/**
 * Viability damage dealt by one diseased meal (diagnostic foodDisease knob).
 * Starvation scale is ~0.9/tick and the breeding bar is 45: one bad meal is
 * ~7 starving ticks — survivable singly, lethal in streaks. Fixed starting
 * calibration, documented, not yet its own knob.
 */
const DISEASE_DAMAGE_PER_MEAL = 6.0;
/**
 * Patch occupants at which food-disease pressure saturates to the full knob
 * rate. A 600x600-unit patch holding ~300 organisms is a genuine crowd;
 * lone eaters see a small fraction of the rate (immune in practice).
 * Starting calibration — the probe's diseased-meal counts are the signal
 * (zero everywhere = too high; saturated everywhere = too low).
 */
const DISEASE_DENSE_PATCH = 300;

/**
 * How often, in ticks, a given organism's cached role/stage readout is
 * recomputed. Staggered by the organism's own age so the work spreads evenly
 * across the population instead of spiking on one tick.
 */
const ROLE_REFRESH_EVERY = 16;

/**
 * Ticks of maintenance an organism must be able to fund from stored energy
 * before it may reproduce.
 *
 * This is a drought/famine buffer: an organism that breeds on its last
 * reserves is gambling the parent's survival on the offspring's. Real
 * life-history strategies gate reproduction on condition, not on a fixed
 * threshold alone.
 */
const REPRO_SURPLUS_TICKS = 90;

/**
 * Fasting-tolerance grace for starvation damage, in consecutive-deficit ticks.
 *
 * REAL-WORLD EQUIVALENT (Owner constraint 2026-10-12): body reserves. Real
 * animals do not take damage the instant expenditure exceeds intake; glycogen
 * and fat buffer brief deficits and wasting begins after reserves deplete.
 * GRACE is the reserve depth: inter-meal troughs are forgiven, sustained
 * deficit still kills at full rate. Lump-income grazers that oscillate across
 * their own upkeep survive their troughs; trickle feeders never notice. This
 * is what makes the gate reward condition rather than income smoothness.
 * Owner-tunable 4-8 on measured need; 6 covers a missed-browse window without
 * forgiving true inability-to-pay (sustained deficit still kills in
 * ~110-300 ticks, preserving the anti-expansion invariant the
 * deficit-proportional rule was built for).
 */
const STARVE_GRACE_TICKS = 6;

/**
 * Breeding-surplus buffer in ticks, from config when set.
 *
 * Exposed as a diagnostic because it is the gate that decides whether ANY
 * guild can reproduce, and it was previously unreachable: a hardcoded
 * constant at both breeding sites, so no config knob could move it. That
 * matters because it is the identified blocker on consumer viability — a
 * consumer must hold 90 ticks of full-rate surplus, which no amount of
 * graze or predation income reaches (measured: consumers extinct at every
 * food-transfer rung of the 18-seed ladder, and consumerBasalScale cannot
 * help because it discounts cost, not the reserve demanded here).
 *
 * null = declared 90. Returned through one helper so the two breeding sites
 * and any future site cannot drift apart.
 */
function resolveReproSurplusTicks(cfg: WorldConfig): number {
  const v = cfg.reproSurplusTicks;
  if (v === null || v === undefined) return REPRO_SURPLUS_TICKS;
  if (!Number.isFinite(v) || v < 0) {
    throw new Error(`bad reproSurplusTicks: ${JSON.stringify(v)} (want >=0 or null)`);
  }
  return v;
}

/**
 * Fraction of offspring that disperse far from the parent.
 *
 * Seed rain is highly local: most propagules land within a short distance of the
 * parent, and only a small share travel far. 4 % is in the range reported for
 * wind- and animal-mediated long-distance dispersal in closed-canopy systems,
 * and it is high enough to let a lineage colonise new patches while keeping most
 * recruitment inside the parental stand.
 */
const LONG_RANGE_DISPERSAL = 0.04;



/** Behavioural intents, resolved from trait-weighted utility scores. */
export const INTENT = {
  FEED: 0,
  HUNT: 1,
  SCAVENGE: 2,
  FLEE: 3,
  MATE: 4,
  SETTLE: 5,
  EXPLORE: 6,
  GRAZE: 7,
} as const;

export const INTENT_NAME: Record<number, string> = {
  0: 'feed',
  1: 'hunt',
  2: 'scavenge',
  3: 'flee',
  4: 'mate',
  5: 'settle',
  6: 'explore',
};

/** Per-subsystem timing, in milliseconds. */
export interface PhaseTimings {
  abiotic: number;
  fields: number;
  spatial: number;
  act: number;
  contests: number;
  deaths: number;
  births: number;
  total: number;
}

/**
 * The four books kept for every biotic nutrient RETURN, per (guild, pool[,
 * source]).
 *
 * They exist because the pre-0.6.3 measurement collapsed two unrelated events
 * into one signed number. `ScalarField.step()` diffusion runs after the
 * regeneration clamp, so a cell routinely sits above its own per-pool cap when
 * a return arrives; the old `min(cap, before + in) - before` then goes negative
 * and reports ceiling deletion as biological recycling.
 *
 *   attempted  what the process meant to deliver   (always >= 0)
 *   accepted   what actually entered the pool      (always >= 0)
 *   capLoss    attempted - accepted, refused by the cap (always >= 0)
 *   eviction   pre-existing excess the clamp deleted (always >= 0)
 *
 * Two exact identities make the set auditable rather than merely plausible:
 * `accepted - eviction` is the observed pool delta, and `accepted + capLoss` is
 * `attempted`. Both hold per return and therefore in aggregate.
 */
export interface ReturnBooks<T> {
  /** What the process meant to deliver. Always >= 0. */
  attempted: T;
  /** What actually entered the pool. Always >= 0. */
  accepted: T;
  /**
   * attempted - accepted, refused by the per-pool ceiling.
   *
   * Accumulated as the subtraction itself, so it can land a few ulps below
   * zero when the two nearly match (measured worst ~-1e-15 over a full run).
   * It is NOT clamped, because clamping would break
   * `attempted == accepted + capLoss`, and the exact identity is the stronger
   * claim. G32 holds non-negativity to double-precision cancellation for the
   * same reason.
   */
  capLoss: T;
  /**
   * Pre-existing excess the clamp deleted. Always >= 0, and never biology's
   * doing. Non-zero means the cell was already over its ceiling when the
   * return arrived: either because diffusion ran it there, or because float32 storage
   * rounded a clamped cell a fraction of an ulp past the ceiling. (Seeding
   * can never create over-cap: seed = cap * jitter * 0.55 with jitter <= 1.3719.)
   */
  eviction: T;
}

export interface WorldSnapshot {
  tick: number;
  population: number;
  births: number;
  deaths: number;
  extinctions: number;
  biomass: number;
  detritus: number;
  /** Benthic detritus reservoir, where organic matter concentrates. */
  sediment: number;
  /** Recalcitrant benthic litter: the structural, non-digestible-by-animals fraction. */
  litter: number;
  nutrient: number;
  meanEnergy: number;
  meanSize: number;
  trophicProducers: number;
  trophicConsumers: number;
  trophicApex: number;
  meanGeneration: number;
  contestedInteractions: number;
  activeDisturbances: number;
}

export interface WorldOptions {
  config?: Partial<WorldConfig>;
  /** Collect history samples every N ticks. 0 disables. */
  historyEvery?: number;
  /**
   * Event tracing. Disabled by default. Enabling records a bounded, read-only
   * event log and MUST NOT change any simulation outcome — see src/trace.
   */
  trace?: TraceOptions;
  /**
   * Optional reproduction-gate probe. Purely observational and MUST NOT change
   * any simulation outcome — see src/trace/reproprobe. Null when absent.
   */
  reproProbe?: ReproProbe;
}

export class World {
  readonly config: WorldConfig;
  readonly rng: Rng;
  readonly store: OrganismStore;
  readonly ledger = new Ledger();
  readonly history: WorldHistory;
  readonly abiotic: AbioticDriver;

  /**
   * Three independently limiting abiotic nutrients.
   *
   * Deliberately three, not one. Competitive exclusion means coexistence of p
   * species is impossible when fewer than p resources are limiting, so a
   * single-nutrient substrate makes a stable food web mathematically
   * impossible rather than merely hard to tune. See RESEARCH.md.
   */
  readonly nutrients: ScalarField[];
  /** Coarse detritus pool suspended in the water column. */
  readonly detritus: ScalarField;
  /**
   * Benthic sediment detritus.
   *
   * Real detritus-based food webs are benthic: organic matter CONCENTRATES in
   * sediment where deposit feeders meet it at usable concentration. Without a
   * concentrating compartment, detritus spread uniformly over a field is orders
   * of magnitude too dilute for a consumer to live on, which is the measured
   * bootstrap deadlock. This field does not diffuse, so it concentrates by
   * construction. See RESEARCH.md.
   */
  readonly sediment: ScalarField;

  /**
   * Recalcitrant benthic litter: the structural, lignified fraction of dead
   * organic matter. Animals cannot digest it; decomposers can.
   *
   * Third organic pool, distinct from `detritus` (suspended labile) and
   * `sediment` (benthic labile). Its purpose is niche separation: it gives the
   * decomposer guild material that no scavenger can reach, which is what lets
   * both coexist instead of one eliminating the other.
   */
  readonly litter: ScalarField;

  /** Total abiotic nutrient across all limiting pools, for reporting. */
  nutrientTotal(): number {
    let t = 0;
    for (const f of this.nutrients) t += f.total();
    return t;
  }
  /**
   * Static, seeded habitat properties. `habitat` carries heterogeneous
   * carrying capacity; `shade` carries light attenuation. Together they make
   * succession, displacement, and collapse reachable outcomes rather than
   * narrated ones.
   */
  readonly habitat: HabitatMap;

  /** Neighbour index. */
  private grid: SpatialGrid;

  /** Live-slot flag, indexed by slot. Mirrors the store's free list. */
  private live: Uint8Array<ArrayBuffer>;
  /**
   * Dormancy flag per slot. Set during actPhase feeding evaluation, read by
   * basal upkeep (next tick, 1-tick lag), starvation damage (same tick),
   * sensing costs (next tick), and breeding proposals (same tick, Phase 6).
   * Only decomposers can be dormant, and only when the diagnostic knob is set.
   * Freshly evaluated every tick for every live slot, so no clearing on slot
   * reuse is needed: actPhase overwrites before any read.
   */
  private dormant: Uint8Array<ArrayBuffer>;
  /**
   * Consecutive dormant ticks per slot (sleep clock). Advances each tick the
   * slot stays dormant; resets on waking. Drives dormant senescence when the
   * knob is set. Mixed into hashState: unlike dormant[] (a recomputed cache),
   * the clock carries history, so omitting it would let divergent sleep
   * histories share a digest.
   */
  private dormantSleep: Uint32Array;
  /**
   * Consecutive energy-deficit ticks per slot (fasting clock). Advances each
   * tick the slot spends below upkeep, resets on any paid tick or while
   * dormant (waiting is not a deficit). Scales starvation damage from 0 to
   * full over STARVE_GRACE_TICKS: the fasting-tolerance reserve. Mixed into
   * hashState like dormantSleep: unlike recomputed caches, the clock carries
   * history, so omitting it would let divergent fasting histories share a
   * digest. Cleared on slot reuse.
   */
  private starveStreak: Uint16Array;
  /**
   * Cumulative senescence damage per slot, parallel to store.starveDamage.
   * Attribution-only (killing runs through store.damage); never reset on
   * waking, cleared only on slot reuse — like starveDamage, it records the
   * load the organism carries, not the current sleep.
   */
  private senesceDamage: Float32Array;
  /**
   * Cumulative disease damage per slot, parallel to senesceDamage. Same
   * contract: attribution-only, cleared only on slot reuse, unhashed.
   */
  private diseaseDamage: Float32Array;
  /** Cumulative diseased meals (rolled diseased, whether or not they killed). */
  diseaseMeals = 0;
  /** Cumulative deaths whose largest damage share is disease. Exact. */
  diseaseDeaths = 0;
  /**
   * Pioneer grace remaining per slot (ticks), parallel to dormantSleep.
   * Granted at birth to flip newborns (guild != parent guild) when the
   * pioneerBonus knob is set; magnitude of the subsidy is fixed at grant in
   * pioneerVoid. Cleared on slot reuse. Unhashed (derived from census).
   */
  private pioneerTicks: Uint16Array;
  /**
   * Destination-guild void (0..1) captured at the flip birth: 1 for an
   * extinct guild, ~0 for a dominant one. Fixed for the grace period.
   */
  private pioneerVoid: Float32Array;
  /** Cumulative flip births granted pioneer grace. Observation only. */
  pioneerGrants = 0;
  /** Pioneer grants by destination guild. Observation only. */
  pioneerGrantsByGuild = [0, 0, 0];
  /**
   * Dormant fraction of the live population, recomputed every tick in Phase 3
   * from last tick's dormancy flags (1-tick lag, negligible for a slow state
   * — same precedent as basal/sensing reads). Drives share-mode senescence.
   */
  private dormantFrac = 0;
  /** Resolved senescence setting (constructor-normalised; user config untouched). */
  private senescence: DormantSenescence | null = null;
  /**
   * Breeding-surplus buffer in ticks. Resolved once in the constructor from
   * config (declared 90 when null) and read by BOTH breeding gates, so the
   * two can never disagree about how much reserve reproduction demands.
   */
  private reproSurplus = REPRO_SURPLUS_TICKS;
  /** Monotonic id allocator. */
  private nextId = 1;

  // --- Per-tick scratch, allocated once. -----------------------------------
  private neighbourScratch: Int32Array;
  private preyTarget: Int32Array<ArrayBuffer>;
  /** Nearest living producer in range, for herbivory. */
  private grazeTarget: Int32Array<ArrayBuffer>;
  private threatTarget: Int32Array<ArrayBuffer>;
  private mateTarget: Int32Array<ArrayBuffer>;
  private intent: Uint8Array<ArrayBuffer>;
  private localMods: AbioticModifiers;
  /** Reused behaviour-utility scratch. Fixed at INTENT_COUNT options. */
  private intentScores = new Float64Array(8);

  /**
   * Mating contacts collected during actPhase, resolved once the whole phase
   * has run. A contact is only a CANDIDATE here: neither organism's final
   * intent is authoritative until every slot has acted, because actPhase walks
   * slots in order and a partner with a higher slot index has not chosen yet
   * at the moment the contact is recorded.
   */
  private mateCandA = new Int32Array(1024);
  private mateCandB = new Int32Array(1024);
  private mateCandN = 0;

  /** Live-packed position/slot arrays for the spatial index build. */
  private packedX = new Float32Array(4096);
  private packedY = new Float32Array(4096);
  private packedSlots = new Int32Array(4096);

  /**
   * Copy live organisms into dense position/slot arrays.
   * Returns the number packed. Allocates only when capacity is exceeded.
   */
  private packLivePositions(): number {
    const store = this.store;
    let n = 0;
    let dormantN = 0;
    for (let slot = 0; slot < store.count; slot++) {
      if (!this.live[slot]) continue;
      // Last tick's dormancy flags (evaluation runs later this tick): 1-tick
      // lag, negligible for a slow state. Feeds share-mode senescence.
      if (this.dormant[slot] === 1) dormantN++;
      if (n >= this.packedX.length) {
        const cap = this.packedX.length * 2;
        this.packedX = new Float32Array(cap);
        this.packedY = new Float32Array(cap);
        this.packedSlots = new Int32Array(cap);
      }
      this.packedX[n] = store.x[slot];
      this.packedY[n] = store.y[slot];
      this.packedSlots[n] = slot;
      n++;
    }
    this.dormantFrac = n > 0 ? dormantN / n : 0;
    return n;
  }

  /**
   * Disease roll on a biomass meal (diagnostic foodDisease knob). With the
   * knob's probability, the meal is diseased: fixed viability damage plus an
   * exact attribution trail (diseaseDamage accumulator, diseasedMeals count).
   * Photosynthesis and mineral uptake never call here — light and minerals
   * are not food. Draws from the main RNG stream, so knob-on runs diverge
   * from knob-off by stream position while staying exactly deterministic per
   * seed+config. Callers pass taken > 0 (no roll on unfed contact).
   */
  /**
   * Local disease pressure for a biomass meal: the knob rate scaled by patch
   * occupancy (0 in empty patches = immune; saturating at DISEASE_DENSE_PATCH
   * occupants). The patch census is rebuilt every tick in Phase 3, so this is
   * fresh at every intake site including the contest-application phase —
   * uniform semantics everywhere: disease follows crowds. Grid disabled falls
   * back to the flat rate (documented).
   */
  private diseasePressure(slot: number): number {
    const p = this.config.foodDisease;
    if (p === null || p === undefined || p <= 0) return 0;
    const cols = this.patchCols;
    if (cols <= 0 || this.patchCensus.length === 0) return p;
    const store = this.store;
    let cx = ((store.x[slot] * cols) / this.config.worldW) | 0;
    let cy = ((store.y[slot] * this.patchRows) / this.config.worldH) | 0;
    if (cx < 0) cx = 0;
    else if (cx >= cols) cx = cols - 1;
    const rows = this.patchRows;
    if (cy < 0) cy = 0;
    else if (cy >= rows) cy = rows - 1;
    const idx = cy * cols + cx;
    let occ = 0;
    for (let g = 0; g < TROPHIC_COUNT; g++) occ += this.patchCount(idx, g);
    return Math.min(1, p * occ / DISEASE_DENSE_PATCH);
  }

  /**
   * Pioneer upkeep factor for a slot: 1 when the knob is off or no grace
   * remains, otherwise (1 - discount * void-at-grant). Pure read — no RNG,
   * no writes — so it is safe at every upkeep site (basal charge,
   * starvation threshold, breeding-surplus bar). Deterministic per
   * seed+config; knob-off path returns exactly 1.
   */
  /**
   * Consumer upkeep multiplier applied to the VIABILITY gates as well as the
   * charge. Returns 1 when the knob is unset, so declared behaviour and every
   * pinned value are unchanged.
   *
   * This exists because consumerBasalScale was half-wired: it scaled only the
   * basal CHARGE (world.ts basal site), leaving the starvation threshold and
   * the breeding-surplus gate demanding the FULL-rate reserve. A consumer
   * could therefore be charged a quarter of upkeep and still starve at the
   * full threshold, and still be refused breeding for lacking a full-rate
   * surplus — so the knob could not rescue consumers by construction, and
   * every "consumers need photox4" conclusion measured through it is
   * unverified. See REPORT.md.
   *
   * Routed through one shared helper for the same reason pioneerFactor exists:
   * a cost discount that does not reach the gates is a bug wearing a knob's
   * clothes, and the two must never be able to disagree.
   */
  private consumerUpkeepFactor(slot: number): number {
    const c = this.config.consumerBasalScale;
    if (c === null || c === undefined) return 1;
    return this.roleOf(slot).trophic === 1 ? c : 1;
  }

  private pioneerFactor(slot: number): number {
    const pb = this.config.pioneerBonus;
    if (pb === null || pb === undefined || pb.discount <= 0) return 1;
    if (this.pioneerTicks[slot] <= 0) return 1;
    return 1 - pb.discount * this.pioneerVoid[slot];
  }

  /**
   * Pioneer grant at a flip birth: newborn guild differs from parent guild.
   * Void is the destination guild's global share from the per-tick patch
   * census (rebuilt before births are placed, so fresh and excluding
   * same-tick newborns): void = 1 - destShare, 1 for an extinct guild.
   * Grid disabled (no census) grants nothing — unmeasurable void, documented.
   */
  private pioneerGrant(slot: number, newbornGuild: number): void {
    const pb = this.config.pioneerBonus;
    if (pb === null || pb === undefined || pb.grace <= 0) return;
    if (this.patchCensus.length === 0) return;
    let dest = 0;
    let total = 0;
    const patches = this.patchCols * this.patchRows;
    for (let p = 0; p < patches; p++) {
      for (let g = 0; g < TROPHIC_COUNT; g++) total += this.patchCount(p, g);
      dest += this.patchCount(p, newbornGuild);
    }
    const share = total > 0 ? dest / total : 0;
    this.pioneerTicks[slot] = Math.max(0, Math.min(65535, Math.floor(pb.grace)));
    this.pioneerVoid[slot] = 1 - share;
    this.pioneerGrants++;
    this.pioneerGrantsByGuild[newbornGuild]++;
  }

  private diseaseRoll(store: OrganismStore, slot: number, meal: number): void {
    if (meal <= 0) return;
    const peff = this.diseasePressure(slot);
    if (peff <= 0) return;
    if (!this.rng.chance(peff)) return;
    store.damage[slot] += DISEASE_DAMAGE_PER_MEAL;
    this.diseaseDamage[slot] += DISEASE_DAMAGE_PER_MEAL;
    this.diseaseMeals++;
  }
  /** 1 where the organism converts assimilated detritus into substrate nutrient. */
  bioticMineraliser = new Uint8Array(1024);

  /**
   * Dense lineage registry.
   *
   * Recombination mints lineage identity from a HASH of the two parent
   * lineages, so the raw key space is sparse and effectively unbounded (order
   * 1e9). Lineage bookkeeping aggregates per-lineage over dense arrays, so
   * storing the raw key there would attempt an allocation proportional to the
   * hash space — tens of gigabytes — and abort the run.
   *
   * Fix: keep the biological key as the identity, and map it to a small dense
   * index for bookkeeping. This is what makes lineage aggregation scale with
   * the number of DISTINCT LINEAGES (hundreds), not with the key space.
   */
  private lineageIndex = new Map<number, number>();
  private lineageKeys: number[] = [];
  private nextLineageIndex = 0;

  /** Map a (possibly sparse) biological lineage key to its dense index. */
  private denseLineage(key: number): number {
    const existing = this.lineageIndex.get(key);
    if (existing !== undefined) return existing;
    const idx = this.nextLineageIndex++;
    this.lineageIndex.set(key, idx);
    this.lineageKeys.push(key);
    return idx;
  }

  /** Biological lineage key behind a dense index, for reporting and export. */
  lineageKeyOf(denseIndex: number): number {
    return this.lineageKeys[denseIndex] ?? -1;
  }

  /** Number of distinct lineages seen. */
  get lineageCount(): number {
    return this.nextLineageIndex;
  }

  /**
   * Snapshot of per-pool, per-guild nutrient flux accumulators.
   * Returns plain objects for external probe consumption.
   * Layouts:
   *   photoUptake[guild][pool]
   *   excretionReturns: ReturnBooks (guild x pool x {attempted, accepted,
   *       capLoss, eviction})
   *   bioticMineralization: ReturnBooks (guild x pool x source x {..})
   *   abioticRegen[pool]
   *   abioticMineralization[pool][source]  source: 0=detritus, 1=sediment, 2=litter
   */
  /**
   * The four books kept for every biotic nutrient RETURN, grouped so they can
   * only be read together.
   *
   * The grouping is the point. The pre-0.6.3 snapshot exposed ONE signed number
   * per (guild, pool[, source]) under the name "returns", which forced any
   * reader to treat a quantity that can be negative as a biological return.
   * Carrying all four side by side makes that misreading structurally harder
   * and keeps the two exact identities visible:
   *
   *   observed delta == accepted - eviction
   *   attempted      == accepted + capLoss
   *
   * `T` is `number[][]` for excretion (guild x pool) and `number[][][]` for
   * biotic mineralisation (guild x pool x source).
   */
  getFluxSnapshot(): {
    photoUptake: number[][];
    excretionReturns: ReturnBooks<number[][]>;
    bioticMineralization: ReturnBooks<number[][][]>;
    bioticMineralizationByPheno: ReturnBooks<number[][][][]>;
    bioticMineralizationShadow: ReturnBooks<number[][][][]>;
    exogenousReplacement: ReturnBooks<number[][][][]>;
    abioticRegen: number[];
    abioticMineralization: number[][];
  } {
    const photoUptake: number[][] = [];
    const excretionReturns: ReturnBooks<number[][]> = {
      attempted: [], accepted: [], capLoss: [], eviction: [],
    };
    const bioticMineralization: ReturnBooks<number[][][]> = {
      attempted: [], accepted: [], capLoss: [], eviction: [],
    };
    // O3: per-event attribution by expressed donor class [class][guild][pool][source].
    // Partitions bioticMineralization: old[g][p][src] == sum over classes. See G33.
    const bioticMineralizationByPheno: ReturnBooks<number[][][][]> = {
      attempted: [], accepted: [], capLoss: [], eviction: [],
    };
    // O1 shadow: UNSCALED would-be offers, same shape. Equals the pheno family
    // per cell on null/unset runs (G34 asserts); the suppressed-run difference
    // is the pool/source/class-local forgone return. See G34.
    const bioticMineralizationShadow: ReturnBooks<number[][][][]> = {
      attempted: [], accepted: [], capLoss: [], eviction: [],
    };
    // O2: exogenous replacement of the forgone remainder, same shape. Guild
    // addresses the suppressed event (accounting context); the donor is
    // exogenous and appears nowhere else. See G35.
    const exogenousReplacement: ReturnBooks<number[][][][]> = {
      attempted: [], accepted: [], capLoss: [], eviction: [],
    };
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      photoUptake[g] = [];
      excretionReturns.attempted[g] = [];
      excretionReturns.accepted[g] = [];
      excretionReturns.capLoss[g] = [];
      excretionReturns.eviction[g] = [];
      bioticMineralization.attempted[g] = [];
      bioticMineralization.accepted[g] = [];
      bioticMineralization.capLoss[g] = [];
      bioticMineralization.eviction[g] = [];
      for (let p = 0; p < NUTRIENT_COUNT; p++) {
        photoUptake[g][p] = this.photoUptakeGuildPool[g * NUTRIENT_COUNT + p];
        const eo = g * NUTRIENT_COUNT + p;
        excretionReturns.attempted[g][p] = this.excretionAttemptedGuildPool[eo];
        excretionReturns.accepted[g][p] = this.excretionReturnsGuildPool[eo];
        excretionReturns.capLoss[g][p] = this.excretionCapLossGuildPool[eo];
        excretionReturns.eviction[g][p] = this.excretionEvictionGuildPool[eo];
        const bo = g * NUTRIENT_COUNT * 3 + p * 3;
        bioticMineralization.attempted[g][p] = [
          this.bioticAttemptedGuildPoolSource[bo + 0],
          this.bioticAttemptedGuildPoolSource[bo + 1],
          this.bioticAttemptedGuildPoolSource[bo + 2],
        ];
        bioticMineralization.accepted[g][p] = [
          this.bioticMineralizationGuildPoolSource[bo + 0],
          this.bioticMineralizationGuildPoolSource[bo + 1],
          this.bioticMineralizationGuildPoolSource[bo + 2],
        ];
        bioticMineralization.capLoss[g][p] = [
          this.bioticCapLossGuildPoolSource[bo + 0],
          this.bioticCapLossGuildPoolSource[bo + 1],
          this.bioticCapLossGuildPoolSource[bo + 2],
        ];
        bioticMineralization.eviction[g][p] = [
          this.bioticEvictionGuildPoolSource[bo + 0],
          this.bioticEvictionGuildPoolSource[bo + 1],
          this.bioticEvictionGuildPoolSource[bo + 2],
        ];
      }
    }
    const abioticRegen: number[] = [];
    for (let p = 0; p < NUTRIENT_COUNT; p++) {
      abioticRegen[p] = this.abioticRegenPool[p];
    }
    const abioticMineralization: number[][] = [];
    for (let p = 0; p < NUTRIENT_COUNT; p++) {
      abioticMineralization[p] = [
        this.abioticMineralizationPoolSource[p * 3 + 0],
        this.abioticMineralizationPoolSource[p * 3 + 1],
        this.abioticMineralizationPoolSource[p * 3 + 2],
      ];
    }
    this.fillPhenoBook(bioticMineralizationByPheno.attempted, this.bioticPhenoAttemptedClassGuildPoolSource);
    this.fillPhenoBook(bioticMineralizationByPheno.accepted, this.bioticPhenoAcceptedClassGuildPoolSource);
    this.fillPhenoBook(bioticMineralizationByPheno.capLoss, this.bioticPhenoCapLossClassGuildPoolSource);
    this.fillPhenoBook(bioticMineralizationByPheno.eviction, this.bioticPhenoEvictionClassGuildPoolSource);
    this.fillPhenoBook(bioticMineralizationShadow.attempted, this.bioticShadowAttemptedClassGuildPoolSource);
    this.fillPhenoBook(bioticMineralizationShadow.accepted, this.bioticShadowAcceptedClassGuildPoolSource);
    this.fillPhenoBook(bioticMineralizationShadow.capLoss, this.bioticShadowCapLossClassGuildPoolSource);
    this.fillPhenoBook(bioticMineralizationShadow.eviction, this.bioticShadowEvictionClassGuildPoolSource);
    this.fillPhenoBook(exogenousReplacement.attempted, this.exogenousAttemptedClassGuildPoolSource);
    this.fillPhenoBook(exogenousReplacement.accepted, this.exogenousAcceptedClassGuildPoolSource);
    this.fillPhenoBook(exogenousReplacement.capLoss, this.exogenousCapLossClassGuildPoolSource);
    this.fillPhenoBook(exogenousReplacement.eviction, this.exogenousEvictionClassGuildPoolSource);
    return { photoUptake, excretionReturns, bioticMineralization, bioticMineralizationByPheno, bioticMineralizationShadow, exogenousReplacement, abioticRegen, abioticMineralization };
  }

  /**
   * Fill one `bioticMineralizationByPheno` book from its flat array.
   * factored so the four books share one stride computation with the guild
   * books above: `class * 27 + guild * 9 + pool * 3 + source`.
   */
  private fillPhenoBook(
    out: number[][][][],
    arr: Float64Array,
  ): void {
    for (let c = 0; c < MINERAL_PHENO_CLASS_COUNT; c++) {
      out[c] = [];
      for (let g = 0; g < TROPHIC_COUNT; g++) {
        out[c][g] = [];
        for (let p = 0; p < NUTRIENT_COUNT; p++) {
          const o = c * TROPHIC_COUNT * NUTRIENT_COUNT * 3 + g * NUTRIENT_COUNT * 3 + p * 3;
          out[c][g][p] = [arr[o + 0], arr[o + 1], arr[o + 2]];
        }
      }
    }
  }

  /**
   * Grow every per-slot array this class owns so index `slot` is writable.
   *
   * The organism store grows itself, but these parallel arrays are owned by
   * World. Left at their initial size, typed-array writes past the end are
   * SILENTLY DROPPED and reads return undefined: sensing targets vanish, birth
   * queue entries are lost, and nothing throws. That failure is invisible until
   * population exceeds the initial capacity - exactly the regime the benchmark
   * ladder is meant to measure, which makes it the worst possible place for a
   * silent truncation.
   *
   * Doubles to a power-of-two size, matching the store's own growth policy.
   */
  private ensureSlotArrays(slot: number): void {
    if (slot < this.live.length) return;
    let cap = this.live.length * 2;
    while (cap <= slot) cap *= 2;

    const growI = (a: Int32Array<ArrayBuffer>, fill = 0): Int32Array<ArrayBuffer> => {
      const n = new Int32Array(cap);
      n.set(a);
      if (fill !== 0) n.fill(fill, a.length);
      return n;
    };
    const growU8 = (a: Uint8Array): Uint8Array<ArrayBuffer> => {
      const n = new Uint8Array(cap);
      n.set(a);
      return n;
    };
    const growU32 = (a: Uint32Array): Uint32Array => {
      const n = new Uint32Array(cap);
      n.set(a);
      return n;
    };
    const growU16 = (a: Uint16Array): Uint16Array => {
      const n = new Uint16Array(cap);
      n.set(a);
      return n;
    };
    const growF32 = (a: Float32Array): Float32Array => {
      const n = new Float32Array(cap);
      n.set(a);
      return n;
    };
    this.live = growU8(this.live);
    this.dormant = growU8(this.dormant);
    this.dormantSleep = growU32(this.dormantSleep);
    this.starveStreak = growU16(this.starveStreak);
    this.senesceDamage = growF32(this.senesceDamage);
    this.diseaseDamage = growF32(this.diseaseDamage);
    this.pioneerTicks = growU16(this.pioneerTicks);
    this.pioneerVoid = growF32(this.pioneerVoid);
    this.bioticMineraliser = growU8(this.bioticMineraliser);
    this.preyTarget = growI(this.preyTarget, -1);
    this.grazeTarget = growI(this.grazeTarget, -1);
    this.threatTarget = growI(this.threatTarget, -1);
    this.mateTarget = growI(this.mateTarget, -1);
    this.successfulMating = growU8(this.successfulMating);
    this.intent = growU8(this.intent);
    // `idToSlot` is deliberately NOT grown here. It is indexed by stable id,
    // which grows monotonically and far faster than slot count (one id per
    // organism ever born, including the dead). Sizing it from `slot` could
    // TRUNCATE it, silently breaking stable-id lookups used by contested
    // interaction resolution. `noteSlot` grows it correctly, on id.
  }

  /** Cumulative nutrient returned to the substrate by organisms, for the matter ledger. */
  bioticMineralised = 0;
  /**
   * Last tick's globally mineralised substrate, and the aggregate nutrient
   * actually returned from it. Exposed so G9 can assert the recycling
   * arithmetic DIRECTLY.
   *
   * A field-level proxy cannot verify this: uptake and return happen in the
   * same ticks, so watching the standing nutrient total measures consumption,
   * not the return path. `recycledLastTick` must equal
   * `mineralisedLastTick * recyclingRate * 0.5` for ANY cell count.
   */
  mineralisedLastTick = 0;
  recycledLastTick = 0;
  /**
   * Flux the cyclic regen term actually SAW last tick. Exposed so a gate can
   * prove the term is not a kill-switch: if this is 0 while mineralisers are
   * alive, the read and the clear are misordered and nutrientCyclic silently
   * suppresses all regeneration.
   */
  cyclicFluxLastTick = 0;
  /**
   * Nutrient ACTUALLY written into the fields by the recycling loop last tick,
   * counted inside the loop. `recycledLastTick` is derived algebraically from
   * the same `share` expression, so it cannot distinguish "the loop ran" from
   * "the loop was deleted". This counter can: G9 asserts on it.
   */
  recycledAppliedLastTick = 0;

  /**
   * Per-cell substrate ACTUALLY PROCESSED by mineralising organisms this tick.
   *
   * This is what `nutrientCyclic` is driven from. It previously used a
   * saturation function of STANDING substrate (detritus + sediment + litter),
   * which is abiotic: a cell holding substrate regenerated nutrients with no
   * decomposer alive at all. That is a legitimate abiotic abstraction, but it
   * is not the biotic guild-interdependence coupling the knob was chosen for,
   * and a decomposition guild that cannot be ablated cannot be shown to drive
   * anything.
   *
   * As a measured FLUX it goes to zero when mineralisers are absent, so it
   * separates biotic cycling from background regeneration by construction.
   *
   * NOT YET EMPIRICALLY DEMONSTRATED. The obvious ablation test cannot be
   * written against the current engine: `bioticMineraliser` is recomputed from
   * role derivation every tick, so clearing it is immediately overwritten.
   * `bioticMineralised` (the global total) remains the observable. See
   * REPORT.md, issue #2 P1-3.
   */
  private mineralisedCell = new Float64Array(0);

  // Layouts (per-pool, per-guild flux measurement; access via getFluxSnapshot()):
  //   photoUptake[guild * NUTRIENT_COUNT + pool]
  //   excretion{Attempted,Returns,CapLoss,Eviction}[guild * NUTRIENT_COUNT + pool]
  //   biotic{Attempted,Mineralization,CapLoss,Eviction}[guild * NUTRIENT_COUNT * 3 + pool * 3 + source]
  //     source: 0=sediment, 1=detritus, 2=litter
  //   bioticPheno{Attempted,Accepted,CapLoss,Eviction}[class * TROPHIC_COUNT * NUTRIENT_COUNT * 3 + guild * NUTRIENT_COUNT * 3 + pool * 3 + source]
  //     class: 0=carrionOnly, 1=recalcOnly, 2=dual, 3=neither (see classifyMineralPheno)
  //   bioticShadow{Attempted,Accepted,CapLoss,Eviction}[same stride as bioticPheno]
  //     would-be UNSCALED offer booked against live headroom, no field writes
  //   exogenous{Attempted,Accepted,CapLoss,Eviction}[same stride as bioticPheno]
  //     O2 replacement of the forgone accepted remainder, exogenous donor only
  //   abioticRegen[pool]
  //   abioticMineralization[pool * 3 + source]  source: 0=detritus, 1=sediment, 2=litter
  private photoUptakeGuildPool = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT);
  /**
   * What a biotic RETURN actually delivered into the pool (>= 0 always).
   *
   * This array used to book `min(cap, before + in) - before`, a single number
   * for two unrelated events. Diffusion runs after the regeneration clamp, so
   * a cell beside a richer one routinely sits ABOVE its own per-pool cap when a
   * return arrives; in that state the expression is NEGATIVE, because the clamp
   * removes pre-existing excess and the incoming amount contributes nothing.
   * Reporting that as "mineralised nutrient" credited biology with nutrient it
   * never produced.
   *
   * `accepted` is the honest quantity: what entered the pool. The other three
   * books below separate what the old tally had blended together, and give an
   * exact conservation identity per return:
   *
   *   observed delta == accepted - eviction
   *   attempted      == accepted + capLoss
   */
  private excretionReturnsGuildPool = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT);
  private bioticMineralizationGuildPoolSource = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  // Attempted / cap-loss / eviction for the same two families. `accepted` is
  // the two arrays above.
  //   excretion*   [guild * NUTRIENT_COUNT + pool]
  //   biotic*      [guild * NUTRIENT_COUNT * 3 + pool * 3 + source]
  //                source: 0=sediment, 1=detritus, 2=litter
  private excretionAttemptedGuildPool = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT);
  private excretionCapLossGuildPool = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT);
  private excretionEvictionGuildPool = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT);
  private bioticAttemptedGuildPoolSource = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private bioticCapLossGuildPoolSource = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private bioticEvictionGuildPoolSource = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  /**
   * Per-EVENT mineralization flux by expressed donor class (O3, Owner decision
   * 2026-10-15 Stage 1). Same four books, partitioned one level deeper:
   * `[class * TROPHIC_COUNT * NUTRIENT_COUNT * 3 + guild * NUTRIENT_COUNT * 3
   * + pool * 3 + source]`, classes from `classifyMineralPheno` in
   * `src/bio/role.ts` (0=carrionOnly, 1=recalcOnly, 2=dual, 3=neither).
   * Class-outermost keeps the inner `(guild, pool, source)` stride identical
   * to the guild books above, so the reconciliation sum reuses the same
   * addressing. Pure observation: written from the same locals as the guild
   * books, never read by simulation logic, excluded from `hashState`.
   */
  private bioticPhenoAcceptedClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private bioticPhenoAttemptedClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private bioticPhenoCapLossClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private bioticPhenoEvictionClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  /**
   * Shadow books: the UNSCALED (would-be) offer run through the same clamp
   * math against live cell headroom, WITHOUT writing fields (O1 Gate-2 P2).
   * On null/unset runs shadow == actual per cell (G34 asserts this, pinning
   * the duplicated math against the single-arithmetic-site original). On
   * suppressed runs the per-cell `shadow - actual` difference is the
   * pool/source/class-local forgone return an O2 dose would need to replace.
   * Cumulative per (class, pool, source): pool/source-local dosing IS
   * specifiable; cell/time-exact replacement is NOT with bounded memory (see
   * the O2 dosing note in REPORT.md). Pure observation like the pheno books.
   */
  private bioticShadowAttemptedClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private bioticShadowAcceptedClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private bioticShadowCapLossClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private bioticShadowEvictionClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  /**
   * O2 exogenous replacement books (Owner Stage 3). Same stride as the pheno
   * family; the class/guild/pool/source address identifies the SUPPRESSED
   * event being replaced (accounting context), while the donor is explicitly
   * exogenous — these books never mix into biotic, abiotic, ledger, cyclic or
   * broadcast paths. Pure observation like the pheno/shadow books.
   */
  private exogenousAttemptedClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private exogenousAcceptedClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private exogenousCapLossClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private exogenousEvictionClassGuildPoolSource = new Float64Array(MINERAL_PHENO_CLASS_COUNT * TROPHIC_COUNT * NUTRIENT_COUNT * 3);
  private abioticRegenPool = new Float64Array(NUTRIENT_COUNT);
  private abioticMineralizationPoolSource = new Float64Array(NUTRIENT_COUNT * 3);

  /** Diagnostic counters: graze takes split from predation (the ledger merges
   * both kinds). Submissions are already public via submittedByKind[4].
   * Pure observation: incremented, never read by simulation logic. */
  grazeWins = 0;
  grazeEnergy = 0;
  /** Sum of scaled graze requests (pre-cap). granted/requested measures cap binding. */
  grazeRequested = 0;
  /**
   * Cumulative dormant-senescence deaths. Exact attribution for the senescence
   * mechanism (deaths whose largest damage share is senescence); the deaths
   * themselves fold into the damage bucket of the demographic shape, which is
   * unchanged. Always 0 when the knob is off.
   */
  senescenceDeaths = 0;

  // --- Phase queues --------------------------------------------------------
  private birthParentSlot: Int32Array<ArrayBuffer>;
  /** Second parent for sexual births (genomeV2 recombination). -1 = asexual. */
  private birthMateSlot: Int32Array<ArrayBuffer>;
  /** Organism id of the second parent, -1 when asexual. Validates slot reuse. */
  private birthMateId: Int32Array<ArrayBuffer>;
  private birthCount: Int32Array<ArrayBuffer>;
  /**
   * Lineage to assign to each queued birth, or -1 to inherit the parent's.
   * Sexual births pass a freshly minted lineage id, which is what makes
   * lineages branch instead of just accumulating clones of the founders.
   */
  private birthLineage: Int32Array<ArrayBuffer>;
  /**
   * Parent's STABLE id captured at queue time.
   *
   * The slot alone is unsafe: a queued clutch can outlive its parent, the slot
   * can be freed and reallocated to an unrelated newborn, and a liveness check
   * on the slot would then happily pass with the wrong organism. Carrying the
   * id and verifying `store.id[slot] === queuedId` at birth time makes the
   * aliasing impossible rather than merely unlikely.
   */
  private birthParentId: Int32Array<ArrayBuffer>;
  /**
   * Per-cell phototrophic mass, rebuilt every tick in Phase 3.
   *
   * This is the canopy. `habitat.shade` is a STATIC spatial property and so
   * creates patchiness but not crowding; this field is the density-dependent
   * half that was missing, and without it producer income had no density
   * dependence at all and the population was bounded only by `maxPopulation`.
   *
   * Rebuilt (not accumulated) each tick so it cannot drift or leak.
   */
  private shadeMass = new Float32Array(0);
  private shadeCols = 0;
  private shadeRows = 0;

  /**
   * Per-patch, per-guild living counts for the metapopulation grid.
   *
   * Layout `[patchIndex * TROPHIC_COUNT + trophic]`. Rebuilt every tick from the
   * live-packed arrays before births are placed, so it reflects the population
   * as it stands and never includes newborns from the same tick (those are
   * placed after the census and would otherwise seed the patch they came from).
   *
   * This census is what makes immigration directional: an empty patch for a
   * guild is attractive because its count is zero.
   */
  private patchCensus = new Int32Array(0);
  private patchCols = 0;
  private patchRows = 0;

  /** Living count of `trophic` within patch `p`, or 0 if the grid is disabled. */
  private patchCount(p: number, trophic: number): number {
    if (this.patchCensus.length === 0) return 0;
    const i = p * TROPHIC_COUNT + trophic;
    return i >= 0 && i < this.patchCensus.length ? this.patchCensus[i] : 0;
  }

  /**
   * Read-only patch-census accessor for diagnostics (spatial-rescue probe).
   * Pure read delegating to the census above: no state written, no RNG drawn,
   * no branch of the simulation altered. Grid is row-major over patchCols x
   * patchRows ([0,0] when disabled). Timing: the census rebuilds every tick
   * before births are placed, so a post-step read excludes same-tick newborns
   * (they would otherwise seed the patch they came from).
   */
  patchGridDims(): [number, number] {
    return [this.patchCols, this.patchRows];
  }

  /** Living count of `trophic` guild within patch `p`; 0 when disabled/out of range. */
  patchGuild(p: number, trophic: number): number {
    return this.patchCount(p, trophic);
  }

  /**
   * Local heterotrophic-substrate availability in cell `ci`, as a 0..1
   * fraction that saturates at `mixotrophySaturation`.
   *
   * This is the shared input to the two guild-interdependence diagnostics
   * (mixotrophyCarbon, nutrientCyclic): both ask the same question — is there
   * organic matter here to work on? Detritus, sediment and recalcitrant
   * litter all count, weighted toward litter because it is the decomposers'
   * exclusive niche and the slowest to accumulate.
   *
   * `dormantFrac` is deliberately NOT read here. This is a spatial substrate
   * question, not a population one, and mixing the two would couple every
   * nutrient field to every dormant count in the world.
   */
  private substrateAvailability(ci: number): number {
    const sat = Math.max(1e-6, this.config.mixotrophySaturation);
    const raw =
      this.detritus.data[ci] +
      this.sediment.data[ci] * 0.8 +
      this.litter.data[ci] * 1.2;
    return raw / (raw + sat);
  }

  /**
   * Rebuild the metapopulation census. O(live), so it costs no more than the
   * spatial grid build that precedes it.
   */
  private rebuildPatchCensus(liveCount: number): void {
    if (this.patchCensus.length === 0) return;
    this.patchCensus.fill(0);
    const store = this.store;
    const cols = this.patchCols;
    const rows = this.patchRows;
    const invW = cols / this.config.worldW;
    const invH = rows / this.config.worldH;
    for (let i = 0; i < liveCount; i++) {
      const slot = this.packedSlots[i];
      const trophic = store.role[slot * ROLE_STRIDE];
      if (trophic < 0 || trophic >= TROPHIC_COUNT) continue;
      let cx = (this.packedX[i] * invW) | 0;
      let cy = (this.packedY[i] * invH) | 0;
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      this.patchCensus[(cy * cols + cx) * TROPHIC_COUNT + trophic]++;
    }
  }

  private pendingBirths = 0;

  // --- Counters ------------------------------------------------------------
  tick = 0;
  totalBirths = 0;
  totalDeaths = 0;
  /** Number of distinct lineages that have gone extinct. */
  extinctLineages = 0;
  /** Times the hard population ceiling blocked a birth. */
  populationCapHits = 0;
  /** Times a disturbance was generated. */
  disturbancesFired = 0;
  /** Peak population observed. */
  peakPopulation = 0;
  /** Ticks the world ran with zero living organisms. */
  emptyTicks = 0;

  /** Timing for the most recent tick. */
  readonly timings: PhaseTimings = {
    abiotic: 0, fields: 0, spatial: 0, act: 0, contests: 0, deaths: 0, births: 0, total: 0,
  };
  /** Cumulative timing, for subsystem cost shares. */
  readonly totals: PhaseTimings = {
    abiotic: 0, fields: 0, spatial: 0, act: 0, contests: 0, deaths: 0, births: 0, total: 0,
  };
  /** Set false in benchmarks to remove instrumentation cost from the hot loop. */
  profiling = true;

  /**
   * Cumulative milliseconds spent in procedural phenotype derivation.
   * Reported separately from phase timings so phenotype cost is never
   * mistaken for per-tick organism biology.
   */
  phenotypeMs = 0;

  /**
   * When true, callers may use {@link sampleLineages}. Off by default so that
   * pure throughput benchmarks measure simulation rather than reporting.
   */
  lineageSampling = false;

  /**
   * Cumulative milliseconds spent aggregating lineage bookkeeping.
   * Lineage sampling is optional (off by default) so that pure throughput
   * benchmarks measure the simulation rather than the reporting.
   */
  lineageMs = 0;

  /** Last tick's contested-interaction records (view, not a copy). */
  private lastResolutions: readonly ResolutionRecord[] = [];
  /** How many entries of `lastResolutions` are valid this tick. */
  private lastResolutionCount = 0;

  /** Tracks which slots had a successful mutual mating this tick (set in resolveContests, read in proposeReproduction). */
  private successfulMating = new Uint8Array(0);

  /**
   * Bounded event log. Null when tracing is disabled, so the untraced hot path
   * pays one predictable null check per event site and allocates nothing.
   */
  private traceLog: TraceLog | null = null;
  /**
   * Reproduction-gate tallies. Null when the probe is not attached, so the
   * unprobed path pays one predictable null check per gate and allocates
   * nothing — the same bargain as traceLog above.
   */
  private repro: ReproProbe | null = null;
  /**
   * Organism id -> lineage id, retained for EVERY id ever born, not just live
   * ones.
   *
   * Trace lineage queries are for extinct lineages — "what happened to this
   * family" — so a map built from live slots only would drop precisely the
   * events of interest. It grows with births rather than with population; the
   * engine already retains a comparable per-slot id space, so this is bounded
   * by total births, and it is only allocated when tracing is enabled.
   */
  private traceIdLineage = new Map<number, number>();

  /** Cached last snapshot. */
  snapshot: WorldSnapshot;

  constructor(opts: WorldOptions = {}) {
    if (opts.trace?.enabled) {
      this.traceLog = new TraceLog(opts.trace.capacity ?? 20000);
    }
    this.repro = opts.reproProbe ?? null;
    const cfg = resolveConfig(opts.config);
    this.config = cfg;
    // Normalise the senescence knob once (user config untouched): a plain
    // number is legacy fixed-grace mode; an object selects a scale-free mode.
    // Unknown mode strings throw here, at construction, never mid-run.
    const ds = cfg.dormantSenescence;
    // Reject non-finite/negative scales at construction: a negative share
    // scale would silently disable via the rate guard, and NaN would never
    // accrue — both look "off" while configured. Grace 0 is allowed (damage
    // from the first dormant tick).
    const bad = (x: unknown): boolean => typeof x !== 'number' || !(x >= 0) || !Number.isFinite(x);
    if (typeof ds === 'number') {
      if (bad(ds)) throw new Error(`bad dormantSenescence scale: ${JSON.stringify(ds)}`);
      this.senescence = { mode: 'fixed', scale: ds };
    } else if (ds !== null && ds !== undefined) {
      if (ds.mode !== 'fixed' && ds.mode !== 'share' && ds.mode !== 'lifespan') {
        throw new Error(`unknown dormantSenescence mode: ${JSON.stringify(ds.mode)}`);
      }
      if (bad(ds.scale)) throw new Error(`bad dormantSenescence scale: ${JSON.stringify(ds.scale)}`);
      this.senescence = { mode: ds.mode, scale: ds.scale };
    }
    // Pioneer-bonus knob validation at construction, never mid-run. Grace 0
    // grants nothing (harmless); discount outside [0,1] or non-finite throws
    // rather than silently clamping into a different experiment.
    const pb = cfg.pioneerBonus;
    if (pb !== null && pb !== undefined) {
      if (!Number.isFinite(pb.grace) || pb.grace < 0) {
        throw new Error(`bad pioneerBonus grace: ${JSON.stringify(pb.grace)}`);
      }
      if (!Number.isFinite(pb.discount) || pb.discount < 0 || pb.discount > 1) {
        throw new Error(`bad pioneerBonus discount: ${JSON.stringify(pb.discount)}`);
      }
    }

    // O1 phenotype-class return fractions: validated at construction, never
    // mid-run. null/undefined = declared full return. Each named fraction
    // must be finite in [0, 1]; anything else throws rather than silently
    // scaling into a different experiment. The key SET is closed too: an
    // unknown key (e.g. `neither`, which structurally cannot be suppressed,
    // or a typo) throws rather than being silently ignored while the user
    // believes it applies. `neither` is not configurable and always passes
    // through (see mineraliseThroughCeiling).
    const pmr = cfg.phenoMineralReturn;
    if (pmr !== null && pmr !== undefined) {
      for (const k of ['carrionOnly', 'recalcOnly', 'dual'] as const) {
        const v: unknown = (pmr as Record<string, unknown>)[k];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
          throw new Error(`bad phenoMineralReturn.${k}: ${JSON.stringify(v)} (want finite number in [0, 1]; the whole knob may be null for declared behaviour)`);
        }
      }
      for (const k of Object.keys(pmr)) {
        if (k !== 'carrionOnly' && k !== 'recalcOnly' && k !== 'dual') {
          throw new Error(`unknown phenoMineralReturn key: ${JSON.stringify(k)} (want exactly carrionOnly/recalcOnly/dual)`);
        }
      }
    }
    // O2 rescue flags: validated at construction, never mid-run. null =
    // no rescue. Each named flag must be a real boolean (truthy numbers or
    // strings throw — a `1` that means "on" today becomes an ambiguous dose
    // tomorrow); closed key set like the O1 knob.
    const rsc = cfg.phenoMineralRescue;
    if (rsc !== null && rsc !== undefined) {
      for (const k of ['carrionOnly', 'recalcOnly', 'dual'] as const) {
        const v: unknown = (rsc as Record<string, unknown>)[k];
        if (typeof v !== 'boolean') {
          throw new Error(`bad phenoMineralRescue.${k}: ${JSON.stringify(v)} (want boolean; the whole knob may be null for no rescue)`);
        }
      }
      for (const k of Object.keys(rsc)) {
        if (k !== 'carrionOnly' && k !== 'recalcOnly' && k !== 'dual') {
          throw new Error(`unknown phenoMineralRescue key: ${JSON.stringify(k)} (want exactly carrionOnly/recalcOnly/dual)`);
        }
      }
    }

    this.reproSurplus = resolveReproSurplusTicks(cfg);

    this.rng = new Rng(cfg.seed);
    this.store = new OrganismStore({ capacity: Math.max(1024, cfg.founders * 2), label: 'organisms' });
    this.live = new Uint8Array(this.store.capacity);
    this.dormant = new Uint8Array(this.store.capacity);
    this.dormantSleep = new Uint32Array(this.store.capacity);
    this.starveStreak = new Uint16Array(this.store.capacity);
    this.senesceDamage = new Float32Array(this.store.capacity);
    this.diseaseDamage = new Float32Array(this.store.capacity);
    this.pioneerTicks = new Uint16Array(this.store.capacity);
    this.pioneerVoid = new Float32Array(this.store.capacity);
    this.neighbourScratch = new Int32Array(4096);

    const fieldCols = Math.ceil(cfg.worldW / cfg.fieldCell);
    const fieldRows = Math.ceil(cfg.worldH / cfg.fieldCell);
    this.habitat = new HabitatMap(fieldCols, fieldRows, cfg.habitatSeed ?? cfg.seed);
    // Coarser than the substrate grid: one canopy cell spans a patch of
    // substrate cells. At 1:1 the canopy could never bind, because producers
    // occupy a fraction of a substrate cell - see `shadeGrain`.
    const grain = Math.max(1, Math.floor(cfg.shadeGrain));
    this.shadeCols = Math.max(1, Math.floor(fieldCols / grain));
    this.shadeRows = Math.max(1, Math.floor(fieldRows / grain));
    // Metapopulation grid. 0 patches disables immigration and restores the
    // pre-v0.4.0 placement path exactly.
    const mgrid = Math.max(0, Math.floor(cfg.metapopulationPatches));
    if (mgrid > 0) {
      this.patchCols = mgrid;
      this.patchRows = mgrid;
      this.patchCensus = new Int32Array(mgrid * mgrid * TROPHIC_COUNT);
    }
    this.shadeMass = new Float32Array(this.shadeCols * this.shadeRows);
    this.nutrients = [];
    this.mineralisedCell = new Float64Array(fieldCols * fieldRows);
    // Flux measurement arrays (cumulative across run)
    this.photoUptakeGuildPool = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT);
    this.excretionReturnsGuildPool = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT);
    this.bioticMineralizationGuildPoolSource = new Float64Array(TROPHIC_COUNT * NUTRIENT_COUNT * 3);
    this.abioticRegenPool = new Float64Array(NUTRIENT_COUNT);
    this.abioticMineralizationPoolSource = new Float64Array(NUTRIENT_COUNT * 3);
    for (let nIdx = 0; nIdx < NUTRIENT_COUNT; nIdx++) {
      this.nutrients.push(new ScalarField(`nutrient${nIdx}`, fieldCols, fieldRows, 0));
    }
    this.detritus = new ScalarField('detritus', fieldCols, fieldRows, 0);
    this.sediment = new ScalarField('sediment', fieldCols, fieldRows, 0);
    /**
     * RECALCITRANT benthic litter - the structural (cellulose/lignin) fraction of
     * dead organic matter, which animals cannot digest and microbes can.
     *
     * This pool is the decomposers' exclusive niche. Without it, detritus was a
     * single entirely labile pool that scavengers and decomposers both drew on,
     * so competitive exclusion removed decomposers on every seed.
     */
    this.litter = new ScalarField('litter', fieldCols, fieldRows, 0);
    // Seed each cell to a fraction of its own capacity, so heterogeneity is
    // present from tick zero. Per-nutrient capacity modulation makes the three
    // pools only weakly correlated, so they can genuinely be co-limiting rather
    // than proportional copies of one another.
    for (let nIdx = 0; nIdx < NUTRIENT_COUNT; nIdx++) {
      const field = this.nutrients[nIdx].data;
      const mod = cfg.nutrientCapacity[nIdx] ?? 1;
      for (let i = 0; i < field.length; i++) {
        const jitter = 0.62 + 0.76 * (((i * 37 + nIdx * 101) % 97) / 97);
        field[i] = this.habitat.capacityAt(i, cfg.nutrientPerCell) * mod * jitter * 0.55;
      }
    }
    // A small starting sediment stock lets a detritus-based web bootstrap
    // instead of requiring a corpse economy to already exist.
    //
    // This stock is standing organic energy, so it must be booked as part of the
    // founding input or the conservation identity is wrong by its entire size
    // from tick zero (measured as a -73 % residual that slowly converged).
    for (let i = 0; i < this.sediment.data.length; i++) {
      this.sediment.data[i] = cfg.sedimentPerCell * (0.5 + this.habitat.fertility.data[i] * 0.6);
    }
    this.ledger.foundingBiomass += this.sediment.total();
    // Litter bootstrap, booked identically: standing organic energy that exists
    // before any corpse economy, so it must be part of the founding input or G3
    // opens wrong by exactly this amount.
    for (let i = 0; i < this.litter.data.length; i++) {
      this.litter.data[i] = cfg.litterPerCell * (0.5 + this.habitat.fertility.data[i] * 0.6);
    }
    this.ledger.foundingBiomass += this.litter.total();

    this.grid = new SpatialGrid(cfg.worldW, cfg.worldH, cfg.spatialCell, this.store.capacity);

    this.preyTarget = new Int32Array(this.store.capacity).fill(-1);
    this.grazeTarget = new Int32Array(this.store.capacity).fill(-1);
    this.threatTarget = new Int32Array(this.store.capacity).fill(-1);
    this.mateTarget = new Int32Array(this.store.capacity).fill(-1);
    this.successfulMating = new Uint8Array(this.store.capacity);
    this.intent = new Uint8Array(this.store.capacity);
    this.localMods = emptyModifiers();

    this.birthParentSlot = new Int32Array(this.store.capacity * 2);
    this.birthMateSlot = new Int32Array(this.store.capacity * 2).fill(-1);
    this.birthMateId = new Int32Array(this.store.capacity * 2).fill(-1);
    this.birthCount = new Int32Array(this.store.capacity * 2);
    this.birthLineage = new Int32Array(this.store.capacity * 2).fill(-1);
    this.birthParentId = new Int32Array(this.store.capacity * 2).fill(-1);

    this.abiotic = new AbioticDriver(cfg.abioticCycle, cfg.disturbanceInterval, cfg.disturbanceChance);

    this.history = new WorldHistory(opts.historyEvery ?? 0);
    this.interactions = new InteractionQueue(Math.max(1024, cfg.founders));
    this.snapshot = this.measure();

    this.seedFounders();
    this.snapshot = this.measure();
  }

  /** Contested interaction queue. Exposed for the validation gates. */
  readonly interactions: InteractionQueue;

  // =========================================================================
  // Founding population
  // =========================================================================

  /**
   * Create the founder population. Genes are drawn around each trait's `init`
   * with a Gaussian of width `spread`, so the founding population is already
   * varied but not absurd — the experiment wants evolvability, not a lottery.
   */
  private seedFounders(): void {
    const cfg = this.config;
    const genome = new Float32Array(TRAIT_COUNT);
    const body = new Uint8Array(BODY_GENE_COUNT);

    // Decomposer seeding: if configured, the first N founders get genes that
    // express to a qualifying decomposer (photo~0.12, recalc~0.70, speed~1.7).
    // Uses rng draws in the same order/count as the standard path so the RNG
    // stream stays aligned for the remaining founders.
    const decompCount =
      cfg.decomposerFounders !== null && cfg.decomposerFounders > 0
        ? Math.floor(cfg.founders * Math.min(1, cfg.decomposerFounders))
        : 0;
    for (let i = 0; i < cfg.founders; i++) {
      const seedAsDecomposer = i < decompCount;
      for (let t = 0; t < TRAIT_COUNT; t++) {
        const spec = TRAITS[t];
        // Diagnostic override of the founder init for this trait only; null
        // (the default) uses the declared spec value, leaving behaviour
        // byte-identical. See config.reproThresholdInit.
        let base =
          t === TRAIT.REPRO_THRESHOLD && cfg.reproThresholdInit !== null
            ? cfg.reproThresholdInit
            : t === TRAIT.ASEXUAL_RATE && cfg.asexualRateInit !== null
              ? cfg.asexualRateInit
              : t === TRAIT.CLUTCH_SIZE && cfg.clutchSizeInit !== null
                ? cfg.clutchSizeInit
                : spec.init;
        // Decomposer-qualifying genes (expressed: photo~0.12<0.34,
        // recalc~0.70>0.55, speed~1.7<2.4). Jitter applies normally below.
        if (seedAsDecomposer) {
          if (t === TRAIT.PHOTOSYNTHETIC_RATE) base = 0.1;
          else if (t === TRAIT.RECALCITRANT_DIGESTION) base = 0.7;
          else if (t === TRAIT.SPEED) base = 0.2;
        }
        const g = base + this.rng.gaussian(0, spec.spread) * 0.5;
        genome[t] = g < 0 ? 0 : g > 1 ? 1 : g;
      }
      for (let b = 0; b < BODY_GENE_COUNT; b++) {
        const spec = BODY_GENES[b];
        const jitter = Math.round((this.rng.nextFloat() - 0.5) * (spec.hi - spec.lo) * 0.5);
        const v = spec.init + jitter;
        body[b] = v < spec.lo ? spec.lo : v > spec.hi ? spec.hi : v;
      }

      // Modular genome v2 founding. Seeded only when the diagnostic is on; a
      // v1 founder carries no modules at all. Founders get a plausible spread
      // rather than a uniform draw, because a lineage that starts with four
      // DEFENSE modules and no sensory organ is a corpse, not a founder. This
      // is a STARTING CONDITION, not a fitness claim.
      let fModules: Float32Array | null = null;
      let fCount = 0;
      if (this.config.genomeV2 === true) {
        const seeded = seedFounderModules(this.rng, 3 + this.rng.int(5));
        fModules = seeded.modules;
        fCount = seeded.count;
      }

      const slot = this.store.allocate();
      if (slot < 0) return;
      this.populateSlot(slot, genome, body, -1, this.nextId - 1, 0, fModules, fCount);
      // Founders are their own lineage. Reserve a dense index first so the
      // biological key and the bookkeeping index cannot collide.
      this.store.lineage[slot] = this.denseLineage(this.store.id[slot]);
      // Founders are lineages too: without this, a lineage founded at tick 0
      // would be missing from `traceLineageMap()` and therefore unqueryable.
      if (this.traceLog !== null) {
        this.traceIdLineage.set(this.store.id[slot], this.store.lineage[slot]);
      }
      this.store.generationDepth[slot] = 0;
      this.noteSlot(slot);
      this.store.x[slot] = this.rng.nextFloat() * cfg.worldW;
      this.store.y[slot] = this.rng.nextFloat() * cfg.worldH;
      this.store.heading[slot] = this.rng.nextFloat() * Math.PI * 2;
      // Founders start with a working reserve so they can attempt life, not
      // immediately starve. This is a starting condition, not a subsidy.
      // Mass-corrected, so the founding reserve is measured against the same
      // ceiling every later income check uses. Reading the raw trait here would
      // let a founder start above half of the capacity it is actually held to.
      const cap = this.capacityOf(slot);
      this.store.energy[slot] = cap * 0.5;
      this.store.energyIngested[slot] = this.store.energy[slot];
      this.store.age[slot] = 0;
      this.store.damage[slot] = 0;
      // Founders arrive with biomass from outside the loop. Book it, or the
      // conservation identity is wrong by this amount from tick zero.
      this.ledger.foundingBiomass += this.store.energy[slot];
    }
  }

  /**
   * Derive and install a phenotype, then cache its expressed traits.
   * This is the timed "procedural phenotype generation" cost the performance
   * protocol measures separately from per-tick updates.
   */
  private populateSlot(
    slot: number,
    genome: Float32Array,
    bodyGenes: Uint8Array,
    parentId: number,
    lineage: number,
    bornTick: number,
    geneModules?: Float32Array | null,
    moduleCount = 0,
  ): void {
    const seed = (this.rng.nextU32() ^ (slot * 0x9e3779b1)) >>> 0;
    // Retained so the phenotype can be RE-DERIVED later with identical
    // geometry. Development re-expression must not re-roll an individual's
    // silhouette every time it crosses a developmental threshold.
    this.store.procSeed[slot] = seed;

    // FIX: module state is RESET on every allocation, not only when modules are
    // written. Structural deletion can yield a child with zero modules; if that
    // child reuses a freed slot, the previous occupant's moduleCount and block
    // would otherwise survive and be inherited again — a zero-module organism
    // carrying its dead neighbour's DNA.
    this.store.moduleCount[slot] = 0;
    if (geneModules && moduleCount > 0) {
      this.store.geneModules.fill(0, slot * MAX_MODULES * MODULE_STRIDE,
        (slot + 1) * MAX_MODULES * MODULE_STRIDE);
    }
    // Procedural phenotype generation is timed SEPARATELY from per-tick
    // biology, because in a birth-heavy world it is a different cost curve
    // from anything the tick loop does. The Owner asked for this split
    // explicitly, so it must not be buried inside a birth-phase total.
    const phenT0 = this.profiling ? now() : 0;
    // Store the module block BEFORE deriving the phenotype, so the phenotype
    // can read it and so a re-derivation later has the genome to re-read.
    if (geneModules && moduleCount > 0) {
      const off = slot * MAX_MODULES * MODULE_STRIDE;
      this.store.geneModules.set(geneModules.subarray(0, MAX_MODULES * MODULE_STRIDE), off);
      this.store.moduleCount[slot] = moduleCount;
    }
    const phen = new Phenotype(genome, bodyGenes, seed,
      this.store.geneModules.subarray(slot * MAX_MODULES * MODULE_STRIDE,
        slot * MAX_MODULES * MODULE_STRIDE + MAX_MODULES * MODULE_STRIDE),
      this.store.moduleCount[slot], 0, 1);
    if (this.profiling) this.phenotypeMs += now() - phenT0;
    this.store.phenotypeDerivations++;

    // Grow every slot-indexed side array BEFORE writing into it.
    //
    // The organism store grows itself, but these parallel arrays are owned by
    // World. If they are left at their initial size, typed-array writes past
    // the end are silently dropped and reads return undefined: sensing targets
    // vanish, birth queue entries are lost, and nothing throws. That failure is
    // invisible until population exceeds the initial capacity - which is
    // exactly the regime the benchmark ladder is meant to measure.
    this.ensureSlotArrays(slot);
    this.live[slot] = 1;
    // Clear dormancy: allocate() reuses released slots, and dormant[] is only
    // overwritten in actPhase. Without this a newborn inherits the previous
    // occupant's flag and gets a tick of unearned cheap basal on its first
    // actPhase (which reads last tick's flag for basal/sensing).
    this.dormant[slot] = 0;
    this.dormantSleep[slot] = 0;
    // Clear the fasting clock with the other history clocks: a newborn
    // inherits no deficit, so its first trough gets full grace (birth trough
    // is not starvation — same precedent as the dormancy reset above).
    this.starveStreak[slot] = 0;
    this.senesceDamage[slot] = 0;
    this.diseaseDamage[slot] = 0;
    this.pioneerTicks[slot] = 0;
    this.pioneerVoid[slot] = 0;
    this.store.fatigue[slot] = 0;

    this.store.id[slot] = this.nextId++;
    this.store.individualSeed[slot] = seed;
    this.store.parentId[slot] = parentId;
    this.store.lineage[slot] = lineage;
    this.store.bornTick[slot] = bornTick;
    this.store.copyGenomeToSlot(slot, genome);
    this.store.copyBodyToSlot(slot, bodyGenes);
    this.store.physical.set(phen.physical, slot * TRAIT_COUNT);
    this.store.phen[slot] = phen;
    this.store.hitRadius[slot] = phen.hitRadius;
    this.store.senseRadius[slot] = phen.senseRadius;
    this.store.maxStep[slot] = phen.maxStep;
    this.store.modules[slot] = phen.body.modules;

    // Cache the derived role readout. It is a pure function of the genome
    // plus age, so it is computed at birth and refreshed when the organism
    // crosses a stage boundary in the act phase.
    // `bioticMineraliser` is grown by ensureSlotArrays above; growing it again
    // here with a different sizing policy let the two paths disagree.
    // Age is 0 at allocation: every organism starts as a juvenile. Reading
    // store.age here would read whatever the recycled slot last held.
    const r = deriveRole(this.store.physical, slot * TRAIT_COUNT, 0);
    this.writeRole(slot, r);
  }

  /** Write a role readout into the flat cache block. */
  /**
   * Size-corrected storage capacity for a slot.
   *
   * Reads the cached phenotype's mass-scaled value. Every energy-income and
   * overflow check must use this rather than the raw trait, or a large animal
   * overflows against a ceiling that is unrelated to its body size.
   */
  /**
   * Accumulate local phototrophic mass per substrate cell.
   *
   * Only producers contribute, and only to the LIGHT path: this is a shading
   * term, not a generic growth penalty, so heterotrophs neither shade nor are
   * shaded. Mass is `phototrophicRate * body size`, standing in for leaf/crown
   * area - an organism intercepts light in proportion to how much of it it
   * presents.
   *
   * Iterates the LIVE-PACKED arrays rather than the dense slot bound, so
   * corpses and recycled slots do not contribute to the canopy.
   */
  private rebuildShadeMass(liveCount: number): void {
    if (this.shadeMass.length === 0) return;
    this.shadeMass.fill(0);
    const store = this.store;
    const cols = this.shadeCols;
    const rows = this.shadeRows;
    const invW = cols / this.config.worldW;
    const invH = rows / this.config.worldH;
    for (let i = 0; i < liveCount; i++) {
      const slot = this.packedSlots[i];
      if (!this.live[slot]) continue;
      const o = slot * TRAIT_COUNT;
      const photo = store.physical[o + TRAIT.PHOTOSYNTHETIC_RATE];
      if (photo <= 0.02) continue;
      let cx = (this.packedX[i] * invW) | 0;
      let cy = (this.packedY[i] * invH) | 0;
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      const size = store.physical[o + TRAIT.SIZE];
      this.shadeMass[cy * cols + cx] += photo * size;
    }
  }

  private capacityOf(slot: number): number {
    return resolveCapacity(this.store.phen[slot], this.store.trait(slot, TRAIT.STORAGE_CAPACITY));
  }

  /**
   * Per-pool nutrient ceiling for a cell: the SAME quantity seeding
   * (world.ts seeding loop) and abiotic regeneration clamp to, namely
   * `nutrientPerCell * fertility * nutrientCapacity[nIdx]`.
   *
   * The nutrient RETURN paths (excretion and the three biotic-mineralisation
   * sites) used to clamp to a FLAT `nutrientPerCell * fertility` with the
   * per-pool multiplier omitted. Pool A's multiplier is 1.0 so it was
   * unaffected, but pools B (0.78) and C (0.62) could be filled above their
   * declared capacity by a return — a silent un-cap of exactly the two pools
   * the per-pool multipliers exist to keep co-limiting.
   *
   * Measured reachability (src/trace/capsreach.ts): under the excretion-return
   * effective config the pools never approach any ceiling, so the defect is NOT
   * reached there (0 excess over 1500 ticks, excretion on and off). Under a
   * saturation arm it IS reached, with B and C exceeding their per-pool caps by
   * ~150x and ~240x the diffusion baseline. Routing the four RETURN sites
   * through this one helper is the smallest correction that makes the return
   * clamp agree with the declared per-pool semantics.
   *
   * PRECISE SCOPE — three spellings of this cap still exist, on purpose:
   *   - seeding (world.ts seeding loop) computes it via habitat.capacityAt * mod;
   *   - the abiotic regeneration clamp (world.ts regen loop) computes it inline;
   *   - the four return sites use this helper.
   * They agree numerically. Unifying the first two would be a refactor with no
   * behavioural effect and was not attempted.
   *
   * Two things this correction does NOT do, both deliberate:
   *   1. It does not make the per-pool cap a hard invariant. `ScalarField.step()`
   *      diffusion runs after the regeneration clamp, so a low-fertility cell
   *      beside a rich one still drifts above its own cap every tick by the
   *      baseline the probe measures. Fixing that means reordering the diffusion
   *      pass — a different change to declared behaviour.
   *   2. It does not cap the abiotic mineralisation broadcast (world.ts
   *      `nData[i] += share`), which has NO cap of any kind and can therefore
   *      exceed even the flat cap. Left untouched: it is far below any ceiling
   *      at declared recycling rates, and capping it is a separate decision.
   */
  private nutrientCapAt(nIdx: number, ci: number): number {
    return this.config.nutrientPerCell
      * this.habitat.fertility.data[ci]
      * (this.config.nutrientCapacity[nIdx] ?? 1);
  }

  /**
   * Apply one biotic nutrient RETURN through the per-pool ceiling, booking the
   * four quantities separately.
   *
   * WHY FOUR BOOKS. The return sites used to book `min(cap, before + in) -
   * before` as "nutrient returned". That single number conflated two unrelated
   * events, because `ScalarField.step()` diffusion runs AFTER the regeneration
   * clamp and leaves low-fertility cells sitting ABOVE their own per-pool cap
   * when a return arrives. In that state the expression is NEGATIVE: the clamp
   * removes pre-existing excess and the incoming amount adds nothing. A reader
   * could not tell "biology recycled this much" from "the ceiling deleted that
   * much", and the aggregate could even net to a value no individual return
   * ever produced.
   *
   * The books, per (guild, pool[, source]):
   *   attempted  what the process meant to deliver          (always >= 0)
   *   accepted   what actually entered the pool             (always >= 0)
   *   capLoss    attempted - accepted, refused by the cap   (>= 0 up to
   *              double-precision cancellation: the subtraction itself is
   *              accumulated, and clamping it would break the identity below)
   *   eviction   pre-existing excess the clamp removed      (always >= 0)
   *
   * Two identities hold EXACTLY in the float64 clamp arithmetic, per return
   * and therefore per accumulated total, which is what makes the measurement
   * auditable rather than merely plausible:
   *   observed delta == accepted - eviction
   *   attempted      == accepted + capLoss
   *
   * `observed delta` is the delta the clamp COMPUTED. The field is
   * Float32Array, so what is actually stored rounds to single precision; a
   * cell clamped exactly to the ceiling can therefore sit a fraction of an ulp
   * above it and the next return will correctly report that fraction as
   * eviction. G31 measures that effect end-to-end (~1e-8 relative against the
   * pool budget) rather than asserting it away.
   *
   * `eviction` is the honest name for the quantity the old tally mixed in: it
   * is nutrient the ceiling deleted, not nutrient biology produced. At declared
   * settings no cell reaches its ceiling THROUGH A RETURN either, so accepted
   * reproduces the pre-correction figure exactly for every return. A non-zero
   * eviction elsewhere means the cell was already over its cap when the return
   * arrived: either because diffusion put it there, or because float32 storage
   * rounded a clamped cell a fraction of an ulp past the ceiling. See G31
   * (writer-isolated world) which bounds the quantisation term.
   *
   * `data` is passed rather than re-read so the caller's local alias and the
   * written array cannot diverge, and it is mutated in place.
   */
  /**
   * One ceiling interaction, pure: the clamp arithmetic both the real return
   * path and the O1 shadow booking share. Single math site on purpose — the
   * shadow duplicates NOTHING; G34 pins shadow==actual per cell on null runs,
   * so any drift between the two readers fails loudly. Operation order
   * matches the pre-extraction body exactly.
   */
  private static ceilingOutcome(cap: number, before: number, amount: number): { after: number; acceptedAmt: number; evictAmt: number } {
    const after = Math.min(cap, before + amount);
    // Zero when the cell was already over its ceiling: the incoming amount is
    // then refused in full and the clamp removes pre-existing excess instead.
    return {
      after,
      acceptedAmt: after > before ? after - before : 0,
      evictAmt: before > after ? before - after : 0,
    };
  }

  private returnThroughCeiling(
    data: Float32Array,
    nIdx: number,
    ci: number,
    amount: number,
    off: number,
    accepted: Float64Array,
    attempted: Float64Array,
    capLoss: Float64Array,
    eviction: Float64Array,
    // Optional phenotype mirror (O3). Excretion callers omit it and behave
    // byte-identically to before. One holder object per mineralization EVENT
    // (not per pool call); with the shadow/scratch locals nearby, per-event
    // short-lived objects total a handful — negligible GC pressure at
    // measured horizons (peak engine RSS ~149 MB). The booked values are the
    // same clamp locals either way.
    pheno: {
      accepted: Float64Array; attempted: Float64Array;
      capLoss: Float64Array; eviction: Float64Array; off: number;
    } | null = null,
  ): number {
    const cap = this.nutrientCapAt(nIdx, ci);
    const before = data[ci];
    const o = World.ceilingOutcome(cap, before, amount);
    data[ci] = o.after;
    attempted[off] += amount;
    accepted[off] += o.acceptedAmt;
    capLoss[off] += amount - o.acceptedAmt;
    eviction[off] += o.evictAmt;
    if (pheno !== null) {
      pheno.attempted[pheno.off] += amount;
      pheno.accepted[pheno.off] += o.acceptedAmt;
      pheno.capLoss[pheno.off] += amount - o.acceptedAmt;
      pheno.eviction[pheno.off] += o.evictAmt;
    }
    // Return the accepted amount so the O2 remainder can be derived without
    // re-reading books. Excretion callers ignore the return value.
    return o.acceptedAmt;
  }

  /**
   * One biotic-mineralisation return: split `returned` across the three pools,
   * push each share through the per-pool ceiling, and book all four flux
   * quantities for the right (guild, pool, source).
   *
   * Factored because the sediment / detritus / litter sites were three copies
   * of this arithmetic, differing only in `source`. Keeping one copy is what
   * makes the per-source books trustworthy: a fix applied to two of the three
   * copies is exactly the class of defect this method exists to prevent.
   *
   * `source`: 0=sediment, 1=detritus, 2=litter.
   */
  private mineraliseThroughCeiling(
    slot: number,
    ci: number,
    nutA: Float32Array,
    nutB: Float32Array,
    nutC: Float32Array,
    returned: number,
    source: 0 | 1 | 2,
  ): void {
    const g = this.roleOf(slot).trophic;
    const base = (g * NUTRIENT_COUNT * 3 + source);
    // Donor class from LIVE expressed traits at event time (O3). Computed once
    // per event so the three per-pool calls cannot split one event across
    // classes. Pure reads: no RNG, no writes, no behaviour change.
    const s = this.store;
    const cls = classifyMineralPheno(
      s.trait(slot, TRAIT.PHOTOSYNTHETIC_RATE),
      s.trait(slot, TRAIT.CARRION_AFFINITY),
      s.trait(slot, TRAIT.RECALCITRANT_DIGESTION),
      s.trait(slot, TRAIT.SPEED));
    const phenoBase = cls * TROPHIC_COUNT * NUTRIENT_COUNT * 3 + base;
    // O1 suppression (Owner Stage 2): shrink the OFFERED return for the named
    // class. Feeding takes already happened upstream; only this offer, the
    // book entries below, and the coupled mineralisedCell/bioticMineralised
    // feedback move. `scale === 1` (and null knob) uses `returned` directly so
    // declared behaviour is bit-identical; `returned * scale` is exact for
    // scale 1 anyway, but the branch makes the guarantee structural.
    // `neither` (cls 3) always passes through: suppressing an anomaly class
    // would hide stale-flag/trait-drift events instead of reporting them.
    const pmr = this.config.phenoMineralReturn;
    let scale = 1;
    if (pmr !== null && pmr !== undefined && cls !== 3) {
      scale = cls === 0 ? pmr.carrionOnly : cls === 1 ? pmr.recalcOnly : pmr.dual;
    }
    const offered = scale === 1 ? returned : returned * scale;
    // Suppressed to zero: touch NOTHING (Gate-2 P1a). Passing a zero offer
    // through the ceiling would clamp an already-over-cap cell down and book
    // eviction — a second intervention deleting standing nutrient the event
    // was supposed to leave alone. Natural zero offers (returned == 0 with
    // scale 1) keep the legacy path exactly, preserving null/unset baseline.
    const suppressedToZero = offered === 0 && scale === 0;
    // Shadow (reads live headroom, writes only shadow arrays): the UNSCALED
    // would-be offer through identical clamp math. On null runs this must
    // equal the actual books per cell (G34 asserts it). Scalar locals keep
    // this read path allocation-light; the per-event objects below (one pheno
    // holder plus ceilingOutcome results) are short-lived and negligible at
    // measured horizons.
    const shAtt = this.bioticShadowAttemptedClassGuildPoolSource;
    const shAcc = this.bioticShadowAcceptedClassGuildPoolSource;
    const shCap = this.bioticShadowCapLossClassGuildPoolSource;
    const shEvi = this.bioticShadowEvictionClassGuildPoolSource;
    // Per-pool would-be accepted (shadow) and actual accepted, retained for
    // the O2 remainder below. Scalar locals, no allocation.
    const shAccP = [0, 0, 0];
    const accP = [0, 0, 0];
    for (let p = 0; p < NUTRIENT_COUNT; p++) {
      const nut = p === 0 ? nutA : p === 1 ? nutB : nutC;
      const so = phenoBase + p * 3;
      const perFull = returned / NUTRIENT_COUNT;
      const o = World.ceilingOutcome(this.nutrientCapAt(p, ci), nut[ci], perFull);
      shAtt[so] += perFull;
      shAcc[so] += o.acceptedAmt;
      shCap[so] += perFull - o.acceptedAmt;
      shEvi[so] += o.evictAmt;
      shAccP[p] = o.acceptedAmt;
    }
    const pheno = {
      accepted: this.bioticPhenoAcceptedClassGuildPoolSource,
      attempted: this.bioticPhenoAttemptedClassGuildPoolSource,
      capLoss: this.bioticPhenoCapLossClassGuildPoolSource,
      eviction: this.bioticPhenoEvictionClassGuildPoolSource,
      off: 0,
    };
    if (suppressedToZero) {
      // P1a: a suppressed zero offer touches no field, book, or feedback —
      // but the shadow above still records the would-be flow and the rescue
      // below still replaces it. Skipping here is the entire fix.
    } else {
      const perPool = offered / NUTRIENT_COUNT;
      // Offsets step by 3 because the source dimension is the innermost one.
      pheno.off = phenoBase + 0 * 3;
      accP[0] = this.returnThroughCeiling(nutA, 0, ci, perPool, base + 0 * 3,
        this.bioticMineralizationGuildPoolSource, this.bioticAttemptedGuildPoolSource,
        this.bioticCapLossGuildPoolSource, this.bioticEvictionGuildPoolSource, pheno);
      pheno.off = phenoBase + 1 * 3;
      accP[1] = this.returnThroughCeiling(nutB, 1, ci, perPool, base + 1 * 3,
        this.bioticMineralizationGuildPoolSource, this.bioticAttemptedGuildPoolSource,
        this.bioticCapLossGuildPoolSource, this.bioticEvictionGuildPoolSource, pheno);
      pheno.off = phenoBase + 2 * 3;
      accP[2] = this.returnThroughCeiling(nutC, 2, ci, perPool, base + 2 * 3,
        this.bioticMineralizationGuildPoolSource, this.bioticAttemptedGuildPoolSource,
        this.bioticCapLossGuildPoolSource, this.bioticEvictionGuildPoolSource, pheno);
      // The SCALED offer drives the coupled feedback (cyclic regen reads
      // mineralisedCell; the broadcast loop runs on abiotic decay totals):
      // suppression's downstream coupling is therefore measured distinctly through the
      // existing abiotic books, never routed around.
      this.bioticMineralised += offered;
      this.mineralisedCell[ci] += offered;
    }
    // O2 rescue (Owner Stage 3): replace the forgone accepted remainder from
    // an exogenous donor at the SAME cell/tick/pool. Remainder per pool is
    // shAccP (would-be, pre-offer headroom) minus accP (actual just booked).
    // Injecting AFTER the suppressed offer keeps headroom exact: S <= cap-H
    // BY CLAMP CONSTRUCTION (S = min(cap,H+F)-H), so H+A0+R == H+S <= cap up
    // to float re-addition rounding (absorbed by the G35 bound) — a remainder
    // lands whole unless the cap genuinely binds, in which case the shortfall
    // books truthfully into exogenous capLoss. (S = 5 with H = 9.9, cap = 10
    // is impossible: the shadow clamp could never have accepted 5 there.)
    // Zero remainders skip (no clamp side effects, same P1a discipline).
    // Unrescued classes: R == 0 because shadow == actual there (G34 pins it),
    // so they no-op without a special case — except float dust: skip
    // threshold is exact `R > 0`. Rescue writes the nutrient FIELDS (it is
    // real nutrient) and the exogenous books ONLY — never biotic/abiotic/
    // ledger/cyclic inputs (cyclic reads mineralisedCell; the broadcast loop
    // runs on abiotic decay totals, not on bioticMineralised, which has no
    // simulation reader).
    const rsc = this.config.phenoMineralRescue;
    const rescueOn = rsc !== null && rsc !== undefined && cls !== 3
      && (cls === 0 ? rsc.carrionOnly : cls === 1 ? rsc.recalcOnly : rsc.dual);
    if (rescueOn) {
      const exAtt = this.exogenousAttemptedClassGuildPoolSource;
      const exAcc = this.exogenousAcceptedClassGuildPoolSource;
      const exCap = this.exogenousCapLossClassGuildPoolSource;
      const exEvi = this.exogenousEvictionClassGuildPoolSource;
      for (let p = 0; p < NUTRIENT_COUNT; p++) {
        const remainder = shAccP[p] - accP[p];
        if (!(remainder > 0)) continue;
        const nut = p === 0 ? nutA : p === 1 ? nutB : nutC;
        const eo = phenoBase + p * 3;
        const o = World.ceilingOutcome(this.nutrientCapAt(p, ci), nut[ci], remainder);
        nut[ci] = o.after;
        exAtt[eo] += remainder;
        exAcc[eo] += o.acceptedAmt;
        exCap[eo] += remainder - o.acceptedAmt;
        exEvi[eo] += o.evictAmt;
      }
    }
  }

  private writeRole(slot: number, r: RoleReadout): void {
    const rb = slot * ROLE_STRIDE;
    const role = this.store.role;
    role[rb] = r.trophic;
    role[rb + 1] = r.motility;
    // Quantised maturation in [0,1] over 255 steps: the cache is a Uint8Array,
    // and a coarse developmental gradient is more than enough for behaviour.
    role[rb + 2] = Math.max(0, Math.min(255, Math.round(r.maturation * 255)));
    role[rb + 3] = r.stage;
    // Reach in world units, scaled by 8 to fit a byte with ~0.12 unit
    // resolution, which is finer than any collision radius in the model.
    role[rb + 4] = Math.max(0, Math.min(255, Math.round(r.reach * 8)));
    this.bioticMineraliser[slot] = r.bioticMineraliser ? 1 : 0;
  }

  /** Public readout for inspection and reporting. */
  roleOf(slot: number): RoleReadout {
    const rb = slot * ROLE_STRIDE;
    const role = this.store.role;
    return {
      trophic: role[rb],
      motility: role[rb + 1],
      maturation: role[rb + 2] / 255,
      stage: role[rb + 3],
      reach: role[rb + 4] / 8,
      bioticMineraliser: this.bioticMineraliser[slot] === 1,
    };
  }

  /**
   * Current effective body radius, which grows with development.
   * Callers that need collision or render size must use this rather than the
   * raw genotype-derived radius, or juveniles will be drawn and collided at
   * adult size and developmental growth will be invisible.
   */
  effectiveRadius(slot: number): number {
    const rb = slot * ROLE_STRIDE;
    const role = this.store.role;
    return developmentalScale(
      { maturation: role[rb + 2] / 255, stage: role[rb + 3] } as RoleReadout,
      this.store.hitRadius[slot],
    );
  }

  /** Damage multiplier from developmental stage, for contest resolution. */
  stageDamageFactor(slot: number): number {
    const rb = slot * ROLE_STRIDE;
    const role = this.store.role;
    return stageDamageFactor({ maturation: role[rb + 2] / 255, stage: role[rb + 3] } as RoleReadout);
  }

  // =========================================================================
  // The tick pipeline
  // =========================================================================

  step(): void {
    this.tick++;
    this.successfulMating.fill(0);
    const cfg = this.config;
    const store = this.store;

    // --- Phase 1: abiotic axis ---------------------------------------------
    const a0 = now();
    const axis = this.abiotic.stepAxis(this.tick, cfg.baseLight, cfg.lightAmplitude);
    this.globalLight = axis.light;
    this.globalTemp = this.abiotic.baseTemperature(cfg.baseTemp, cfg.tempAmplitude);
    this.abiotic.maybeDisturb(this.tick, cfg.worldW, cfg.worldH, this.rng);
    this.disturbancesFired = this.abiotic.history.length;
    this.abiotic.age();
    const t1 = now();

    // --- Phase 2: substrate fields ----------------------------------------
    const detritus = this.detritus;
    // External organic input (falling matter). This is an energy INPUT and is
    // recorded as such.
    const perCellOrganic = cfg.basalFoodPerCell;
    // Leaf-litter rain: part of the organic input arrives as RECALCITRANT
    // structural material (fallen leaves, woody debris) rather than as labile
    // detritus. One total is booked for both destinations, so the identity is
    // unchanged - the input is the same, only its quality is partitioned.
    const labileRain = perCellOrganic * (1 - cfg.litterRainShare);
    const litterRain = perCellOrganic * cfg.litterRainShare;
    const litterField = this.litter.data;
    for (let i = 0; i < detritus.data.length; i++) {
      detritus.data[i] += labileRain;
      litterField[i] += litterRain;
    }
    this.ledger.recordOrganicInput(perCellOrganic * detritus.data.length);
    // Nutrient regeneration toward each cell's own carrying capacity, applied
    // independently to each limiting pool.
    //
    // A constant addition would make nutrient inexhaustible and cap producer
    // biomass only by time, not by space. Regenerating toward a HABITAT-BOUNDED
    // ceiling means a dense sessile producer population can genuinely exhaust
    // the patch it roots in, which is what makes colonisation, succession,
    // competitive displacement and collapse reachable instead of narrated.
    const hab = this.habitat;
    const fert = hab.fertility.data;
    const drain = hab.drainage.data;
    const nCells = detritus.data.length;
    // Diagnostic: cyclic nutrient regeneration (nutrientCyclic). Declared
    // behaviour regenerates nutrient abiotically at a flat rate, which is a
    // free lunch: producers can farm it forever with nothing else alive.
    // When set, regeneration is scaled by local decomposition substrate, so
    // nutrient returns only where organic matter is actually being worked on
    // — decomposer activity — and a producer-only world slowly starves.
    const cyclic = cfg.nutrientCyclic === true;
    this.cyclicFluxLastTick = 0;
    for (let nIdx = 0; nIdx < NUTRIENT_COUNT; nIdx++) {
      const nData = this.nutrients[nIdx].data;
      const mod = cfg.nutrientCapacity[nIdx] ?? 1;
      for (let i = 0; i < nCells; i++) {
        const cap = cfg.nutrientPerCell * fert[i] * mod;
        let rate = cfg.nutrientRegen;
        if (cyclic) {
          // Driven by substrate mineralisers ACTUALLY processed this tick, not
          // by standing substrate. Ablate the mineralisers and this term goes
          // to zero even with a full substrate pool; that separation is what
          // makes it a biotic coupling rather than background regeneration.
          const sat = Math.max(1e-6, cfg.mixotrophySaturation);
          const raw = this.mineralisedCell[i];
          if (raw > this.cyclicFluxLastTick) this.cyclicFluxLastTick = raw;
          rate *= raw / (raw + sat);
        }
        const before = nData[i];
        nData[i] += (cap - nData[i]) * rate * drain[i];
        // Flux measurement: abiotic regeneration per pool
        this.abioticRegenPool[nIdx] += nData[i] - before;
        // Diagnostic: abiotic nutrient floor (nutrientFloor), a fraction of
        // capacity. This is the RECOVERY PATH for the A+C deadlock, not an
        // energy subsidy: it guarantees a remnant population can always
        // regrow, without supplying enough to sustain a standing guild.
        // Applied after regeneration and before clamping so the floor is the
        // value that actually survives the tick. Zero = declared behaviour.
        const floor = cfg.nutrientFloor * cap;
        if (nData[i] < floor) nData[i] = floor;
        if (nData[i] > cap) nData[i] = cap;
        else if (nData[i] < 0) nData[i] = 0;
      }
      this.nutrients[nIdx].step(cfg.nutrientDiffusivity, cfg.nutrientDecay);
    }

    // Clear the flux AFTER the regen loop has read it, not before.
    //
    // The fill used to sit at the top of this phase, so the cyclic term below
    // always read 0 and `nutrientCyclic` behaved as a nutrient KILL-SWITCH
    // rather than a coupling. The loop now reads the PREVIOUS tick's
    // mineraliser throughput (a deliberate one-tick lag, since mineralisation
    // itself runs later in actPhase), and the array is cleared here ready for
    // this tick's accumulation.
    this.mineralisedCell.fill(0);

    // Detritus mineralises: it leaves the biological loop as it becomes
    // inorganic nutrient. Energy that was in a corpse does NOT come back free.
    // Each pool's decay is booked EXACTLY ONCE, from its own accumulator.
    // Sharing one accumulator across both loops and booking after each loop
    // double-counted the first pool, creating energy every tick.
    let detritusMineralised = 0;
    for (let i = 0; i < nCells; i++) {
      const d = detritus.data[i];
      if (d <= 0) continue;
      const r = d * cfg.detritusDecay;
      detritus.data[i] = d - r;
      detritusMineralised += r;
    }
    this.ledger.recordMineralised(detritusMineralised);

    // Sediment decays far more slowly than suspended detritus, which is what
    // makes it a persistent reservoir rather than a transient one.
    const sed = this.sediment.data;
    let sedimentMineralised = 0;
    for (let i = 0; i < nCells; i++) {
      const v = sed[i];
      if (v <= 0) continue;
      const r = v * cfg.sedimentDecay;
      sed[i] = v - r;
      sedimentMineralised += r;
    }
    this.ledger.recordMineralised(sedimentMineralised);

    // Recalcitrant litter decays slowest of the three organic pools, so a thin
    // flux integrates into a usable reservoir rather than vanishing. Booked from
    // its OWN accumulator: sharing one accumulator across pools double-counted
    // the first pool once already, which created energy every tick.
    const litter = this.litter.data;
    let litterMineralised = 0;
    for (let i = 0; i < nCells; i++) {
      const v = litter[i];
      const r = v * cfg.litterDecay;
      litter[i] = v - r;
      litterMineralised += r;
    }
    this.ledger.recordMineralised(litterMineralised);

    // Mineralised matter returns to the substrate split across the pools, so
    // recycling does not silently become a nutrient-A-only subsidy.
    // Return the recycled fraction ONCE, split across pools AND cells.
    //
    // This previously broadcast `share` to every cell while dividing only by
    // the pool count, so the aggregate addition was nCells times the quantity
    // that was actually mineralised. Nutrients are NOT covered by the energy
    // ledger, so the accounting residual could not see it: the books stayed
    // balanced while substrate was created from nothing. Dividing by the cell
    // count as well makes aggregate recycling independent of grid resolution,
    // which G9 asserts directly.
    const totalMineralised = detritusMineralised + sedimentMineralised + litterMineralised;
    const share = (totalMineralised * cfg.recyclingRate * 0.5) / (NUTRIENT_COUNT * nCells);
    // Record the pair G9 asserts on. The aggregate returned is share * nCells
    // * NUTRIENT_COUNT, which must collapse back to the intended quantity.
    this.mineralisedLastTick = totalMineralised;
    this.recycledLastTick = share * nCells * NUTRIENT_COUNT;
    let applied = 0;
    for (let nIdx = 0; nIdx < NUTRIENT_COUNT; nIdx++) {
      const nData = this.nutrients[nIdx].data;
      for (let i = 0; i < nCells; i++) {
        nData[i] += share;
        applied += share; // measured inside the loop, not derived from the formula
      }
      // Flux measurement: abiotic mineralization from organic pools per pool
      // Source: 0=detritus, 1=sediment, 2=litter (evenly distributed via share)
      this.abioticMineralizationPoolSource[nIdx * 3 + 0] += share * nCells * (detritusMineralised / totalMineralised || 0);
      this.abioticMineralizationPoolSource[nIdx * 3 + 1] += share * nCells * (sedimentMineralised / totalMineralised || 0);
      this.abioticMineralizationPoolSource[nIdx * 3 + 2] += share * nCells * (litterMineralised / totalMineralised || 0);
    }
    this.recycledAppliedLastTick = applied;
    const t2 = now();

    // --- Phase 3: spatial rebuild -----------------------------------------
    // Build from a LIVE-PACKED position array. Passing the dense bound would
    // index dead-but-recycled slots, so corpses stayed in the neighbour index
    // and inflated every query's fan-out for the rest of the tick - a cost that
    // grows with cumulative deaths, not with current population.
    const liveCount = this.packLivePositions();
    this.grid.build(this.packedX, this.packedY, liveCount);
    // Packed slot index -> real slot, so neighbour hits map back correctly.
    this.grid.buildPackedIndices(this.packedSlots, liveCount);
    this.rebuildShadeMass(liveCount);
    this.rebuildPatchCensus(liveCount);
    const t3 = now();

    // --- Phase 4: sense / decide / move / metabolise / feed -----------------
    // Reset the interaction queue BEFORE the act phase fills it. Resetting
    // afterwards would silently discard every submission the act phase made,
    // which presents as an ecology that never contests anything.
    this.interactions.reset();
    this.actPhase();
    const t4 = now();

    // --- Phase 4b: reciprocal mating ---------------------------------------
    // actPhase only recorded mating CONTACTS; the intent array is not
    // authoritative until every slot has acted, so consent is settled here.
    this.resolveMatingIntent();

    // --- Phase 5: contested interactions -----------------------------------
    // Requests were submitted during actPhase; resolve them now while every
    // participant is still guaranteed live.
    this.resolveContests();
    const t5 = now();

    // --- Phase 6: reproduction proposals -----------------------------------
    this.proposeReproduction();
    const t6 = now();

    // --- Phase 7: deaths, then release slots -------------------------------
    this.deathPhase();
    const t7 = now();

    // --- Phase 8: births ---------------------------------------------------
    this.birthPhase();
    const t8 = now();

    // --- Phase 9: metrics --------------------------------------------------
    if (store.population > this.peakPopulation) this.peakPopulation = store.population;
    if (store.population === 0) this.emptyTicks++;
    this.snapshot = this.measure();
    this.history.record(this.tick, this.snapshot);
    const t9 = now();

    if (this.profiling) {
      const tm = this.timings;
      tm.abiotic = t1 - a0;
      tm.fields = t2 - t1;
      tm.spatial = t3 - t2;
      tm.act = t4 - t3;
      tm.contests = t5 - t4;
      tm.deaths = t6 - t5;
      tm.births = t8 - t7;
      tm.total = t9 - a0;
      const tot = this.totals;
      tot.abiotic += tm.abiotic;
      tot.fields += tm.fields;
      tot.spatial += tm.spatial;
      tot.act += tm.act;
      tot.contests += tm.contests;
      tot.deaths += tm.deaths;
      tot.births += tm.births;
      tot.total += tm.total;
    }
  }

  // -------------------------------------------------------------------------
  // Phase 4: the per-organism hot loop
  // -------------------------------------------------------------------------

  /**
   * Sense, decide, move, metabolise, feed.
   *
   * This is the loop the performance protocol cares most about. It reads
   * exclusively from the flattened typed arrays and writes only to them; the
   * cached `Phenotype` objects are touched only for rendering and inspection,
   * never here. Traits are read through `store.physical` with a precomputed
   * per-slot base offset.
   */
  private actPhase(): void {
    const store = this.store;
    const cfg = this.config;
    const n = store.count;
    this.mateCandN = 0;
    if (n === 0) return;
    const p = store.physical;
    const x = store.x;
    const y = store.y;
    const mods = this.localMods;
    this.resetTickDiagnostics();

    // Per-tick constants hoisted out of the loop.
    const fieldW = cfg.worldW / this.nutrients[0].cols;
    const fieldH = cfg.worldH / this.nutrients[0].rows;
    const nCols = this.nutrients[0].cols;
    const nRows = this.nutrients[0].rows;
    // Direct references to each pool's backing array, hoisted out of the loop.
    const nutA = this.nutrients[0].data;
    const nutB = this.nutrients[1].data;
    const nutC = this.nutrients[2].data;
    const detritusData = this.detritus.data;
    const sedimentData = this.sediment.data;
    const litterData = this.litter.data;
    const globalLight = this.globalLight;
    const globalTemp = this.globalTemp;
    const shade = this.habitat.shade.data;
    const roleBlock = store.role;

    for (let slot = 0; slot < n; slot++) {
      if (!this.live[slot]) continue;
      const o = slot * TRAIT_COUNT;

      // --- Read the traits this organism actually uses. ---------------------
      const size = p[o + TRAIT.SIZE];
      const photo = p[o + TRAIT.PHOTOSYNTHETIC_RATE];
      const efficiency = p[o + TRAIT.METABOLIC_EFFICIENCY];
      const capacity = this.capacityOf(slot);
      const basalCost = p[o + TRAIT.BASAL_COST];
      const massCost = p[o + TRAIT.MASS_COST];
      const digestion = p[o + TRAIT.DIGESTION_RATE];
      const thermalTol = p[o + TRAIT.THERMAL_TOLERANCE];
      const visionRange = p[o + TRAIT.VISION_RANGE];
      const fov = p[o + TRAIT.VISION_FOV];
      const nutrientSense = p[o + TRAIT.NUTRIENT_SENSE];
      const threatSense = p[o + TRAIT.THREAT_SENSE];
      const aggression = p[o + TRAIT.AGGRESSION];
      const timidity = p[o + TRAIT.TIMIDITY];
      const foragingDrive = p[o + TRAIT.FORAGING_DRIVE];
      const herdInstinct = p[o + TRAIT.HERD_INSTINCT];
      const exploration = p[o + TRAIT.EXPLORATION];
      const appetite = p[o + TRAIT.FEEDING_APPETITE];
      // Digestive capacity for structural (recalcitrant) material. Gates the
      // litter pool. Physical value equals the gene (0..1 range), so it is used
      // directly as a fraction.
      const recalc = p[o + TRAIT.RECALCITRANT_DIGESTION];
      const maturityAge = p[o + TRAIT.MATURITY_AGE];
      const carrion = p[o + TRAIT.CARRION_AFFINITY];
      const memory = p[o + TRAIT.MEMORY];
      // Endurance resists fatigue: the trait that decides whether a prey animal
      // can outrun a predator indefinitely.
      const endurance = p[o + TRAIT.ENDURANCE];
      // Nutrient-partitioning traits: heritable niche specialisation.
      const affA = p[o + TRAIT.NUTRIENT_A];
      // Foraging strategy: benthic deposit feeding vs active hunting. This is
      // what lets consumer guilds diverge instead of competing identically.
      const detritivory = p[o + TRAIT.DETRITIVORY];
      const huntDrive = 1 - detritivory;
      const affB = p[o + TRAIT.NUTRIENT_B];
      const affC = p[o + TRAIT.NUTRIENT_C];
      // Normalized size gene. Used for gape limitation, which needs a scale-
      // free value: the PHYSICAL size trait runs to ~15, so a modifier written
      // against it would go negative for large organisms.
      const sizeGene = store.genome[o + TRAIT.SIZE];

      const px = x[slot];
      const py = y[slot];
      const heading = store.heading[slot];

      // --- Local abiotic conditions ---------------------------------------
      this.abiotic.modifiersAt(px, py, mods);

      // --- Sensing ---------------------------------------------------------
      // Cost of sensing is real: a large sensory field burns energy.
      const senseCost = visionRange * 0.00022 * (1 + memory * 0.0008);
      // Dormant organisms do not sense: no information gathering while waiting.
      // Reads last tick's flag (sensing precedes feeding evaluation).
      // `asleep` is the dormantThreatBlind DIAGNOSTIC (null = off): it waives
      // the sensing cost AND the threat detection below. With the knob off,
      // `asleep` is always false and both lines behave exactly as declared —
      // the cost waiver below is gated on the dormancy knob alone, so the
      // two can no longer disagree.
      // Dormant, per the DECLARED dormancy knob (drives the cost waiver only).
      const dormant = this.config.decomposerDormancy !== null && this.dormant[slot] === 1;
      // Blind, per the dormantThreatBlind diagnostic (drives threat detection
      // only). Kept as a separate flag so knob-off reproduces declared
      // behaviour EXACTLY: the cost waiver must not depend on the diagnostic.
      const asleep = dormant && this.config.dormantThreatBlind === true;
      if (!dormant) {
        this.spend(slot, senseCost, 'sensing');
      }

      let prey = -1;
      let preyDistSq = Infinity;
      let grazeTarget = -1;
      let grazeDistSq = Infinity;
      let threat = -1;
      let threatDistSq = Infinity;
      let mate = -1;
      let mateDistSq = Infinity;
      let crowding = 0;
      let sameKind = 0;
      // Herd centroid, in offsets from this organism. Accumulated for
      // conspecifics only (same trophic role, comparable body size).
      let herdX = 0;
      let herdY = 0;
      let herdN = 0;

      const senseR = store.senseRadius[slot];
      if (this.neighbourScratch.length < n) this.neighbourScratch = new Int32Array(n * 2);
      const found = this.grid.query(px, py, senseR, this.neighbourScratch);
      const cosHalf = Math.cos(Math.min(Math.PI, fov * 0.5));
      for (let k = 0; k < found; k++) {
        const other = this.neighbourScratch[k];
        if (other === slot || !this.live[other]) continue;
        const ox = x[other];
        const oy = y[other];
        const dx = ox - px;
        const dy = oy - py;
        const dSq = dx * dx + dy * dy;
        if (dSq > senseR * senseR) continue;
        crowding++;

        const oo = other * TRAIT_COUNT;
        const otherSize = p[oo + TRAIT.SIZE];

        // Field-of-view check: FOV >= 2*pi means omnidirectional.
        let inFov = true;
        if (fov < Math.PI * 1.99) {
          const d = Math.sqrt(dSq);
          if (d > 1e-6) {
            const cosA = (dx / d) * Math.cos(heading) + (dy / d) * Math.sin(heading);
            inFov = cosA >= cosHalf;
          }
        }

        // Gape constraint: a predator must be within a plausible size band of
        // its prey. This is what creates real niche structure instead of a
        // big-animal-eats-everything world.
        const ratio = otherSize / Math.max(0.05, size);
        // Gape limitation.
        //
        // The band is deliberately WIDE (0.16..0.92). A tighter band plus a
        // large-attacker requirement was tried to separate predator and grazer
        // guilds by body size; it was measured and REJECTED, because it removed
        // hunting from grazers and grazers collapsed (34 -> 5) even with
        // herbivory available. Hunting is load-bearing for small consumers.
        const edible = ratio > 0.16 && ratio < 0.92;
        // Something is a threat if it out-sizes us, or if it is our size band
        // and actually armed.
        const dangerous = ratio > 1.12 || (ratio > 0.86 && p[oo + TRAIT.TOXIN] > 0.45);

        if (inFov && edible && otherSize < size * 0.95 && dSq < preyDistSq) {
          preyDistSq = dSq;
          prey = other;
        }
        // A sleeping organism gathers no information at all, so it cannot
        // DETECT a threat. Gated on the dormantThreatBlind diagnostic: with
        // the knob on, pay-nothing also means see-nothing, so a hunter walks
        // up to a sleeper and the sleeper has no warning. `threat` stays -1,
        // the FLEE case below has no bearing, and the sleeper holds
        // position. Knob off (null = declared behaviour) leaves threat
        // detection untouched, which is what every prior measurement saw.
        if (dangerous && dSq < threatDistSq && !asleep) {
          threatDistSq = dSq;
          threat = other;
        }
        // A living producer is potential forage for a heterotroph. This is the
        // renewable consumer food source; without it every consumer is a
        // detritivore and the two consumer guilds exclude each other.
        const otherTrophic = roleBlock[other * ROLE_STRIDE];
        if (otherTrophic === TROPHIC.PRODUCER && dSq < grazeDistSq) {
          grazeDistSq = dSq;
          grazeTarget = other;
        }
        if (
          inFov &&
          store.age[other] > maturityAge &&
          store.age[slot] > maturityAge &&
          ratio > 0.62 &&
          ratio < 1.6 &&
          dSq < mateDistSq
        ) {
          mateDistSq = dSq;
          mate = other;
        }
        if (otherSize > 0.85 * size && otherSize < 1.15 * size) sameKind++;
        // Conspecifics for herding. Same trophic role and broadly comparable
        // body size. Since the readout collapse (v0.3.3) all mobile
        // heterotrophs share CONSUMER, so hunters, grazers and scavengers of
        // similar size now herd together where before they did not — mixed
        // herding groups, which are real ecology (zebra/wildebeest), not a bug
        // preserved from the five-guild taxonomy. Independent review confirmed
        // this as the one behavioural delta of the collapse; kept deliberately
        // rather than reconstructing diet guilds through the back door.
        if (roleBlock[other * ROLE_STRIDE] === roleBlock[slot * ROLE_STRIDE] && otherSize > 0.6 * size && otherSize < 1.7 * size) {
          herdX += dx;
          herdY += dy;
          herdN++;
        }
      }

      this.preyTarget[slot] = prey;
      this.grazeTarget[slot] = grazeTarget;
      this.threatTarget[slot] = threat;
      this.mateTarget[slot] = mate;
      if (prey >= 0) this.lastDetectedPrey++;
      if (threat >= 0) this.lastDetectedThreat++;
      if (mate >= 0) this.lastDetectedMate++;

      // --- Behaviour arbitration -------------------------------------------
      // Utility per option from evolved traits and genuine local opportunity.
      // Absence of an opportunity zeroes that option's score, so intent is
      // always downstream of what is actually nearby.
      const age = store.age[slot];
      const energy = store.energy[slot];
      const energyFrac = energy / Math.max(1, capacity);
      const maturity = age > maturityAge ? 1 : 0;

      const cellX = Math.min(nCols - 1, Math.max(0, (px / fieldW) | 0));
      const cellY = Math.min(nRows - 1, Math.max(0, (py / fieldH) | 0));
      const localDetritus = detritusData[cellY * nCols + cellX];
      void sedimentData;
      // Flat index of this organism's substrate cell, reused by both feeders.
      const ci = cellY * nCols + cellX;

      // Producers are not really "hunting"; they track substrate.
      // Behaviour arbitration.
      //
      // Every size-related modifier below uses the NORMALIZED size gene, not
      // the physical body size. Physical size runs to ~15, so a modifier
      // written as (1 - size*0.1) goes negative for large animals and
      // silently switches predation off for exactly the organisms that should
      // be the dominant predators.
      const localNutrientMean = (nutA[ci] + nutB[ci] + nutC[ci]) / NUTRIENT_COUNT;
      const photoOpportunity = photo > 0.02 ? localNutrientMean * globalLight * mods.lightMul : 0;
      const feedScore =
        foragingDrive * 1.1 * (photoOpportunity * 0.5 + (localDetritus > 0.4 ? carrion * 0.8 : 0)) +
        appetite * 0.12;
      const huntScore =
        prey >= 0 ? huntDrive * aggression * 2.4 * (1 - timidity * 0.4) * (1 - sizeGene * 0.25) : 0;
      // Benthic feeding is available regardless of the water-column pool.
      const scavengeScore = (localDetritus > 0.4 || sedimentData[ci] > 0.2) ? detritivory * 1.5 * appetite : 0;
      const fleeScore =
        threat >= 0
          ? timidity *
            2.0 *
            threatSense *
            (1 - sizeGene * 0.15) *
            (energyFrac < 0.35 ? 1.35 : 1)
          : 0;
      const mateScore =
        maturity && mate >= 0 && energyFrac > 0.5 ? p[o + TRAIT.MATE_SEEKING] * 1.8 : 0;
      // Settling is a genuine option but must not be the default winner: it
      // only dominates under real crowding AND low reserves, otherwise
      // nothing ever hunts and the ecology goes inert.
      const settleScore =
        crowding > 6 ? 0.5 + herdInstinct * 0.45 * (1 - energyFrac) : 0.05 + (1 - exploration) * 0.22;
      const exploreScore = exploration * 0.75 + (crowding > 8 ? 0.3 : 0);
      // Herbivory is preferred over hunting when a producer is in reach: it is
      // cheaper per unit energy and does not require winning a lethal contest.
      const grazeScore =
        grazeTarget >= 0 ? detritivory * 0.6 + appetite * 1.5 * (1 - sizeGene * 0.2) : 0;

      // Behaviour arbitration scores live in a reused scratch buffer; the
      // number of options is fixed at 7 intents.
      const score = this.intentScores;
      score[0] = feedScore;
      score[1] = huntScore;
      score[2] = scavengeScore;
      score[3] = fleeScore;
      score[4] = mateScore;
      score[5] = settleScore;
      score[6] = exploreScore;
      score[7] = grazeScore;
      // Weighted random selection: ties are broken by chance, not by index
      // order, so behaviour is not biased toward the first option listed.
      const pick = this.weightedChoice(score, 8, 0.32);
      this.intent[slot] = pick;
      this.intentCounts[pick]++;

      // --- Fatigue ---------------------------------------------------------
      // Only sustained fleeing tires an animal. A short burst costs little;
      // a sustained chase is what exhausts prey, and that is what lets a
      // predator win a chase it could never win on raw speed.
      if (pick === INTENT.FLEE) {
        // Endurance is 0..1; resistance = endurance. A prey animal with high
        // endurance barely tires, which is a real anti-predator strategy.
        const resist = endurance;
        store.fatigue[slot] = Math.min(1, store.fatigue[slot] + (0.028 * (1 - resist * 0.92)));
      } else if (store.fatigue[slot] > 0) {
        store.fatigue[slot] = Math.max(0, store.fatigue[slot] - 0.014);
      }


      // --- Turn toward the chosen goal -------------------------------------
      let wantTurn = 0;
      let moveAmount = 0;
      switch (pick) {
        case INTENT.FEED: {
          // Producers climb the nutrient gradient; heterotrophs home on
          // detritus when there is any nearby.
          moveAmount = 0.75;
          if (nutrientSense > 0.02 || photo <= 0.02) {
            wantTurn = this.gradientHeading(px, py, heading, nutrientSense, 26) - heading;
          }
          break;
        }
        case INTENT.HUNT: {
          // Pursuit boost. A hunter moving at the same top speed as its quarry
          // can never close the gap, because both re-decide every tick and
          // reverse on any frame wobble. Predators normally outperform prey
          // over a sustained chase; this encodes that, scaled by burst power.
          const burst = p[o + TRAIT.BURST_POWER];
          moveAmount = 1.15 + burst * 0.35;
          // A pure autotroph does not hunt.
          //
          // Gated on the DERIVED TROPHIC ROLE rather than a phototrophy
          // threshold, because the role is a readout of the whole trait vector
          // and this therefore stays derived rather than a hardcoded cutoff.
          // A phototrophy threshold let producers whose gene fell just under it
          // hunt their own trophic level: measured deaths were 162/170 from
          // predation in a population that was 92 % producers.
          const canHunt = roleBlock[slot * ROLE_STRIDE] !== TROPHIC.PRODUCER;
          if (prey >= 0 && canHunt) {
            wantTurn = angleTo(px, py, x[prey], y[prey]) - heading;
            // Close enough to strike rather than close further. Reach is the
            // pair's collision radii plus a lunge allowance, so a strike is
            // physically possible instead of requiring sub-unit precision.
            const dSq = preyDistSq;
            // Use DEVELOPMENTAL radii: a juvenile is physically smaller, so its
            // strike reach must shrink with it. Using the raw genotype radius
            // here would make growth invisible in the one place it matters.
            const reach = this.effectiveRadius(slot) + this.effectiveRadius(prey) + 4.5;
            if (dSq < reach * reach) {
              moveAmount = 0;
              this.submittedByKind[INTERACTION.PREDATE]++;
              this.interactions.submit(
                this.store,
                slot,
                prey,
                INTERACTION.PREDATE,
                Math.min(energy, capacity * 0.4),
              );
            }
          }
          break;
        }
        case INTENT.SCAVENGE: {
          moveAmount = 0.85;
          wantTurn = this.detritusHeading(px, py, heading, carrion, 26) - heading;
          break;
        }
        case INTENT.FLEE: {
          moveAmount = 1.25;
          if (threat >= 0) {
            // Run directly away, and pay for the sprint.
            wantTurn = angleTo(px, py, x[threat], y[threat]) + Math.PI - heading;
          }
          break;
        }
        case INTENT.MATE: {
          moveAmount = 0.7;
          if (mate >= 0) {
            wantTurn = angleTo(px, py, x[mate], y[mate]) - heading;
            const dSq = mateDistSq;
            if (dSq < (store.hitRadius[slot] + store.hitRadius[mate] + 3) ** 2) {
              moveAmount = 0;
              // Recorded, not submitted. Whether this contact matures into a
              // mating depends on the PARTNER also choosing MATE this tick,
              // and the partner may not have acted yet.
              if (this.mateCandN >= this.mateCandA.length) {
                const grown = new Int32Array(this.mateCandA.length * 2);
                grown.set(this.mateCandA);
                this.mateCandA = grown;
                const grownB = new Int32Array(this.mateCandB.length * 2);
                grownB.set(this.mateCandB);
                this.mateCandB = grownB;
              }
              this.mateCandA[this.mateCandN] = slot;
              this.mateCandB[this.mateCandN] = mate;
              this.mateCandN++;
            }
          }
          break;
        }
        case INTENT.SETTLE:
          moveAmount = sameKind > 0 ? 0.16 : 0;
          break;
        case INTENT.GRAZE: {
          // Approach a living producer and browse it on contact.
          moveAmount = 0.85;
          const canGraze = roleBlock[slot * ROLE_STRIDE] !== TROPHIC.PRODUCER;
          if (grazeTarget >= 0 && canGraze) {
            wantTurn = angleTo(px, py, x[grazeTarget], y[grazeTarget]) - heading;
            const reach = this.effectiveRadius(slot) + this.effectiveRadius(grazeTarget) + 3.5;
            if (grazeDistSq < reach * reach) {
              moveAmount = 0;
              this.submittedByKind[4]++;
              this.interactions.submit(this.store, slot, grazeTarget, 4, Math.min(energy, capacity * 0.4));
            }
          }
          break;
        }
        case INTENT.EXPLORE:
        default:
          moveAmount = 0.55 + exploration * 0.5;
          break;
      }

      // --- Herding ---------------------------------------------------------
      // Cohesion: steer toward the centroid of nearby conspecifics, weighted by
      // the heritable `herdInstinct`. This is real herding - aggregation for
      // predator dilution and for staying on known forage - and it has a direct
      // top-down consequence: a herd dilutes predation risk, so grouping
      // individuals genuinely reduces per-capita mortality from predators.
      //
      // Previously `herdInstinct` only bent the body plan and damped
      // exploration; nothing actually caused organisms to move together.
      if (herdN >= 2 && herdInstinct > 0.05) {
        const cohesion = Math.min(0.85, herdInstinct * (1 - 0.45 * energyFrac));
        const hx = herdX / herdN;
        const hy = herdY / herdN;
        if (Math.abs(hx) > 1e-6 || Math.abs(hy) > 1e-6) {
          const toHerd = Math.atan2(hy, hx) - heading;
          wantTurn += toHerd * cohesion;
        }
      }

      // --- Locomotion ------------------------------------------------------
      // Turn rate is bounded by maneuverability, expressed as a trait.
      const maneuverability = p[o + TRAIT.MANEUVERABILITY];
      const maxTurn = 0.16 + maneuverability * 1.5;
      if (wantTurn > Math.PI) wantTurn -= Math.PI * 2;
      else if (wantTurn < -Math.PI) wantTurn += Math.PI * 2;
      const turn = wantTurn > maxTurn ? maxTurn : wantTurn < -maxTurn ? -maxTurn : wantTurn;
      const newHeading = heading + turn;
      store.heading[slot] = newHeading;

      // --- Locomotion, gated by motility -----------------------------------
      // Sessile organisms are rooted: they do not translate. This is the
      // autotrophy/immobility trade-off, and it is what makes substrate
      // depletion local and therefore what makes succession possible.
      const roleBase = slot * ROLE_STRIDE;
      const motility = roleBlock[roleBase + 1];
      let step = store.maxStep[slot] * moveAmount;
      if (motility === MOTILITY.SESSILE) step = 0;
      else if (motility === MOTILITY.CREEP) step *= 0.32;
      // Exhaustion slows an animal down. Applied to every mover, so a tired
      // predator tires too: pursuit is not free for either side.
      const fatiguePenalty = 1 - store.fatigue[slot] * 0.62;
      if (fatiguePenalty > 0) step *= fatiguePenalty;
      if (step < 0) step = 0;

      // Movement cost is quadratic-plus in speed, so sprinting is expensive.
      if (step > 0) {
        const frac = Math.min(1.6, step / Math.max(0.001, store.maxStep[slot]));
        let moveCost = (0.004 * frac * frac + 0.0012 * frac * frac * frac * frac) * (1 + size * 0.5);
        // Sprinting while exhausted is disproportionately expensive: the
        // quadratic term is amplified by fatigue, which is what turns a chase
        // into a decisive attrition contest rather than an endless stalemate.
        if (store.fatigue[slot] > 0.05) {
          moveCost *= 1 + store.fatigue[slot] * 2.4;
        }
        this.spend(slot, moveCost * cfg.locomotionCostScale, 'movement');
        let nx = px + Math.cos(newHeading) * step;
        let ny = py + Math.sin(newHeading) * step;
        // Walls are semi-permeable: bounce rather than clamp, so the boundary
        // is a real (if crude) habitat edge and not a sticky accumulation site.
        if (nx < 0) { nx = -nx; store.heading[slot] = Math.PI - newHeading; }
        else if (nx > cfg.worldW) { nx = 2 * cfg.worldW - nx; store.heading[slot] = Math.PI - newHeading; }
        if (ny < 0) { ny = -ny; store.heading[slot] = -newHeading; }
        else if (ny > cfg.worldH) { ny = 2 * cfg.worldH - ny; store.heading[slot] = -newHeading; }
        x[slot] = nx < 0 ? 0 : nx > cfg.worldW ? cfg.worldW : nx;
        y[slot] = ny < 0 ? 0 : ny > cfg.worldH ? cfg.worldH : ny;
      }

      // --- Metabolism ------------------------------------------------------
      // Homeostatic cost. Organisms outside their thermal tolerance burn more.
      const tempHere = globalTemp + mods.tempOffset;
      const thermalStress = Math.max(0, Math.abs(tempHere - 18) / 18) / Math.max(0.05, thermalTol);
      // Same upkeep basis the starvation/reproduction checks use, plus the
      // thermal stress term that sits on top of baseline maintenance.
      let basal = (upkeepOf(basalCost, size, massCost) + thermalStress * 0.05) * mods.metabolismMul;
      // Consumer upkeep scale (diagnostic, default null = unchanged). Consumers
      // spend 75.9% of their budget on basal; this tests whether overhead is
      // the binding constraint on breeding surplus.
      if (this.config.consumerBasalScale !== null && this.roleOf(slot).trophic === 1) {
        basal *= this.config.consumerBasalScale;
      }
      // Dormancy: upkeep collapses while waiting. Reads last tick's flag
      // (evaluated at feeding, after basal is charged) — 1-tick lag, negligible
      // for a slow state. Only reachable when the knob is set, since dormant[]
      // is otherwise always zero.
      if (this.dormant[slot] === 1 && this.config.decomposerDormancy !== null) {
        basal *= this.config.decomposerDormancy;
      }
      // Pioneer establishment bonus (diagnostic, default null = unchanged).
      // Grace ticks down once per tick here, at the single basal-charge site;
      // the starvation and breeding gates read the same remaining grace
      // through pioneerFactor, so all three upkeep bars move together.
      if (this.pioneerTicks[slot] > 0) {
        basal *= this.pioneerFactor(slot);
        this.pioneerTicks[slot]--;
      }
      this.spend(slot, basal, 'basal');

      // Excretion: metabolism returns a little matter to the local substrate
      // as inorganic nutrient. Small, but it means organisms are a nutrient
      // SOURCE locally and not only a sink.
      if (cfg.excretionRate > 0) {
        const excreted = (basal * cfg.excretionRate * 6) / NUTRIENT_COUNT;
        // Per-pool ceilings, NOT one flat cap: pools B and C have multipliers
        // below 1.0, so a shared flat cap would let a return fill them above
        // their declared capacity. See nutrientCapAt / returnThroughCeiling.
        const g = this.roleOf(slot).trophic;
        const off = g * NUTRIENT_COUNT;
        this.returnThroughCeiling(nutA, 0, ci, excreted, off + 0,
          this.excretionReturnsGuildPool, this.excretionAttemptedGuildPool,
          this.excretionCapLossGuildPool, this.excretionEvictionGuildPool);
        this.returnThroughCeiling(nutB, 1, ci, excreted, off + 1,
          this.excretionReturnsGuildPool, this.excretionAttemptedGuildPool,
          this.excretionCapLossGuildPool, this.excretionEvictionGuildPool);
        this.returnThroughCeiling(nutC, 2, ci, excreted, off + 2,
          this.excretionReturnsGuildPool, this.excretionAttemptedGuildPool,
          this.excretionCapLossGuildPool, this.excretionEvictionGuildPool);
      }

      // Crowding penalty: local density costs energy via interference.
      if (crowding > 4) {
        const crowdingCost = (crowding - 4) * 0.006 * (1 + p[o + TRAIT.SIZE]);
        const crowdingPaid = this.spend(slot, crowdingCost, 'basal');
        // Recorded separately so density dependence is directly measurable.
        // spend() already attributed the same amount to per-guild basal; this
        // is the density-specific view of that charge, not a second charge.
        // Records what was ACTUALLY deducted (paid), not requested: spend()
        // clamps to available energy, and requested crowding can exceed an
        // organism's whole reserve when local density is extreme.
        this.ledger.recordCrowding(crowdingPaid, this.roleOf(slot).trophic);
      }

      // Ageing: damage accrues with age past a senescent threshold.
      const lifespan = p[o + TRAIT.LIFESPAN];
      if (age > lifespan * 0.62) {
        store.damage[slot] += (age - lifespan * 0.62) * 0.0016 * (2 - p[o + TRAIT.REGENERATION] * 6);
      }

      // --- Feeding --------------------------------------------------------
      // --- Photosynthesis: multiple limiting nutrients + light -> energy ----
      // This is the one true energy injection into the biological system.
      //
      // LIEBIG'S LAW OF THE MINIMUM: growth is limited by whichever pool is
      // scarcest relative to what the organism wants, not by the sum. With one
      // limiting resource this reduces to the old single-nutrient uptake; with
      // three it produces genuine co-limitation, which is the mechanism that
      // lets nutrient specialists coexist instead of excluding each other.
      if (photo > 0.02 && ci >= 0) {
        // Beer-Lambert attenuation through the local canopy. `globalLight` is
        // global forcing; `shade` is static habitat patchiness; `shadeMass` is
        // the density-dependent term that actually bounds the population.
        const canopy = this.shadeMass[ci];
        const selfShade = canopy > 0 ? Math.exp(-this.config.shadeExtinction * canopy) : 1;
        const localLight = globalLight * shade[ci] * selfShade * mods.lightMul;
        let demand = photo * 0.42 * localLight * mods.captureMul;
        // Guild-specific capture scales (diagnostic, default null = unchanged).
        // Consumers already derive 27.5% of income here; producers take 97.2%.
        {
          const g = this.roleOf(slot).trophic;
          if (g === 1 && this.config.consumerPhotoScale !== null) demand *= this.config.consumerPhotoScale;
          else if (g === 0 && this.config.producerCaptureScale !== null) demand *= this.config.producerCaptureScale;
          // Decomposers had NO branch here, so they captured at full demand no
          // matter what the other two scales were set to. Under `--zero` that
          // made the decomposer guild the only guild with a live energy input.
          else if (g === 2 && this.config.decomposerPhotoScale !== null) demand *= this.config.decomposerPhotoScale;
        }
        // Diagnostic: mixotrophic carbon requirement (mixotrophyCarbon).
        // Bare light is not enough for a producer: capturing energy also
        // requires local heterotrophic substrate to work on, which exists
        // only because heterotrophs (or corpses) produced it. This is the
        // producer half of the guild-interdependence coupling; nutrientCyclic
        // is the nutrient half. Producers keep their guild label and all
        // their pathways — only the photosynthesis DEMAND is scaled — so this
        // adds no new guild test and cannot be read as an assignment table.
        if (cfg.mixotrophyCarbon === true && this.roleOf(slot).trophic === TROPHIC.PRODUCER) {
          demand *= this.substrateAvailability(ci);
        }
        if (demand > 0) {
          // What this organism would take from each pool, scaled by affinity.
          const wA = demand * affA;
          const wB = demand * affB;
          const wC = demand * affC;
          // Limiting factor: the smallest pool relative to what is wanted.
          let lim = 1;
          if (affA > 1e-4) lim = Math.min(lim, nutA[ci] / wA);
          if (affB > 1e-4) lim = Math.min(lim, nutB[ci] / wB);
          if (affC > 1e-4) lim = Math.min(lim, nutC[ci] / wC);
          if (lim > 1) lim = 1;

          // Consume from each pool, capped by what is present.
          if (affA > 1e-4) {
            const take = wA * lim;
            const actualTake = take < nutA[ci] ? take : nutA[ci];
            nutA[ci] -= actualTake;
            // Flux measurement: photosynthesis uptake per guild per pool
            const g = this.roleOf(slot).trophic;
            this.photoUptakeGuildPool[g * NUTRIENT_COUNT + 0] += actualTake;
          }
          if (affB > 1e-4) {
            const take = wB * lim;
            const actualTake = take < nutB[ci] ? take : nutB[ci];
            nutB[ci] -= actualTake;
            const g = this.roleOf(slot).trophic;
            this.photoUptakeGuildPool[g * NUTRIENT_COUNT + 1] += actualTake;
          }
          if (affC > 1e-4) {
            const take = wC * lim;
            const actualTake = take < nutC[ci] ? take : nutC[ci];
            nutC[ci] -= actualTake;
            const g = this.roleOf(slot).trophic;
            this.photoUptakeGuildPool[g * NUTRIENT_COUNT + 2] += actualTake;
          }

          // Energy fixed is proportional to what was actually obtained.
          const yieldFactor = 0.45 + efficiency * 0.6;
          const gained = demand * lim * yieldFactor;
          const room = capacity - energy;
          const take = gained < room ? gained : Math.max(0, room);
          if (take > 0) {
            store.energy[slot] += take;
            store.energyIngested[slot] += take;
          }
          // ALL of `gained` is booked as capture: the overflow is placed into
          // the detritus pool below, so it is still inside the system. Booking
          // only `take` here would count less input than the pools hold.
          if (gained > 0) {
            this.ledger.recordCapture(gained);
            this.ledger.recordCaptureGuild(gained, this.roleOf(slot).trophic);
          }
          const overflow = gained - take;
          if (overflow > 0) {
            this.detritus.add(x[slot], y[slot], fieldW, fieldH, overflow);
            this.ledger.recordSpill(overflow);
          }
        }
      }

      // --- Detritivory / scavenging ----------------------------------------
      // Draws from the BENTHIC sediment first, because that compartment is
      // where organic matter concentrates and where it is actually usable.
      // Suspended detritus is far too dilute to support a consumer on its own,
      // which is why the POC previously measured a consumer bootstrap deadlock.
      if (sedimentData[ci] > 0.2 && digestion > 0) {
        const appetiteTerm = 0.28 + appetite * 0.9;
        const want = Math.min(sedimentData[ci], capacity * 0.22 * appetiteTerm * digestion * (0.3 + 1.4 * detritivory));
        if (want > 0) {
          const removed = Math.min(want, sedimentData[ci]);
          if (removed > 0) {
            sedimentData[ci] -= removed;
            const assimilated = removed * (0.32 + efficiency * 0.5);
            const unassimilated = removed - assimilated;
            const room = capacity - store.energy[slot];
            const taken = assimilated < room ? assimilated : Math.max(0, room);
            if (taken > 0) {
              store.energy[slot] += taken;
              store.energyIngested[slot] += taken;
              // Diseased detritus: part of the heterotroph food-disease path.
              this.diseaseRoll(store, slot, taken);
            }
            store.hunger[slot] = 0;
            this.ledger.recordUnassimilated(unassimilated);
            this.ledger.recordScavenged(removed);
            this.ledger.recordUnassimilatedGuild(unassimilated, this.roleOf(slot).trophic);
            this.ledger.recordScavengedGuild(removed, this.roleOf(slot).trophic);
            const overflow = assimilated - taken;
            if (overflow > 0) {
              this.detritus.add(x[slot], y[slot], fieldW, fieldH, overflow);
              this.ledger.recordSpill(overflow);
            }
            if (this.bioticMineraliser[slot]) {
              const returned = taken * cfg.bioticMineralisation;
              // Returned across all pools so recycling is not pool-specific.
              // Per-pool ceilings, not one flat cap: see returnThroughCeiling,
              // which also books attempted / accepted / cap-loss / eviction.
              this.mineraliseThroughCeiling(slot, ci, nutA, nutB, nutC, returned, 0);
            }
          }
        }
      } else if (localDetritus > 0.4 && digestion > 0) {
        const appetiteTerm = 0.28 + appetite * 0.9;
        const want = Math.min(localDetritus, capacity * 0.16 * appetiteTerm * digestion);
        if (want > 0) {
          const removed = Math.min(want, detritusData[ci]);
          if (removed > 0) {
            detritusData[ci] -= removed;
            const assimilated = removed * (0.32 + efficiency * 0.5);
            const unassimilated = removed - assimilated;
            // Respect the storage ceiling here too. Without this the scavenger
            // path alone could exceed storage capacity without bound, so the
            // "storage buffer" invariant held only for two of three intake
            // routes and cross-path comparisons were skewed.
            const room = capacity - store.energy[slot];
            const taken = assimilated < room ? assimilated : Math.max(0, room);
            if (taken > 0) {
              store.energy[slot] += taken;
              store.energyIngested[slot] += taken;
              // Diseased detritus: part of the heterotroph food-disease path.
              this.diseaseRoll(store, slot, taken);
            }
            store.hunger[slot] = 0;
            this.ledger.recordUnassimilated(unassimilated);
            this.ledger.recordScavenged(removed);
            this.ledger.recordUnassimilatedGuild(unassimilated, this.roleOf(slot).trophic);
            this.ledger.recordScavengedGuild(removed, this.roleOf(slot).trophic);
            // What could not be stored goes to the substrate, matching the
            // photosynthesis overflow path.
            const overflow = assimilated - taken;
            if (overflow > 0) {
              this.detritus.add(x[slot], y[slot], fieldW, fieldH, overflow);
              this.ledger.recordSpill(overflow);
            }

            // --- Biotic mineralisation ------------------------------------
            // A mineralising scavenger returns part of what it assimilated to
            // the substrate as inorganic nutrient. This is the active process
            // that makes decomposers an ecosystem ROLE rather than scenery: it
            // is what closes the detritus -> nutrient -> producer loop through
            // biology instead of leaving it to abiotic decay alone.
            //
            // This block was a comment header with no code: the suspended
            // branch never returned nutrient, making suspended feeding a
            // nutrient sink. All three detrital paths must mineralise, or
            // biological closure leaks through whichever path is missing.
            if (this.bioticMineraliser[slot]) {
              const returned = taken * cfg.bioticMineralisation;
              // Returned across all pools so recycling is not pool-specific.
              // Per-pool ceilings, not one flat cap: see returnThroughCeiling.
              this.mineraliseThroughCeiling(slot, ci, nutA, nutB, nutC, returned, 1);
            }
          }
        }
      } else if (litterData[ci] > 0.2 && digestion > 0 && recalc > 0.4) {
        // --- Recalcitrant litter: the decomposers' exclusive niche ----------
        // Last in the chain, so labile detritus is always preferred when it is
        // present. That ordering IS the sequential mechanism: mobile scavengers
        // take the rich labile fraction first, and only organisms that can
        // actually digest structural material are left with litter.
        //
        // Gate at 0.4, not 0.05. At 0.05 the entire founder cloud (init 0.2)
        // qualified, so mobile generalists — grazers above all — drained litter
        // without returning nutrient (mineralising needs recalc > 0.5) and
        // sessile specialists never got a turn: measured 0.0% decomposers on
        // every seed across six attempts, with litter stocks draining despite
        // decomposer absence. Independent review confirmed this as code-level
        // certainty, not hypothesis.
        //
        // At 0.4 roughly a fifth of founders qualify (init 0.2, spread 0.5 halved
        // at the draw, so effective SD 0.25),
        // so standing variation exists for selection without the pool being
        // open to the grazer bulk. Intake already scales with recalc, so
        // 0.4-eaters nibble while high-recalc specialists feast — partial
        // tolerance earns partial share, which is the honest biology.
        //
        // Residual leak, acknowledged: eaters in (0.4, 0.5) consume without
        // mineralising (flag needs recalc > 0.5 plus non-photo; slow only on
        // the carrion path). Their
        // intake is modest by proportionality, and they sit one mutation from
        // the mineraliser threshold — evolutionarily, they are decomposers in
        // transit, not a separate exploit.
        //
        // Gated by DIGESTIVE CAPABILITY (`recalc`), never by guild label. An
        // organism becomes a decomposer by evolving this trait; nothing in the
        // feeding path asks what guild it is.
        const appetiteTerm = 0.28 + appetite * 0.9;
        const want = Math.min(litterData[ci], capacity * 0.18 * appetiteTerm * digestion * recalc);
        if (want > 0) {
          const removed = Math.min(want, litterData[ci]);
          litterData[ci] -= removed;
          // Strictly poorer per unit than labile (labile is 0.32 + eff*0.5).
          // Decomposers earn their place on exclusive VOLUME, not on better
          // efficiency - which is also why a specialist is not automatically
          // the better organism overall.
          const assimilated = removed * (0.10 + efficiency * 0.3) * (0.35 + 0.65 * recalc);
          const unassimilated = removed - assimilated;
          const room = capacity - store.energy[slot];
          const taken = assimilated < room ? assimilated : Math.max(0, room);
          if (taken > 0) {
            store.energy[slot] += taken;
            store.energyIngested[slot] += taken;
            // Diseased litter: part of the heterotroph food-disease path.
            this.diseaseRoll(store, slot, taken);
          }
          store.hunger[slot] = 0;
          this.ledger.recordUnassimilated(unassimilated);
          this.ledger.recordScavenged(removed);
          this.ledger.recordUnassimilatedGuild(unassimilated, this.roleOf(slot).trophic);
          this.ledger.recordScavengedGuild(removed, this.roleOf(slot).trophic);
          const overflow = assimilated - taken;
          if (overflow > 0) {
            this.detritus.add(x[slot], y[slot], fieldW, fieldH, overflow);
            this.ledger.recordSpill(overflow);
          }
          if (this.bioticMineraliser[slot]) {
            const returned = taken * cfg.bioticMineralisation;
            // Per-pool ceilings, not one flat cap: see nutrientCapAt.
            // Per-pool ceilings, not one flat cap: see returnThroughCeiling.
            this.mineraliseThroughCeiling(slot, ci, nutA, nutB, nutC, returned, 2);
          }
        }
      } else {
        store.hunger[slot]++;
      }

      // --- Dormancy evaluation --------------------------------------------
      // Decomposer-only, diagnostic-knob-gated. Recomputed fresh every tick:
      // dormant iff energy below breeding threshold AND no usable substrate in
      // this cell. Uses the same floors as the feeding gates (sediment 0.2,
      // detritus 0.4, litter 0.2). Litter at or below 0.2 cannot be eaten, so
      // it must not count as food: waking on it traps the organism paying full
      // upkeep while unable to feed. Starvation (below) and
      // breeding (Phase 6) read this tick's value; basal and sensing read last
      // tick's (1-tick lag, negligible for a slow state).
      if (this.config.decomposerDormancy !== null && this.roleOf(slot).trophic === 2) {
        const threshold = store.trait(slot, TRAIT.REPRO_THRESHOLD);
        const energyFrac = store.energy[slot] / Math.max(1, capacity);
        const foodHere =
          litterData[ci] > 0.2 || sedimentData[ci] > 0.2 || localDetritus > 0.4;
        this.dormant[slot] = energyFrac < threshold && !foodHere ? 1 : 0;
      } else {
        this.dormant[slot] = 0;
      }

      // --- Dormant senescence -----------------------------------------------
      // Diagnostic-knob-gated (null = off). The sleep clock advances each tick
      // the slot stays dormant and resets on waking. Three modes behind the
      // one knob (see config docs): fixed grace, dormant-share pressure, and
      // lifespan-relative grace. Killing runs through the existing damage
      // path; attribution via senesceDamage (parallel to starveDamage).
      if (this.dormant[slot] === 1) {
        this.dormantSleep[slot]++;
        const sn = this.senescence;
        if (sn !== null) {
          let rate = 0;
          if (sn.mode === 'fixed') {
            if (this.dormantSleep[slot] > sn.scale) rate = 0.35;
          } else if (sn.mode === 'share') {
            // No grace: the pressure IS the hoarding fraction. At 90%+
            // dormant this matches fixed-mode lethality (~0.35/tick); at 5%
            // it is ~0.02/tick (harmless over any run horizon).
            rate = 0.35 * sn.scale * this.dormantFrac;
          } else {
            // lifespan: grace scales with the organism's own heritable
            // lifespan (same trait the age-death gate reads).
            const grace = sn.scale * store.trait(slot, TRAIT.LIFESPAN);
            if (this.dormantSleep[slot] > grace) rate = 0.35;
          }
          if (rate > 0) {
            store.damage[slot] += rate;
            this.senesceDamage[slot] += rate;
          }
        }
      } else {
        this.dormantSleep[slot] = 0;
      }

      // --- Starvation -----------------------------------------------------
      // Damage scales with how badly the organism fails to meet its own
      // maintenance cost, rather than accruing at a flat rate while starving.
      //
      // The flat rate was a real defect: an organism at zero energy still took
      // ~130 ticks to die, long enough to keep breeding. That decoupled
      // reproduction from viability and produced unbounded growth of starving
      // organisms born faster than they died. Deficit-proportional damage makes
      // inability-to-pay lethal in proportion to inability-to-pay.
      const upkeep =
        upkeepOf(basalCost, size, massCost) *
        this.pioneerFactor(slot) *
        this.consumerUpkeepFactor(slot);
      // Dormant organisms do not accrue starvation damage: waiting is not dying.
      // Only reachable when the knob is set (dormant[] otherwise always zero).
      const isDormant = this.dormant[slot] === 1 && this.config.decomposerDormancy !== null;
      if (!isDormant && upkeep > 0 && energy < upkeep) {
        const deficit = (upkeep - energy) / upkeep; // 0..1
        // Fasting tolerance (Owner constraint 2026-10-12: body reserves buffer
        // brief deficits; wasting begins after reserves deplete). The streak
        // counts CONSECUTIVE deficit ticks; damage ramps 0 -> full over
        // STARVE_GRACE_TICKS, so a missed-browse window is forgiven while true
        // inability-to-pay still kills at full rate a few ticks later.
        const streak = this.starveStreak[slot] =
          Math.min(65535, this.starveStreak[slot] + 1);
        store.hunger[slot] += 1;
        const starveDmg = 0.9 * (0.35 + 0.65 * deficit) *
          Math.min(1, streak / STARVE_GRACE_TICKS);
        store.damage[slot] += starveDmg;
        store.starveDamage[slot] += starveDmg;
      } else {
        // Any paid tick — or dormancy, which is waiting, not deficit — clears
        // the clock, so the next trough starts forgiven. The hunger fallback
        // below is byte-identical to before (dormant included).
        this.starveStreak[slot] = 0;
        if (store.hunger[slot] > 260) {
          store.damage[slot] += 0.12;
        }
      }

      // Regeneration, paid for out of the metabolic budget.
      if (store.damage[slot] > 0.05) {
        const regen = p[o + TRAIT.REGENERATION];
        if (regen > 0.005) {
          const healed = Math.min(store.damage[slot], regen * 0.9);
          store.damage[slot] -= healed;
          this.spend(slot, healed * 0.7, 'basal');
        }
      }

      // Refresh the cached role readout periodically so juvenile->adult and
      // adult->senescent transitions actually happen, and so developmental
      // body growth is observable rather than being frozen at birth. One
      // organism in ROLE_REFRESH_EVERY is refreshed per tick, which keeps the
      // amortised cost near 6% rather than paying it every tick for everyone.
      if (age % ROLE_REFRESH_EVERY === 0) {
        // Modular genome v2 (diagnostic): re-express modules at the CURRENT
        // developmental age before deriving the role.
        //
        // Without this, development never happens in the live world. Phenotypes
        // are derived ONCE at birth, and a newborn is age 0, where
        // developmentFactor(0, onset) is zero for every valid onset — so every
        // module was gated to zero at birth and never re-expressed. The module
        // deltas, their upkeep and the whole developmental claim were therefore
        // inert in the engine while the standalone helper demonstrated them
        // perfectly. G21 asserts this on a LIVE organism.
        if (this.config.genomeV2 === true && store.moduleCount[slot] > 0) {
          this.reexpressModules(slot, age);
        }
        this.writeRole(slot, deriveRole(p, o, age + 1));
      }

      store.age[slot] = age + 1;
      if (store.reproCooldown[slot] > 0) store.reproCooldown[slot]--;
    }
  }

  /**
   * Deduct energy, routing the amount through the ledger and clamping at zero.
   * A single choke point means no code path can remove biological energy
   * without recording it.
   */
  private spend(slot: number, amount: number, bucket: 'basal' | 'movement' | 'sensing' | 'contest' | 'reproduction'): number {
    if (amount <= 0) return 0;
    const have = this.store.energy[slot];
    const actual = amount < have ? amount : have;
    this.store.energy[slot] = have - actual;
    this.store.energySpent[slot] += actual;
    this.ledger.recordExpenditure(actual, bucket);
    // Per-guild attribution. roleOf() is a pure read of the cached role block
    // (no RNG, no writes), and no code path branches on the accumulated values,
    // so this cannot change outcomes. It is accounting only.
    const bucketIndex =
      bucket === 'basal' ? 0
      : bucket === 'movement' ? 1
      : bucket === 'sensing' ? 2
      : bucket === 'contest' ? 3
      : 4;
    this.ledger.recordExpenditureGuild(actual, bucketIndex, this.roleOf(slot).trophic);
    return actual;
  }

  /**
   * Weighted choice over `n` scores in a caller-owned scratch buffer.
   *
   * Reads `scores` in place and writes normalised weights back into it. The
   * scratch buffer is reused every call so the hot loop allocates nothing: at
   * 50k organisms a single small array per decision would dominate GC.
   */
  private weightedChoice(scores: Float64Array, n: number, sharpness: number): number {
    let max = -Infinity;
    for (let i = 0; i < n; i++) if (scores[i] > max) max = scores[i];
    if (max <= 0) return INTENT.SETTLE;
    let total = 0;
    for (let i = 0; i < n; i++) {
      // exp() of a non-positive argument is in (0,1], so no overflow.
      const e = Math.exp((scores[i] - max) * sharpness);
      scores[i] = e;
      total += e;
    }
    let r = this.rng.nextFloat() * total;
    for (let i = 0; i < n; i++) {
      r -= scores[i];
      if (r <= 0) return i;
    }
    return n - 1;
  }

  /** Heading toward the steepest local nutrient gradient. */
  private gradientHeading(px: number, py: number, heading: number, sense: number, probe: number): number {
    const cfg = this.config;
    const gw = cfg.worldW / this.nutrients[0].cols;
    const gh = cfg.worldH / this.nutrients[0].rows;
    // Sum across pools so a producer climbs whichever gradient is steepest
    // overall; Liebig limitation then decides which pool actually binds.
    const sampleAll = (x: number, y: number): number => {
      let t = 0;
      for (const f of this.nutrients) t += f.sample(x, y, gw, gh);
      return t;
    };
    // Four axis-aligned samples. Sampling each axis independently is the whole
    // point: a diagonal probe measures neither the east-west nor the
    // north-south difference cleanly, and comparing north against east mixes
    // two perpendicular axes into one bogus gradient.
    const e = sampleAll(Math.min(cfg.worldW, px + probe), py);
    const w = sampleAll(Math.max(0, px - probe), py);
    const n = sampleAll(px, Math.max(0, py - probe));
    const s = sampleAll(px, Math.min(cfg.worldH, py + probe));
    const dE = (e - w) * sense;
    const dN = (n - s) * sense;
    if (Math.abs(dE) < 1e-9 && Math.abs(dN) < 1e-9) return heading;
    return Math.atan2(-dN, dE);
  }

  /** Heading toward the steepest local detritus gradient. */
  private detritusHeading(px: number, py: number, heading: number, sense: number, probe: number): number {
    const cfg = this.config;
    const w = cfg.worldW / this.detritus.cols;
    const h = cfg.worldH / this.detritus.rows;
    const e = this.detritus.sample(Math.min(cfg.worldW, px + probe), py, w, h);
    const wst = this.detritus.sample(Math.max(0, px - probe), py, w, h);
    const n = this.detritus.sample(px, Math.max(0, py - probe), w, h);
    const s = this.detritus.sample(px, Math.min(cfg.worldH, py + probe), w, h);
    const dE = (e - wst) * sense;
    const dN = (n - s) * sense;
    if (Math.abs(dE) < 1e-9 && Math.abs(dN) < 1e-9) return heading;
    return Math.atan2(-dN, dE);
  }

  /**
   * Phase 4b: turn recorded mating contacts into submissions.
   *
   * RECIPROCITY here means mutual SELECTION, not merely mutual intent. A
   * contact matures only when the partner chose this organism back
   * (`mateTarget[b] === a`) in addition to both organisms being in MATE intent.
   * One-sided intent is not consent: the partner may have been fleeing, grazing
   * or hunting, or courting someone else entirely.
   *
   * That requirement is what makes the canonical-order filter below
   * LOSSLESS rather than a silent discard. When selection is mutual, the
   * contact test is symmetric — `dSq` compares the same two bodies from either
   * side — so BOTH organisms record the pair, one as (a,b) and one as (b,a).
   * Exactly one satisfies a < b. A contact whose partner selected someone
   * else is rejected by the mateTarget test regardless of which slot recorded
   * it, so keeping only the low-slot direction loses nothing. Filtering on
   * slot order alone (without the mateTarget test) WOULD lose real matings:
   * whether a pairing happened would depend on slot indices rather than
   * biology.
   *
   * Reading intent and mateTarget is only sound after the whole act phase has
   * run, which is why this is a separate phase rather than an inline check.
   */
  private resolveMatingIntent(): void {
    const count = this.mateCandN;
    if (count === 0) return;
    const store = this.store;
    for (let i = 0; i < count; i++) {
      const a = this.mateCandA[i];
      const b = this.mateCandB[i];
      if (a >= b) continue; // self-contact, or the pair seen from the other side
      if (this.intent[a] !== INTENT.MATE || this.intent[b] !== INTENT.MATE) continue;
      // The partner must have selected THIS organism, not merely be in MATE
      // intent with someone else.
      if (this.mateTarget[b] !== a) continue;
      this.submittedByKind[INTERACTION.MATE]++;
      this.interactions.submit(store, a, b, INTERACTION.MATE, 0);
    }
  }

  // -------------------------------------------------------------------------
  // Phase 5: contested interactions
  // -------------------------------------------------------------------------

  private resolveContests(): void {
    const store = this.store;
    const rng = this.rng;
    const cfg = this.config;
    const fieldW = cfg.worldW / this.detritus.cols;
    const fieldH = cfg.worldH / this.detritus.rows;

    this.interactions.resolve(
      store,
      (slot) => this.live[slot] === 1,
      rng,
      FATAL_DAMAGE,
      (as) => {
        // Predation contact cost. The energy transfer itself is applied from
        // the queue's resolution record below, so it is booked exactly once.
        this.spend(as, 0.4 + store.trait(as, TRAIT.SIZE) * 0.1, 'contest');
      },
      (_winner, loser) => {
        // Territorial displacement costs the loser a little condition. Spacing
        // therefore emerges from contests rather than from a hard rule.
        store.damage[loser] += 0.2;
      },
      (a, b) => {
        // Reciprocal mating: both sides pay a gamete cost and both get a
        // reproduction opportunity. Consent is mutual by construction.
        //
        // Both sides must independently hold a viable surplus. Contests resolve
        // in attacker-id order, so without this a starving organism could mate
        // purely because it happened to be resolved first.
        const upA = upkeepOf(store.trait(a, TRAIT.BASAL_COST), store.trait(a, TRAIT.SIZE), store.trait(a, TRAIT.MASS_COST))
          * this.pioneerFactor(a) * this.consumerUpkeepFactor(a);
        const upB = upkeepOf(store.trait(b, TRAIT.BASAL_COST), store.trait(b, TRAIT.SIZE), store.trait(b, TRAIT.MASS_COST))
          * this.pioneerFactor(b) * this.consumerUpkeepFactor(b);
        if (store.energy[a] <= upA * this.reproSurplus || store.energy[b] <= upB * this.reproSurplus) {
          return;
        }
        // Mark both slots as having successfully mated this tick.
        // This is read in proposeReproduction to allow asexual fallback
        // for organisms that sensed a mate but did not achieve mutual mating.
        this.successfulMating[a] = 1;
        this.successfulMating[b] = 1;
        this.spend(a, 1.6 + store.trait(a, TRAIT.SIZE) * 0.25, 'reproduction');
        this.spend(b, 1.6 + store.trait(b, TRAIT.SIZE) * 0.25, 'reproduction');
        // Recombination forks the lineage, so lineage trees actually branch
        // rather than degenerating into one immortal founder clone.
        const la = store.lineage[a];
        const lb = store.lineage[b];
        const laNew = this.mintRecombinantLineage(la, lb);
        const lbNew = this.mintRecombinantLineage(lb, la);
        // genomeV2: the mate is threaded through so the child can be built by
        // CROSSOVER rather than by copying one parent. v1 birth drew from a
        // single parent, so mating never mixed genes.
        this.queueBirth(a, 1, laNew, b);
        this.queueBirth(b, 1, lbNew, a);
        const probe = this.repro;
        if (probe !== null) {
          probe.fired(a, this.roleOf(a).trophic, true);
          probe.fired(b, this.roleOf(b).trophic, true);
        }
      },
      (as, ds) => {
        // Contact cost for a scavenge-contest winner. The energy transfer itself
        // is applied from the resolution record, so it is booked exactly once.
        store.damage[as] += 0.05;
        void ds;
      },
      undefined,
      cfg.meatYieldPerMass,
      cfg.plantYieldPerMass,
    );

    // Apply the resolved records. Records are in deterministic id order, so
    // damage and energy accumulate in a reproducible sequence.
    //
    // `peekRecords` rather than a copying drain: at high population the
    // resolved-record count is large, and allocating a fresh array every tick
    // would put GC pressure directly into the phase we are trying to measure.
    const recs = this.interactions.peekRecords();
    this.lastResolutions = recs;
    this.lastResolutionCount = this.interactions.resolutionCount();
    // Loop to the VALID RECORD COUNT, not the backing array length. `records` is a
    // reused buffer that grows to the high-water mark and is never shrunk, so
    // iterating to `recs.length` re-applies stale records from earlier ticks
    // whenever the current tick resolved fewer contests. That silently applied
    // extra damage and extra predation transfers every quiet tick.
    for (let i = 0; i < this.lastResolutionCount; i++) {
      const r = recs[i];
      // Trace contests across the whole run, not just the last tick. The
      // in-memory `resolutions()` view is overwritten every tick, so without
      // this a contest could only be inspected in the tick it happened — which
      // made historical win-rate and damage analysis impossible without
      // re-running the simulation with different probes.
      if (this.traceLog !== null) {
        this.traceLog.record({
          tick: this.tick,
          kind: TRACE.CONTEST,
          a: r.attackerId,
          b: r.defenderId,
          v: r.delta,
          w: r.outcome,
          x: r.kind,
          y: r.attackerDamage,
          z: r.defenderDamage,
        });
      }
      if (r.outcome === OUTCOME.ABANDONED) continue;
      // Locate slots by stable id. The queue already applied contact costs in
      // its callbacks; here we apply damage and predation yield.
      const as = this.slotOfId(r.attackerId);
      const ds = this.slotOfId(r.defenderId);
      if (as < 0) continue;
      if (r.attackerDamage > 0) {
        const stageMul = this.stageDamageFactor(as);
        store.damage[as] = Math.min(FATAL_DAMAGE + 1, store.damage[as] + r.attackerDamage * stageMul);
        this.spend(as, r.attackerDamage * 0.05, 'contest');
      }
      if (ds < 0 || !this.live[ds]) continue;
      if (r.defenderDamage > 0) {
        // A juvenile or senescent organism cannot inflict full damage. Without
        // this the life-stage system would be cosmetic: stages existed and were
        // reported, but never changed any outcome.
        const stageMul = this.stageDamageFactor(as);
        store.damage[ds] = Math.min(FATAL_DAMAGE + 1, store.damage[ds] + r.defenderDamage * stageMul);
        // Predation yield: energy moves from defender to attacker.
        // predationYieldScale is a diagnostic multiplier on the amount moved per
        // event (default null = unchanged). grazeYieldScale, when set, replaces
        // it for GRAZE-kind transfers only, so plants can be made more
        // nutritious without enriching meat. Conservation preserved: it scales
        // the request and the defender provides what it holds. See config.
        const yieldScale =
          r.kind === INTERACTION.GRAZE && this.config.grazeYieldScale !== null
            ? this.config.grazeYieldScale
            : (this.config.predationYieldScale ?? 1);
        if (r.delta * yieldScale > 0 && (r.kind === INTERACTION.PREDATE || r.kind === INTERACTION.GRAZE)) {
          // Pure transfer: no dissipation may be recorded here.
          //
          // `r.delta` is what the resolver WOULD LIKE to move. The defender may
          // hold less than that (it can be the target of several contests in one
          // tick, and an earlier one may already have drained it), so spillage
          // must be computed from the energy actually removed. Spilling the
          // difference against the request would mint detritus from energy that
          // never existed.
          const available = store.energy[ds];
          const scaledDelta = r.delta * yieldScale;
          const removed = scaledDelta < available ? scaledDelta : available;
          const gained = transferEnergy(store, ds, as, removed);
          this.ledger.recordPredated(gained);
          this.ledger.recordPredatedGuild(gained, this.roleOf(as).trophic);
          // Diseased meat/graze: hunted and browsed tissue is food too.
          if (gained > 0) this.diseaseRoll(store, as, gained);
          // Split graze takes from predation takes (ledger merges both kinds).
          if (r.kind === INTERACTION.GRAZE) {
            this.grazeWins++;
            this.grazeEnergy += gained;
            this.grazeRequested += scaledDelta;
          }
          const overflow = removed - gained;
          if (overflow > 0) this.ledger.recordSpill(overflow);
          if (gained > 0) store.hunger[as] = 0;
        }
      }
    }
    void fieldW;
    void fieldH;
  }

  /**
   * Slot lookup by stable id. Uses a monotonic id, so a flat Int32Array keyed
   * by id works and is O(1). Falls back when the id is outside the table.
   */
  private slotOfId(id: number): number {
    if (id < 0 || id >= this.idToSlot.length) return -1;
    const slot = this.idToSlot[id];
    return slot >= 0 && this.live[slot] === 1 && this.store.id[slot] === id ? slot : -1;
  }

  private idToSlot: Int32Array<ArrayBuffer> = new Int32Array(0).fill(-1);

  /** Keep the id->slot table large enough. Called after slot allocation. */
  private noteSlot(slot: number): void {
    const id = this.store.id[slot];
    if (id >= this.idToSlot.length) {
      const next = new Int32Array(Math.max(id + 1, this.idToSlot.length * 2)).fill(-1);
      next.set(this.idToSlot);
      this.idToSlot = next;
    }
    this.idToSlot[id] = slot;
  }

  // -------------------------------------------------------------------------
  // Phase 6: reproduction proposals
  // -------------------------------------------------------------------------

  private proposeReproduction(): void {
    const store = this.store;
    const n = store.count;
    const probe = this.repro;
    const dormancyOn = this.config.decomposerDormancy !== null;
    for (let slot = 0; slot < n; slot++) {
      if (!this.live[slot]) continue;
      // Dormant decomposers do not propose breeding: growth into absent food
      // is not attempted. Reads this tick's flag (set in actPhase feeding).
      if (dormancyOn && this.dormant[slot] === 1) continue;
      // Guild is resolved lazily and ONLY when a probe is attached, so the
      // unprobed path pays one null check per gate and nothing more.
      const guild = probe === null ? -1 : this.roleOf(slot).trophic;
      if (store.reproCooldown[slot] > 0) {
        if (probe !== null) probe.blocked(slot, guild, REPRO_GATE.cooldown);
        continue;
      }
      // Mass-corrected: breeding eligibility must be judged against the same
      // capacity that gates intake, or an organism can qualify to breed at a
      // fraction of a reserve that intake would have refused to fill.
      const capacity = this.capacityOf(slot);
      const threshold = store.trait(slot, TRAIT.REPRO_THRESHOLD);
      const energyFrac = store.energy[slot] / Math.max(1, capacity);
      if (energyFrac < threshold) {
        if (probe !== null) probe.blocked(slot, guild, REPRO_GATE.fraction);
        continue;
      }

      const maturityAge = store.trait(slot, TRAIT.MATURITY_AGE);
      if (store.age[slot] < maturityAge) {
        if (probe !== null) probe.blocked(slot, guild, REPRO_GATE.maturity);
        continue;
      }
      if (store.damage[slot] > FATAL_DAMAGE * 0.45) {
        if (probe !== null) probe.blocked(slot, guild, REPRO_GATE.damage);
        continue;
      }

      // Viable surplus: reproduction requires enough reserve to sustain the
      // organism for a drought period, not merely a fraction of its storage
      // buffer. Without this, a small-bodied organism with a small buffer could
      // breed while starving - the mechanism behind the unbounded expansion in
      // REPORT.md.
      const upkeep =
        upkeepOf(
          store.trait(slot, TRAIT.BASAL_COST),
          store.trait(slot, TRAIT.SIZE),
          store.trait(slot, TRAIT.MASS_COST),
        ) * this.pioneerFactor(slot) * this.consumerUpkeepFactor(slot);
      if (store.energy[slot] <= upkeep * this.reproSurplus) {
        if (probe !== null) probe.blocked(slot, guild, REPRO_GATE.surplus);
        continue;
      }

      const asexualRate = store.trait(slot, TRAIT.ASEXUAL_RATE);
      const mateSeeking = store.trait(slot, TRAIT.MATE_SEEKING);

      // Sexual reproduction proceeds only for organisms that achieved a
      // CONFIRMED mutual mating this tick (surplus-checked, reciprocal).
      // Asexual reproduction is always available as a fallback; mate-seeking
      // genotypes breed slower asexually, creating a genuine trade-off.
      const sexual = this.successfulMating[slot] === 1;
      if (sexual) {
        if (probe !== null) probe.blocked(slot, guild, REPRO_GATE.sexual);
        continue; // handled by the MATE interaction, already queued
      }

      // Income-breeding response `(1 + 10*margin)`: organisms holding a large
      // surplus breed promptly rather than waiting out a flat lottery.
      //
      // Measured failure it addresses: consumers spike above the breeding gate
      // on lump income (kills) then burn down before the stochastic roll fires
      // (max drive ~0.015 = 67-tick wait even at FULL energy), while producers
      // on trickle income hold surplus indefinitely and eventually win the
      // lottery. Same gate, radically different holding dynamics.
      //
      // Uniform — no guild label. Continuous at the gate margin (multiplier is
      // exactly 1 there, steepening immediately above), rising to ~4-6x at full
      // energy across the founder threshold band, giving lump-income organisms
      // a real chance during spikes. The
      // differential effect comes from income physics (lump vs trickle), not
      // from naming consumers. Producers also breed faster when eligible, but
      // they remain nutrient-limited so carrying capacity still binds.
      const drive = sexual ? 0 : asexualRate * (1 - mateSeeking * 0.55) * 2.4 * (energyFrac - threshold + 0.25) * (1 + 10 * Math.max(0, energyFrac - threshold));
      // Pass margin and the trait term so the probe can attribute the drive
      // deficit between eligibility headroom and heritable reproductive rate.
      // Both are read-only derivations of values already computed above.
      if (probe !== null) {
        probe.reachedRoll(
          slot, guild, drive, energyFrac - threshold,
          store.trait(slot, TRAIT.ASEXUAL_RATE),
          mateSeeking,
        );
      }
      if (drive <= 0) continue;
      // Exactly one rng.chance() call, as before: storing the result instead of
      // inlining it in the condition preserves the RNG stream byte-for-byte.
      const passed = this.rng.chance(Math.min(0.9, drive));
      if (probe !== null && passed) probe.fired(slot, guild);
      if (!passed) continue;

      const clutch = Math.max(1, Math.round(store.trait(slot, TRAIT.CLUTCH_SIZE) * (0.5 + this.rng.nextFloat())));
      this.queueBirth(slot, clutch);
      // Cost of the act, on top of the biomass transferred to offspring.
      // reproActCostScale is a diagnostic override (default null = unchanged);
      // scale 0 makes breeding free to test whether its ENERGY COST is what
      // selection is responding to. See config.reproActCostScale.
      if (this.config.reproActCostScale === null || this.config.reproActCostScale === 1) {
        this.spend(slot, 1.1 + store.trait(slot, TRAIT.SIZE) * 0.35, 'reproduction');
      } else {
        this.spend(
          slot,
          (1.1 + store.trait(slot, TRAIT.SIZE) * 0.35) * this.config.reproActCostScale,
          'reproduction',
        );
      }
    }
  }

  /**
   * Re-derive one organism's expressed traits from its module genome at the
   * organism's CURRENT age and energy state.
   *
   * Regenerates the whole phenotype rather than only the trait block, so the
   * derived quantities (hit radius, sensing radius, max step, capacity) follow
   * the newly expressed structure instead of staying frozen at birth. The
   * individual's procedural seed is reused, so its silhouette is stable across
   * re-expression — a phenotype must remain a pure function of
   * (genome, seed, age, condition).
   */
  private reexpressModules(slot: number, age: number): void {
    const store = this.store;
    const go = slot * TRAIT_COUNT;
    const bo = slot * BODY_GENE_COUNT;
    const mo = slot * MAX_MODULES * MODULE_STRIDE;
    const count = store.moduleCount[slot];
    if (count <= 0) return;

    const lifespan = Math.max(1, store.trait(slot, TRAIT.LIFESPAN));
    const ageFraction = Math.max(0, Math.min(1, age / lifespan));
    const energyFraction = this.capacityOf(slot) > 0
      ? Math.max(0, Math.min(1, store.energy[slot] / this.capacityOf(slot)))
      : 0;

    const genome = store.genome.subarray(go, go + TRAIT_COUNT);
    const bodyGenes = store.bodyGenes.subarray(bo, bo + BODY_GENE_COUNT);
    const phen = new Phenotype(
      genome, bodyGenes, store.procSeed[slot],
      store.geneModules.subarray(mo, mo + MAX_MODULES * MODULE_STRIDE),
      count, ageFraction, energyFraction,
    );

    store.physical.set(phen.physical, go);
    store.phen[slot] = phen;
    store.hitRadius[slot] = phen.hitRadius;
    store.senseRadius[slot] = phen.senseRadius;
    store.maxStep[slot] = phen.maxStep;
  }

  private queueBirth(parentSlot: number, count: number, lineageOverride = -1, mateSlot = -1): void {
    // Grow rather than silently drop: a high-fecundity ecology must not have
    // its births censored without being counted anywhere.
    if (this.pendingBirths + count > this.birthParentSlot.length) {
      const next = Math.max(this.birthParentSlot.length * 2, this.pendingBirths + count);
      const gp = new Int32Array(next);
      gp.set(this.birthParentSlot);
      this.birthParentSlot = gp;
      const gc = new Int32Array(next);
      gc.set(this.birthCount);
      this.birthCount = gc;
      const gl = new Int32Array(next).fill(-1);
      gl.set(this.birthLineage);
      this.birthLineage = gl;
      const gi = new Int32Array(next).fill(-1);
      gi.set(this.birthParentId);
      this.birthParentId = gi;
      const gm = new Int32Array(next).fill(-1);
      gm.set(this.birthMateSlot);
      this.birthMateSlot = gm;
      const gi2 = new Int32Array(next).fill(-1);
      gi2.set(this.birthMateId);
      this.birthMateId = gi2;
      this.birthDrops++;
    }
    const parentId = this.store.id[parentSlot];
    this.repro?.queued?.(this.roleOf(parentSlot).trophic, mateSlot >= 0, count);
    for (let i = 0; i < count; i++) {
      this.birthParentSlot[this.pendingBirths] = parentSlot;
      this.birthCount[this.pendingBirths] = count;
      this.birthLineage[this.pendingBirths] = lineageOverride;
      this.birthParentId[this.pendingBirths] = parentId;
      this.birthMateSlot[this.pendingBirths] = mateSlot;
      this.birthMateId[this.pendingBirths] = mateSlot >= 0 ? this.store.id[mateSlot] : -1;
      this.pendingBirths++;
    }
  }

  /** Birth requests that could not be queued. Should stay 0. */
  birthDrops = 0;

  /**
   * Mint a lineage id for a recombined (sexual) child.
   *
   * Deterministic in the two parent lineage ids, so the same mating event
   * always produces the same lineage id — required for repeatability, and it
   * also makes lineage identity inspectable after the fact.
   */
  private mintRecombinantLineage(a: number, b: number): number {
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    let h = (Math.imul(lo, 0x9e3779b1) ^ Math.imul(hi, 0x85ebca6b)) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return 1000000 + (h % 900000000);
  }

  // -------------------------------------------------------------------------
  // Phase 7: death
  // -------------------------------------------------------------------------

  private reasonStarve = 0;
  private reasonAge = 0;
  private reasonDamage = 0;

  /**
   * Phase 1 demographic instrumentation: per-guild breakdowns of deaths, births,
   * and age at death.
   *
   * Read-only counters. No RNG draws, no influence on simulation flow — they
   * observe the existing death/birth paths without changing them. Guild index is
   * the TROPHIC value (0=producer, 1=consumer, 2=decomposer); cause index is
   * 0=starve, 1=age, 2=damage; pathway index is 0=asexual, 1=sexual (recombinant).
   */
  private deathByGuildCause = new Float64Array(3 * 3);
  private birthsByGuildPath = new Float64Array(3 * 2);
  /**
   * Guild-transition matrix: parent guild -> newborn guild, flat [3*3].
   *
   * Counts every birth by (parent's guild, child's guild), so guild
   * resurrection via mutation is directly measurable: a consumer parent with
   * a producer child is a C->P transition. Diagonal = faithful reproduction;
   * off-diagonal = evolution crossing a guild boundary.
   *
   * Accounting only: read by nothing in the engine. Parent role is cached and
   * current (parent is live — checked above); newborn role cached by
   * populateSlot above. Cannot affect simulation flow.
   */
  private guildTransitions = new Float64Array(3 * 3);
  private ageAtDeathSum = new Float64Array(3);
  private ageAtDeathCount = new Float64Array(3);

  private deathPhase(): void {
    const store = this.store;
    const n = store.count;
    const cfg = this.config;
    const fieldW = cfg.worldW / this.detritus.cols;
    const fieldH = cfg.worldH / this.detritus.rows;

    for (let slot = 0; slot < n; slot++) {
      if (!this.live[slot]) continue;
      const lifespan = store.trait(slot, TRAIT.LIFESPAN);
      const lethal =
        store.damage[slot] >= FATAL_DAMAGE ||
        store.age[slot] > lifespan ||
        store.energy[slot] <= 0 && store.hunger[slot] > 400;
      if (!lethal) continue;

      // Reason classification, for demographic history.
      //
      // Starvation and injury share the `damage` counter, so the cause is
      // whichever contributed more. Classifying on the counter alone reported
      // starving organisms as `damage` deaths and produced a wrong reading of
      // what was killing the population.
      const starveShare = store.starveDamage[slot];
      const senesceShare = this.senesceDamage[slot];
      const diseaseShare = this.diseaseDamage[slot];
      const injuryShare = store.damage[slot] - starveShare - senesceShare - diseaseShare;
      // Per-guild demographic counters. Read-only: the role is already cached,
      // and these increments cannot affect simulation flow.
      const deadGuild = store.role[slot * ROLE_STRIDE];
      const g = deadGuild >= 0 && deadGuild < 3 ? deadGuild : -1;
      if (store.damage[slot] < FATAL_DAMAGE) {
        if (store.age[slot] > lifespan) {
          this.reasonAge++;
          if (g >= 0) this.deathByGuildCause[g * 3 + 1]++;
        } else {
          this.reasonStarve++;
          if (g >= 0) this.deathByGuildCause[g * 3 + 0]++;
        }
      } else if (senesceShare > starveShare && senesceShare > injuryShare) {
        // Dormant-senescence death: exact by construction, since only the
        // senescence block writes senesceDamage. Folded into the damage
        // bucket to preserve the demographic shape; senescenceDeaths is the
        // exact attribution. Always zero when the knob is off.
        this.reasonDamage++;
        this.senescenceDeaths++;
        if (g >= 0) this.deathByGuildCause[g * 3 + 2]++;
      } else if (diseaseShare > starveShare && diseaseShare > senesceShare && diseaseShare > injuryShare) {
        // Food-disease death: exact by construction (only diseaseRoll writes
        // diseaseDamage). Ties with senescence break toward senescence above;
        // both loads are cumulative life histories, so order only decides
        // genuinely mixed cases. Folded into the damage bucket like
        // senescence; diseaseDeaths is the exact attribution.
        this.reasonDamage++;
        this.diseaseDeaths++;
        if (g >= 0) this.deathByGuildCause[g * 3 + 2]++;
      } else if (starveShare > injuryShare) {
        this.reasonStarve++;
        if (g >= 0) this.deathByGuildCause[g * 3 + 0]++;
      } else {
        this.reasonDamage++;
        if (g >= 0) this.deathByGuildCause[g * 3 + 2]++;
      }
      // Age at death, per guild. Mean = sum/count; separates "dying as
      // juveniles" from "living long but not breeding".
      if (g >= 0) {
        this.ageAtDeathSum[g] += store.age[slot];
        this.ageAtDeathCount[g]++;
      }

      // Trace the death with its full causal state. The cumulative counters
      // above answer "how many"; this answers "why THIS one" — the damage
      // split (starve vs injury), age, and guild at the moment of death, which
      // were not otherwise recoverable after the fact.
      if (this.traceLog !== null) {
        const cause =
          store.damage[slot] < FATAL_DAMAGE
            ? store.age[slot] > lifespan
              ? DEATH_CAUSE.AGE
              : DEATH_CAUSE.STARVE
            : starveShare > injuryShare && starveShare >= senesceShare && starveShare >= diseaseShare
              ? DEATH_CAUSE.STARVE
              : DEATH_CAUSE.DAMAGE;
        this.traceLog.record({
          tick: this.tick,
          kind: TRACE.DEATH,
          a: store.id[slot],
          b: store.lineage[slot],
          v: cause,
          w: store.age[slot],
          x: store.damage[slot],
          y: starveShare,
          z: g,
        });
      }

      // Corpse -> detritus. Digestibility governs how much becomes usable
      // substrate; the remainder is recorded as spoilage, not discarded.
      //
      // The corpse's energy MUST be removed from the organism first. Leaving
      // it in place while also crediting detritus and dissipation counts the
      // same energy three times and breaks the conservation identity.
      const remaining = store.energy[slot];
      if (remaining > 0) {
        const digestion = 0.35 + store.trait(slot, TRAIT.CARRION_AFFINITY) * 0.3;
        store.energy[slot] = 0;
        this.ledger.recordLivingLoss(
          remaining,
          0.88,
          this.detritus,
          fieldW,
          fieldH,
          store.x[slot],
          store.y[slot],
          digestion,
          this.sediment,
          cfg.litterFraction,
          this.litter,
        );
      }

      this.live[slot] = 0;
      this.store.release(slot);
      this.totalDeaths++;
      this.preyTarget[slot] = -1;
      this.threatTarget[slot] = -1;
      this.mateTarget[slot] = -1;
    }
  }

  // -------------------------------------------------------------------------
  // Phase 8: birth
  // -------------------------------------------------------------------------

  private birthPhase(): void {
    const store = this.store;
    const cfg = this.config;
    const genome = this.birthGenome;
    const body = this.birthBody;
    const fieldW = cfg.worldW / this.detritus.cols;
    const fieldH = cfg.worldH / this.detritus.rows;

    let made = 0;
    for (let q = 0; q < this.pendingBirths; q++) {
      // `store.population` ALREADY includes newborns made earlier in this same
      // phase, because they are live slots. Adding `made` again double-counted
      // and made the effective ceiling roughly half of the configured value,
      // which also inflated the reported cap-hit count.
      if (store.population >= cfg.maxPopulation) {
        this.populationCapHits += this.pendingBirths - q;
        break;
      }
      const parent = this.birthParentSlot[q];
      const queuedParentId = this.birthParentId[q];
      // Require BOTH liveness and an id match. Liveness alone is not enough:
      // the slot may now hold a different organism entirely.
      if (
        parent < 0 ||
        !this.live[parent] ||
        queuedParentId < 0 ||
        this.store.id[parent] !== queuedParentId
      ) {
        continue;
      }

      // Inheritance with mutation. Sexual children branch the lineage;
      // asexual children stay in it. Either way the genome is inherited and
      // mutated here, so morphology and physiology are both heritable.
      this.inherit(parent, genome, body);

      // --- Modular genome v2 (diagnostic) -----------------------------------
      // Null-default: with genomeV2 unset this block is skipped entirely and
      // no organism carries modules, so declared behaviour is unchanged.
      let modCount = 0;
      let modBlock: Float32Array | null = null;
      if (this.config.genomeV2 === true) {
        const store = this.store;
        const rate = store.trait(parent, TRAIT.MUTATION_RATE);
        modBlock = new Float32Array(MAX_MODULES * MODULE_STRIDE);
        const mate = this.birthMateSlot[q];
        if (mate >= 0 && mate !== parent && this.live[mate]
            && this.birthMateId[q] >= 0 && store.id[mate] === this.birthMateId[q]) {
          // Recombination: single-point crossover at a module boundary. Both
          // parents contribute. Guarded so a recycled slot cannot be read as a
          // second parent.
          modCount = recombineModules(
            this.rng,
            store.geneModules.subarray(parent * MAX_MODULES * MODULE_STRIDE,
              parent * MAX_MODULES * MODULE_STRIDE + store.moduleCount[parent] * MODULE_STRIDE),
            store.moduleCount[parent],
            store.geneModules.subarray(mate * MAX_MODULES * MODULE_STRIDE,
              mate * MAX_MODULES * MODULE_STRIDE + store.moduleCount[mate] * MODULE_STRIDE),
            store.moduleCount[mate],
            modBlock, rate,
          );
        } else {
          modCount = inheritModules(
            this.rng,
            store.geneModules.subarray(parent * MAX_MODULES * MODULE_STRIDE,
              parent * MAX_MODULES * MODULE_STRIDE + store.moduleCount[parent] * MODULE_STRIDE),
            store.moduleCount[parent], modBlock, rate,
          );
        }
      }
      const override = this.birthLineage[q];
      const lineageId =
        override >= 0 ? this.denseLineage(override) : store.lineage[parent];

      // Birth energy: a fraction of the parent's reserve, scaled to a share.
      // birthTransferScale is a diagnostic override (default null = unchanged).
      // Scale 0 creates offspring without charging the parent, which violates
      // the closed energy budget; it exists only to test the direction of the
      // selection gradient. See config.birthTransferScale.
      const transferScale =
        cfg.birthTransferScale === null ? 1 : cfg.birthTransferScale;
      const perChild = store.energy[parent] * cfg.birthCostFactor * 0.5 * transferScale;
      // Record the parental charge per-guild. This is the amount DEBITED from
      // the parent (requested == debited, since perChild is 0.21x of the
      // parent's own energy); it may exceed what the child receives (`gained`)
      // by `birthOverflow` when the newborn buffer is small. As a COST ratio
      // the figures stand; as a received-endowment ratio they are upper bounds.
      // A transfer within biomass, not dissipation, so it lives in
      // transferredOutByGuild rather than in the expenditure buckets.
      const slot = store.allocate();
      if (slot < 0) break;
      this.ledger.recordTransferOut(perChild, this.roleOf(parent).trophic);

      this.populateSlot(slot, genome, body, store.id[parent], lineageId, this.tick, modBlock, modCount);
      this.noteSlot(slot);
      // Generation depth increments only on recombination.
      store.generationDepth[slot] =
        override >= 0 ? store.generationDepth[parent] + 1 : store.generationDepth[parent];

      // Cost the parent, then place the newborn. This is a TRANSFER of biomass, not
      // an expenditure: the energy moves into the newborn, so it must not be
      // booked as dissipation or the conservation identity breaks.
      //
      // Clear the newborn's buffer BEFORE the transfer. Zeroing it afterwards
      // would destroy the energy that was just moved, which leaks exactly
      // `perChild` per birth.
      store.energy[slot] = 0;
      const gained = transferEnergy(this.store, parent, slot, perChild);
      // The part of the endowment that will not fit in the newborn's buffer
      // must be accounted for. The parent was already debited for the whole
      // amount, so without this the difference vanishes.
      const birthOverflow = perChild - gained;
      if (birthOverflow > 0) {
        this.detritus.add(store.x[parent], store.y[parent], fieldW, fieldH, birthOverflow);
        this.ledger.recordSpill(birthOverflow);
      }
      store.age[slot] = 0;
      store.damage[slot] = 0;
      store.hunger[slot] = 0;
      store.fatigue[slot] = 0;
      store.bornTick[slot] = this.tick;
      // Per-guild birth counters, by pathway. Read-only: the newborn's role was
      // cached by populateSlot above, and `override >= 0` marks a sexual
      // (recombinant) birth. Cannot affect simulation flow.
      {
        const newbornGuild = store.role[slot * ROLE_STRIDE];
        this.repro?.placed?.(newbornGuild, this.birthMateSlot[q] >= 0);
        if (newbornGuild >= 0 && newbornGuild < 3) {
          const pathway = override >= 0 ? 1 : 0;
          this.birthsByGuildPath[newbornGuild * 2 + pathway]++;
          const parentGuild = store.role[parent * ROLE_STRIDE];
          if (parentGuild >= 0 && parentGuild < 3) {
            this.guildTransitions[parentGuild * 3 + newbornGuild]++;
            // Pioneer establishment bonus: a birth flip into a void guild
            // banks grace scaled by the void. Same-tick newborns are excluded
            // from the census, so the void cannot dilute within a tick.
            if (newbornGuild !== parentGuild) this.pioneerGrant(slot, newbornGuild);
          }
        }
      }

      // --- Dispersal -------------------------------------------------------
      // Placement is heritable, and displacement from the parent is a
      // heritable consequence of locomotion AND of the dispersal trait.
      //
      // This is not decoration. Sessile producers bud IN PLACE, so without a
      // dispersal mechanism a rooted population permanently exhausts the cell it
      // occupies and has no route to fresh substrate: measured survivors drifted
      // toward fertile cells (mean fertility 1.19 -> 1.26 vs world mean 1.14)
      // while their LOCAL nutrient fell 18.1 -> 15.4, and the population then
      // declined monotonically. Real plants solve this with seeds and spores;
      // this is the heritable analogue, and it is what makes colonisation
      // possible at all.
      const parentSessile = store.role[parent * ROLE_STRIDE + 1] === MOTILITY.SESSILE;
      const dispersalGene = store.trait(parent, TRAIT.DISPERSAL);
      // Sessile parents are pushed harder because they have no other way to
      // move; motile parents already spread by walking.
      const capacityBoost = parentSessile ? 1.85 : 1;
      // Displacement grows with the parent's own body size and locomotor reach,
      // so a large-bodied disperser moves its offspring further.
      const base = store.hitRadius[slot] * (2.4 + store.maxStep[parent] * 0.85);
      const reach = base + dispersalGene * dispersalGene * 260 * capacityBoost;
      // Dispersal is DIRECTIONAL and biased along the parent's heading, so a
      // lineage advances rather than scattering symmetrically.
      const ang = store.heading[parent] + this.rng.gaussian(0, 0.8);
      // HEAVY-TAILED, matching real seed and propagule dispersal: recruitment is
      // overwhelmingly local (primary dispersal - gravity, drop, short walk) with
      // a small fraction carried far (secondary dispersal - wind, water, animals).
      //
      // The previous shape was `reach * (0.45 + 0.55*rand)`, i.e. a MANDATORY
      // minimum displacement of 0.45*reach for every single offspring. That is
      // the opposite of nature and it spread every founder's descendants evenly
      // across the map, so local density never built up anywhere.
      //
      // That mattered because it removed the only thing light competition could
      // act on: with <0.5 producers per substrate cell there was no local
      // density for self-shading to engage, so the population could only be
      // bounded by the artificial `maxPopulation` cap. Local recruitment is what
      // makes stands, thickets and canopy patches - and therefore real carrying
      // capacity - possible at all.
      const longRange = this.rng.chance(LONG_RANGE_DISPERSAL);
      // Actual displacement of this offspring, used for the travel cost below.
      // Set on both branches: the heading path computes it directly, the
      // immigration path measures it after landing in the chosen patch.
      let travelDist = 0;

      // --- Immigration: directed long-range placement (v0.4.0) -------------
      // A long-range disperser does NOT simply land further along the parent's
      // heading. It targets a PATCH chosen by how badly that patch is missing
      // the newborn's own guild: weight `1 / (1 + w * localCount)`, so an empty
      // patch for this guild is maximally attractive and a saturated one is
      // avoided. Within the chosen patch the position is uniform.
      //
      // Why this is the right mechanism: measured on a 4x4 grid across both
      // seeds, consumer abundance is spatially CLUSTERED (CV 0.85-1.86; one
      // patch held 69 consumers while four held 0-3). The failure mode is
      // therefore patch-LOCAL extinction, not global collapse. This converts a
      // local extinction into a recolonisation event, supplying the
      // "increase when rare" that Chesson's coexistence theory requires and that
      // this model previously inverted (per-capita birth rate FELL with rarity,
      // because income was encounter-limited - an in-built Allee effect).
      //
      // Not a food subsidy and not an external input: the immigrant is an
      // ordinary newborn whose energy came from the parent reserve via the
      // birthCostFactor transfer above, and it stays inside the same closed
      // world. This is movement between patches, which is what real immigration
      // is.
      //
      // Placement within the patch is uniform rather than heading-biased,
      // because a cross-patch propagule has already committed to a destination;
      // keeping the parent's heading would drag it straight back out of the
      // patch it was sent to.
      //
      // RNG: three nextFloat draws when a target patch is taken (weighted pick,
      // then x and y within the patch), replacing the single nextFloat the old
      // distance expression consumed. The pre-branch `ang` gaussian and the
      // post-branch heading draw are shared by both paths. Deterministic per
      // seed; the version bump covers the stream change.
      if (longRange && this.patchCensus.length > 0) {
        const guild = store.role[slot * ROLE_STRIDE];
        const nPatches = this.patchCols * this.patchRows;
        let total = 0;
        for (let p = 0; p < nPatches; p++) {
          total += 1 / (1 + this.config.immigrationWeight * this.patchCount(p, guild));
        }
        let pick = this.rng.nextFloat() * total;
        let chosen = nPatches - 1;
        for (let p = 0; p < nPatches; p++) {
          pick -= 1 / (1 + this.config.immigrationWeight * this.patchCount(p, guild));
          if (pick <= 0) {
            chosen = p;
            break;
          }
        }
        const pcol = chosen % this.patchCols;
        const prow = (chosen / this.patchCols) | 0;
        const pw = this.config.worldW / this.patchCols;
        const ph = this.config.worldH / this.patchRows;
        store.x[slot] = clamp(pcol * pw + this.rng.nextFloat() * pw, 0, this.config.worldW);
        store.y[slot] = clamp(prow * ph + this.rng.nextFloat() * ph, 0, this.config.worldH);
        // Already clamped into bounds, so the reflection pass below is a no-op
        // for this path; `travelDist` is still set so the travel cost applies.
        travelDist = Math.hypot(
          store.x[slot] - store.x[parent],
          store.y[slot] - store.y[parent],
        );
        // Trace the recolonisation event. Immigration is the mechanism currently
        // preventing patch-local consumer extinction, so whether it works and
        // whether the immigrants SURVIVE are the two questions worth answering
        // directly — the second needs following an id to its death, which only a
        // per-event log supports.
        if (this.traceLog !== null) {
          const fromCol = Math.min(
            this.patchCols - 1,
            Math.max(0, Math.floor((store.x[parent] / this.config.worldW) * this.patchCols)),
          );
          const fromRow = Math.min(
            this.patchRows - 1,
            Math.max(0, Math.floor((store.y[parent] / this.config.worldH) * this.patchRows)),
          );
          this.traceLog.record({
            tick: this.tick,
            kind: TRACE.IMMIGRATION,
            a: store.id[slot],
            b: fromRow * this.patchCols + fromCol,
            x: chosen,
            v: store.role[slot * ROLE_STRIDE],
            w: store.parentId[slot],
            y: travelDist,
            z: 0,
          });
        }
      } else if (
        this.config.sporeDispersal !== null &&
        this.config.sporeDispersal !== 0 &&
        store.role[slot * ROLE_STRIDE] === TROPHIC.DECOMPOSER
      ) {
        // --- Spore dispersal (diagnostic, decomposers only) -----------------
        // Offspring lands 30-80 field cells away (wind-like, long-range), 20%
        // directed to the highest-litter cell among 8 candidates. Travel cost
        // waived below: no body travels. See config.sporeDispersal.
        const cellSize = cfg.worldW / this.litter.cols;
        const px = store.x[parent];
        const py = store.y[parent];
        const dist = (30 + this.rng.nextFloat() * 50) * cellSize;
        const sang = this.rng.nextFloat() * Math.PI * 2;
        let sx = px + Math.cos(sang) * dist;
        let sy = py + Math.sin(sang) * dist;
        // 20% directed: sample 8 candidates in radius, pick max litter.
        if (this.rng.nextFloat() < 0.2) {
          let bestL = -1;
          let bx = sx, by = sy;
          for (let k = 0; k < 8; k++) {
            const kd = (30 + this.rng.nextFloat() * 50) * cellSize;
            const ka = this.rng.nextFloat() * Math.PI * 2;
            const cx = px + Math.cos(ka) * kd;
            const cy = py + Math.sin(ka) * kd;
            const ccx = Math.min(this.litter.cols - 1, Math.max(0, Math.floor(cx / cellSize)));
            const ccy = Math.min(this.litter.rows - 1, Math.max(0, Math.floor(cy / cellSize)));
            const lv = this.litter.data[ccy * this.litter.cols + ccx];
            if (lv > bestL) { bestL = lv; bx = cx; by = cy; }
          }
          sx = bx; sy = by;
        }
        store.x[slot] = sx;
        store.y[slot] = sy;
        // travelDist=0 so the travel cost below is zero (waived for spores).
        // Reflection and clamping below still apply for bounds.
        travelDist = 0;
      } else {
        travelDist = longRange
          ? reach * (0.55 + 0.45 * this.rng.nextFloat())
          : base * (0.3 + 0.7 * this.rng.nextFloat());
        store.x[slot] = store.x[parent] + Math.cos(ang) * travelDist;
        store.y[slot] = store.y[parent] + Math.sin(ang) * travelDist;
      }
      let nx = store.x[slot];
      let ny = store.y[slot];
      // Reflect off the world edge rather than clamping, so dispersal is not
      // silently biased toward the interior.
      if (nx < 0) nx = -nx;
      if (nx > cfg.worldW) nx = 2 * cfg.worldW - nx;
      if (ny < 0) ny = -ny;
      if (ny > cfg.worldH) ny = 2 * cfg.worldH - ny;
      store.x[slot] = clamp(nx, 0, cfg.worldW);
      store.y[slot] = clamp(ny, 0, cfg.worldH);
      store.heading[slot] = this.rng.nextFloat() * Math.PI * 2;

      // Birth event, recorded once placement is final so the recorded position
      // and energy match the organism as it enters the world.
      if (this.traceLog !== null) {
        this.traceLog.record({
          tick: this.tick,
          kind: TRACE.BIRTH,
          a: store.id[slot],
          b: store.id[parent],
          v: store.energy[slot],
          // Pathway flag: 1 = sexual (recombinant), 0 = asexual. NOT a clutch
          // size — see `formatEvent`, which labels it accordingly.
          w: override >= 0 ? 1 : 0,
          x: store.role[slot * ROLE_STRIDE],
          y: store.x[slot],
          z: store.y[slot],
        });
        // Record id -> lineage for lineage queries. Done at BIRTH because that is
        // the only point where both the new id and its lineage are known, and
        // it must include organisms that later die — lineage queries target
        // extinct lineages, which is the main reason to have this map.
        this.traceIdLineage.set(store.id[slot], store.lineage[slot]);
      }

      // Dispersal COST. Movement is not free: an offspring placed far from its
      // parent carries a provisioning cost, which is what creates a real
      // trade-off rather than free colonisation.
      const travelCost = travelDist * 0.0042;
      if (travelCost > 0) this.spend(parent, travelCost, 'reproduction');
      // Cost of reproduction includes a refractory period, which is a genuine
      // life-history cost rather than a bookkeeping detail.
      store.reproCooldown[parent] = 8 + this.rng.int(26);

      this.totalBirths++;
      made++;
    }
    this.pendingBirths = 0;
  }


  /** Reusable buffers for inheritance so births allocate nothing. */
  private birthGenome = new Float32Array(TRAIT_COUNT);
  private birthBody = new Uint8Array(BODY_GENE_COUNT);

  /**
   * Scheduled radiation multiplier for the current tick: 1 when the knob is
   * off or the schedule hasn't started. Geometric in tick — m(t) doubles
   * every `doubling` ticks from `onset`, saturating at `cap`. Defensive
   * clamps (doubling >= 1, cap >= 1) make every numeric schedule total — no
   * invalid states, no mid-run throws. Same draws, scaled sigma: stream
   * positions stay comparable with radiation off.
   *
   * `overgrowthCoupling` (optional, default null = original behaviour) makes
   * the ramp DIE with overgrowth: the multiplier scales by the live dormant
   * share relative to `floor`, clamped to 1. Below the floor the share term
   * is 1 (full schedule); as the brake suppresses hoarding and the dormant
   * share falls toward zero, radiation fades proportionally and reaches
   * exactly 1x at zero dormancy. Self-scaling like share-mode senescence:
   * evolvability is only spent where the overgrowth is. `floor` 0 disables
   * the coupling entirely (share/0 undefined -> treated as uncoupled).
   *
   * Reads this tick's dormant share (recomputed in Phase 3 from last tick's
   * dormancy flags, the same 1-tick-lag precedent share-mode already uses);
   * inheritance runs in Phase 6, later in the same tick.
   */
  private radiationMultiplier(): number {
    const r = this.config.radiation;
    if (r === null || r === undefined) return 1;
    if (this.tick < r.onset) return 1;
    const m = Math.pow(2, (this.tick - r.onset) / Math.max(1, r.doubling));
    let mult = Math.min(Math.max(1, r.cap), m);
    const floor = r.overgrowthCoupling;
    if (floor !== null && floor !== undefined && floor > 0) {
      // Couple the EXCESS over background (1x) to dormant share, not the total.
      // At 0 dormancy → 1x background (not 0x). At dormantFrac >= floor → full mult.
      mult = 1 + (mult - 1) * Math.min(1, this.dormantFrac / floor);
    }
    return mult;
  }

  /**
   * Copy the parent's genome with mutation, and step the discrete body-plan
   * genes. Body plans change by integer structural steps, so a lineage's
   * morphology is genuinely inherited and genuinely mutable.
   */
  private inherit(parentSlot: number, outGenome: Float32Array, outBody: Uint8Array): void {
    const store = this.store;
    const po = parentSlot * TRAIT_COUNT;
    const mutationRate = store.trait(parentSlot, TRAIT.MUTATION_RATE);
    // Stress-induced mutagenesis: a parent under physiological stress produces
    // offspring that explore genotype space faster. Hunger integrates starvation
    // over time (lethal damage accrues past ~260), damage is scaled against the
    // breeding disqualification bar (45), and energy deficit captures how far
    // below a full reserve the parent sits. Each term is clamped to [0,1] and
    // weighted by how directly it signals distress.
    //
    // The effective rate feeds BOTH the trait loop and the body-gene loop below,
    // so structural and physiological exploration scale together. Comfortable
    // parents (stress ~0) reproduce at exactly background rate; maximally
    // stressed parents at ~(1+gain)x. No guild label is read anywhere on this
    // path — the boost follows condition, so a starving producer and a starving
    // consumer are treated identically.
    const stress =
      clamp(store.hunger[parentSlot] / 200, 0, 1) * 0.5 +
      clamp(store.damage[parentSlot] / 50, 0, 1) * 0.3 +
      clamp(1 - store.energy[parentSlot] / Math.max(1, this.capacityOf(parentSlot)), 0, 1) * 0.2;
    const effRate = mutationRate * (1 + this.config.stressMutagenesis * stress) * this.radiationMultiplier();

    for (let t = 0; t < TRAIT_COUNT; t++) {
      const spec: TraitSpec = TRAITS[t];
      const inherited = store.genome[po + t];
      // Sigma combines the parent's own mutation rate with the trait's own
      // per-gene sensitivity, so a high-mutation-rate lineage really does
      // explore faster.
      const sigma = effRate * spec.sigma * 6;
      let g = inherited + this.rng.gaussian(0, sigma);
      // Occasional larger "macro" step, so novel extremes are reachable.
      if (this.rng.chance(0.012)) g += this.rng.gaussian(0, sigma * 8);
      outGenome[t] = g < 0 ? 0 : g > 1 ? 1 : g;
    }

    const bo = parentSlot * BODY_GENE_COUNT;
    for (let b = 0; b < BODY_GENE_COUNT; b++) {
      const spec = BODY_GENES[b];
      let v = store.bodyGenes[bo + b];
      const span = spec.hi - spec.lo;
      if (span > 1) {
        // Structural genes step by 1 with a rate tied to mutation rate.
        const p = Math.min(0.45, effRate * 2.4);
        if (this.rng.chance(p)) v += this.rng.chance(0.5) ? 1 : -1;
        // Rare larger structural rearrangement.
        if (this.rng.chance(p * 0.16)) v += Math.round(this.rng.gaussian(0, span * 0.12));
        if (v < spec.lo) v = spec.lo;
        else if (v > spec.hi) v = spec.hi;
      }
      outBody[b] = v;
    }
  }

  // -------------------------------------------------------------------------
  // Measurement
  // -------------------------------------------------------------------------

  /** Per-phase cumulative share of simulation cost. */
  phaseShares(): Record<string, number> {
    const t = this.totals;
    const total = t.total || 1;
    return {
      abiotic: t.abiotic / total,
      fields: t.fields / total,
      spatial: t.spatial / total,
      act: t.act / total,
      contests: t.contests / total,
      deaths: t.deaths / total,
      births: t.births / total,
    };
  }

  measure(): WorldSnapshot {
    const store = this.store;
    // Iterate the dense bound but count only LIVE organisms. Using
    // `store.count` as the denominator understates every mean as soon as any
    // organism dies, because count is a high-water mark that never shrinks.
    const bound = store.count;
    const p = store.physical;
    let biomass = 0;
    let sizeSum = 0;
    let producers = 0;
    let consumers = 0;
    let apex = 0;
    let generationSum = 0;
    let live = 0;

    for (let slot = 0; slot < bound; slot++) {
      if (!this.live[slot]) continue;
      live++;
      const o = slot * TRAIT_COUNT;
      const e = store.energy[slot];
      biomass += e;
      sizeSum += p[o + TRAIT.SIZE];
      const toxin = p[o + TRAIT.TOXIN];
      // Guild comes from the AUTHORITATIVE derived role, not from a second
      // threshold. This used to re-derive "producer" as `photo > 0.35` while
      // deriveRole used `photo > 0.34`, so an organism with photo in
      // (0.34, 0.35] counted as a PRODUCER in role terms and a CONSUMER in
      // every snapshot statistic. Two reporting paths disagreeing is how a
      // measured guild total stops meaning anything.
      const guild = this.roleOf(slot).trophic;
      if (guild === TROPHIC.PRODUCER) producers++;
      else consumers++;
      if (p[o + TRAIT.SIZE] > 4.2 && toxin > 0.18) apex++;
      generationSum += store.generationDepth[slot];
    }

    const denom = live > 0 ? live : 1;
    return {
      tick: this.tick,
      population: live,
      births: this.totalBirths,
      deaths: this.totalDeaths,
      extinctions: this.extinctLineages,
      biomass,
      detritus: this.detritus.total(),
      sediment: this.sediment.total(),
      litter: this.litter.total(),
      nutrient: this.nutrientTotal(),
      meanEnergy: biomass / denom,
      meanSize: sizeSum / denom,
      trophicProducers: producers,
      trophicConsumers: consumers,
      trophicApex: apex,
      // This is the MEAN generation depth of living organisms. It previously
      // carried the producer FRACTION under this name, which silently
      // mislabelled every snapshot and history sample.
      meanGeneration: generationSum / denom,
      contestedInteractions: this.interactions.totalResolved,
      activeDisturbances: this.abiotic.activeCount,
    };
  }

  /**
   * Causal accounting residual. The invariant is
   *   capture + injectOrganic === biomass + detritus + dissipated
   * A small non-zero value is expected from float accumulation; a large one
   * means energy was created or destroyed somewhere.
   */
  accountingResidual(): number {
    // Use the same liveness-filtered definition of biomass the snapshot uses.
    // Summing the dense bound happens to agree today only because death zeroes
    // an organism's energy first; any future path that leaves energy in a freed
    // slot would over-count here and not in the snapshot.
    const biomass = this.ledger.biomass(this.store, (slot) => this.live[slot] === 1);
    // BOTH organic pools count. Corpses sink mostly into the benthic
    // compartment, so counting only the suspended pool left most of the
    // standing organic energy unaccounted for and the identity broke by -23 %.
    const det = this.detritus.total() + this.sediment.total() + this.litter.total();
    const dis = this.ledger.totalDissipated();
    const input = this.ledger.totalInput();
    return input - (biomass + det + dis);
  }

  /**
   * Residual as a fraction of total input, which is the scale-free form the
   * validation gate should assert on: an absolute tolerance would pass a
   * small world trivially and fail a large one spuriously.
   */
  accountingResidualFraction(): number {
    const input = this.ledger.totalInput();
    if (input <= 0) return 0;
    return this.accountingResidual() / input;
  }

  /**
   * Order-sensitive digest of everything that can influence future evolution.
   *
   * Scoped deliberately to LIVE slots in slot order plus their stable ids. That
   * means slot recycling is detected (it changes who occupies the population)
   * while vacant-slot bookkeeping is not, and the digest never depends on
   * memory layout, wall-clock time, or process identity.
   */
  hashState(): string {
    const store = this.store;
    const h = new RollingDigest();
    h.reset();
    h.mixInt(this.tick);
    h.mixInt(this.nextId);
    h.mixInt(store.count);
    h.mixInt(this.totalBirths);
    h.mixInt(this.totalDeaths);
    h.mixInt(this.populationCapHits);
    // RNG state: hidden RNG state is exactly the kind of divergence a state
    // digest is supposed to catch, so it must be inside the digest.
    const rngWords = this.rng.state();
    h.mixU32(rngWords[0]);
    h.mixU32(rngWords[1]);
    h.mixU32(rngWords[2]);
    h.mixU32(rngWords[3]);
    // Ledger totals and the abiotic axis are also authoritative: they determine
    // future capture and mortality even when every organism looks identical.
    h.mixF32(this.ledger.capture);
    h.mixF32(this.ledger.injectOrganic);
    h.mixF32(this.ledger.mineralised);
    h.mixF32(this.ledger.unassimilated);
    h.mixF32(this.abiotic.phase);
    h.mixF32(this.abiotic.drift);
    h.mixInt(this.abiotic.history.length);
    // Substrate fields are authoritative state: they determine who eats next.
    for (const f of this.nutrients) h.mixF32Array(f.data);
    h.mixF32Array(this.detritus.data);
    // The sediment compartment is authoritative state: it is the reservoir
    // detritivores live on, so omitting it would let a divergent sediment
    // state pass the repeatability digest.
    h.mixF32Array(this.sediment.data);
    h.mixF32Array(this.litter.data);
    h.mixF32Array(this.habitat.fertility.data);
    for (let slot = 0; slot < store.count; slot++) {
      if (this.live[slot] !== 1) continue;
      h.mixInt(store.id[slot]);
      h.mixInt(store.lineage[slot]);
      h.mixInt(store.parentId[slot]);
      h.mixInt(store.generationDepth[slot]);
      h.mixInt(store.age[slot]);
      h.mixInt(store.hunger[slot]);
      h.mixInt(this.starveStreak[slot]);
      h.mixInt(store.reproCooldown[slot]);
      h.mixInt(this.dormantSleep[slot]);
      h.mixF32(this.dormantFrac);
      h.mixF32(store.energy[slot]);
      h.mixF32(store.damage[slot]);
      h.mixF32(store.x[slot]);
      h.mixF32(store.y[slot]);
      h.mixF32(store.heading[slot]);
      h.mixF32(store.energyIngested[slot]);
      h.mixF32(store.energySpent[slot]);
      h.mixF32Array(store.genome.subarray(slot * TRAIT_COUNT, (slot + 1) * TRAIT_COUNT));
      h.mixBytes(store.bodyGenes.subarray(slot * 12, (slot + 1) * 12));
    }
    return h.digest();
  }

  /** Deaths broken down by proximate cause, for demographic history. */
  deathReasons(): { starve: number; age: number; damage: number } {
    return { starve: this.reasonStarve, age: this.reasonAge, damage: this.reasonDamage };
  }

  /**
   * Phase 1 demographic decomposition: per-guild births, deaths, and age at death.
   *
   * Guild index follows TROPHIC (0=producer, 1=consumer, 2=decomposer). Cause index is 0=starve, 1=age, 2=damage; pathway
   * index is 0=asexual, 1=sexual. Mean age at death per guild is
   * ageAtDeathSum/count; a guild whose mean age at death sits well below its
   * maturity age is dying as juveniles.
   *
   * Read-only view over the instrumentation counters. Copies into plain arrays
   * so callers cannot mutate engine state.
   */
  /**
   * Dormant vs active decomposer counts, for the dormancy acceptance test.
   * Returns [dormant, active]. Always [0, n] when the knob is off.
   */
  /**
   * Per-slot dormancy read for the pixel renderer. Read-only; exposes one bit
   * of existing diagnostic state so hibernation is visible. No behavior change.
   */
  isDormant(slot: number): boolean {
    return this.dormant[slot] === 1;
  }

  dormantCounts(): [number, number] {
    let dormant = 0, active = 0;
    for (let slot = 0; slot < this.store.count; slot++) {
      if (!this.live[slot]) continue;
      if (this.roleOf(slot).trophic !== 2) continue;
      if (this.dormant[slot] === 1) dormant++;
      else active++;
    }
    return [dormant, active];
  }

  /**
   * Guild-transition matrix as rows of parent guild -> child guild counts.
   * Row g = births from parents of guild g, split by newborn guild.
   * Read-only snapshot for diagnostics.
   */
  transitionMatrix(): number[][] {
    const out: number[][] = [];
    for (let g = 0; g < 3; g++) {
      out.push([
        this.guildTransitions[g * 3 + 0],
        this.guildTransitions[g * 3 + 1],
        this.guildTransitions[g * 3 + 2],
      ]);
    }
    return out;
  }

  demographics(): {
    deaths: number[][];
    births: number[][];
    meanAgeAtDeath: (number | null)[];
  } {
    const deaths: number[][] = [];
    const births: number[][] = [];
    const meanAgeAtDeath: (number | null)[] = [];
    for (let g = 0; g < 3; g++) {
      deaths.push([
        this.deathByGuildCause[g * 3 + 0],
        this.deathByGuildCause[g * 3 + 1],
        this.deathByGuildCause[g * 3 + 2],
      ]);
      births.push([this.birthsByGuildPath[g * 2 + 0], this.birthsByGuildPath[g * 2 + 1]]);
      const n = this.ageAtDeathCount[g];
      meanAgeAtDeath.push(n > 0 ? this.ageAtDeathSum[g] / n : null);
    }
    return { deaths, births, meanAgeAtDeath };
  }

  /**
   * The event trace, or null when tracing is disabled.
   *
   * The handle is MUTABLE diagnostic state (callers may `record` or `reset` it)
   * but it is DIAGNOSTIC-ONLY in effect: the engine never reads the log, so
   * mutating it cannot change any simulation outcome. Verified by identical
   * `hashState()` with tracing on and off.
   *
   * Query with the helpers in src/trace (`between`, `ofKind`, `forOrganism`,
   * `forLineage`) or render with `formatEvent`.
   */
  trace(): TraceLog | null {
    return this.traceLog;
  }

  /** Whether event tracing is active on this world. */
  get tracing(): boolean {
    return this.traceLog !== null;
  }

  /**
   * Map organism id -> lineage id for every id born this run, INCLUDING dead
   * ones. Read-only; returns a copy so callers cannot mutate engine state.
   *
   * Includes founders as well as births, so a lineage founded at tick 0 is
   * queryable. Members are recorded at birth, which is also where the id is
   * assigned — the only moment both values are known together.
   */
  traceLineageMap(): Map<number, number> {
    return new Map(this.traceIdLineage);
  }

  /** Resolution records from the most recent tick, as a stable-count view. */
  resolutions(): readonly ResolutionRecord[] {
    return this.lastResolutions.length === this.lastResolutionCount
      ? this.lastResolutions
      : this.lastResolutions.slice(0, this.lastResolutionCount);
  }

  /** True when the given slot currently holds a living organism. */
  aliveAt(slot: number): boolean {
    return this.live[slot] === 1;
  }

  /**
   * Sample lineage aggregates into a tracker, and time the cost separately.
   *
   * Bookkeeping is reporting, not biology, so it is timed on its own axis.
   * Leaving it inside the tick phases would make lineage-heavy runs look like
   * slower simulation when the extra time is only measurement.
   */
  sampleLineages(tracker: LineageTracker, tick: number): void {
    const t0 = this.profiling ? now() : 0;
    const store = this.store;
    tracker.sample(
      tick,
      (slot) => store.lineage[slot],
      (slot, trait) => store.genome[slot * TRAIT_COUNT + trait],
      (slot) => store.energy[slot],
      (slot) => store.generationDepth[slot],
      store.count,
      (slot) => this.live[slot] === 1,
    );
    if (this.profiling) this.lineageMs += now() - t0;
  }

  /**
   * Cumulative intent histogram, indexed by INTENT. This is real ecological
   * evidence (behavioural composition over time), not just a debug aid: a
   * world where nobody ever hunts or flees is visibly inert, and that should
   * be measurable rather than inferred.
   */
  readonly intentCounts = new Int32Array(8);

  /**
   * Opportunity counters: how many organisms actually had a prey / threat /
   * mate in range on the most recent tick. Separating "opportunity" from
   * "chosen" is what distinguishes an inert ecology from a broken detector.
   */
  lastDetectedPrey = 0;
  lastDetectedThreat = 0;
  lastDetectedMate = 0;
  /** Cumulative total contests submitted, by kind. */
  readonly submittedByKind = new Int32Array(5);

  /** Reset the per-tick opportunity counters. */
  resetTickDiagnostics(): void {
    this.lastDetectedPrey = 0;
    this.lastDetectedThreat = 0;
    this.lastDetectedMate = 0;
  }

  /** Global abiotic values for the current tick. */
  globalLight = 0.6;
  globalTemp = 18;

  /** Run for `ticks` ticks. */
  run(ticks: number, onTick?: (tick: number, w: World) => void): void {
    for (let i = 0; i < ticks; i++) {
      this.step();
      if (onTick) onTick(this.tick, this);
    }
  }
}

/**
 * Baseline energy an organism must spend per tick merely to stay alive.
 *
 * Mirrors the basal term charged in the act phase, so the starvation and
 * reproduction viability tests are compared against the SAME quantity the
 * simulation actually deducts. If these two diverge, viability becomes fiction.
 */
function upkeepOf(basalCost: number, size: number, massCost: number): number {
  // Allometric (Kleiber) mass scaling: total metabolic cost grows as M^0.75, so
  // cost PER UNIT MASS falls as M^-0.25. Expressed relative to a mid-sized
  // reference animal so the average organism's budget is unchanged.
  //
  // The previous term scaled LINEARLY with mass, which made large bodies
  // disproportionately expensive and was a principal reason apex predators
  // could never persist: a big predator paid several times the upkeep of a
  // small grazer while competing for the same producer biomass, so it was
  // excluded every time (measured 31 -> 0). Real large animals are not
  // penalised this way; that is what Kleiber's law is for.
  return basalCost * (1 + massCost * 42 * REFERENCE_SIZE * Math.pow(size / REFERENCE_SIZE, 0.75));
}

/** Mid-sized reference animal for the allometric mass term. */
const REFERENCE_SIZE = 6.7;

function angleTo(ax: number, ay: number, bx: number, by: number): number {
  return Math.atan2(by - ay, bx - ax);
}

/**
 * Move energy from one living organism to another. This is a TRANSFER, not an
 * expenditure: the energy leaves biomass and re-enters biomass, so it must
 * never touch the dissipation ledger. Booking it as a `spend` would silently
 * break the conservation identity — exactly the class of bug the accounting
 * gate exists to catch.
 */
function transferEnergy(store: OrganismStore, fromSlot: number, toSlot: number, requested: number): number {
  if (requested <= 0) return 0;
  const available = store.energy[fromSlot];
  const amount = requested < available ? requested : available;
  if (amount <= 0) return 0;
  store.energy[fromSlot] -= amount;
  // Deliberately NOT added to `energySpent`: that counter means energy
  // dissipated, and a transfer dissipates nothing. Recording it there made the
  // per-organism counter read "dissipation + transfers".
  store.energyTransferred[fromSlot] += amount;
  const cap = resolveCapacity(store.phen[toSlot], store.trait(toSlot, TRAIT.STORAGE_CAPACITY));
  const room = cap - store.energy[toSlot];
  const gain = amount < room ? amount : Math.max(0, room);
  if (gain > 0) {
    store.energy[toSlot] += gain;
    store.energyIngested[toSlot] += gain;
  }
  return gain;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function now(): number {
  // performance.now() is monotonic and does not make the simulation depend on
  // wall-clock time: it is only ever used for reporting, never for state.
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export { TRAIT, TRAITS, BODY_GENES, TRAIT_COUNT } from '../bio/genome.js';
export { INTERACTION, OUTCOME } from '../bio/interactions.js';
export { WORLD_ENGINE_VERSION } from './version.js';
