/**
 * Chemical species, compartments, transport, and elemental conservation.
 *
 * This module is the environmental half of the integrated biogeochemistry
 * experiment. Every gram of conserved matter in the simulation lives in
 * exactly one POOL in this file, and every transfer between pools is an
 * explicit movement of one ELEMENT (src/bio/elements.ts).
 *
 * WHAT IS MODELLED. Twenty-five compartments spanning inorganic dissolved
 * species, an immobile mineral sink, labile organic matter, structural
 * litter, sediment and a buffered water reservoir. All seven elements
 * (C, H, O, N, P, S, Fe) are cycled under ONE declared multielement
 * composition contract (POOL_COMPOSITION below): molecular H2O and O2, a
 * carbon-carrier DIC, bulk organic matter [C 1, H 1.8, O 0.5] per carbon,
 * and single-element nutrient carriers (with sulfide carrying its two H and
 * ferric oxide its declared 1.5 O per Fe).
 *
 * WHAT IS NOT CLAIMED. There is no molecular chemistry here — no speciation
 * equilibria, no pH-dependent solubility, no enzyme kinetics, no atmospheric
 * column. Water is an EXTERNAL BUFFERED RESERVOIR: the water pool is not a
 * chemical species network, and the reservoir top-up (`waterInput`) is a
 * declared boundary input. H and O ARE inside the conservation claim: they
 * close across the modelled compartments through the composition contract,
 * with the water-buffer boundary, the freeNutrients subsidy and two declared
 * gas exports (N2, H2) as the only exits (G39, G41). C, N, P, S and Fe close
 * the same way, with weathering and sediment as explicit boundaries (G27).
 *
 * DETERMINISM. Transport is a pull-based 5-point stencil (see
 * ScalarField.step), which is order-independent by construction: every cell
 * reads a snapshot of its four neighbours. Reaction effects are applied to
 * pools as per-cell deltas and settled in a separate pass, so no organism's
 * result can depend on the order organisms are iterated in.
 */

import { E, ELEMENT_NAMES } from '../bio/elements.js';

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
  /**
   * Water: an EXTERNAL, BUFFERED reservoir.
   *
   * Declared rather than simulated. Photosynthesis draws the hydrogen and
   * oxygen it incorporates into tissue, and respiration returns them, so the
   * O2 it releases and the H and O in organic matter have a real source and
   * sink. A pool that is refilled to a fixed level is a BUFFER, not a claim of
   * conservation across it: no conservation is asserted for water beyond the
   * model boundary.
   */
  H2O = 24,
  COUNT = 25,
}

export const POOL_COUNT = POOL.COUNT;

/**
 * Runtime accessor for the POOL constants.
 *
 * `POOL` is a const enum and therefore has NO runtime identity across module
 * boundaries: a probe, a viewer or a test cannot import `POOL.DIC`. Everything
 * that indexes pools at runtime — probes, the viewer, the conservation report —
 * must go through this object instead.
 */
export const POOL_RT = {
  O2: 0, DIC: 1, NH4: 2, NO2: 3, NO3: 4, PO4: 5, SO4: 6, H2S: 7, FE2: 8,
  FE3: 9, OC: 10, ON: 11, OP: 12, OS: 13, OFE: 14,
  LC: 15, LN: 16, LP: 17, LS: 18,
  SC: 19, SN: 20, SP: 21, SS: 22, SFE: 23, H2O: 24,
} as const;

/** Which conserved element each pool carries. */
/**
 * Which conserved element each pool carries, at runtime.
 *
 * Exported because the energy/matter books are compared and ablated per
 * ELEMENT, and a consumer that had to re-declare this table would eventually
 * disagree with it — which is how an element's matter ends up booked against
 * another element with the books still balancing.
 */
export const POOL_ELEMENT_RT: readonly E[] = [
  E.O, E.C, E.N, E.N, E.N, E.P, E.S, E.S, E.FE,   // 0-8 inorganic
  E.FE,                                          // 9  FE3
  E.C, E.N, E.P, E.S, E.FE,                     // 10-14 labile organic
  E.C, E.N, E.P, E.S,                           // 15-18 litter
  E.C, E.N, E.P, E.S, E.FE,                     // 19-23 sediment
  E.H,                                          // 24 water (H and O; tracked in both)
];

