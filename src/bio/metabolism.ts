/**
 * Interconnected metabolic reactions.
 *
 * Seven families are made causally functional (photosynthesis, aerobic
 * respiration, fermentation, decomposition/mineralisation, nitrogen cycling,
 * sulfur cycling including a chemosynthetic strategy, and iron-dependent
 * metabolism). They are expressed as ONE network rather than seven special
 * cases, so that the interactions between them — which is where the ecology
 * actually lives — fall out of the model instead of being scripted.
 *
 * THE CENTRAL RULE. A reaction grants energy only when its substrates are
 * present AND the organism possesses the required capability. Enabling a
 * pathway is not the same as running it. Nothing in this file awards energy for
 * a named pathway existing.
 *
 * EVIDENCE. Every reaction accumulates `extent` and a run count. A claim that a
 * process occurred is answerable from those counters, not from the presence of
 * a capability — which is the distinction this repository has already been
 * burned by twice.
 *
 * DECLARED IDEALISATIONS.
 *  - Monod kinetics with a single half-saturation constant per substrate. No
 *    multi-substrate limitation beyond the explicit `limitingFrom` list.
 *  - Fixed stoichiometry per unit extent. No thermodynamic coupling.
 *  - Nitrogen fixation is NOT modelled (no N2 pool); nitrate and ammonium are
 *    the only inorganic nitrogen forms, so N is a closed cycle with two exits
 *    (denitrification to gas, sediment burial).
 *  - No pH. Sulfide is not rendered toxic and no acid production is modelled.
 *  - O2 is not tracked inside biomass; respiratory quotient is simplified.
 *  - ONE declared multielement composition contract (POOL_COMPOSITION in
 *    src/world/chemistry.ts) governs every pool, transfer and reaction in this
 *    network. A reaction that does not close against it is a defect, and the
 *    element-contract gate asserts that each one does. Two gas exports are
 *    declared (N2 from denitrification, H2 from O2-free mineralisation); water
 *    remains an external buffered reservoir.
 */

import { CLASS, POOL, type Chemistry } from '../world/chemistry.js';
import { E } from './elements.js';

/**
 * Metabolic capabilities — the heritable half of metabolism.
 *
 * Bit flags so one integer per organism carries its whole metabolic repertoire,
 * and so the bitmask can be expressed directly by genome modules (see
 * src/bio/modgenome.ts) without a second trait block.
 */
export const enum CAP {
  NONE = 0,
  /** CO2 -> organic carbon using light. */
  PHOTOSYNTHESIS = 1 << 0,
  /** Oxidative metabolism requiring O2. */
  AEROBIC = 1 << 1,
  /** Substrate-level metabolism, O2-independent, low yield. */
  FERMENT = 1 << 2,
  /** NH4 -> NO2 -> NO3. Requires O2. */
  NITRIFY = 1 << 3,
  /** NO3 -> N2 gas under anoxia. The only N export to atmosphere. */
  DENITRIFY = 1 << 4,
  /** SO4 -> H2S under anoxia. */
  SULF_REDUCE = 1 << 5,
  /** H2S -> SO4, fixing C as a side effect. The sulfur chemosynthetic niche. */
  SULF_OXIDIZE = 1 << 6,
  /** Fe2 uptake; Fe is a cofactor so this gates metabolism, not bulk growth. */
  FE_UPTAKE = 1 << 7,
  /** Fe2 -> Fe3 with C fixation. The iron chemosynthetic niche. */
  FE_CHEMO = 1 << 8,
  /** Assimilate inorganic N into organic N. */
  N_ASSIM = 1 << 9,
  /** Break down structural litter (slow, refractory). */
  LIGNOLYTIC = 1 << 10,
  /** Access sedimentary P directly. */
  SEDIMENT_ACCESS = 1 << 11,
}

export const CAP_COUNT = 12;
/**
 * Approved experiment-only omissions; never a capability-mask knockout.
 *
 * `nitrification` has been an ISOLATED pathway since chem/0.8.1 — it is not in
 * the live network — and this selector is retained so recorded arm names stay
 * resolvable. Omitting it is a declared no-op: the arms are state-identical
 * and the control/omission contrast is VACUOUS (G51/G54).
 */
export type ReactionOmission = 'nitrification' | 'iron oxidation' | 'iron uptake';

/** A substrate requirement: pool plus moles consumed per unit of extent. */
export interface Sub {
  pool: POOL;
  coeff: number;
}

/**
 * A gas leaving the modelled system, per unit of extent.
 *
 * NOT a pool: the atmosphere is an external boundary, and matter that leaves
 * as gas must be booked as an EXPORT on the elemental audit rather than
 * quietly dropped or written into a pool it does not belong to. Two exits
 * exist by declaration: N2 from denitrification and H2 from the O2-free
 * mineralisation family (once the carbon that hydrogen arrived with is
 * mineralised to DIC, no remaining product can carry it).
 */
