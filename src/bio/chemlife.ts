/**
 * Organism-side chemistry: elemental stores, metabolic execution, growth.
 *
 * This module is where MATTER and ENERGY become genuinely distinct constraints.
 * The existing engine has one currency — `store.energy`. That is kept, because
 * discarding a working, accounted energy ledger to replace it with something
 * less careful would be a regression. Matter is added alongside it as a second,
 * separately conserved quantity.
 *
 * The separation is not a label. An organism here can hold:
 *   - abundant energy and no phosphate   -> cannot grow or reproduce
 *   - abundant phosphate and no energy    -> cannot build tissue that costs
 *                                           energy to construct
 * and both outcomes are produced by `grow()`, not asserted about it.
 *
 * WHAT AN ORGANISM CARRIES. Standing BIOMASS (elemental composition of living
 * tissue, which returns to the pools on death) and ASSIMILATED STORES (internal
 * pools of N, P and trace elements, drawn down to build biomass and offspring,
 * and excreted on death). Keeping these separate is what allows stores to be
 * transported by feeding independently of tissue.
 *
 * DETERMINISM. Every pool effect is written to Chemistry's delta buffer and
 * settled once per tick, so an organism's reaction outcome never depends on
 * whether it was iterated before or after its neighbour.
 */

import {
  E, biomassDemand, newElemVec, sumElems, MACRONUTRIENTS, TRACE_ELEMENTS,
} from './elements.js';
import {
  CAP, CAP_COUNT, REACTIONS, RX_COUNT, reactionExtent, type Reaction,
} from './metabolism.js';
import { POOL, type Chemistry } from '../world/chemistry.js';

/**
 * Local nutrient pools an organism can draw from in one tick.
 *
 * Deliberately simple: an organism reaches only what is in its own cell plus a
 * share of the organic matter already in that cell. It does NOT teleport to a
 * global average, because that would make the spatial chemistry decorative.
 */
export interface NutrientAccess {
  nh4: number;
  no3: number;
  po4: number;
  so4: number;
  h2s: number;
  fe2: number;
}

export function readAccess(chem: Chemistry, cell: number): NutrientAccess {
  const f = chem.fields;
  return {
    nh4: f[POOL.NH4].data[cell],
    no3: f[POOL.NO3].data[cell],
    po4: f[POOL.PO4].data[cell],
    so4: f[POOL.SO4].data[cell],
    h2s: f[POOL.H2S].data[cell],
    fe2: f[POOL.FE2].data[cell],
  };
}

export interface ChemConfig {
  enabled: boolean;
  energyScale: number;
  assimilationEfficiency: number;
  reproNutrientDemand: number;
  noChemosynthesis: boolean;
  noAnaerobic: boolean;
  noNitrogenCycle: boolean;
  freeEnergy: boolean;
  freeNutrients: boolean;
}

export const DEFAULT_CHEM_CONFIG: ChemConfig = {
  enabled: false,
  energyScale: 1,
  assimilationEfficiency: 0.62,
  reproNutrientDemand: 1,
  noChemosynthesis: false,
  noAnaerobic: false,
  noNitrogenCycle: false,
  freeEnergy: false,
  freeNutrients: false,
};

/**
 * Per-organism chemical state, stored SoA alongside the engine's own arrays.
 *
 * Kept in its own arrays rather than added to OrganismStore so that the
 * chemistry experiment is a self-contained unit: deleting these arrays returns
 * the engine to its previous shape.
 */
export interface ChemStores {
  /** Standing biomass, moles per element, capacity * E.COUNT. */
  biomass: Float64Array;
  /** Assimilated internal stores, moles per element, capacity * E.COUNT. */
  stores: Float64Array;
  /** Capability bitmask per slot. */
  capMask: Uint16Array;
  /**
   * Per-capability expression strength, capacity * CAP_COUNT.
   *
   * Float32, not Int32. Capability strength is a module MAGNITUDE and is
   * routinely fractional; storing it in an integer array truncated every
   * magnitude below 1.0 to zero, which silently produced organisms with modules
   * and NO capabilities — a genome that inherited metabolic machinery and could
   * never use it, with nothing to indicate why.
   */
  capStrength: Float32Array;
}

