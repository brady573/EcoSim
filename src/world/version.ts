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
 * 0.6.5 adds O1 behaviour WHEN ITS KNOB IS SET: `phenoMineralReturn` scales
 * the offered mineralization return per expressed donor class, changing
 * nutrient flow and downstream populations in that configured arm. Knob-unset
 * runs are bit-identical to 0.6.4 (C1 pins prove it), so the pair 517 ->
 * 882/170/65, 24601 -> 563/279/90 (500 ticks) still holds — no new
 * retirement-chain entry, no re-pin. A versioned configured experimental
 * world is therefore distinguishable from the 0.6.4 O3 measurement identity:
 * 0.6.4 observations describe O3-books-only runs; any `phenoMineralReturn`
 * figure belongs to 0.6.5 and must be source-qualified as such.
 *
 * 0.6.4 is a MEASUREMENT re-base, not a behavioural change. Engine semantics,
 * seed parity and reproducibility are untouched: the pools themselves, the
 * writer paths, and every default are the same, and the pinned pair 517 ->
 * 882/170/65, 24601 -> 563/279/90 (500 ticks) still holds — no new
 * retirement-chain entry, no re-pin.
 *
 * What this release changes is the instrumentation the probes read:
 *   - `getFluxSnapshot()` exposes a fifth family,
 *     `bioticMineralizationByPheno`, partitioning every biotic-mineralization
 *     book by expressed donor class (0=carrionOnly, 1=recalcOnly, 2=dual,
 *     3=neither; see `classifyMineralPheno` in `src/bio/role.ts` and G33).
 *     The existing four families are byte-identical: the pheno books are
 *     written from the same clamp locals through one optional mirror branch
 *     (excretion callers omit it), add no RNG draw, change no field write,
 *     and are excluded from `hashState`. The partition identity
 *     `old[g][p][src] == sum over classes` is asserted per cell by G33.
 *     A living-organism census is not an event-flux measurement; the census
 *     denominators and these books are deliberately different instruments.
 *
 * 0.6.3 is a MEASUREMENT re-base, not a behavioural change. Engine semantics,
 * seed parity and reproducibility are untouched: the pools themselves, the
 * writer paths, and every default are the same, and the pinned pair 517 ->
 * 882/170/65, 24601 -> 563/279/90 (500 ticks) still holds — no new
 * retirement-chain entry, no re-pin.
 *
 * What this release changes is the instrumentation the probes read:
 *   - `getFluxSnapshot()` exposes four books per return (attempted, accepted,
 *     capLoss, eviction) under one `ReturnBooks<T>` grouping, instead of a
 *     single signed "returns" number computed as `min(cap, before + in) -
 *     before`, which went NEGATIVE whenever a cell was already over its own
 *     cap when a return arrived — routine, because diffusion runs after the
 *     regeneration clamp — so ceiling deletion was being reported as
 *     biological recycling. The returned `accepted` quantity is the same
 *     `Math.min(cap, before + amount)` arithmetic as before; what moved is
 *     what is OBSERVED, not what is WRITTEN. The exact identities hold in
 *     the float64 clamp arithmetic:
 *         accepted - eviction == observed delta
 *         attempted == accepted + capLoss
 *     The pools are Float32Array, so field agreement carries float32 write
 *     rounding (~1e-8 relative, measured end-to-end by G31).
 *
 *   - ReproProbe accepts labelled sexual events for matingdiag. ReproProbeLog
 *     ignores these events, preserving its asexual-lottery metrics.
 *
 * Historical note: the per-pool RETURN cap (configuration multipliers [1.0, 0.78,
 * 0.62] instead of one flat `nutrientPerCell * fertility`) was corrected under
 * 0.6.2 and pinned by G30 at `gates/0.4.0`. 0.6.2 saturation figures are valid
 * provenance for that corrected engine. Earlier flat-cap measurements remain
 * evidence of the earlier source snapshot, not of the corrected paths.
 * No nutrient-write arithmetic changes relative to this PR's reviewed head;
 * existing corrected saturation runs do not require biological remeasurement.
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
export const WORLD_ENGINE_VERSION = 'ts-evo-poc/0.6.5';

/**
 * Identifier for the credibility-check suite. G30 (per-pool nutrient cap on
 * return paths) shipped with gates/0.4.0; G31 and G32 (the book-level checks)
 * with gates/0.5.0; G33 (phenotype-partitioned mineralization books) with
 * gates/0.6.0; G34 (O1 phenotype-class suppression) with gates/0.7.0.
 */
export const GATE_SUITE_VERSION = 'gates/0.7.0';