export interface GasExport {
  element: E;
  coeff: number;
}

export interface Reaction {
  readonly id: number;
  readonly name: string;
  /** Capability required. A run without it is not merely slower — it cannot. */
  readonly cap: CAP;
  readonly substrates: readonly Sub[];
  readonly products: readonly Sub[];
  /** Gases exported per unit extent, booked on the boundary audit. */
  readonly gas?: readonly GasExport[];
  /** Energy per unit extent. Negative means the process COSTS energy. */
  readonly energy: number;
  /** Per-unit-extent rate ceiling, before capability strength. */
  readonly vmax: number;
  /** Substrates whose concentration limits the rate (Monod), by pool. */
  readonly limits: readonly POOL[];
  /** Minimum O2 required for the reaction to proceed at all. */
  readonly minO2: number;
  /** Maximum O2 — used for anaerobic pathways inhibited by oxygen. */
  readonly maxO2: number;
  /** Families, for reporting and for the evidence ladder. */
  readonly family: string;
  readonly note: string;
}

let nextRx = 0;
function rx(
  name: string, cap: CAP, family: string,
  substrates: readonly Sub[], products: readonly Sub[],
  energy: number, vmax: number,
  limits: readonly POOL[],
  minO2: number, maxO2: number, note: string,
  gas?: readonly GasExport[],
): Reaction {
  return {
    id: nextRx++, name, cap, family, substrates, products, energy, vmax,
    limits, minO2, maxO2, note, gas,
  };
}

const s = (pool: POOL, coeff: number): Sub => ({ pool, coeff });

/**
 * The network.
 *
 * Ordered by family for readability; execution order does not matter because
 * every reaction writes to the delta buffer and the buffer is settled once per
 * tick. That is what makes the result independent of reaction order and of
 * organism iteration order.
 */
