# Rapid isolated reaction trials — experiment-only

Authority: PR #14 review 5540863270 and Owner request to begin rapid trials.
Predeclaration: `939575c:D3D4-SELECTIVE-PREREGISTRATION.md` (hypotheses unchanged).
All eight primary arms completed; see `RXOMIT-RAPID-RESULTS.md` for measured
outcomes, provenance and limits. No ecological verdict is claimed.

## Surface and identity

`chemistryReactionOmit` is null by default. Non-null accepts exactly one name:
`nitrification`, `iron oxidation`, or `iron uptake` (the extracellular OFE
reaction, NOT organism Fe assimilation). Chemistry must be enabled. Invalid
values, arrays/combined names and chemistry-off omissions throw. Organisms,
genes, expressed capabilities, uptake, upkeep and unrelated processes remain.
The selected reaction simply does not execute: no substrate reservation,
products or energy income, and no compensation.

Null identity stays `ts-evo-poc/0.8.0+chem/0.7.8`. Non-null runs add a distinct
`+rxomit/1/nitrification`, `+rxomit/1/iron-oxidation` or
`+rxomit/1/iron-uptake` suffix. Use `runIdentity(world.config)` for research
provenance; fixed boolean calls denote the ordinary model only. The dedicated
runner is the supported launch path; existing cohort CLIs do not parse this
research switch. Gate suite `gates/0.8.2` adds G51 discriminating controls.

## Reached gates and retention

The new `reproduction` event records actual reached decisions in existing
order. Passed prefixes and first blockers are recorded; missing downstream
predicates were NOT reached. Matter-disabled cases are `matter:notApplicable`,
not passed matter checks. Lottery records reuse the existing RNG result.
Pair-level intent/reciprocity/surplus rejections are not individual failure
causes. Confirmed sexual requests take their existing separate route, not a
retroactively inferred pass through the asexual gates. Queue, capacity,
parent-id/liveness, allocation and actual placement are observed where they
execute. No biological predicate is reordered or added.

Incremental ring reads report `unreadLost` separately from global historical
eviction. Trial reads must have zero unread loss. All reached reproductive
events are archived; chemistry is consumed for cumulative flux measurements
but raw chemistry events are sampled only at the predeclared ticks and first
divergence. This is not a complete chemical life-history archive.

## Qualification and run plan

First: compiled one-cell on/off controls for each process, non-vacuity,
retained uptake capability, realized omission and no compensatory income.
Then: control plus three isolated omissions for registered seeds 41001/41002,
400 founders, 1000 ticks; each executed untraced and traced. Require exact
state/RNG observer parity and default-control replay against the qualified
0.7.8 panel. Protocol/source digests and resolved configurations precede runs.
No combined arms, seed hunt, new coefficient or permanent physiology.

The archive guard reconstructs reached-gate counts and admission outcomes from
all retained reproductive records. It checks chemical samples against gross
books and cumulative lower bounds, but cannot independently replay cumulative
chemistry from sparse samples. Full cumulative flux totals rely on the runner's
lossless in-memory consumption and parity assertions; they are not represented
as a second complete raw chemical measurement.

`scripts/reaction-omission-trials.mjs --out NEW_DIRECTORY` writes raw compressed
records, first-divergence common-state witnesses, full reached-gate counts,
reaction extents/gross reservations, element uptake, growth/energy/elemental
audits and trajectories. Missing/non-finite evidence is an integrity failure;
absent target activity is explicitly vacuous, not an evidence failure or a
confirmed null biological effect. Downstream RNG/energy/resource feedback is
confounded and must not be called isolated nutrient causation.