export function newChemStores(capacity: number): ChemStores {
  return {
    biomass: new Float64Array(capacity * E.COUNT),
    stores: new Float64Array(capacity * E.COUNT),
    capMask: new Uint16Array(capacity),
    capStrength: new Float32Array(capacity * CAP_COUNT),
  };
}

export function growChemStores(s: ChemStores, capacity: number): ChemStores {
  const copy = (old: Float64Array, elems: number) => {
    const next = new Float64Array(capacity * elems);
    next.set(old.subarray(0, Math.min(old.length, next.length)));
    return next;
  };
  const copyI = (old: Float32Array, k: number) => {
    const next = new Float32Array(capacity * k);
    next.set(old.subarray(0, Math.min(old.length, next.length)));
    return next;
  };
  const copyU = (old: Uint16Array) => {
    const next = new Uint16Array(capacity);
    next.set(old.subarray(0, Math.min(old.length, next.length)));
    return next;
  };
  return {
    biomass: copy(s.biomass, E.COUNT),
    stores: copy(s.stores, E.COUNT),
    capMask: copyU(s.capMask),
    capStrength: copyI(s.capStrength, CAP_COUNT),
  };
}

export function clearSlot(st: ChemStores, slot: number): void {
  st.biomass.fill(0, slot * E.COUNT, (slot + 1) * E.COUNT);
  st.stores.fill(0, slot * E.COUNT, (slot + 1) * E.COUNT);
  st.capMask[slot] = 0;
  st.capStrength.fill(0, slot * CAP_COUNT, (slot + 1) * CAP_COUNT);
}

export function biomassCarbon(st: ChemStores, slot: number): number {
  return st.biomass[slot * E.COUNT + E.C];
}
export function biomassN(st: ChemStores, slot: number): number {
  return st.biomass[slot * E.COUNT + E.N];
}
export function biomassP(st: ChemStores, slot: number): number {
  return st.biomass[slot * E.COUNT + E.P];
}
export function storeN(st: ChemStores, slot: number): number {
  return st.stores[slot * E.COUNT + E.N];
}
export function storeP(st: ChemStores, slot: number): number {
  return st.stores[slot * E.COUNT + E.P];
}

export function capStrengthAt(st: ChemStores, slot: number, cap: CAP): number {
  let i = 0;
  let m = cap;
  while (m > 1) { m >>= 1; i++; }
  return st.capStrength[slot * CAP_COUNT + i];
}

/** Give a founder an initial body and stores, scaled to its starting size. */
export function seedBiomass(st: ChemStores, slot: number, carbon: number): void {
  const v = biomassDemand(carbon);
  for (let e = 0; e < E.COUNT; e++) st.biomass[slot * E.COUNT + e] = v[e];
  // A modest starting store so a founder is not immediately nutrient-locked;
  // it must still feed itself thereafter.
  const base = slot * E.COUNT;
  st.stores[base + E.N] = carbon * 0.16 * 0.5;
  st.stores[base + E.P] = carbon * 0.009 * 0.5;
  st.stores[base + E.S] = carbon * 0.006 * 0.5;
  st.stores[base + E.FE] = carbon * 0.0006 * 0.5;
}

/**
 * Execute one organism's metabolism for a tick.
 *
 * Returns the energy credited. Matter moved is applied through Chemistry's
 * delta buffer; nothing here writes a pool directly, which is what keeps the
 * chemistry order-independent.
 */