export const REACTIONS: readonly Reaction[] = [
  // --- Family 1: photosynthetic carbon fixation ----------------------------
  // Photosynthesis draws the oxygen it releases from WATER, not from nothing:
  // 6 CO2 + 6 H2O -> C6H12O6 + 6 O2 puts both released oxygens in the water
  // pool. Modelling DIC alone as a substrate and emitting O2 creates matter,
  // which showed as a +7% oxygen residual. The water pool is EXTERNAL AND
  // BUFFERED (declared, not simulated), so the draw and the return are booked
  // against that reservoir rather than against a modelled pool.
  // 1 DIC + 0.9 H2O -> 1 OC(CH1.8O0.5) + 0.2 O2  — balanced in H and O.
  //
  // The previous form emitted 1.9 O2 with DIC as its only substrate, which is
  // an EMISSION rather than a balance: the hydrogen and oxygen it put into
  // organic matter had no source, which measured as +374% H and +87% N.
  // Deriving the coefficients from BIOMASS_STOICH rather than choosing them:
  //   H: 2n = 1.8  -> n = 0.9 water
  //   O: n = 0.5 + 2m -> m = 0.2 O2
  rx('photosynthesis', CAP.PHOTOSYNTHESIS, 'carbon fixation',
    [s(POOL.DIC, 1), s(POOL.H2O, 0.9)],
    [s(POOL.OC, 1), s(POOL.O2, 0.2)],
    1.0, 0.055, [POOL.DIC, POOL.PO4, POOL.NH4],
    0, 1e9,
    'Light-driven DIC fixation. O2 is a PRODUCT of the balance, not an '
    + 'emission: the oxygen released and the H and O locked into tissue both '
    + 'come from water, an external buffered reservoir. A photosynthetic '
    + 'community therefore still makes its own oxygenated habitat, while the '
    + 'chemistry stays closed. Requires inorganic N and P.'),

  // --- Family 2: aerobic organic metabolism --------------------------------
  // The reverse of photosynthesis, in the same stoichiometry:
  // 1 OC + 0.2 O2 -> 1 DIC + 0.9 H2O. Returning water matters — respiration is
  // what closes the water loop, and without it the reservoir drains monotonically.
  rx('aerobic respiration', CAP.AEROBIC, 'aerobic',
    [s(POOL.OC, 1), s(POOL.O2, 0.2)],
    [s(POOL.DIC, 1), s(POOL.H2O, 0.9)],
    0.82, 0.085, [POOL.OC],
    0.02, 1e9,
    'Oxidative breakdown. O2 is consumed, carbon returned as DIC and water '
    + 'returned to the reservoir: the exact inverse of photosynthesis, which is '
    + 'why the two are stoichiometrically coupled rather than merely similar.'),

  // --- Family 3: O2-independent metabolism ---------------------------------
  // 1 OC -> 0.5 DIC + 0.5 OC + 0.25 H2O + 0.2 H2 (gas). THE HYDROGEN AND
  // OXYGEN MUST GO SOMEWHERE: a unit of organic carbon carries 1.8 H and
  // 0.5 O, DIC is a pure carbon carrier, and the returned half-carbon carries
  // only 0.9 H and 0.25 O. The remainder leaves as water (0.25, i.e. 0.5 H
  // and 0.25 O) and as H2 gas (0.2, i.e. 0.4 H). The earlier form listed only
  // DIC and OC, destroying 0.9 H and 0.25 O per unit extent — the measured H
  // and O residuals of the attribution.
  rx('fermentation', CAP.FERMENT, 'anaerobic',
    [s(POOL.OC, 1)],
    [s(POOL.DIC, 0.5), s(POOL.OC, 0.5), s(POOL.H2O, 0.25)],
    0.26, 0.030, [POOL.OC],
    0, 0.03,
    'Substrate-level metabolism. Works only where O2 has been depleted, and '
    + 'yields far less per unit carbon than respiration. This is what makes '
    + 'an anoxic niche worth occupying and what limits how large it can get. '
    + 'The H2 it releases is a DECLARED gas export: no H2-consuming pathway '
    + 'is modelled, so that hydrogen leaves the system rather than pretending '
    + 'to return to a pool.',
    [{ element: E.H, coeff: 0.4 }]),

  // --- Family 4: decomposition and mineralisation --------------------------
  // Organic matter is stored as SEPARATE single-element pools (OC, ON, OP,
  // OS), so a reaction that breaks down carbon and MINERALISES nitrogen must
  // draw BOTH. The earlier form consumed only OC and produced 0.05 NH4, which
  // created nitrogen from nothing — the +82% residual.
  //
  // Per unit of organic carbon the tissue holds 0.16 N and 0.009 P, of which
  // mineralisation releases a fraction and the remainder stays organic.
  // Carbon is only PARTIALLY mineralised: 0.7 returns as DIC and the remaining
  // 0.3 is refractory and STAYS ORGANIC. The earlier form emitted 0.7 and
  // destroyed 0.3 outright, which is the carbon residual. Refractory carbon
  // returns to the organic pool, from which burial can eventually sequester it.
  // H AND O COMPLETE THE BALANCE. Only 0.3 of the carbon stays organic, so
  // 0.54 of the 1.8 H and 0.15 of the 0.5 O are re-incorporated; the rest
  // leaves as water (0.63 = 1.26 H + 0.63 O), and the oxygen to make it comes
  // from O2 (0.14 = 0.28 O): H 1.8 = 0.54 + 1.26; O 0.5 + 0.28 = 0.15 + 0.63.
  rx('aerobic decomposition', CAP.AEROBIC, 'decomposition',
    [s(POOL.OC, 1), s(POOL.ON, 0.16), s(POOL.OP, 0.009), s(POOL.O2, 0.14)],
    [s(POOL.DIC, 0.7), s(POOL.NH4, 0.05), s(POOL.PO4, 0.004),
     s(POOL.ON, 0.11), s(POOL.OP, 0.005), s(POOL.OC, 0.3), s(POOL.H2O, 0.63)],
    0.0, 0.075, [POOL.OC],
    0.02, 1e9,
    'Mineralises labile organic matter and returns N and P to available '
    + 'forms. No energy credit: this is a service performed by heterotrophs, '
    + 'funded by what they ingest, not a free lunch.'),

  // Anaerobic recovery is worse (0.55) and the remainder stays organic — which
  // is why anoxic detritus persists and must be dealt with somewhere else.
  rx('anaerobic decomposition', CAP.AEROBIC, 'decomposition',
    // FINDING 5 FIXED. This reaction emitted H2S but drew no organic sulfur, so
    // the sulfide was created rather than reduced from organic matter. Organic
    // sulfur is now a substrate with a matching coefficient.
    //
    // The coefficient is BIOMASS_STOICH[S] (0.006), matching nitrogen (0.16) and
    // phosphorus (0.009) exactly. It had been 0.012, twice tissue sulfur, which
    // declared detritus to be sulfur-enriched relative to living tissue without
    // saying so. Detritus and tissue now share one stoichiometry.
    [s(POOL.OC, 1), s(POOL.ON, 0.16), s(POOL.OP, 0.009), s(POOL.OS, 0.006)],
    [s(POOL.DIC, 0.55), s(POOL.NH4, 0.05), s(POOL.PO4, 0.004), s(POOL.H2S, 0.006),
     s(POOL.ON, 0.11), s(POOL.OP, 0.005), s(POOL.OC, 0.45), s(POOL.H2O, 0.275)],
    0.0, 0.045, [POOL.OC],
    0, 0.02,
    'Same mineralisation without O2, but carbon is recovered less completely '
    + 'and REDUCED SULFUR IS PRODUCED. This is how an anoxic zone manufactures '
    + 'the substrate for sulfate reducers and sulfur oxidisers — the coupling '
    + 'between families 3, 4 and 6. H and O close as water (0.275) and H2 gas '
    + '(0.214 -> 0.428 H); sulfide brings its own two H.',
    [{ element: E.H, coeff: 0.428 }]),

  // --- Family 5: nitrogen ---------------------------------------------------
  // NITRIFICATION IS ISOLATED — ABSENT FROM THE LIVE NETWORK.
  //
  // The pathway cannot be balanced under POOL_COMPOSITION: NH4 and NO3 are
  // single-element nitrogen carriers, so no product of this reaction can
  // receive the oxygen it must consume, and both ways to make it balance
  // break a mechanism with live dependants:
  //   (a) NO3 = N + 3 O forces denitrification — its only consumer — to shed
  //       that oxygen through organic carbon at ~15 C per 2 NO3: an absurd
  //       donor demand created by an accounting choice;
  //   (b) NH4 = N + 4 H makes that hydrogen appear from nowhere in every
  //       reaction that produces NH4 without a hydrogen source, sediment
  //       release above all, which would manufacture H at every step.
  //
  // chem/0.8.0 kept the reaction alive with its oxygen reduced to a presence
  // gate while it still earned energy and converted NH4 -> NO3. The Owner
  // review of 2026-10-18 found that a material mechanism departure — an
  // oxygen-consuming pathway drawing no oxidant — and accepted the isolation
  // fallback: the pathway is declared unsupported/disabled below, out of the
  // live array, with its historical stoichiometry preserved in
  // ISOLATED_REACTIONS rather than rewritten with invented matter.
  //
  // CONSEQUENCES. The reaction executes in no arm: no extent, no energy
  // income, no NH4 -> NO3 flux. `chemistryReactionOmit: 'nitrification'`
  // remains an accepted, name-resolvable selector whose omission is a
  // declared no-op, so the control/omission contrast is VACUOUS by
  // construction (G51/G54; CHEM-080-CONTRACT.md §3.1; CHO-081-RESULTS.md).
  // CAP.NITRIFY remains heritable but inert; a future pathway requires an
  // Owner decision.

  // 2 NO3 -> 0.6 NH4 + 1.4 N2(gas). The 1.4 is a real atmospheric export and
  // must be booked, or the nitrogen books appear to leak.
  rx('denitrification', CAP.DENITRIFY, 'nitrogen',
    [s(POOL.NO3, 2)],
    [s(POOL.NH4, 0.6)],
    0.12, 0.030, [POOL.NO3],
    0, 0.015,
    'NO3 -> N2 gas. The model\'s ONLY nitrogen export to atmosphere, and it '
    + 'requires anoxia. Nitrogen fixation is not modelled, so this is a real '
    + 'leak that an ecosystem must replace from weathering.',
    [{ element: E.N, coeff: 1.4 }]),

  // REMOVED as a separate reaction.
  //
  // Assimilation of inorganic N into an ORGANISM is `assimilate()` in
  // chemlife.ts, which claims NH4 from the pool into the organism's own stores.
  // Having a reaction that ALSO ran on the same capability drew NH4 a second
  // time and deposited the nitrogen in the ON pool, where no organism ever
  // claimed it: nitrogen left NH4 twice and arrived once. That was the entire
  // remaining +56% nitrogen residual.
  //
  // The capability bit (CAP.N_ASSIM) is retained and still gates assimilation;
  // only the duplicate pool-to-pool path is gone.

  // --- Family 6: sulfur ----------------------------------------------------
  // THE DONOR IS NOW DRAWN. The note has always declared organic carbon as
  // this reaction's electron donor, but no carbon substrate was listed: the
  // reaction reduced sulfate and created sulfide's two hydrogen atoms from
  // nothing (+2.0 H per unit extent, the sulfur family's share of the H
  // residual). Sulfide carries its H (composition contract), so the reduction
  // needs a reductant; 2.5 OC supplies it. The carbon leaves as DIC and the
  // surplus H and O as water: S 1 -> 1; C 2.5 -> 2.5; H 4.5 = 2 + 2.5;
  // O 1.25 = 1.25. The carbon cost is high because the donor is bulk organic
  // matter and the acceptor is tracked as sulfur alone, not as the full
  // SO4(2-) formula — a declared abstraction, not a kinetic claim.
  rx('sulfate reduction', CAP.SULF_REDUCE, 'sulfur',
    [s(POOL.SO4, 1), s(POOL.OC, 2.5)],
    [s(POOL.H2S, 1), s(POOL.DIC, 2.5), s(POOL.H2O, 1.25)],
    0.08, 0.022, [POOL.SO4],
    0, 0.02,
    'Reduces sulfate to sulfide under anoxia, using organic carbon as the '
    + 'electron donor. Sulfate is abundant and near-useless without this; '
    + 'sulfide is the valuable product. The donor is now a real substrate, so '
    + 'a sulfate reducer competes for the same labile carbon as every other '
    + 'heterotroph.'),

  rx('sulfur oxidation', CAP.SULF_OXIDIZE, 'sulfur',
    // FINDING 5 FIXED. DIC was a zero-coefficient PRODUCT placeholder, so the
    // 0.42 mol of organic carbon this produces had no substrate. Chemolitho-
    // autotrophy fixes CO2 with the energy released by oxidising sulfide, so
    // DIC is now a substrate with a coefficient matching the carbon fixed.
    // H AND O RECONCILED. Sulfide brings 2 H; the 0.42 C fixed into organic
    // matter carries 0.756 H and 0.21 O. The remainder leaves as water
    // (0.622 = 1.244 H + 0.622 O), and the O2 draw follows from it:
    //   2 = 0.756 + 1.244;  2b = 0.21 + 0.622 -> b = 0.416.
    // The earlier 1.1 O2 draw was 0.684 O more than any product could hold —
    // the largest single term in the oxygen residual.
    [s(POOL.H2S, 1), s(POOL.O2, 0.416), s(POOL.DIC, 0.42)],
    [s(POOL.SO4, 1), s(POOL.OC, 0.42), s(POOL.H2O, 0.622)],
    0.74, 0.030, [POOL.H2S],
    0.02, 1e9,
    'CHIMOSYNTHESIS. Oxidises sulfide for energy and fixes DIC as carbon '
    + 'using that energy, needing neither light nor organic food. Creates a '
    + 'producer that lives where photosynthesis cannot: at the oxic/anoxic '
    + 'boundary, on sulfide.'),

  // --- Family 7: iron -------------------------------------------------------
  rx('iron oxidation', CAP.FE_CHEMO, 'iron',
    // FINDING 5 FIXED, same defect: 0.34 mol of organic carbon per unit extent
    // was produced with no carbon substrate anywhere in the reaction. DIC is
    // now drawn to supply the carbon that is fixed.
    // H AND O RECONCILED, with Fe3 as the mineral sink the composition
    // contract declares (Fe2O3: 1.5 O per Fe). Fe2 brings no H, so the H the
    // fixed carbon needs comes from water; the balance then fixes the O2
    // draw: H 0.612 = 0.612 (from 0.306 H2O); O 0.306 + 2b = 1.5 + 0.17 ->
    // b = 0.682.
    [s(POOL.FE2, 1), s(POOL.O2, 0.682), s(POOL.DIC, 0.34), s(POOL.H2O, 0.306)],
    [s(POOL.FE3, 1), s(POOL.OC, 0.34)],
    0.58, 0.026, [POOL.FE2],
    0.015, 1e9,
    'CHIMOSYNTHESIS on ferrous iron. Fe2 is scarce and Fe3 is an '
    + 'immobile sink, so this pathway both feeds on a limiting trace element '
    + 'and permanently sequesters it.'),

  rx('iron uptake', CAP.FE_UPTAKE, 'iron',
    [s(POOL.FE2, 1)],
    [s(POOL.OFE, 1)],
    0.0, 0.50, [POOL.FE2],
    0, 1e9,
    'Fe is a cofactor, not structure: uptake consumes Fe2 for a tiny molar '
    + 'demand. Losing it does not prevent growth directly — it prevents '
    + 'reactions that need Fe-dependent machinery.'),

  // --- Structural litter and sediment ---------------------------------------
  // Litter carries its own nitrogen in LN, so mineralising it draws LN. The
  // earlier form produced NH4 from carbon alone, creating nitrogen outright.
  // Only part of the litter is solubilised; the rest stays as refractory litter,
  // carrying its own N and P back into the litter pools. The earlier form
  // destroyed 0.55 C and 0.07 N outright and conjured phosphorus from nothing.
  rx('ligninolysis', CAP.LIGNOLYTIC, 'decomposition',
    // H AND O COMPLETE THE BALANCE, as in the labile family: the 0.55
    // refractory remainder carries 0.99 H and 0.275 O of the original 1.8 and
    // 0.5; the difference leaves as water (0.225) and H2 gas (0.18 -> 0.36 H).
    [s(POOL.LC, 1), s(POOL.LN, 0.08), s(POOL.LP, 0.001)],
    [s(POOL.DIC, 0.45), s(POOL.NH4, 0.012), s(POOL.PO4, 0.001),
     s(POOL.LC, 0.55), s(POOL.LN, 0.068), s(POOL.H2O, 0.225)],
    0.0, 0.0035, [POOL.LC],
    0, 1e9,
    'Structural litter is refractory by construction: its rate is two orders '
    + 'of magnitude below labile decomposition. Most of it does NOT return to '
    + 'the water column — it buries, and only weathering brings it back. Litter '
    + 'is therefore a long-timescale sink, not a recycled pool.',
    [{ element: E.H, coeff: 0.36 }]),

  // Likewise: sediment nitrogen lives in SN and must be drawn, not conjured.
  // Weathering solubilises a fraction; the remainder stays buried. The earlier
  // form destroyed 0.3 C and released phosphorus that was never drawn from SN
  // or SP, so it was created from nothing.
  rx('sediment release', CAP.SEDIMENT_ACCESS, 'sediment',
    [s(POOL.SC, 1), s(POOL.SN, 0.02), s(POOL.SP, 0.006)],
    [s(POOL.OC, 0.7), s(POOL.PO4, 0.004), s(POOL.NH4, 0.02),
     s(POOL.SC, 0.3), s(POOL.SP, 0.002)],
    0.0, 0.0022, [POOL.SC],
    0, 1e9,
    'Weathering and burial turnover. Extremely slow, and the only route by '
    + 'which buried P returns. P limitation in this model is therefore '
    + 'partly a geological timescale problem.'),
];

