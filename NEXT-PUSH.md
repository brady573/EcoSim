# Next Push — 3×3 emergent classes + balance first

**Status:** Owner-approved direction, 2026-10-09. RoI numbering: guilds by energy
source, classes as emergent strategy clusters in trait space (never assigned
boxes; no-species-table rule retained). Recorded in Scientific Method MCP case
`66d8c7ba`.

> **Provenance note (2026-10-10).** The MCP case reference above is retained as
> written but no longer resolves: the MCP was retired by the Owner on
> 2026-10-20. The direction itself stands. The "balance first" ordering below
> has since been overtaken by a measured dependency ladder — see `REPORT.md`
> entries for the sealed zeroed baseline and the 18-seed rungs — which reached
> the same conclusion (no class work until a rung produces three-guild worlds
> without monoculture or extinction).

## Order (Owner decision): balance first

No class work lands until the tree shows genuine density dependence. Rationale:
new strategies developed on an unbounded tree produce uninterpretable results
(is a behavior failing, or is nothing hungry?). Balance fixes change biological
parameters, so each candidate mechanism returns to the Owner before landing.

## Balance-first starting state (2026-10-09, from REPORT history)

Not from scratch. Density dependence EXISTS (self-shading with Beer-Lambert
canopy, producer clumping via two-mode dispersal, nutrient drawdown, grazer
damage fix, herding). The 2400-tick baseline is a success (all guilds present
on 8/9 seeds under the combined winner: photox4 + seeding + dormancy + spores).
What is missing is LONG-RUN self-limitation: durable 2/9 at 4800 ticks, with
collapse modes overgrowth (24601/31415/77031), competitive exclusion (517),
fade (99991), runaway (42). Every fix so far overshoots on some seeds — no
guild has self-limiting feedback. Prior failures recorded so none are retried
blind: 1:1 shading can't bind at sparse densities; coarse canopy saturates;
nutrient cuts starve consumers (same-energy coupling); graze-damage fix helped
but didn't restore guilds.

## Balance-first candidate steps (each needs Owner approval — biology changes)

- D. Diagnostic-first (no bio changes): characterize what tips runs into each
  collapse mode using short bounded runs. Recommended immediate step.
- A. Dormancy-with-senescence for hoarding seeds (targets overgrowth mode).
- B. Photo between 2x-4x for exclusion seeds (targets 517-type exclusion).
- C. Wire dead disturbance channels (if still dead) as episodic brakes.
- Deferred from earlier: exclusive litter + deterministic growth (steps 3-4),
  entry-barrier lowering for unseeded emergence.

## The nine (strawman → approved with edits as noted)

| Guild | Class 1 | Class 2 | Class 3 | Nature grounding |
|---|---|---|---|---|
| Producers | Competitor-like: capture hard, sit still | Stress-tolerator-like: endure poor ground | Ruderal-like: chase disturbance, seed far | Grime CSR triangle (competitors / stress-tolerators / ruderals) |
| Consumers | Herbivores | Predators | Scavengers | Given by Owner |
| Decomposers | Opportunist-like: fresh falls, boom-bust | Fragmenter-like: mobile, shred + process | Structural-specialist-like: sessile, crack litter | Litter succession: sugar fungi/bacteria → fauna fragmenters → white-rot specialists |

Note: fragmenters straddle the consumer/decomposer line by nature (they are
animals). Emergent clusters handle this: an organism may sit between guilds and
render mid-blend. This is intended, not a classification failure.

## Visibility rule (Owner decision)

Continuous color gradient from strategy weights, not discrete per-guild colors.
Each class gets an anchor color; each organism renders as the weighted blend of
its anchors; per-pixel aggregation keeps dominant-blend-wins, density brightness,
and dormant slate (slate is organism *state*, not strategy). Legend becomes
"pure colors = pure strategies." Presentation-only: reads sim state, never
writes it; determinism untouched. Implementation home: shared pixel renderer
(`src/trace/pixels.ts` + app lerp mirror).

## What counts as a real class (acceptance sketch, thresholds Owner-set)

A class counts when it is (a) a detectable cluster in trait space, (b)
persistent over time rather than a flicker, and (c) visibly distinguishable.
Numeric thresholds for "persistent" and "detectable" are Owner decisions, not
yet set — deliberately.

## Open questions (return to Owner)

- Numeric persistence/detectability thresholds (only when a verdict matters).
- Whether the unclamped mineralization deposit should respect caps (modeling
  call; flagged 2026-10-09, no defect alleged).
- Balance-first candidate mechanisms (diagnosis in progress; each returns for
  approval before any biological parameter changes).

## GRADUATED (2026-10-10): share-mode senescence is the accepted brake

Reconciled against Janzen–Connell density-dependent dormant mortality and
resting-egg-bank losses (RESEARCH.md §8): functional form matches, mediation
abstracted, stated as consistency — not proof. Evidence: 24601 lock-in
becomes bounded oscillation through 12k ticks (all guilds recur, B/D ≈1);
pressure tracks hoarding within and across runs (1103 deaths on hoarding
world, 0 on quiet one). Engine default unchanged (knob null = declared
behaviour); share:1 is the standard brake setting for balance runs.
Lifespan mode documented-not-recommended; fixed grace kept for compat.
Watch item: P/C marginality late on 24601-share (P15/C9 at t12000).
Remaining: 517 exclusion, 99991 fade, 42 runaway untested against the brake.
