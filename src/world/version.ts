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

/** Identifier for the credibility-check suite that accompanies this version. */
export const GATE_SUITE_VERSION = 'gates/0.4.0';