/**
 * Reactions declared UNSUPPORTED and isolated from the live network.
 *
 * A pathway lands here when the declared composition vocabulary cannot carry
 * its transfers and every balancing alternative breaks a live mechanism.
 * Isolation is a RECORD, not a switch: nothing in the engine consults this
 * list to decide what to run. It exists so a removed pathway stays
 * inspectable, and G54 asserts that no isolated name is live, that the
 * isolated nitrification pathway books nothing in a cell that could support
 * it, and that its omission selector is a declared no-op.
 */
export interface IsolatedReaction {
  readonly name: ReactionOmission;
  readonly cap: CAP;
  readonly family: string;
  readonly substrates: readonly Sub[];
  readonly products: readonly Sub[];
  readonly energy: number;
  readonly vmax: number;
  readonly limits: readonly POOL[];
  readonly minO2: number;
  readonly maxO2: number;
  readonly note: string;
  readonly reason: string;
}

export const ISOLATED_REACTIONS: readonly IsolatedReaction[] = [
  {
    name: 'nitrification',
    cap: CAP.NITRIFY,
    family: 'nitrogen',
    substrates: [s(POOL.NH4, 1)],
    products: [s(POOL.NO3, 1)],
    energy: 0.10,
    vmax: 0.040,
    limits: [POOL.NH4],
    minO2: 0.02,
    maxO2: 1e9,
    note: 'Oxidises ammonium to nitrate. Requires oxygen, so it happens at '
      + 'oxic interfaces. Nitrate is not directly usable by most of this '
      + 'ecosystem — it must be reduced again, which is what makes the '
      + 'anaerobic pathway valuable.',
    reason: 'Cannot close under POOL_COMPOSITION: NH4 and NO3 are '
      + 'single-element nitrogen carriers, so the oxidant draw has no product '
      + 'to reach; changing either carrier breaks denitrification (its only '
      + 'consumer would need ~15 C per 2 NO3 to shed the oxygen) or the '
      + 'sediment-release path (H manufactured from nothing). At chem/0.8.0 '
      + 'the pathway was kept live with its oxygen reduced to a presence gate '
      + 'while still earning energy; the Owner review of 2026-10-18 found '
      + 'that a material mechanism departure and accepted isolation as the '
      + 'fallback. Recorded in CHO-081-RESULTS.md and CHEM-080-CONTRACT.md.',
  },
];

