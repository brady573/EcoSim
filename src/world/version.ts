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
 * 0.6.2 corrects two behavioural defects found by independent review:
 *   - radiationMultiplier dormant coupling inverted intent: at 0 dormancy
 *     produced 0x mutation (should be 1x background). Fixed to couple only
 *     the excess over 1x, so 0 dormancy = 1x, full dormant share = full mult.
 *   - Mating logic: sensed mateTarget skipped asexual breeding even when no
 *     mutual mating occurred. Fixed to only skip asexual for slots with a
 *     confirmed successful mating this tick (surplus-checked, reciprocal).
 *     Asexual is now always available as fallback; mate-seeking genotypes
 *     breed slower asexually, creating a genuine trade-off.
 *   Parity re-pinned: 517 -> 882/170/65, 24601 -> 563/279/90.
 *
 * 0.6.1 grants fasting tolerance to starvation damage (Owner constraint
 * 2026-10-12: body reserves buffer brief deficits). Damage ramps 0 -> full
 * over STARVE_GRACE_TICKS consecutive-deficit ticks; sustained deficit still
 * kills at full rate. Parity is re-pinned below; all figures recorded under
 * 0.6.0 describe the instantaneous-damage semantics and are earlier-engine
 * evidence, not current behaviour.
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
export const WORLD_ENGINE_VERSION = 'ts-evo-poc/0.6.2';

/** Identifier for the credibility-check suite that accompanies this version. */
export const GATE_SUITE_VERSION = 'gates/0.4.0';