/**
 * DECLARED MULTIELEMENT COMPOSITION — the one contract every transfer uses.
 *
 * Per unit of pool AMOUNT, the moles of each element the pool contains, in E
 * order [C, H, O, N, P, S, Fe]. This table is authoritative for the INVENTORY:
 * `elementTotal()` multiplies each pool by its row, and every reaction,
 * acquisition, death, burial, weathering and boundary flux was reconciled
 * against it (see REPORT.md and CHEM-080-CONTRACT.md). `POOL_ELEMENT_RT` above
 * remains the PRIMARY-element map used by ablations and diagnostics; for pools
 * that carry more than one element it names the element an ablation removes.
 *
 * THE DECLARED CONVENTIONS, and why each is what it is:
 *
 *  - H2O = 2 H + 1 O and O2 = 2 O per unit. MOLECULAR. The reaction network
 *    already derived its coefficients from these molecular forms (photosynthesis
 *    is 1 DIC + 0.9 H2O -> 1 OC + 0.2 O2, which balances only under them); the
 *    earlier inventory counted water as 1 H + 1 O and O2 as 1 O, which is what
 *    made the H and O books disagree with the reactions.
 *
 *  - DIC = C only. DECLARED POC ABSTRACTION, not molecular CO2. Inorganic
 *    carbon is tracked as the element; its oxygen is represented through the
 *    O2 / H2O couple that the reactions carry explicitly. A CO2 inventory would
 *    force every O2-free mineralisation to consume water to dispose of the
 *    carbon's oxygen, which is not this model's chemistry.
 *
 *  - Organic carbon pools (OC, LC, SC) = [C 1, H 1.8, O 0.5] per C unit: the
 *    bulk biomass formula, identical to BIOMASS_STOICH. Dead tissue, litter and
 *    buried sediment represent the same bulk organic matter as living tissue,
 *    so one unit of organic carbon always carries the same H and O. N, P, S and
 *    Fe live in their OWN pools (ON, OP, OS, OFe and the litter/sediment
 *    equivalents) and are NOT repeated inside the C pools — that is what keeps
 *    the nutrient pools from being double-counted.
 *
 *  - N, P, S and Fe pools are single-element carriers, with two declared
 *    exceptions that the reaction balances require and that are physical:
 *      H2S carries its two H (sulfide is the reductant whose hydrogen is
 *      partly incorporated into fixed organic carbon); Fe3 carries 1.5 O per Fe
 *      (it is a ferric oxide mineral sink, declared as Fe2O3 content).
 *
 *  - Fe2, like the other dissolved nutrients, is a bare element carrier
 *    (hydration is not inventoried; solubility is represented by CLASS).
 *
 * What this buys: with the table in place, matter closes WITHIN the modelled
 * system for all seven elements, plus two declared gas exports (N2 from
 * denitrification, H2 from O2-free mineralisation). H2O remains an external
 * BUFFERED reservoir — the buffer top-up is still a declared boundary input —
 * but H and O are no longer routed to the reservoir sink to hide an
 * accounting mismatch: they stay in the pools their reactions put them in.
 *
 * Every row is asserted against every reaction by the element-contract gate;
 * editing a row without re-deriving the reactions is a contract violation, not
 * a parameter change.
 */
