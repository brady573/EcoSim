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
/** Bump on any behavioural change to the simulation. */
export const WORLD_ENGINE_VERSION = 'ts-evo-poc/0.4.1';
/** Identifier for the credibility-check suite that accompanies this version. */
export const GATE_SUITE_VERSION = 'gates/0.1.0';
