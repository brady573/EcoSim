/**
 * Chemical species, compartments, transport, and elemental conservation.
 *
 * This module is the environmental half of the integrated biogeochemistry
 * experiment. Every gram of conserved matter in the simulation lives in
 * exactly one POOL in this file, and every transfer between pools is an
 * explicit movement of one ELEMENT (src/bio/elements.ts).
 *
 * WHAT IS MODELLED. Twenty-four compartments spanning inorganic dissolved
 * species, an immobile mineral sink, labile organic matter, structural litter
 * and sediment. C, N, P, S and Fe are cycled; H and O are tracked as biomass
 * components and as dissolved O2.
 *
 * WHAT IS NOT, AND IS NOT CLAIMED. There is no molecular chemistry here — no
 * speciation equilibria, no pH-dependent solubility, no enzyme kinetics, no
 * atmospheric column. Water is an EXTERNAL BUFFERED RESERVOOL: hydrogen and the
 * oxygen bound in water are not conserved in this model, because the water pool
 * is not simulated. Atmospheric CO2, geological weathering, gas exchange at the
 * water surface and export to sediment sinks are declared as explicit fluxes
 * and measured in the ledger. Conservation claims in this repository are
 * therefore for C, N, P, S and Fe across the modelled compartments plus those
 * declared boundaries — NOT for atomic balance of the whole system. Hydrogen and
 * oxygen-as-water are deliberately outside the claim.
 *
 * DETERMINISM. Transport is a pull-based 5-point stencil (see
 * ScalarField.step), which is order-independent by construction: every cell
 * reads a snapshot of its four neighbours. Reaction effects are applied to
 * pools as per-cell deltas and settled in a separate pass, so no organism's
 * result can depend on the order organisms are iterated in.
 */

import { E, ELEMENT_NAMES } from '../bio/elements.js';
import { ScalarField } from '../core/field.js';

/**
 * Chemical compartments.
 *
 * Indexed by an Int8Array for pool→element, so the hot path costs one array
 * read per transfer rather than a switch.
 */
export const enum POOL {
  // --- Inorganic, dissolved, mobile ---------------------------------------
  O2 = 0,    // dissolved oxygen
  DIC = 1,   // dissolved inorganic carbon
  NH4 = 2,   // ammonium
  NO2 = 3,   // nitrite
  NO3 = 4,   // nitrate
  PO4 = 5,   // orthophosphate
  SO4 = 6,   // sulfate
  H2S = 7,   // sulfide (reduced sulfur)
  FE2 = 8,   // ferrous iron (bioavailable)
  // --- Inorganic, immobile mineral sink ------------------------------------
  FE3 = 9,   // ferric oxide (oxidised, effectively unavailable)
  // --- Labile organic matter ----------------------------------------------
  OC = 10,
  ON = 11,
  OP = 12,
  OS = 13,
  OFE = 14,
  // --- Structural litter ---------------------------------------------------
  LC = 15,
  LN = 16,
  LP = 17,
  LS = 18,
  // --- Sediment ------------------------------------------------------------
  SC = 19,
  SN = 20,
  SP = 21,
  SS = 22,
  SFE = 23,
  COUNT = 24,
}

export const POOL_COUNT = POOL.COUNT;

/** Which conserved element each pool carries. */
const POOL_ELEMENT: readonly E[] = [
  E.O, E.C, E.N, E.N, E.N, E.P, E.S, E.S, E.FE,   // 0-8 inorganic
  E.FE,                                          // 9  FE3
  E.C, E.N, E.P, E.S, E.FE,                     // 10-14 labile organic
  E.C, E.N, E.P, E.S,                           // 15-18 litter
  E.C, E.N, E.P, E.S, E.FE,                     // 19-23 sediment
];

/** Transport class: how a pool moves through the grid. */
export const enum CLASS {
  DISSOLVED = 0,  // diffuses freely
  SEMI = 1,       // suspended organic: slow spread
  IMMOBILE = 2,   // mineral, litter and sediment stay put
}