export function runMetabolism(
  chem: Chemistry,
  st: ChemStores,
  slot: number,
  cell: number,
  cfg: ChemConfig,
  out: Float64Array,
  extentOut?: Float64Array,
): number {
  const mask = st.capMask[slot];
  if (mask === 0) return 0;
  let energy = 0;
  for (let id = 0; id < RX_COUNT; id++) {
    const r: Reaction = REACTIONS[id];
    if ((mask & r.cap) === 0) continue;
    if (isAblated(r, cfg)) continue;
    // Decomposition is a service funded by the organism's own uptake, so its
    // reactions carry no energy credit. Everything else that runs credits what
    // its stoichiometry says.
    const strength = capStrengthAt(st, slot, r.cap);
    if (strength <= 0) continue;
    const extent = reactionExtent(r, chem, cell, strength, out);
    if (extent <= 0) continue;
    // `out` accumulates NET transfers for the whole organism and is applied
    // ONCE by the caller.
    //
    // Applying it per reaction is a mass multiplier: a pool listed by two
    // reactions has its net delta written to the world twice. That inflated
    // phosphorus by 5,100% and iron by 7,400% on a 300-tick run, and it is
    // invisible to any check that does not close the books.
    if (r.energy > 0) energy += r.energy * extent;
    if (extentOut) extentOut[id] = extent;
  }
  return cfg.freeEnergy ? energy * 0 : energy * cfg.energyScale;
}

/** Ablations must actually gate execution, not merely be recorded. */
function isAblated(r: Reaction, cfg: ChemConfig): boolean {
  if (cfg.noChemosynthesis
    && (r.cap === CAP.SULF_OXIDIZE || r.cap === CAP.FE_CHEMO)) return true;
  if (cfg.noAnaerobic
    && (r.cap === CAP.FERMENT || r.cap === CAP.DENITRIFY || r.cap === CAP.SULF_REDUCE)) return true;
  if (cfg.noNitrogenCycle
    && (r.cap === CAP.NITRIFY || r.cap === CAP.DENITRIFY || r.cap === CAP.N_ASSIM)) return true;
  return false;
}

/**
 * Assimilate inorganic nutrients into internal stores.
 *
 * Draws from the cell's dissolved pools. Competition for a finite pool is real:
 * two organisms in the same cell both read the same pre-tick concentration, and
 * the delta buffer settles the combined draw once, so neither can take more
 * than exists.
 */
export function assimilate(
  chem: Chemistry, st: ChemStores, slot: number, cell: number, cfg: ChemConfig,
  demand: Float64Array,
): void {
  const base = slot * E.COUNT;
  const eff = cfg.freeNutrients ? 1 : cfg.assimilationEfficiency;
  if ((st.capMask[slot] & CAP.N_ASSIM) !== 0) {
    const take = Math.min(
      chem.remaining(POOL.NH4, cell) * eff,
      demand[E.N] * 0.02,
    );
    if (take > 0) {
      chem.claim(POOL.NH4, cell, take);
      st.stores[base + E.N] += take;
    }
  }
  // CARBON ACQUISITION — the pathway growth depends on.
  //
  // FINDING 4. `grow()` draws tissue from stores, and stores never received
  // carbon from anywhere, so growth could never add a single gram of tissue: it
  // computed a result and then moved nothing. Organisms now take labile
  // organic carbon (OC) out of the cell into their stores, which is what makes
  // the producer -> detritus -> consumer loop a real material path rather than
  // a decorative pool.
  //
  // Limited by what the cell actually holds, so it cannot draw on carbon that
  // is not there.
  if (!cfg.freeNutrients) {
    const oc = chem.remaining(POOL.OC, cell);
    const takeC = Math.min(oc * eff, demand[E.C] * 0.02);
    if (takeC > 0) {
      chem.claim(POOL.OC, cell, takeC);
      st.stores[base + E.C] += takeC;
    }
  }

  // P and trace elements are taken by any living cell that carries tissue.
  const po4 = chem.remaining(POOL.PO4, cell);
  const takeP = Math.min(po4 * eff, demand[E.P] * 0.02);
  if (takeP > 0) {
    chem.claim(POOL.PO4, cell, takeP);
    st.stores[base + E.P] += takeP;
  }
  if ((st.capMask[slot] & CAP.FE_UPTAKE) !== 0) {
    const takeFe = Math.min(
      chem.remaining(POOL.FE2, cell) * eff, demand[E.FE] * 0.02,
    );
    if (takeFe > 0) {
      chem.claim(POOL.FE2, cell, takeFe);
      st.stores[base + E.FE] += takeFe;
    }
  }
  if ((st.capMask[slot] & CAP.SULF_REDUCE) !== 0 || (st.capMask[slot] & CAP.SULF_OXIDIZE) !== 0) {
    const src = (st.capMask[slot] & CAP.SULF_OXIDIZE) !== 0 ? POOL.SO4 : POOL.H2S;
    const takeS = Math.min(
      chem.remaining(src, cell) * eff, demand[E.S] * 0.02,
    );
    if (takeS > 0) {
      chem.claim(src, cell, takeS);
      st.stores[base + E.S] += takeS;
    }
  }
}

