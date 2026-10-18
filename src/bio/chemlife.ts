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
  CAP, CAP_COUNT, REACTIONS, RX_COUNT, reactionExtent, type Reaction, type ReactionOmission,
} from './metabolism.js';
import { POOL, POOL_COMPOSITION, type Chemistry } from '../world/chemistry.js';

/**
 * Energy cost of constructing one mole of tissue carbon.
 *
 * SINGLE DEFINITION, on purpose. This number appeared twice — once here as the
 * divisor that converts available energy into an affordable amount of carbon,
 * and once as a literal `0.55` at the site that spends the energy. Two copies
 * of a conversion factor is the same class of defect as two copies of a cost
 * discount: if they ever disagree, growth is charged at a different rate than
 * it was budgeted, and the books still balance, so nothing reports it.
 *
 * Energy is not conserved by this model — organisms dissipate it — so this is a
 * declared cost, not a physical constant.
 */
export const ENERGY_PER_CARBON = 0.55;

/**
 * Standing reserve of a TRACE element, as a fraction of its tissue stoichiometry.
 *
 * Reproduction consumes tissue, and tissue contains iron. But the iron an
 * organism needs ON HAND is catalytic, not structural: it is spent in
 * proportion to work done and returned, not incorporated and retained. Demanding
 * a tissue-complement in stores therefore asks for something no organism in this
 * model can accumulate, and silently removes reproduction from the ecosystem.
 *
 * This constant is the threshold that says "enough catalytic iron to build a
 * newborn", and it is DECLARED rather than derived so that it can be argued
 * with rather than discovered by accident. It is the one number in this file
 * with no upstream justification, and it is the number to change first if iron
 * turns out to limit the ecology in a way the experiment does not expect.
 */
export const COFACTOR_RESERVE = 0.05;

/**
 * Fraction of a one-carbon complement an organism may assimilate per tick.
 *
 * This was six independent `0.02` literals, one per element. Six copies of a
 * rate constant is how the uptake of carbon and the uptake of phosphorus came
 * to be tuned separately without anyone noticing they had drifted apart.
 *
 * The value is not arbitrary and the previous one was wrong for a specific
 * reason: at 2% per tick an organism needs 50 ticks of undisturbed accumulation
 * to hold ONE carbon-complement in stores, while `grow()` draws those same
 * stores down every tick it builds tissue. The two were never reconciled, so
 * the stock an organism could hold was pinned near zero by construction — and
 * `canAffordOffspring()` demands a full complement. The result was that NO
 * organism in a 250-tick run of 326 cleared the reproduction gate, on any
 * element combination: reproduction was switched off in the entire model, and
 * every conservation figure in this repository was measured on an ecosystem
 * in which nothing had ever been born.
 *
 * At 20% a reserve builds in five ticks, which is short enough to outrun
 * growth's draw and long enough that uptake is still limited by what the cell
 * actually contains.
 */