export const RX_COUNT = REACTIONS.length;

/**
 * Index reactions by the capability that enables them, for fast dispatch.
 *
 * Keyed by CAPABILITY BIT INDEX, not by the raw CAP value. The capabilities are
 * bit flags (SEDIMENT_ACCESS is 1<<11 = 2048), so indexing an array by the flag
 * itself runs off the end and crashes at module load.
 */
export const RX_BY_CAP: readonly number[][] = (() => {
  const m: number[][] = [];
  for (let c = 0; c < CAP_COUNT; c++) m[c] = [];
  for (const r of REACTIONS) m[capBit(r.cap)].push(r.id);
  return m;
})();

function capBit(cap: CAP): number {
  let c = 0;
  let m = cap;
  while (m > 1) { m >>= 1; c++; }
  return c;
}

/**
 * Per-reaction evidence counters.
 *
 * Separate from any energy or matter total on purpose: "sulfur oxidation
 * occurred" is a claim about extent executed, and mixing it into the energy
 * ledger would make it unfalsifiable.
 */
export interface MetabolicEvidence {
  /** Total extent executed, summed over all runs. */
  readonly extent: Float64Array;
  /** Number of distinct organism-ticks that ran the reaction. */
  readonly runs: Float64Array;
  /** Total energy credited by the reaction. */
  readonly energy: Float64Array;
  /** Extent that ran but was capped by substrate availability, not capability. */
  readonly substrateLimited: Float64Array;
}