export interface GrowthResult {
  /** Carbon actually incorporated into standing biomass this tick. */
  carbon: number;
  /** True when matter, not energy, was the binding constraint. */
  nutrientLimited: boolean;
  /** True when energy, not matter, was the binding constraint. */
  energyLimited: boolean;
}

/**
 * Build new tissue.
 *
 * THE CENTRAL CLAIM OF THIS EXPERIMENT lives in this function. Growth is the
 * MINIMUM of what energy permits and what matter permits. An organism with
 * abundant energy and no phosphate grows nothing; an organism with abundant
 * phosphate and no energy grows nothing. Which constraint bit is reported so a
 * probe can distinguish the two, rather than both showing up as "slow".
 */
export function grow(
  st: ChemStores, slot: number, requestedCarbon: number, energyAvailable: number,
  cfg: ChemConfig, result: GrowthResult, scratch: Float64Array,
): void {
  result.carbon = 0;
  result.nutrientLimited = false;
  result.energyLimited = false;
  if (requestedCarbon <= 0) return;

  const v = biomassDemand(requestedCarbon, scratch);

  // Matter-limited ceiling: what the organism's own stores can supply.
  let matterCarbon = requestedCarbon;
  const base = slot * E.COUNT;
  // STRUCTURAL elements come from stores, as do the macronutrients and traces.
  // Standing biomass is deliberately NOT counted as available: it is tissue the
  // organism already built, and treating it as feedstock would let an organism
  // "grow" by cannibalising itself.
  for (const e of [E.C, E.H, E.O, ...MACRONUTRIENTS, ...TRACE_ELEMENTS]) {
    const need = v[e];
    if (need <= 0) continue;
    const have = st.stores[base + e];
    const possible = have / need;
    if (possible < matterCarbon) matterCarbon = possible;
  }
  if (cfg.freeNutrients) matterCarbon = requestedCarbon;

  // Energy-limited ceiling: constructing tissue costs energy per unit carbon.
  const ENERGY_PER_CARBON = 0.55;
  const energyCarbon = energyAvailable / ENERGY_PER_CARBON;

  const carbon = Math.max(0, Math.min(matterCarbon, energyCarbon, requestedCarbon));
  if (carbon <= 1e-12) {
    if (matterCarbon < energyCarbon) result.nutrientLimited = true;
    else result.energyLimited = true;
    return;
  }
  result.nutrientLimited = carbon < energyCarbon && matterCarbon < requestedCarbon - 1e-12;
  result.energyLimited = carbon < matterCarbon;

  const built = biomassDemand(carbon, scratch);
  // STRICTLY CONSERVATIVE. Tissue is assembled ONLY from stores the organism
  // already holds. An earlier version added `built - drawn` to biomass, which
  // created matter from nothing — a 68,000% phosphorus residual on a 300-tick
  // run, and a conservation claim that was measuring the size of the hole.
  for (let e = 0; e < E.COUNT; e++) {
    const drawn = Math.min(st.stores[base + e], built[e]);
    st.stores[base + e] -= drawn;
    st.biomass[base + e] += drawn;
  }
  result.carbon = carbon;
}

/**
 * Release an organism's chemistry on death.
 *
 * Biomass returns to the environment as labile organic matter, with a declared
 * fraction buried as structural litter. Stores that were never built into
 * tissue are EXCRETED into the dissolved pools directly — this is why a
 * nutrient-poor world does not simply recycle everything forever.
 */