const POOL_CLASS: readonly CLASS[] = [
  CLASS.DISSOLVED, // O2
  CLASS.DISSOLVED, // DIC
  CLASS.DISSOLVED, // NH4
  CLASS.DISSOLVED, // NO2
  CLASS.DISSOLVED, // NO3
  CLASS.DISSOLVED, // PO4
  CLASS.DISSOLVED, // SO4
  CLASS.DISSOLVED, // H2S
  CLASS.SEMI,      // FE2 — oxidises readily, so slow
  CLASS.IMMOBILE,  // FE3
  CLASS.SEMI, CLASS.SEMI, CLASS.SEMI, CLASS.SEMI, CLASS.SEMI, // labile organic
  CLASS.IMMOBILE, CLASS.IMMOBILE, CLASS.IMMOBILE, CLASS.IMMOBILE, // litter
  CLASS.IMMOBILE, CLASS.IMMOBILE, CLASS.IMMOBILE, CLASS.IMMOBILE, CLASS.IMMOBILE, // sediment
];

export const POOL_NAMES: readonly string[] = [
  'O2', 'DIC', 'NH4', 'NO2', 'NO3', 'PO4', 'SO4', 'H2S', 'Fe2', 'Fe3',
  'OC', 'ON', 'OP', 'OS', 'OFe',
  'LC', 'LN', 'LP', 'LS',
  'SC', 'SN', 'SP', 'SS', 'SFe',
];

export function poolElement(p: POOL): E {
  return POOL_ELEMENT[p];
}

export interface ChemistryConfig {
  /** Per-tick diffusivity for dissolved species. */
  diffusivity: number;
  /** Per-tick diffusivity for suspended species (organic matter, ferrous iron). */
  semiDiffusivity: number;
  /** Atmospheric CO2 delivered to the water column per tick, whole world. */
  co2Weathering: number;
  /** Geological nutrient release (P, N) to the water column per tick. */
  nutrientWeathering: number;
  /** Fraction of organic carbon that sinks from water column to sediment. */
  burial: number;
  /** Sediment release back to the water column per tick. */
  sedimentWeathering: number;
  /** Initial dissolved oxygen per cell. */
  initialO2: number;
  /** Initial DIC per cell. */
  initialDIC: number;
  /** Initial ammonium per cell. */
  initialNH4: number;
  /** Initial nitrate per cell. */
  initialNO3: number;
  /** Initial phosphate per cell. */
  initialPO4: number;
  /** Initial sulfate per cell. */
  initialSO4: number;
  /** Initial ferrous iron per cell. */
  initialFe2: number;
  /** Initial labile organic carbon per cell (a pulse of legacy detritus). */
  initialOC: number;
}

export const DEFAULT_CHEMISTRY: ChemistryConfig = {
  diffusivity: 0.18,
  semiDiffusivity: 0.02,
  co2Weathering: 0.0022,
  nutrientWeathering: 0.00035,
  burial: 0.0009,
  sedimentWeathering: 0.00004,
  initialO2: 0.9,
  initialDIC: 0.06,
  initialNH4: 0.004,
  initialNO3: 0.006,
  initialPO4: 0.0016,
  initialSO4: 0.010,
  initialFe2: 0.00035,
  initialOC: 0.35,
};

/**
 * External fluxes, measured so the ledger can balance.
 *
 * These are the ONLY places matter enters or leaves the modelled system. Any
 * conservation claim is meaningless unless they are counted, so they are first
 * class rather than hidden inside a reaction.
 */