const COMPOSITION_ROWS: readonly (readonly number[])[] = [
  //   C    H    O    N    P    S   Fe
  [0, 0, 2, 0, 0, 0, 0],         // 0  O2   molecular oxygen
  [1, 0, 0, 0, 0, 0, 0],         // 1  DIC  carbon carrier (declared POC abstraction)
  [0, 0, 0, 1, 0, 0, 0],         // 2  NH4  nitrogen carrier
  [0, 0, 0, 1, 0, 0, 0],         // 3  NO2  nitrogen carrier
  [0, 0, 0, 1, 0, 0, 0],         // 4  NO3  nitrogen carrier
  [0, 0, 0, 0, 1, 0, 0],         // 5  PO4  phosphorus carrier
  [0, 0, 0, 0, 0, 1, 0],         // 6  SO4  sulfur carrier
  [0, 2, 0, 0, 0, 1, 0],         // 7  H2S  sulfide, carries its two H
  [0, 0, 0, 0, 0, 0, 1],         // 8  Fe2  iron carrier
  [0, 0, 1.5, 0, 0, 0, 1],       // 9  Fe3  ferric oxide (Fe2O3 per Fe)
  [1, 1.8, 0.5, 0, 0, 0, 0],     // 10 OC   bulk organic carbon
  [0, 0, 0, 1, 0, 0, 0],         // 11 ON   organic nitrogen
  [0, 0, 0, 0, 1, 0, 0],         // 12 OP   organic phosphorus
  [0, 0, 0, 0, 0, 1, 0],         // 13 OS   organic sulfur
  [0, 0, 0, 0, 0, 0, 1],         // 14 OFe  organic iron
  [1, 1.8, 0.5, 0, 0, 0, 0],     // 15 LC   litter carbon (bulk)
  [0, 0, 0, 1, 0, 0, 0],         // 16 LN   litter nitrogen
  [0, 0, 0, 0, 1, 0, 0],         // 17 LP   litter phosphorus
  [0, 0, 0, 0, 0, 1, 0],         // 18 LS   litter sulfur
  [1, 1.8, 0.5, 0, 0, 0, 0],     // 19 SC   sediment carbon (bulk)
  [0, 0, 0, 1, 0, 0, 0],         // 20 SN   sediment nitrogen
  [0, 0, 0, 0, 1, 0, 0],         // 21 SP   sediment phosphorus
  [0, 0, 0, 0, 0, 1, 0],         // 22 SS   sediment sulfur
  [0, 0, 0, 0, 0, 0, 1],         // 23 SFe  sediment iron
  [0, 2, 1, 0, 0, 0, 0],         // 24 H2O  molecular water (buffered reservoir)
];

// Flat [pool * E.COUNT + element] for the hot audit path.
export const POOL_COMPOSITION: readonly number[] = COMPOSITION_ROWS.flat();

/** Moles of element `e` carried per unit of pool `p`, by the declared contract. */
export function poolComposition(p: POOL, e: E): number {
  return POOL_COMPOSITION[p * E.COUNT + e];
}

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
  CLASS.IMMOBILE,               // water: a buffer, not a field
];

export const POOL_NAMES: readonly string[] = [
  'O2', 'DIC', 'NH4', 'NO2', 'NO3', 'PO4', 'SO4', 'H2S', 'Fe2', 'Fe3',
  'OC', 'ON', 'OP', 'OS', 'OFe',
  'LC', 'LN', 'LP', 'LS',
  'SC', 'SN', 'SP', 'SS', 'SFe',
];

export function poolElement(p: POOL): E {
  return POOL_ELEMENT_RT[p];
}


/**
 * Float64 scalar field for chemical pools.
 *
 * A deliberately separate type from `ScalarField` rather than a widening of
 * it. `ScalarField.data` is Float32Array and is used by the pre-existing
 * nutrient fields; changing its precision would perturb their dynamics and move
 * the pinned parity values, which this experiment is not permitted to do.
 *
 * The chemistry pools need float64 because the conservation books add small
 * deltas to large concentrations thousands of times per run, and float32
 * rounding at each application produced a 1-5% apparent loss on every element
 * that is merely being accounted for.
 */
export class ChemField {
  readonly data: Float64Array;
  private scratch: Float64Array;

  constructor(readonly name: string, readonly cols: number, readonly rows: number, fill = 0) {
    this.data = new Float64Array(cols * rows);
    this.scratch = new Float64Array(cols * rows);
    if (fill !== 0) this.data.fill(fill);
  }

