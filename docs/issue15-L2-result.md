# L2 corrected measurement packet — acceptance pending

## Identity and frozen protocol

Corrective replay: engine **ts-evo-poc/0.6.8**, measurement source
`37d01a4` (full SHA in `l2-panel.json.sourceSHA`). Original 0.6.7 evidence
remains available at commit `c90a15b`; it is not retroactively relabelled.
The frozen preregistration is unchanged at `f368029`.

This is a repair of invalidated attribution, NOT a second candidate:
same viability base, producerCaptureScale 1, nutrientFloor 0,
nutrientRegen 0.0002, nutrientCyclic true; seeds 517/41001; 750 ticks;
snapshots 0/100/250/500/625/750. Fully resolved A configs and command are
in the corrected JSON. Research knobs distinguish B/C as before.

## R1 and corrected localization

Only eligible producer-DISPLAYED events enter R1. Limited means lim<=0.90.

| Seed | Window | Limited / eligible | Eligible unique organisms/cells | LIMITED unique organisms/cells | LIMITED binding A/B/C |
|---|---|---|---|---|---|
|517|(500,625]|18208 / 127334|1231 / 872|277 / 58|2509 / 8591 / 7108|
|517|(625,750]|26214 / 143959|1303 / 1138|314 / 129|4358 / 12030 / 9826|
|41001|(500,625]|10327 / 93385|908 / 541|170 / 33|21 / 2632 / 7674|
|41001|(625,750]|17043 / 103004|972 / 564|260 / 48|82 / 2109 / 14852|

**R1 MET on both seeds**: 14.30%/18.21% and 11.06%/16.55%, each
window exceeds 100 eligible events. The prior claim that limitation spans
hundreds of distinct cells is WITHDRAWN: those were eligible activity cells.
The limited subset occupies 33–129 cells per window. Repeated organism events
are not independent samples. Binding counts can overlap for tied pools;
they are not a disjoint partition. B/C dominate limited-only binding counts.
`limPartialEvents` denotes materially limited events with 0<lim<=0.90,
NOT all events with 0<lim<1; zero counts are 0 in these windows.

## R2 and scientific disposition

A runs first for both seeds. After R1 passes, B runs, R2 is evaluated,
and ONLY THEN are C and its twins constructed. A qualifying R1 seed must
have >=1 accepted unit forgone across the late windows. B's deficits are
1128.107102 / 2458.579040: **R2 MET**. The original runner did not enforce
STOP-B; that procedural defect is now repaired, not denied retroactively.
C's own late lost flow and exogenous accepted agree:
889.505243 / 2750.523675. C is not required to recreate A because cyclic
feed-through follows a different path. No between-world dose substitution.

Primary uptake per eligible producer event over both late windows:

|Seed|Pool|A|B|C|B<A|C closer to A|
|---|---|---|---|---|---|---|
|517|A|0.066036|0.066540|0.069600|no|no|
|517|B|0.061046|0.060666|0.061702|yes|no|
|517|C|0.053453|0.050640|0.052978|yes|yes|
|41001|A|0.068295|0.069557|0.065480|no|no|
|41001|B|0.060210|0.061372|0.058943|no|no|
|41001|C|0.069459|0.068430|0.066717|yes|no|

Closer means abs(C−A)<abs(B−A), computed before rounding. The old table
incorrectly labelled seed 41001/pool C as closer and obscured seed 517/pool B.
**Nutrient-mediated reliance remains INCONCLUSIVE.** No efficacy, obligate
decomposition, calibration, or sustained multigeneration food-web claim.
L1's frozen negative remains valid; it was NOT proven to be merely an
instrument limitation by this different condition/window.

## Memory and negative fixtures

Only samples have a fixed cap (64/window). Exact eligible and limited ID/cell
sets cost O(distinct IDs + cells per window), mirrored per displayed guild;
IDs include successive generations, not just simultaneously living organisms.
There is no advertised fixed total-memory ceiling. G36's resource fixture
feeds 4096 distinct IDs/cells: samples cap at 2; each tracked set-entry
category totals 8192 (window plus guild). This is an entry-count resource test,
not measured heap bytes or proof of indefinite scalability.

|Constraint|Source|Negative fixture / actual evidence|
|---|---|---|
|Eligible vs limited attribution|PhotoObserver.record|G36: nonlimited binding on other ID/cell must not enter limited coverage/binding|
|Repeated events not unique individuals|same|G36: three limited events on one ID/cell remain one distinct participant|
|Memory claims honest|distinctMeasure|G36: 4096-ID growth vs capped sample; no constant-space claim|
|STOP-B enforced|l2-protocol.mjs afterR2|protocol test: zero, 0.999, NaN, Infinity and non-R1 seed invoke no rescue; 1.0 permits it|
|Nonperturbing observer|world capture site / G36|on/off hashes, uptake books, census; compiled gates 44/44 pass|
|Unchanged candidate biology|corrected vs original JSON|ALL A/B/C biological snapshots on both seeds deep-equal c90a15b archive|
|Frozen R1/R2|runner / raw output|same numerators, denominators and lost flow as original|

## Artifacts and remaining review

`evidence/issue15-L2-20261018/l2-panel.json` and `l2-screen.output.txt`
are the corrected replay. Typecheck, 44/44 compiled gates, STOP-B fixtures,
11/11 contracts (including freshly rebuilt app) and 154/154 workflow fixtures
passed. Independent focused code and evidence reviews found no functional
defects; their stale-comment and tolerance-label findings were corrected.
The replay source remains 37d01a4; subsequent script edits only correct its
version comment and redundant initial version label, not run arithmetic.
Final-head remote CI is reported separately when observed. No automatic
merge. PR #14 and larger cohorts excluded.