export function releaseOnDeath(
  chem: Chemistry, st: ChemStores, slot: number, cell: number,
  burialFraction: number, labile: Float64Array, litter: Float64Array,
): void {
  const base = slot * E.COUNT;
  for (let e = 0; e < E.COUNT; e++) {
    const b = st.biomass[base + e];
    const s = st.stores[base + e];
    if (b <= 0 && s <= 0) continue;

    // Structural carbon (and its associated N/P/S) buries; the rest is labile.
    if (e === E.C) {
      const buried = b * burialFraction;
      litter[E.C] += buried;
      labile[E.C] += b - buried;
    } else {
      const frac = b > 0 ? burialFraction : 0;
      const buried = b * frac;
      litter[e] += buried;
      labile[e] += b - buried;
    }
    // Unexpended stores are excreted as available forms, not as dead tissue.
    if (s > 0) {
      if (e === E.N) chem.react(POOL.NH4, cell, s);
      else if (e === E.P) chem.react(POOL.PO4, cell, s);
      else if (e === E.S) chem.react(POOL.SO4, cell, s);
      else if (e === E.FE) chem.react(POOL.FE2, cell, s);
    }
  }
  clearSlot(st, slot);
}

/**
 * Can this organism afford one offspring?
 *
 * Requires BOTH a nutrient reserve and the carbon to build the tissue. This is
 * where the energy/matter separation becomes an ecological fact rather than a
 * bookkeeping one: an energy-rich, nutrient-poor population cannot replace
 * itself even though nothing about its energy budget is wrong.
 */
export function canAffordOffspring(
  st: ChemStores, slot: number, cfg: ChemConfig,
): { ok: boolean; lacking: 'nutrient' | 'carbon' | 'none' } {
  if (cfg.freeNutrients) return { ok: true, lacking: 'none' };
  const demand = cfg.reproNutrientDemand;
  const v = biomassDemand(demand, newElemVec());
  const base = slot * E.COUNT;
  for (const e of [...MACRONUTRIENTS, ...TRACE_ELEMENTS]) {
    const need = v[e] * cfg.reproNutrientDemand;
    if (need <= 0) continue;
    if (st.stores[base + e] < need) return { ok: false, lacking: 'nutrient' };
  }
  if (st.biomass[base + E.C] < demand) return { ok: false, lacking: 'carbon' };
  return { ok: true, lacking: 'none' };
}

/** Transfer matter from a parent to an offspring, and remove it from the parent. */
export function transferToOffspring(
  st: ChemStores, parent: number, child: number, fraction: number,
): void {
  const pb = parent * E.COUNT;
  const cb = child * E.COUNT;
  for (let e = 0; e < E.COUNT; e++) {
    const move = st.biomass[pb + e] * fraction;
    st.biomass[pb + e] -= move;
    st.biomass[cb + e] += move;
  }
}

/** Sum of a population's standing carbon — for probes and the viewer. */
export function totalCarbon(st: ChemStores, capacity: number): number {
  let s = 0;
  for (let i = 0; i < capacity; i++) s += st.biomass[i * E.COUNT + E.C];
  return s;
}

/** Per-element totals across living biomass — the biological side of the ledger. */
export function biomassElementTotals(st: ChemStores, capacity: number): Float64Array {
  const out = new Float64Array(E.COUNT);
  for (let i = 0; i < capacity; i++) {
    for (let e = 0; e < E.COUNT; e++) out[e] += st.biomass[i * E.COUNT + e];
  }
  return out;
}

export function storeElementTotals(st: ChemStores, capacity: number): Float64Array {
  const out = new Float64Array(E.COUNT);
  for (let i = 0; i < capacity; i++) {
    for (let e = 0; e < E.COUNT; e++) out[e] += st.stores[i * E.COUNT + e];
  }
  return out;
}

/** Capability repertoire width across a population, for diversity metrics. */
export function repertoireHistogram(st: ChemStores, capacity: number, alive: (i: number) => boolean): Float64Array {
  const h = new Float64Array(16);
  for (let i = 0; i < capacity; i++) {
    if (!alive(i)) continue;
    let w = 0, m = st.capMask[i];
    while (m) { w += m & 1; m >>>= 1; }
    h[Math.min(15, w)]++;
  }
  return h;
}

export { sumElems };