  /**
   * Explicit 5-point diffusion with decay, in place. Pull-based, so every cell
   * reads the pre-tick snapshot of its neighbours and the result cannot depend
   * on iteration order.
   *
   * Reflecting boundaries reuse the boundary value, which is a zero-flux wall
   * and conserves mass; clamping to zero would silently drain the edges.
   */
  step(diffusivity: number, decay: number): void {
    const { cols, rows, data, scratch } = this;
    for (let cy = 0; cy < rows; cy++) {
      const row = cy * cols;
      for (let cx = 0; cx < cols; cx++) {
        const i = row + cx;
        const left = cx > 0 ? data[i - 1] : data[i];
        const right = cx < cols - 1 ? data[i + 1] : data[i];
        const up = cy > 0 ? data[i - cols] : data[i];
        const down = cy < rows - 1 ? data[i + cols] : data[i];
        const centre = data[i];
        scratch[i] = centre + diffusivity * (left + right + up + down - 4 * centre);
      }
    }
    if (decay > 0) {
      const keep = 1 - decay;
      for (let i = 0; i < data.length; i++) data[i] = scratch[i] * keep;
    } else {
      data.set(scratch);
    }
  }
}

/**
 * Largest accepted boundary burial fraction.
 *
 * One fraction has TWO consumers: the per-tick boundary sink (OC -> SC, taken
 * before organisms run) and the litter share of dead tissue, derived in the
 * death path as `burial * 22`. Above 1/22 the death split would exceed 1 and
 * release negative labile matter, so the accepted domain is
 * [0, MAX_BURIAL_FRACTION]. Out-of-domain configuration is REJECTED at
 * construction, never silently capped: a clamped fraction would be a different
 * experiment wearing the configured value's name.
 */