export interface BoundaryFluxes {
  co2In: number;
  weatherP: number;
  weatherN: number;
  weatherS: number;
  weatherFe: number;
  sedimentOut: number;
  exportOut: number;
  /**
   * Matter present in founder organisms at seeding.
   *
   * An EXTERNAL INPUT, not a by-product. Founding biomass is already recorded
   * as an input in the energy ledger; this is the elemental counterpart, and it
   * is counted here rather than assumed so the books balance from tick 0.
   */
  founderMatter: Float64Array;
  /**
   * Matter that left the modelled system as gas, per element.
   *
   * Nitrogen is the model's only atmospheric export (denitrification). This is
   * tracked because an N cycle with no exit cannot balance against weathering
   * input over long runs, and an untracked exit looks exactly like a leak.
   */
  gasExport: Float64Array;
  /**
   * Hydrogen and oxygen leaving as dead tissue.
   *
   * Water is an EXTERNAL BUFFERED RESERVOOL in this model and is not
   * simulated, so H and O in tissue leave the modelled system on death. They
   * are tracked here so the books close rather than being quietly dropped, and
   * so no conservation claim is made across that boundary.
   */
  reservoirSink: Float64Array;
  /** Net draw from the external water reservoir, per element. */
  reservoirSource: Float64Array;
  /** Net O2 drawn from / returned to water, per element. */
  waterO2: Float64Array;
}

export function newBoundaryFluxes(): BoundaryFluxes {
  return {
    co2In: 0, weatherP: 0, weatherN: 0, weatherS: 0, weatherFe: 0,
    sedimentOut: 0, exportOut: 0,
    founderMatter: new Float64Array(7), gasExport: new Float64Array(7),
    reservoirSink: new Float64Array(7),
    reservoirSource: new Float64Array(7), waterO2: new Float64Array(7),
  };
}

/**
 * Per-tick reaction deltas, accumulated by every consumer and settled once.
 *
 * Separating accumulation from settlement is what makes reactions independent of
 * organism iteration order: within a tick, every organism writes into the same
 * delta buffer, and the buffer is applied to the pools afterwards. Two organisms
 * competing for the same cell cannot produce an order-dependent result from
 * "who read first" — they both read the pre-tick pool snapshot.
 */
export class Chemistry {
  readonly fields: ScalarField[] = [];
  readonly cols: number;
  readonly rows: number;
  readonly cellArea: number;
  readonly cfg: ChemistryConfig;
  /** Per-cell reaction deltas, indexed pool*cellCount + cell. */
  readonly delta: Float64Array;
  readonly flux = newBoundaryFluxes();

  constructor(cols: number, rows: number, cellArea: number, cfg: ChemistryConfig) {
    this.cols = cols;
    this.rows = rows;
    this.cellArea = cellArea;
    this.cfg = cfg;
    const n = cols * rows;
    for (let p = 0; p < POOL_COUNT; p++) {
      this.fields.push(new ScalarField(POOL_NAMES[p], cols, rows, 0));
    }
    this.delta = new Float64Array(POOL_COUNT * n);
    this.seedInitial();
  }

  private seedInitial(): void {
    const c = this.cfg;
    const fill = (p: POOL, v: number) => this.fields[p].data.fill(v);
    fill(POOL.O2, c.initialO2);
    fill(POOL.DIC, c.initialDIC);
    fill(POOL.NH4, c.initialNH4);
    fill(POOL.NO3, c.initialNO3);
    fill(POOL.PO4, c.initialPO4);
    fill(POOL.SO4, c.initialSO4);
    fill(POOL.FE2, c.initialFe2);
    fill(POOL.OC, c.initialOC);
    // Reduced sulfur and fixed Fe start absent: sulfate is the oxidised,
    // available form, and ferrous iron only appears where oxygen is consumed.
    // This is what makes reduced niches something an ecosystem has to CREATE.
  }

  index(x: number, y: number): number {
    let cx = (x / this.cellW) | 0;
    let cy = (y / this.cellH) | 0;
    if (cx < 0) cx = 0; else if (cx >= this.cols) cx = this.cols - 1;
    if (cy < 0) cy = 0; else if (cy >= this.rows) cy = this.rows - 1;
    return cy * this.cols + cx;
  }

  cellW: number = 1;
  cellH: number = 1;

  setCellSize(w: number, h: number): void {
    this.cellW = w;
    this.cellH = h;
  }

  /** Concentration of a pool at a world position. */
  at(pool: POOL, x: number, y: number): number {
    return this.fields[pool].data[this.index(x, y)];
  }