export function newMetabolicEvidence(): MetabolicEvidence {
  const n = RX_COUNT;
  return {
    extent: new Float64Array(n),
    runs: new Float64Array(n),
    energy: new Float64Array(n),
    substrateLimited: new Float64Array(n),
  };
}

export function reactionById(id: number): Reaction {
  return REACTIONS[id];
}

/**
 * Rate law for one reaction in one cell.
 *
 * Returns the extent to execute this tick, which is ALSO the element transfer
 * amount — so a reaction cannot move matter it did not compute a rate for.
 *
 * `capStrength` is how strongly the organism expresses the capability; a
 * partial expression gives a proportionally lower rate. That is what lets
 * developmental onset and module magnitude matter biologically rather than as
 * a boolean gate.
 */
export function reactionExtent(
  r: Reaction,
  chem: Chemistry,
  cell: number,
  capStrength: number,
  out: Float64Array,
  light = 1,
  budgetHits?: Float64Array,
): number {
  const o2 = chem.fields[POOL.O2].data[cell];
  if (o2 < r.minO2) return 0;
  if (o2 > r.maxO2) return 0;

  let rate = r.vmax * capStrength;

  // LIGHT. A light-driven capability cannot run at full rate in darkness.
  // `light` is the LOCAL value the rest of the simulation already computes —
  // global forcing x habitat shade x Beer-Lambert self-shading — so the
  // chemistry path and the legacy path see one environment, not two.
  if (LIGHT_DRIVEN.has(r.cap)) {
    rate *= light > 0 ? light : 0;
    if (rate <= 1e-12) return 0;
  }

  for (const pool of r.limits) {
    const c = chem.remaining(pool, cell);
    // Monod half-saturation is expressed relative to the reaction's own vmax so
    // that a single convention covers pools spanning many orders of magnitude.
    // DECLARED IDEALISATION: a real Km is a property of a transporter, not of
    // the reaction it serves.
    const km = Math.max(1e-9, r.vmax * 0.02);
    rate *= c / (km + c);
    if (rate <= 1e-12) return 0;
  }
  if (rate <= 1e-12) return 0;

  // Substrate availability caps the extent, read through `remaining()` so that
  // organisms earlier in this tick's sweep cannot take the same pool twice.
  // Without this, N organisms in one cell each read the full pre-tick
  // concentration and their combined draw is N times the pool.
  for (const sub of r.substrates) {
    if (sub.coeff <= 0) continue;
    // Gross substrate budget, not NET. `remaining()` already accounts for
    // CLAIMS made by organisms earlier this tick. This organism additionally
    // carries a per-tick GROSS budget: every reaction decrements it as it
    // executes. Using `out[pool]` here was unsafe because a reaction producing
    // the same pool could erase an earlier reaction's draw in the net vector,
    // then the later draw saw the full starting inventory again. Two reaction
    // extents could therefore exceed the real cell together and their products
    // and energy were credited at full value while settle() clamped the
    // overdraw. The fixed REACTIONS order is the declared priority rule.
    // Cross-organism, per-cell, one-snapshot budget: pre-tick inventory minus
    // every gross draw already reserved in this cell this tick. Products never
    // refill it, so a reaction that returns half its substrate cannot lend that
    // half to the next organism before settle().
    const avail = chem.remainingForReaction(sub.pool, cell);
    const budgetBound = (avail > 0 ? avail : 0) / sub.coeff;
    if (budgetBound < rate) {
      if (budgetHits) budgetHits[sub.pool]++;
      rate = budgetBound;
    }
  }
  if (rate <= 1e-12) return 0;

  for (const sub of r.substrates) {
    const drawn = sub.coeff * rate;
    out[sub.pool] -= drawn;
    chem.claimGross(sub.pool, cell, drawn);
  }
  for (const prod of r.products) out[prod.pool] += prod.coeff * rate;
  return rate;
}