export const MAX_BURIAL_FRACTION = 1 / 22;

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
  /** Water reservoir level per cell. External, buffered, declared. */
  waterReservoir: number;
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
  waterReservoir: 400.0,
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
  /**
   * Chemical energy income, cumulative. Energy produced by reactions.
   *
   * Energy is NOT conserved by this model — organisms dissipate it — so these
   * are declared budgets, not physical quantities. They exist so that "energy
   * limits growth" is a MEASUREMENT rather than an assertion.
   */
  chemEnergyIncome: number;
  /** Cumulative energy charged for constructing chemical tissue. */
  chemEnergySpent: number;
  /** Cumulative moles of tissue carbon actually built under chemistry. */
  chemCarbonBuilt: number;
  /** Explicit exogenous nutrient subsidy used only by the freeNutrients ablation. */
  freeNutrientSubsidy: Float64Array;
  founderMatter: Float64Array;
  /**
   * Matter that left the modelled system as gas, per element.
   *
   * Two declared vents: N2 from denitrification and H2 from the O2-free
   * mineralisation family. Tracked because a cycle with no exit cannot balance
   * against weathering input over long runs, and an untracked exit looks
   * exactly like a leak.
   */
  gasExport: Float64Array;
  /**
   * Matter leaving through the declared external water/mineral boundary.
   *
   * Two things land here: ablation removals (`noNutrients`) and any H/O
   * RESIDUE that leaves the tissue ratio at death. Under the composition
   * contract, tissue H and O normally stay in the system inside the organic
   * pools — a unit of organic carbon carries its own 1.8 H and 0.5 O — so this
   * is no longer the main death path: a figure here means matter left the
   * modelled system, and it is booked so the books close rather than being
   * quietly dropped.
   */
  reservoirSink: Float64Array;
  /** Water drawn from the external reservoir to hold it at its level. */
  waterInput: number;
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
    chemEnergyIncome: 0, chemEnergySpent: 0, chemCarbonBuilt: 0,
    freeNutrientSubsidy: new Float64Array(7),
    reservoirSink: new Float64Array(7), waterInput: 0,
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
  readonly fields: ChemField[] = [];
  readonly cols: number;
  readonly rows: number;
  /**
   * Moles represented by one field cell.
   *
   * FIXES THE UNIT MISMATCH AT ITS SOURCE. Pool values are moles PER CELL.
   * `elementTotal` previously multiplied by cellArea = cellWidth^2 = 1600,
   * while organism stores were credited in raw moles with no conversion — two
   * incompatible units in the same conservation equation. It also made living
   * biomass about 0.006% of standing carbon, so organisms were numerically
   * irrelevant to the chemistry they were supposed to drive.
   *
   * One mole per cell puts an organism's carbon on the same scale as a cell's
   * inventory: with 10,000 cells holding ~0.35 mol of labile carbon each, a
   * founding cohort of 400 organisms at ~1 mol C each is ~11% of the standing
   * pool — a real fraction that organisms can measurably deplete and refill.
   */
  readonly cellArea: number;
  readonly cfg: ChemistryConfig;
  /** Per-cell reaction deltas, indexed pool*cellCount + cell. */
  readonly delta: Float64Array;
  /**
   * Per-cell quantity ALREADY CLAIMED by earlier organisms this tick.
   *
   * FINDING 3, fixed at the source. Competing organisms in one cell all read the
   * same pre-tick concentration, so N organisms each drawing "up to 100% of
   * what is there" sum to N times the pool and drive it negative. Flooring the
   * result hides the overshoot but CREATES matter, because the part of the draw
   * that never materialised still generated its reaction products elsewhere.
   *
   * Claiming makes the competition explicit and finite: an organism may take
   * what is present MINUS what earlier organisms in the same tick already took.
   * `remaining()` is what every uptake path must read.
   */
  readonly claimed: Float64Array;
  readonly flux = newBoundaryFluxes();

  constructor(cols: number, rows: number, cellArea: number, cfg: ChemistryConfig) {
    this.cols = cols;
    this.rows = rows;
    this.cellArea = cellArea;
    this.cfg = cfg;
    const n = cols * rows;
    for (let p = 0; p < POOL_COUNT; p++) {
      this.fields.push(new ChemField(POOL_NAMES[p], cols, rows, 0));
    }
    this.delta = new Float64Array(POOL_COUNT * n);
    this.claimed = new Float64Array(POOL_COUNT * n);
    this.waterBuffer = cfg.waterReservoir;
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
    // Water is refilled to its reservoir level, not evolved.
    fill(POOL.H2O, c.waterReservoir);
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

  /**
   * What is still available of a pool at a cell, after earlier claims this tick.
   *
   * Never negative: a fully-claimed pool reads zero, which is the correct answer
   * for a finite resource that has already been taken.
   */
  remaining(pool: POOL, cell: number): number {
    const i = pool * this.cols * this.rows + cell;
    const free = this.fields[pool].data[cell] - this.claimed[i];
    return free > 0 ? free : 0;
  }

  /**
   * What remains for a REACTION substrate after this tick's reservations.
   *
   * Reactions and assimilation share ONE reservation array, so this is the
   * same one-snapshot budget: the pre-tick inventory minus everything already
   * reserved in this cell this tick — reaction gross draws by every organism
   * and every uptake by every organism. Products never refill it.
   */
  remainingForReaction(pool: POOL, cell: number): number {
    return this.remaining(pool, cell);
  }

  /**
   * Reserve a GROSS reaction-substrate draw for this tick.
   *
   * It is booked into the SAME `claimed` array assimilation uses, so a
   * substrate a reaction returned this tick cannot be re-taken by a later
   * reaction OR by a later organism's uptake before `settle()`. Reserving the
   * gross draw here (>= the net draw) is what makes the one-snapshot contract
   * hold; the caller must NOT also claim the reaction's net delta.
   */
  claimGross(pool: POOL, cell: number, amount: number): void {
    if (amount <= 0) return;
    this.claimed[pool * this.cols * this.rows + cell] += amount;
    this.grossDrawnTotal[pool] += amount;
  }

  /** Book a draw against a pool so later organisms in this tick see less. */
  claim(pool: POOL, cell: number, amount: number): void {
    if (amount <= 0) return;
    const i = pool * this.cols * this.rows + cell;
    this.claimed[i] += amount;
    this.delta[i] -= amount;
  }

  /**
   * Cumulative magnitude clamped to zero by settling, per pool.
   *
   * FINDING 3. Competing organisms in one cell both read the same pre-tick
   * concentration, so their combined draw can exceed what the cell holds and
   * drive a pool negative — after which the next organism reads a negative
   * "available" concentration and the model silently creates matter. Clamping
   * makes the overshoot visible instead of letting it propagate.
   */
  readonly clamped = new Float64Array(POOL_COUNT);

  /**
   * Running total of everything settle() has ever had to clamp, per pool.
   *
   * `clamped` is reset at the START of every settle, so it describes the most
   * recent tick only. A method named `totalClamped()` that summed it was
   * reporting one tick's worth under a name promising the whole run: it read
   * 0.09 for a run whose true cumulative clamp was 13.07. A number whose name
   * misdescribes its window is how a real defect stays invisible, so the
   * cumulative figure is kept separately and accumulated where the clamp is
   * actually taken.
   */
  readonly clampedCumulative = new Float64Array(POOL_COUNT);

  /** Cells that were clamped on the most recent settle, per pool. */
  readonly clampedCells = new Float64Array(POOL_COUNT);

  /** Cumulative gross reaction-substrate draws, per pool. Diagnostic only. */
  readonly grossDrawnTotal = new Float64Array(POOL_COUNT);

  /** Apply accumulated deltas, then transport. Order is fixed and declared. */
  settle(): void {
    const n = this.cols * this.rows;
    this.clamped.fill(0);
    this.clampedCells.fill(0);
    this.claimed.fill(0);
    for (let p = 0; p < POOL_COUNT; p++) {
      const f = this.fields[p];
      const base = p * n;
      for (let i = 0; i < n; i++) {
        const d = this.delta[base + i];
        if (d === 0) continue;
        const next = f.data[i] + d;
        if (next < 0) {
          this.clamped[p] += -next;
          this.clampedCumulative[p] += -next;
          this.clampedCells[p]++;
          f.data[i] = 0;
        } else {
          f.data[i] = next;
        }
      }
      this.delta.fill(0, base, base + n);
    }
    // Water is a BUFFER. Refill each cell to its declared reservoir level and
    // book the top-up as an external input, so the reservoir neither drains nor
    // accumulates silently. No conservation is claimed across this boundary.
    if (this.waterBuffer > 0) {
      const f = this.fields[POOL.H2O];
      const fd = f.data;
      // Only a RESERVOIR TOP-UP is an external input: water the reactions
      // actually drew down and that must be replenished from outside. Counting
      // the initial fill as an input would double-book the opening inventory,
      // which already contains it.
      for (let i = 0; i < n; i++) {
        const d = this.waterBuffer - fd[i];
        if (d > 0) { fd[i] = this.waterBuffer; this.flux.waterInput += d; }
      }
    }
    this.transport();
  }

  /** Declared water reservoir level per cell. */
  waterBuffer: number = 0;

  /** Total magnitude clamped across all pools since construction. */
  totalClamped(): number {
    let s = 0;
    for (let p = 0; p < POOL_COUNT; p++) s += this.clampedCumulative[p];
    return s;
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
   * This is the number conservation is checked against. Every pool is counted
   * through POOL_COMPOSITION — the one declared multielement contract — so a
   * pool that carries several elements (water, O2, the bulk organic carbons,
   * H2S, Fe3) is counted for each of them at its full declared content. The
   * boundaries that remain external BY DECLARATION are the atmospheric CO2
   * source, the water reservoir buffer, weathering, the freeNutrients subsidy
   * and the gas exports; each is booked as an input or output on the audit.
   */
  elementTotal(e: E): number {
    const n = this.cols * this.rows;
    let sum = 0;
    for (let p = 0; p < POOL_COUNT; p++) {
      const c = POOL_COMPOSITION[p * E.COUNT + e];
      if (c === 0) continue;
      const f = this.fields[p].data;
      let s = 0;
      for (let i = 0; i < n; i++) s += f[i];
      sum += s * c;
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