  /** Add directly to a pool in world coordinates (boundary/weathering only). */
  inject(pool: POOL, x: number, y: number, amount: number): void {
    const i = this.index(x, y);
    this.fields[pool].data[i] += amount;
  }

  /** Record a reaction's effect on a pool at a cell. */
  react(pool: POOL, cell: number, amount: number): void {
    this.delta[pool * this.cols * this.rows + cell] += amount;
  }

  /** Apply accumulated deltas, then transport. Order is fixed and declared. */
  settle(): void {
    const n = this.cols * this.rows;
    for (let p = 0; p < POOL_COUNT; p++) {
      const f = this.fields[p];
      const base = p * n;
      for (let i = 0; i < n; i++) {
        const d = this.delta[base + i];
        if (d !== 0) f.data[i] += d;
      }
      this.delta.fill(0, base, base + n);
    }
    this.transport();
  }

  /**
   * Transport. Pull-based stencil per pool, order-independent.
   *
   * Immobile pools are skipped entirely: their content only moves through
   * explicit reactions (mineralisation, burial, weathering), never by
   * diffusion. That distinction is ecological, not an optimisation — it is
   * why a litter patch stays a patch.
   */
  private transport(): void {
    const c = this.cfg;
    for (let p = 0; p < POOL_COUNT; p++) {
      const cls = POOL_CLASS[p];
      if (cls === CLASS.IMMOBILE) continue;
      const d = cls === CLASS.DISSOLVED ? c.diffusivity : c.semiDiffusivity;
      if (d > 0) this.fields[p].step(Math.min(0.25, d), 0);
    }
  }

  /**
   * Total inventory of one element across every modelled compartment, in moles.
   *
   * This is the number conservation is checked against. It does NOT include
   * atmospheric CO2, water, or anything outside the declared boundaries.
   */
  elementTotal(e: E): number {
    const n = this.cols * this.rows;
    let sum = 0;
    for (let p = 0; p < POOL_COUNT; p++) {
      if (POOL_ELEMENT[p] !== e) continue;
      const f = this.fields[p].data;
      for (let i = 0; i < n; i++) sum += f[i];
    }
    return sum * this.cellArea;
  }

  /** Per-pool totals, for a compartment-resolved balance report. */
  poolTotals(): Float64Array {
    const out = new Float64Array(POOL_COUNT);
    const n = this.cols * this.rows;
    for (let p = 0; p < POOL_COUNT; p++) {
      let s = 0;
      const f = this.fields[p].data;
      for (let i = 0; i < n; i++) s += f[i];
      out[p] = s * this.cellArea;
    }
    return out;
  }

  /** Reset accumulated deltas without applying them (used by ablations). */
  clearDeltas(): void {
    this.delta.fill(0);
  }
}

/**
 * Elemental conservation check.
 *
 * Compares inventory change against accounted inputs and outputs, per element.
 * A non-zero residual here is a BUG — matter created or destroyed — and is
 * reported as such rather than absorbed as a tolerance.
 */
export interface ConservationReport {
  element: string;
  initial: number;
  final: number;
  inputs: number;
  outputs: number;
  residual: number;
  residualFraction: number;
  ok: boolean;
}

export function conservationReport(
  initial: Float64Array,
  final: Float64Array,
  inputs: Float64Array,
  outputs: Float64Array,
  tolerance = 1e-9,
): ConservationReport[] {
  const out: ConservationReport[] = [];
  for (let e = 0; e < E.COUNT; e++) {
    const in0 = initial[e], fin = final[e], i = inputs[e], o = outputs[e];
    // Expected final = initial + in - out.
    const residual = fin - (in0 + i - o);
    const denom = Math.max(1e-12, Math.abs(in0) + i + o);
    const frac = residual / denom;
    out.push({
      element: ELEMENT_NAMES[e],
      initial: in0, final: fin, inputs: i, outputs: o,
      residual, residualFraction: frac,
      ok: Math.abs(frac) <= tolerance,
    });
  }
  return out;
}
