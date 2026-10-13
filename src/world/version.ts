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
export const WORLD_ENGINE_VERSION = 'ts-evo-poc/0.6.0';

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
 * Bumped to 0.7.0 for the chemistry semantics as they now stand: conservation
 * accounting closed, photosynthesis gated on local light, chemical energy
 * income and growth expenditure booked, detrital sulfur aligned to tissue
 * stoichiometry.
 */
export const CHEMISTRY_ENGINE_VERSION = 'chem/0.7.0';

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
export const GATE_SUITE_VERSION = 'gates/0.4.0';