/** Families present, for reporting and for the evidence ladder. */
export function reactionFamilies(): string[] {
  const seen = new Set<string>();
  for (const r of REACTIONS) seen.add(r.family);
  return [...seen];
}

/** Human-readable capability names, indexed by bit position. */
/**
 * Capabilities whose rate is set by LIGHT rather than by substrate.
 *
 * Photosynthesis is described as light-driven but previously executed on
 * chemistry and capability alone: it ran at full rate at midnight and in a
 * fully shaded cell, and the only thing that stopped it was DIC running out.
 * That is not a light-driven process, it is a carbon-limited one wearing the
 * name — and it means the model's energy income was completely decoupled from
 * the day/night and canopy structure the rest of the simulation computes.
 *
 * Declared as a set rather than a field on `rx()` so that adding it cannot
 * silently leave the existing reactions at their previous, ungated behaviour:
 * a new reaction is light-driven only if it is named here, and the gate below
 * fails loudly for any capability listed without a rate.
 */
export const LIGHT_DRIVEN: ReadonlySet<number> = new Set([CAP.PHOTOSYNTHESIS]);

export const CAP_NAMES: readonly string[] = [
  'photosynthesis', 'aerobic', 'ferment', 'nitrify', 'denitrify',
  'sulfateReduce', 'sulfurOxidize', 'feUptake', 'feChemo', 'nAssim',
  'lignolytic', 'sedimentAccess',
];

