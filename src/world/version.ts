/**
 * Engine version for the experimental evolution POC.
 *
 * This is the first term of the reproducibility contract:
 *
 *     engine version + resolved config + seed + command sequence
 *       = reproducible run *within this fixed experimental version*
 *
 * The version is bumped whenever any file in `src/` changes in a way that
 * could alter simulation output. It is NOT a claim of production determinism:
 * see REPORT.md for the cross-platform caveats.
 */

/**
 * Bump on any behavioural change to the simulation.
 *
 * 0.7.0 corrects the legacy coarse-canopy lookup at the Owner's explicit
 * authorisation and re-pins parity. See the version constant for detail.
 *
 * 0.6.0 closes the energy accounting defects found by independent review
 * (issue #2). Parity is re-pinned: 517 -> 808/159/58, 24601 -> 558/290/96.
 * All figures recorded under 0.5.0 describe a LEAKY engine — decomposer
 * photosynthesis was never actually gated under `--zero` — and are earlier-
 * engine evidence, not current behaviour.
 *
 * 0.5.0 corrects three defects found by independent review:
 *   - resource-gradient ascent compared north against east with no south
 *     sample, and probed east on the diagonal;
 *   - predation assimilation was applied twice (effective yield was
 *     carnivoreDigestion squared rather than carnivoreDigestion);
 *   - mating matured from a one-sided submission, and a mutually-recorded
 *     pair was resolved twice, double-charging onMate().
 *
 * All figures recorded under 0.4.1 describe the DEFECTIVE semantics and are
 * provenance only. See REPORT.md.
 */
/**
 * 0.7.0 — OWNER-AUTHORISED CANOPY CORRECTION, 2026-10-13.
 *
 * The legacy photosynthesis path indexed the COARSE canopy array `shadeMass`
 * (shadeCols x shadeRows, shadeGrain 4) with a FULL-RESOLUTION substrate cell.
 * With the default grain that read an unrelated cell for 15/16 of the world and
 * ran off the end of the array for the rest, so Beer-Lambert self-shading was
 * effectively disabled in that path and producer income had no density
 * dependence. Parity is re-pinned: 517 -> 492/136/74, 24601 -> 296/171/74.
 *
 * The retired 0.6.0 pins 808/159/58 and 558/290/96 were measured THROUGH the
 * defect. Every figure recorded under 0.6.0 is provenance, not current
 * behaviour.
 *
 * Two gates were exposed by the correction and changed to test what they name:
 * G12 asserted a biotic flux on the FINAL tick, and the corrected ecosystem no
 * longer sustains that loop by ~tick 100; G12 now asserts the read/clear
 * ORDERING it exists to catch. G28 asserted NET standing tissue rises, and the
 * corrected balance has deaths exceeding growth inside the window; G28 now
 * asserts growth occurs, measured as the largest single-organism tissue gain.
 * Neither weakening is cosmetic — both prior assertions were ecological claims
 * the gates never made.
 */
// Reconciliation with main's 0.6.3: fasting tolerance, mating/radiation fixes,
// per-pool nutrient caps and observers combined with the canopy correction.
// Earlier 0.7.0 and 0.6.3 panels are provenance, not this engine's live pins.
export const WORLD_ENGINE_VERSION = 'ts-evo-poc/0.8.0';

/**
 * Semantics version for the chemistry-enabled model.
 *
 * SEPARATE FROM THE BASE VERSION ON PURPOSE. Every figure in the evidence base
 * is recorded against `ts-evo-poc/0.6.0` with chemistry unset, and the chemistry
 * subsystem is a null-default diagnostic precisely so it cannot perturb those
 * pins. That isolation means one version string was covering TWO different sets
 * of simulation semantics: a run with chemistry off and a run with chemistry on
 * reported the same identity while differing in what a reaction does, how
 * matter is booked, and what "growth" even means.
 *
 * That is the exact failure the pinned-version discipline exists to prevent.
 * Under 0.5.0 this repository published an 89% carbon figure for an engine whose
 * carbon was within 2%, because the defect changed the numbers without changing
 * the name. A changed-semantics run sharing an identity with the old one is the
 * same failure in a new place, and it would be invisible to any consumer that
 * reads only the version.
 *
 * Bumped to 0.7.0 for the keyed accounting semantics (conservation accounting closed,
 * photosynthesis gated on local light, detrital sulfur aligned to tissue stoichiometry).
 *
 * chem/0.7.1 adds the causal energy reconciliation, H/O death release,
 * and the diagnostic bridge ledger booking. These are accounting-identity changes
 * while preserving chemistry-off runs, so it is a chemistry-component bump.
 */
// Owner D1/D2, 2026-10-15: dimensionally valid limiting-element growth and
// linear macronutrient offspring demand. All chem/0.7.7 panels are historical;
// chemistry-unset base semantics and parity remain unchanged.
export const CHEMISTRY_ENGINE_VERSION = 'chem/0.7.8';

/**
 * Whether the chemistry semantics themselves changed in the 0.7.0 correction.
 *
 * They did not. The chemistry light path already mapped substrate cells onto
 * the coarse canopy grid correctly, so correcting the LEGACY lookup left the
 * chemistry light term unchanged. What moved is the BASE component of the
 * composite identity, so a chemistry-on run is now
 * `ts-evo-poc/0.7.0+chem/0.7.0` — a different string, and therefore
 * distinguishable from every pre-correction chemistry run, without claiming the
 * chemistry subsystem itself changed.
 */

/**
 * The identity a run actually has, given its resolved configuration.
 *
 * A chemistry-enabled run is a DIFFERENT MODEL, not a configuration of the
 * pinned one, and is reported as such. Evidence produced under either string
 * cannot be silently compared against the other, because the strings differ.
 */
export function runIdentity(chemistryEnabled: boolean): string {
  return chemistryEnabled
    ? `${WORLD_ENGINE_VERSION}+${CHEMISTRY_ENGINE_VERSION}`
    : WORLD_ENGINE_VERSION;
}

/** Identifier for the credibility-check suite that accompanies this version. */
/**
 * 0.5.0 — two gates changed what they assert (G12: ordering not a sustained
 * cycle; G28: growth occurs, not net standing stock) and G34 was added for the
 * Owner-authorised canopy correction. The suite's semantics changed, so a
 * result recorded under gates/0.4.0 is not comparable without re-running.
 *
 * gates/0.7.6 covers the current suite through G40 with split conservation
 * tolerances, a discriminating 1:1 H/O uptake control, and the three-arm
 * cross-organism shared-budget control.
 */
// Combined chemistry and main validation suite, including G41-G47.
export const GATE_SUITE_VERSION = 'gates/0.8.1';
