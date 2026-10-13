/**
 * Elements and biomass stoichiometry.
 *
 * This is the foundation of the integrated biogeochemistry experiment: the
 * separation of MATTER from ENERGY. Energy has its own ledger (src/world/
 * ledger.ts, `store.energy`) and is conserved and spent as joules. Matter has
 * this one, and every gram of it can be traced into exactly one compartment at
 * every instant.
 *
 * ELEMENT vs SYMBOL. Chemical symbols (CHONPS) are convenient but ambiguous
 * when a "pool" also has a phase and a lability. Everything conserved here is
 * an ELEMENT in a POOL (src/world/chemistry.ts). An element vector is a
 * Float64Array of length ELEM_COUNT indexed by the E enum.
 *
 * DECLARED IDEALISATION. Stoichiometry is per unit of biomass CARBON, in molar
 * proportions. That is a choice, not a derivation: real biomass is not a single
 * formula, and the numbers below are near-Redfield for marine material rather
 * than fitted to any organism in this simulation. What is enforced is internal
 * consistency — the same coefficients drive construction, consumption and
 * recycling, so the books balance — and that every assumption is stated rather
 * than buried in a reaction.
 */

/** Conserved elements. Order is load-bearing: it indexes every element vector. */
export const enum E {
  C = 0,
  H = 1,
  O = 2,
  N = 3,
  P = 4,
  S = 5,
  FE = 6,
  COUNT = 7,
}

/** Human-readable names, indexed by E. Used in ledgers, probes and the viewer. */
export const ELEMENT_NAMES: readonly string[] = ['C', 'H', 'O', 'N', 'P', 'S', 'Fe'];

/**
 * Runtime element count.
 *
 * `E` is a const enum and therefore has NO runtime identity across module
 * boundaries — a probe cannot import `E.COUNT`. Anything that iterates elements
 * at runtime (probes, viewer, ledgers) must use this.
 */
export const E_RUNTIME_COUNT = 7;

/**
 * Standard atomic masses (u). Used only to REPORT mass balance to a human; the
 * conservation checks are done in moles so that stoichiometry and mass are not
 * confused with one another.
 */
export const ATOMIC_MASS: readonly number[] = [12.011, 1.008, 15.999, 14.007, 30.974, 32.06, 55.845];

/**
 * Bulk biomass formula, molar, PER UNIT OF CARBON.
 *
 * C 1.0 is the reference. N:P = 17.8 and C:N = 6.25 sit near Redfield values
 * for marine material. Fe is a trace cofactor rather than structural, three
 * orders of magnitude below P, which is why Fe limits metabolism qualitatively
 * rather than bulk growth.
 *
 * DECLARED IDEALISATION: one formula for all life. Real organisms differ in
 * C:N:P by more than an order of magnitude, and that difference is precisely
 * what a stoichiometric model exists to express. This model captures the
 * LIMITING-ELEMENT consequences correctly and does not capture biochemical
 * diversity.
 */
export const BIOMASS_STOICH: readonly number[] = [
  1.0,    // C
  1.8,    // H
  0.5,    // O
  0.16,   // N
  0.009,  // P
  0.006,  // S
  0.0006, // Fe
];

/** Structural elements (C,H,O) — the bulk that reproduction moves. */
export const STRUCTURAL_ELEMS: readonly E[] = [E.C, E.H, E.O];
/** Macronutrients whose absence blocks biomass construction outright. */
export const MACRONUTRIENTS: readonly E[] = [E.N, E.P];
/** Trace elements that gate metabolism without gating bulk growth. */
export const TRACE_ELEMENTS: readonly E[] = [E.S, E.FE];

/** Allocate a zeroed element vector. */
export function newElemVec(): Float64Array {
  return new Float64Array(E.COUNT);
}

/**
 * Element demand to build `carbon` grams of biomass.
 *
 * Every construction path in the simulation MUST go through this function
 * rather than hand-rolling coefficients, or "matter is conserved" becomes a
 * claim about a formula instead of about the code.
 */
export function biomassDemand(carbon: number, out?: Float64Array): Float64Array {
  const v = out ?? newElemVec();
  for (let e = 0; e < E.COUNT; e++) v[e] = BIOMASS_STOICH[e] * carbon;
  return v;
}

/** Total mass of an element vector in grams (moles × atomic mass). */
export function elemMass(v: ArrayLike<number>): number {
  let m = 0;
  for (let e = 0; e < E.COUNT; e++) m += v[e] * ATOMIC_MASS[e];
  return m;
}

/** Sum over a subset of elements. */
export function sumElems(v: ArrayLike<number>, es: readonly E[]): number {
  let s = 0;
  for (const e of es) s += v[e];
  return s;
}

/** Copy src into dst. */
export function copyElem(dst: Float64Array, src: ArrayLike<number>, offset = 0): void {
  for (let e = 0; e < E.COUNT; e++) dst[offset + e] = src[e];
}

/**
 * Scale `v` into `dst` at `offset`, then zero `dst`.
 *
 * The single write primitive for per-slot element storage. Callers that build a
 * partial element vector and then hand it over get a cleared destination for
 * free, which removes a class of "forgot to initialise element 6" bug.
 */
export function setElem(dst: Float64Array, offset: number, v: ArrayLike<number>): void {
  for (let e = 0; e < E.COUNT; e++) dst[offset + e] = v[e];
}

/** Add `v` (scaled by `k`) into `dst` at `offset`. */
export function addElem(dst: Float64Array, offset: number, v: ArrayLike<number>, k = 1): void {
  for (let e = 0; e < E.COUNT; e++) dst[offset + e] += v[e] * k;
}

/**
 * Limiting nutrient for a biomass construction, and the fraction achievable.
 *
 * This is the mechanism that makes matter and energy DISTINCT constraints. A
 * caller supplies what it can obtain for each element (local availability,
 * assimilated stores) and the energy it can pay; growth takes the smaller of
 * the two. An organism with abundant energy and no phosphate cannot grow, and
 * that is a property of this function rather than of any particular caller.
 */
export interface LimitingResult {
  /** Fraction of the requested carbon actually buildable, 0..1. */
  carbon: number;
  /** The element that capped it, for display and for evolution's benefit. */
  limitedBy: E | -1;
}

export function limitingCarbon(
  available: ArrayLike<number>,
  energyCarbon: number,
  scratch?: Float64Array,
): LimitingResult {
  const v = scratch ?? newElemVec();
  biomassDemand(1, v);
  let best = 1;
  let limitedBy: E | -1 = -1;
  for (let e = 0; e < E.COUNT; e++) {
    const need = v[e];
    if (need <= 0) continue;
    // O and H arrive with water and CO2 and are not limiting in this model;
    // treating them as such would let a cell starve for hydrogen in an ocean.
    if (e === E.O || e === E.H) continue;
    const possible = available[e] / need;
    if (possible < best) {
      best = possible;
      limitedBy = e;
    }
  }
  const carbon = Math.min(best, Math.max(0, energyCarbon));
  if (limitedBy < 0 && energyCarbon < 1) limitedBy = -1;
  return { carbon, limitedBy };
}