export const ASSIMILATION_FRACTION = 0.20;

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
  reactionOmit: ReactionOmission | null;
  noChemosynthesis: boolean;
  noAnaerobic: boolean;
  noNitrogenCycle: boolean;
  /**
   * Starve the world of mineral nutrients.
   *
   * A diagnostic ablation, not a scenario. Its purpose is to answer a question
   * conservation cannot: conservation proves matter is neither created nor
   * destroyed, and says nothing about whether nutrients actually LIMIT
   * anything. If reproduction is genuinely nutrient-gated, removing the
   * mineral pools must stop births while leaving energy and age untouched; if
   * births continue, the "nutrient-limited" label was decoration.
   */
  noNutrients: boolean;
  /**
   * Scale factor on atmospheric CO2 weathering. DIAGNOSTIC, for H9 only.
   *
   * The intervention used to test whether organic-carbon SUPPLY per cell is
   * what limits reproduction. Declared here rather than buried in the probe so
   * that the arm is part of the model's documented surface and is reproducible
   * from a config line.
   */
  co2WeatheringScale: number;
  /**
   * Convert chemistry tissue released at death into legacy detritus.
   *
   * DIAGNOSTIC, for H10 only. The two economies are currently separate: matter
   * released by a chemistry death goes to chemistry pools, while the legacy food
   * web reads the detritus ScalarField. An organism can therefore hold 300 mol
   * of chemical tissue and still starve on the legacy clock. This knob bridges
   * them, and `CHEM_TO_LEGACY_PER_CARBON` declares the conversion — which is an
   * ARBITRARY number, stated as such, because no principled factor exists
   * between a mole of carbon and the legacy detritus units.
   */
  toLegacyDetritus: boolean;
  /**
   * Transfer elemental matter along with energy in predation/graze contests.
   *
   * NULL = declared behaviour, exactly: predation moves energy only and the
   * two economies stay decoupled at the meal (the state this PR shipped). When
   * set, an attacker that gains `gained` energy also assimilates the
   * corresponding tissue carbon (`gained / ENERGY_PER_CARBON`, capped by the
   * prey's remaining biomass) and the prey loses exactly that tissue. The
   * transfer is stoichiometric across ALL tracked elements, so matter is moved
   * rather than created, and the conservation gate sees it.
   */
  predationMatter: boolean;
  /**
   * Make energy free, as the config contract states: growth then depends on
   * matter ALONE. Applied at the growth BUDGET, not by suppressing income.
   */
  freeEnergy: boolean;
  freeNutrients: boolean;
}

export const DEFAULT_CHEM_CONFIG: ChemConfig = {
  enabled: false,
  energyScale: 1,
  assimilationEfficiency: 0.62,
  reproNutrientDemand: 1,
  reactionOmit: null,
  noChemosynthesis: false,
  noAnaerobic: false,
  noNitrogenCycle: false,
  noNutrients: false,
  co2WeatheringScale: 1,
  toLegacyDetritus: false,
  predationMatter: false,
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
  /**
   * LOCAL light per slot, 0..1.
   *
   * The chemistry path previously had no light term at all, so photosynthesis
   * ran at full rate in darkness and under full canopy. This carries the same
   * value the legacy path computes — global forcing x habitat shade x
   * Beer-Lambert self-shading — so both paths see one environment.
   */
  light: Float64Array;
}