/**
 * Fold a bitmask into a strength map, so callers can ask "how strongly is this
 * expressed" without reconstructing bit arithmetic at every call site.
 */
export function capStrength(caps: number, r: Reaction): number {
  if ((caps & r.cap) === 0) return 0;
  return 1;
}

/**
 * Mobility of a pool — exposed so callers can reason about whether a
 * concentration is locally meaningful or globally mixed.
 */
export function poolMobility(pool: POOL): CLASS {
  return pool === POOL.LC || pool === POOL.LN || pool === POOL.LP || pool === POOL.LS
    || pool === POOL.SC || pool === POOL.SN || pool === POOL.SP
    || pool === POOL.SS || pool === POOL.SFE || pool === POOL.FE3
    ? CLASS.IMMOBILE : pool === POOL.OC || pool === POOL.ON || pool === POOL.OP
      || pool === POOL.OS || pool === POOL.OFE || pool === POOL.FE2
      ? CLASS.SEMI : CLASS.DISSOLVED;
}

/**
 * Capability bits conferred by each genome module kind.
 *
 * This table is the entire bridge between the inherited genome and the reaction
 * network. Because it maps onto the EXISTING module vocabulary, a metabolic
 * capability is inherited by duplication, deleted by deletion, mixed by
 * crossover, switched on by developmental onset and shed under energy stress —
 * all through machinery that already existed and is already gated. No second
 * heritable system was built.
 *
 * Index is GENE_MODULE. Zero means the kind confers no metabolic capability.
 */
import { GENE_MODULE } from './modgenome.js';

export const MODULE_CAPABILITY: readonly number[] = (() => {
  const m: number[] = new Array(15).fill(0);
  m[GENE_MODULE.PHOTOSYNTHETIC] = CAP.PHOTOSYNTHESIS;
  m[GENE_MODULE.HETERO_AEROBIC] = CAP.AEROBIC;
  m[GENE_MODULE.ANAEROBIC] = CAP.FERMENT | CAP.DENITRIFY;
  m[GENE_MODULE.CHEMOLITHOTROPH] = CAP.SULF_OXIDIZE | CAP.FE_CHEMO;
  m[GENE_MODULE.SULFUR_REDUCTOR] = CAP.SULF_REDUCE;
  m[GENE_MODULE.NITRIFIER] = CAP.NITRIFY | CAP.N_ASSIM;
  m[GENE_MODULE.SAPROTROPH] = CAP.LIGNOLYTIC | CAP.SEDIMENT_ACCESS;
  m[GENE_MODULE.TRACE_UPTAKE] = CAP.FE_UPTAKE;
  return m;
})();

/**
 * Derive an organism's capability mask and per-capability expression strength
 * from its module block.
 *
 * STRENGTH, NOT JUST PRESENCE. A capability that is partially expressed runs at
 * a proportionally reduced rate. That is what lets developmental onset and
 * module magnitude have biological consequence instead of acting as a boolean
 * switch, and it is why the same mechanism serves v1 trait modules unchanged.
 */
export function capabilitiesFromModules(
  modules: Float32Array, count: number, baseSlot: number, stride: number,
  kindIdx: number, magIdx: number, out: Float32Array,
): void {
  out.fill(0);
  for (let i = 0; i < count; i++) {
    const off = baseSlot + i * stride;
    const kind = modules[off + kindIdx] | 0;
    const mag = modules[off + magIdx];
    if (mag <= 0) continue;
    const caps = MODULE_CAPABILITY[kind] ?? 0;
    if (caps === 0) continue;
    // Scale each capability by magnitude, saturating at 1 so a stack of
    // modules does not grant unbounded expression.
    for (let c = 0; c < CAP_COUNT; c++) {
      const bit = 1 << c;
      if (caps & bit) out[c] = Math.min(1, out[c] + mag);
    }
  }
}

/** Pack a per-capability strength vector into a single mask (present/absent). */
export function maskFromStrength(strength: Float32Array): number {
  let m = 0;
  for (let c = 0; c < CAP_COUNT; c++) if (strength[c] > 0) m |= 1 << c;
  return m;
}

/**
 * How strongly a capability is expressed, from the packed mask alone.
 *
 * Falls back to 1 when only the mask is available. Used by probes that report a
 * repertoire rather than a physiology.
 */
export function strengthOf(strength: Float32Array, cap: CAP): number {
  const c = capIndex(cap);
  return c < 0 ? 0 : strength[c];
}

function capIndex(cap: CAP): number {
  let c = 0;
  let m = cap;
  while (m > 1) { m >>= 1; c++; }
  return c;
}

/** Count of capabilities present, for diversity metrics. */
export function repertoireWidth(mask: number): number {
  let n = 0, m = mask;
  while (m) { n += m & 1; m >>>= 1; }
  return n;
}