export function newChemStores(capacity: number): ChemStores {
  return {
    biomass: new Float64Array(capacity * E.COUNT),
    stores: new Float64Array(capacity * E.COUNT),
    capMask: new Uint16Array(capacity),
    capStrength: new Float32Array(capacity * CAP_COUNT),
    light: new Float64Array(capacity),
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
    light: copy(s.light, 1),
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
  budgetHits?: Float64Array,
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
    const extent = reactionExtent(r, chem, cell, strength, out, st.light[slot], budgetHits);
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
  // FINDING 1 FIXED. This used to return `energy * 0` when freeEnergy was set.
  //
  // The declared contract is "make energy free: growth then depends on matter
  // ALONE". Zeroing reaction energy income instead removes the organism's
  // supply, which is the opposite: the arm starved its subjects and was then
  // reported as evidence that energy relief does not help. That is a knob
  // wearing a coat of a result. Income is credited as declared, and the relief
  // is applied where the contract puts it -- at the growth budget.
  return energy * cfg.energyScale;
}

/** Ablations must actually gate execution, not merely be recorded. */
function isAblated(r: Reaction, cfg: ChemConfig): boolean {
  if (cfg.reactionOmit != null && r.name === cfg.reactionOmit) return true;
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
  // FINDING 2: efficiency is physical. A GATE diagnostic must not also rewrite
  // how efficiently an organism draws, or the arm changes two mechanisms at once.
  const eff = cfg.assimilationEfficiency;
  if ((st.capMask[slot] & CAP.N_ASSIM) !== 0) {
    const take = Math.min(
      chem.remaining(POOL.NH4, cell) * eff,
      demand[E.N] * ASSIMILATION_FRACTION,
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
  //
  // FINDING 2 FIXED. This uptake was previously SKIPPED ENTIRELY when
  // freeNutrients was set, leaving carbon stores permanently at zero. The
  // growth ceiling ignored that and reported the full request as tissue built,
  // while the population gain came from parent-to-child transfer rather than
  // growth. The arm therefore measured nothing about nutrient relief.
  // freeNutrients relaxes GATES; uptake is always physical.
  {
    const oc = chem.remaining(POOL.OC, cell);
    const takeC = Math.min(oc * eff, demand[E.C] * ASSIMILATION_FRACTION);
    if (takeC > 0) {
      // ONE debit per credit. `claim()` already writes `delta -= take` and
      // `claimed += take`, so crediting the store from a SEPARATE react() call
      // drew the carbon twice while adding it once.
      chem.claim(POOL.OC, cell, takeC);
      st.stores[base + E.C] += takeC;
      // THE BULK COMPOSITION CONTRACT: an organism takes the MOLECULE.
      //
      // One unit of organic carbon carries 1.8 H and 0.5 O (POOL_COMPOSITION),
      // which is also the bulk tissue formula. Crediting carbon alone would
      // drain H and O out of the field through the very transfer that is meant
      // to supply tissue, and growth would be structurally impossible for want
      // of H and O exactly as it once was. Crediting them here is what
      // replaces the old separate water claim: tissue H and O ride with the
      // carbon that constitutes the tissue.
      st.stores[base + E.H] += POOL_COMPOSITION[POOL.OC * E.COUNT + E.H] * takeC;
      st.stores[base + E.O] += POOL_COMPOSITION[POOL.OC * E.COUNT + E.O] * takeC;
    }
  }

  // NO SEPARATE WATER UPTAKE FOR TISSUE.
  //
  // An earlier version claimed water from the reservoir purely to supply
  // tissue H and O, because carbon arrived without them; the H/O books were
  // then kept level by returning the "excess" O to the reservoir sink at
  // death. Under the composition contract the organic carbon carries its own
  // H and O, so a water claim for tissue would double-supply them, and the
  // sink return was a boundary bookkeeping device rather than a chemistry.
  // Water remains an external buffered reservoir for REACTIONS (photosynthesis
  // draws it, respiration returns it) and is not a tissue feedstock.

  // P and trace elements are taken by any living cell that carries tissue.
  const po4 = chem.remaining(POOL.PO4, cell);
  const takeP = Math.min(po4 * eff, demand[E.P] * ASSIMILATION_FRACTION);
  if (takeP > 0) {
    chem.claim(POOL.PO4, cell, takeP);
    st.stores[base + E.P] += takeP;
  }
  if ((st.capMask[slot] & CAP.FE_UPTAKE) !== 0) {
    const takeFe = Math.min(
      chem.remaining(POOL.FE2, cell) * eff, demand[E.FE] * ASSIMILATION_FRACTION,
    );
    if (takeFe > 0) {
      chem.claim(POOL.FE2, cell, takeFe);
      st.stores[base + E.FE] += takeFe;
    }
  }
  if ((st.capMask[slot] & CAP.SULF_REDUCE) !== 0 || (st.capMask[slot] & CAP.SULF_OXIDIZE) !== 0) {
    const src = (st.capMask[slot] & CAP.SULF_OXIDIZE) !== 0 ? POOL.SO4 : POOL.H2S;
    const takeS = Math.min(
      chem.remaining(src, cell) * eff, demand[E.S] * ASSIMILATION_FRACTION,
    );
    if (takeS > 0) {
      chem.claim(src, cell, takeS);
      st.stores[base + E.S] += takeS;
    }
  }

  // EXPLICIT freeNutrients subsidy. This is an EXOGENOUS, BOOKED input, not
  // an invisible relaxation of the growth ceiling or offspring gate. Carbon is
  // deliberately excluded (it is physically assimilated from OC), and so are H
  // and O: under the composition contract tissue H and O ride with that
  // organic carbon, so subsidising them separately would inject water into the
  // organism's stoichiometry and break the exact H/C and O/C ratios that let a
  // unit of dead carbon carry its own H and O back into the organic pools at
  // death. The subsidy therefore covers the dissolved MINERAL supply, N/P/S/Fe,
  // whose scarcity is what this ablation is about. The amount is
  // recorded in the chemistry boundary flux so the elemental audit can balance.
  if (cfg.freeNutrients) {
    for (const e of [E.N, E.P, E.S, E.FE]) {
      const need = demand[e] * ASSIMILATION_FRACTION;
      const add = Math.max(0, need - st.stores[base + e]);
      if (add <= 0) continue;
      st.stores[base + e] += add;
      chem.flux.freeNutrientSubsidy[e] += add;
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
  _cfg: ChemConfig, result: GrowthResult, scratch: Float64Array,
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
    // have/need is a fraction of THIS request, not carbon moles. Comparing
    // that fraction directly with matterCarbon admitted malformed tissue for
    // partial shortages whenever the requested carbon was below one mole.
    const possible = requestedCarbon * (have / need);
    if (possible < matterCarbon) matterCarbon = possible;
  }
  // Energy-limited ceiling: constructing tissue costs energy per unit carbon.
  const energyCarbon = energyAvailable / ENERGY_PER_CARBON;

  const carbon = Math.max(0, Math.min(matterCarbon, energyCarbon, requestedCarbon));
  if (carbon <= 1e-12) {
    if (matterCarbon < energyCarbon) result.nutrientLimited = true;
    else result.energyLimited = true;
    return;
  }
  result.nutrientLimited = carbon < energyCarbon && matterCarbon < requestedCarbon - 1e-12;
  result.energyLimited = carbon < matterCarbon;

  // FINDING 2 FIXED. `result.carbon` reported the REQUESTED amount, which is
  // only what tissue is assembled from when stores happen to hold it. Under
  // freeNutrients that overstated carbon built by 4.6x (1,329.69 mol reported
  // against 286.90 mol of actual tissue), so the counter measured a request
  // rather than an outcome while appearing to measure growth.
  const carbonBefore = st.stores[base + E.C];
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

  // What was actually assembled, not what was asked for. This must be the LAST
  // assignment: an earlier `result.carbon = carbon` on the following line
  // silently overwrote it and restored the overstatement.
  result.carbon = Math.max(0, carbonBefore - st.stores[base + E.C]);
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
    //
    // FINDING 7 FIXED. Carbon was missing from this list. assimilate() fills
    // carbon stores, and clearSlot() voided them on death, so every mole of
    // unbuilt carbon an organism held simply DISAPPEARED — which is why the
    // carbon books never closed no matter how the reactions were balanced.
    if (s > 0) {
      // Carbon stores join the LABILE stream rather than being reacted here,
      // so the caller routes them with the same OC mapping — and, with them,
      // the H and O the composition contract says every unit of organic carbon
      // carries. Reacting carbon directly while passing H and O through
      // `labile` would split one molecule across two independent code paths,
      // which is how an H/O ratio silently drifts from its reaction balance.
      if (e === E.C) labile[E.C] += s;
      else if (e === E.N) chem.react(POOL.NH4, cell, s);
      else if (e === E.P) chem.react(POOL.PO4, cell, s);
      else if (e === E.S) chem.react(POOL.SO4, cell, s);
      else if (e === E.FE) chem.react(POOL.FE2, cell, s);
      // H and O stores pass through `labile`. world.ts resolves them against
      // the H and O carried by the carbon routed to OC/LC and books only the
      // RESIDUE through the declared water boundary; see the death block in
      // chemistryPhase for the exact rule.
      else if (e === E.H || e === E.O) labile[e] += s;
    }
  }
  clearSlot(st, slot);
}

/**
 * Move eaten tissue from prey to predator along with the energy transfer.
 *
 * MATTER, NOT A MIRROR OF ENERGY. The legacy contest path moves energy only;
 * this function moves the matching tissue carbon (`energyGained /
 * ENERGY_PER_CARBON`, capped by what the prey actually holds) and every other
 * tracked element in the same stoichiometric proportion. The prey loses exactly
 * what the predator gains, so the conservation ledger sees a transfer rather
 * than a mint. Hydrogen and oxygen ride along as tissue water; the reservoir
 * accounting picks them up when the predator eventually dies.
 *
 * Returns the carbon actually moved (0 if the prey had no tissue or no energy
 * was gained).
 */
export function transferPredationMatter(
  st: ChemStores, predatorSlot: number, preySlot: number, energyGained: number,
): number {
  const preyBase = preySlot * E.COUNT;
  const predBase = predatorSlot * E.COUNT;
  const preyC = st.biomass[preyBase + E.C];
  if (!(preyC > 0) || !(energyGained > 0)) return 0;
  const carbonEquiv = energyGained / ENERGY_PER_CARBON;
  const takeC = Math.min(preyC, carbonEquiv);
  if (!Number.isFinite(takeC) || takeC <= 0) return 0;
  const frac = takeC / preyC;
  for (let e = 0; e < E.COUNT; e++) {
    const moved = st.biomass[preyBase + e] * frac;
    if (!(moved > 0)) continue;         // identical to <= for finite values; also skips NaN
    st.biomass[preyBase + e] -= moved;
    st.stores[predBase + e] += moved;
  }
  return takeC;
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
  const demand = cfg.reproNutrientDemand;
  const v = biomassDemand(demand, newElemVec());
  const base = slot * E.COUNT;
  // MACRONUTRIENTS are required at tissue stoichiometry.
  for (const e of MACRONUTRIENTS) {
    const need = v[e]; // biomassDemand already applied the linear demand scale
    if (need <= 0) continue;
    if (st.stores[base + e] < need) return { ok: false, lacking: 'nutrient' };
  }
  // TRACE ELEMENTS are COFACTORS, not structure.
  //
  // The reaction table declares this in words — "Fe is a cofactor, not
  // structure" — and the previous gate contradicted it by demanding a full
  // TISSUE complement of iron sitting in the organism's ASSIMILATED STORES.
  //
  // That was unreachable by construction, and the result was not subtle: zero
  // of 326 living organisms cleared the iron bar and reproduction was blocked
  // for the entire population, on every seed, at every horizon. The best store
  // reached 2.0e-4 against a 6.0e-4 demand, because assimilate() draws each
  // element at 2% of demand per tick — a rate sized for construction, which
  // cannot support a standing reserve of an element the model consumes
  // catalytically.
  //
  // Conservation said nothing about this. Both the blocked and the unblocked
  // world conserve matter exactly; a perfectly balanced model in which no
  // organism has ever reproduced is not a working ecosystem, and no mass-balance
  // check can tell the difference.
  //
  // So trace elements are gated on a DECLARED COFACTOR RESERVE, not on tissue
  // stoichiometry. Iron limitation still expresses itself — through growth,
  // which does consume iron at tissue stoichiometry — but it no longer vetoes
  // reproduction outright through a threshold that no organism can reach.
  for (const e of TRACE_ELEMENTS) {
    const need = v[e] * COFACTOR_RESERVE;
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
  // The child slot is CLEARED before anything is credited to it.
  //
  // Slot reuse is the same hazard as the v1 genome leak this repository has
  // already had to correct once: a slot freed without a chemistry clear (eviction
  // at the population cap, disturbance, or any death path that does not run
  // releaseOnDeath) leaves its previous occupant's tissue behind, and adding the
  // new offspring's tissue on top of it mints whatever was left. Nitrogen ran at
  // +80% with exactly this signature: per-tick creation tracking weathering from
  // tick 1, then exceeding it once breeding began.
  for (let e = 0; e < E.COUNT; e++) {
    st.biomass[cb + e] = 0;
    st.stores[cb + e] = 0;
  }
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
