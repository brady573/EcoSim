# L2 result — single prospective config-only candidate with event-time Liebig observer

> Execution of `docs/issue15-L2-preregistration.md` (committed BEFORE any L2
> candidate outcome was observed: prereg commit `f368029`, instrument commits
> `2d41ff8`, `43ad54c`, `a79e49b`; candidates ran AFTER all four). Engine
> `ts-evo-poc/0.6.7` (measurement-only successor of merged `main`
> `06be7da`). Seeds 517, 41001. Horizon 750 ticks. Snapshots
> 0/100/250/500/625/750. Candidate = viability + `producerCaptureScale 1.0`,
> `nutrientFloor 0`, `nutrientRegen 0.0002` (positive — the cyclic branch is
> LIVE, unlike L1), `nutrientCyclic true`. One candidate; no variants; no
> seed hunting; no threshold change.

## Verdict (read from the frozen rules, not chosen afterwards)

**R1 — event-time local producer nutrient limitation: MET, on BOTH seeds.**

Producer-DISPLAYED eligible photo events (photo > 0.02, valid cell, demand >
0, >=1 affinity > 1e-4) with event-time `lim <= 0.90`:

| seed | window | limited/eligible | frac | >=5%? | events>=100? | uniq orgs | uniq cells | mean lim (all) | lim=0 | lim in (0,1) | bound pools A/B/C |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 517 | (500,625] | 18208/127334 | 14.30% | yes | yes (127334) | 1231 | 872 | 0.882 | 0 | 18208 | 2592 / 8780 / 7405 |
| 517 | (625,750] | 26214/143959 | 18.21% | yes | yes (143959) | 1303 | 1138 | 0.855 | 0 | 26214 | 4453 / 12357 / 10280 |
| 41001 | (500,625] | 10327/93385 | 11.06% | yes | yes (93385) | 908 | 541 | 0.907 | 0 | 10327 | 22 / 2683 / 7900 |
| 41001 | (625,750] | 17043/103004 | 16.55% | yes | yes (103004) | 972 | 564 | 0.864 | 0 | 17043 | 121 / 2136 / 15314 |

Limitation is **real at event time, partial-only, and late-window
persistent**: every limited event sits in (0, 1) (never exactly 0), mean
unmet share ~10–15%, spanning hundreds of distinct organisms and hundreds of
spatial cells — not a handful of hotspots. Bound pools are dominated by B and
C, with pool A contributing on seed 517. Repeated events from one organism
are NOT independent (the unique IDs are reported precisely so no one will
mistake 44k events for 44k independent trials).

**R1 => R2 proceeded (the frozen sequencing), and R2 is also MET:**

- B lost-accepted recalcOnly flow across the two late windows (cumulative
  book deltas 500->750): **1128.107** (seed 517) and **2458.579** (seed
  41001) — both far above the frozen 1.0 accepted-unit threshold, far above
  dust, delivered per event (G35 book identities hold; C's exogenous
  accepted equals C's own shadow−actual per window exactly:
  889.505/2750.524).
- C arm exogenous accounting at t750: attempted == accepted (2003.039 /
  5418.202), capLoss = eviction = 0.
- C twin digests equal on both seeds; A twin digest equal (determinism).

**H-L2 directional pattern: NOT established => INCONCLUSIVE (honest branch of
the frozen rule).** The preregistered pattern was "B < A uptake with C moving
closer to A". PRIMARY measure — producer uptake by pool PER eligible photo
event, late windows (late book delta / producer eligible events):

| seed | pool | A | B | C | B < A? | C closer to A than B? |
|---|---|---|---|---|---|---|
| 517 | A | 0.066 | 0.067 | 0.070 | **no** | no (farther) |
| 517 | B | 0.061 | 0.061 | 0.062 | ~ (equal) | ambiguous |
| 517 | C | 0.053 | 0.051 | 0.053 | yes | yes |
| 41001 | A | 0.068 | 0.070 | 0.065 | **no** (B > A) | no |
| 41001 | B | 0.060 | 0.061 | 0.059 | no | no |
| 41001 | C | 0.069 | 0.068 | 0.067 | yes | yes |

Late-window TOTALS (secondary measure): 517: A 48977, B 47054 (B < A holds),
C 49390 (above A — over-restoration); 41001: A 38878, B 40406 (B > A — the
hypothesis direction fails outright), C 36686. The two seeds disagree, and
within a seed the per-pool picture mixes. Per the frozen scientific language,
mixing/absent late response/unequal cohort composition/cyclic confounding
demand **INCONCLUSIVE** rather than a directional or efficacy claim. No
post-hoc cutoff was invented and none is needed: the pattern the prereg
required for SUPPORTED is simply absent on both seeds.

**No efficacy, reliance, obligate-decomposition, or calibration claim is
made.** Two-seed exploratory evidence only; a larger confirmatory study
remains a future, separately authorized decision.

## What can legitimately be concluded from this screen

1. The L1 negative was NOT the last word because of the instrument: with the
   event-time observer, limitation that L1's end-of-tick empty-pool proxy
   could not see (0 < lim < 1) is abundant in the late windows of a restored
   cyclic-coupling candidate. L1 itself remains frozen and unchanged; this
   result does not retrofit it.
2. Event-time partial limitation is spatially distributed (hundreds of
   distinct cells), affects a substantial minority of producer photo events,
   and binds mostly through pools B and C.
3. Same-event exogenous replacement delivers exactly at the book-cell level
   under a LIVE cyclic coupling (attempted == accepted, capLoss/eviction 0,
   C's exo == C's own shadow−actual per window), and C is — as predeclared —
   NOT a bit-identical reconstruction of A this time: replacement is a
   different path through the cyclic feed-through and the C trajectory
   legitimately diverges (late lost flow in C, 889.5/2750.5, differs from B
   because the worlds evolve differently once replacement takes effect).
   Between-world cumulative totals were NOT used as a dose or as evidence of
   completeness.

## Downstream context (descriptive, per arm, at declared samples)

Sample values are in `l2-panel.json`; headline context (do not read cause
into these — cohort composition is unequal by construction of the arms):
producer living energy falls 500->750 in every arm (e.g. 517: 12121 -> 9088
A, 12591 -> 9595 B, 12021 -> 8383 C); placed producer births 500->750
(asexual/sexual engine counters): 517 A 472/38, B 502/26, C 420/60; direct
`demographics().deaths` (starve/age/damage) 500->750 producer totals 517:
300/235/284 per arm. Pool cap utilisation and abiotic regen are in the
archive and were NOT used for classification.

## Deviations and defects (recorded, not repaired)

- **None in the candidate execution.** A ran first for both seeds; R1 was
  evaluated from A's observer before B or C was constructed; the script
  itself refuses to run B/C unless its own computed R1 is true; B/C then ran
  for both seeds with no other biological difference. No threshold was
  shifted: R1's frozen rule was evaluated exactly as written and happened to
  pass comfortably, so the "less than 100 events => UNMEASURABLE" branch was
  not needed. The prereg did not anticipate re-deriving C's expected
  BEST-restore behaviour — none was scored.
- **Instrument formed BEFORE the run, in pieces:** four commits
  (`2d41ff8` observer+G36, `f368029` prereg freeze, `43ad54c` per-guild
  counters, `a79e49b` per-guild limiter distribution + bound pools) were
  needed because the first instrument draft under-specified the
  producer-guild split that R1's fixed wording requires. No L2 candidate
  outcome was observed before all four were committed; the shortfall was
  found by desk-checking the prereg against the intended report, not from
  data.
- **Self-review only, so far:** the internal independent review pass for this
  packet could not be obtained (specialist model unavailable; see PR
  description). The Design Partner's formal review of the new PR is the
  outstanding independent check.

## Acceptance matrix (each constraint -> source -> probe -> actual result)

| # | Constraint (Owner decision) | Source of truth | Probe/verification | Actual result |
|---|---|---|---|---|
| 1 | Opt-in strictly observational observer; no field write, RNG, iteration-order, hashState contribution; bounded memory | `src/world/photoObserver.ts`, `photoObserver` knob `null` default | G36 in `src/gates.ts` (observer on/off across CHECKS, photoUptake equality, census equality, sampled-event Liebig recompute, zero/partial/full unit behavior, out-of-window counting, sample-cap memory) | PASS (44/44 gates incl. G36) |
| 2 | Default/unset C1 pins unchanged (parity, no re-pin) | `src/world/version.ts` 0.6.7 annotation | `node scripts/contract-checks.mjs` C1 | PASS — 882/170/65 and 563/279/90 exactly, same pair as 0.6.6, no re-pin |
| 3 | Engine identity and version bar | engine `ts-evo-poc/0.6.7`, gates `gates/0.9.0` | config resolved and printed in this packet's panel/head, `C5` asserts `photoObserver` key present in the shipped bundle | PASS |
| 4 | EXACTLY ONE prospective L2 condition, frozen knobs | prereg s.1 | candidate block in `l2-panel.json`; run log "L2" | PASS — single condition, both seeds, 750 ticks |
| 5 | Seeds 517/41001, horizon 750, snapshots 0/100/250/500/625/750 | prereg s.1 | `l2-panel.json` sample times | PASS |
| 6 | Frozen prereg committed before first outcome inspection | prereg s.0 | commit order in `git log` | PASS (f368029 precedes candidate run; archive commit only adds results) |
| 7 | R1 exactly as frozen, A-first | prereg s.3 | `l2-screen.output.txt` R1 block, per-guild counters | PASS — MET on both seeds |
| 8 | R2 exactly as frozen, >=1.0 accepted-unit foregone | prereg s.4 | per-window cumulative book deltas in run log / results | PASS — 1128.107 / 2458.579 |
| 9 | G35 four-book accounting inside C; exogenous capped/off evolution represented honestly | prereg s.4 | exogenous attempted/accepted/capLoss/eviction at t750 (2003.039 / 5418.202; capLoss=eviction=0); G35 unchanged and green | PASS |
| 10 | Determinism twins at L2 config | prereg s.0 | C twin digests equal both seeds; A twin digest equal | PASS |
| 11 | Directional pattern requires B<A and C-toward-A; mixing => INCONCLUSIVE | prereg s.6 | per-event per-pool table in this result | **INCONCLUSIVE** (mixing on both seeds — honest branch of the frozen rule) |
| 12 | Scientific language bans efficacy/reliance/obligate claims | prereg s.6 | this document's wording | PASS |
| 13 | Single PR from merged main; no auto-merge; PR #14 untouched | prereg s.7 | PR head `issue15/l2-observer-rescue` from `06be7da`; git history | PASS |
| 14 | CI/typecheck/gates/contract/workflow all pass at the PR head | prereg s.7 | run at final head | PASS — typecheck clean, 44/44 gates (incl. G36), 11/11 contract (C1 exact, C4 bundle-vs-CLI, C5 keys), 154/154 workflow |

## Replay

```sh
npm install
npm run view:build
node evidence/issue15-L2-20261018/l2-screen.mjs      # re-derives R1/R2 panel
```

The script rewrites `l2-panel.json`; stdout matches the archived
`l2-screen.output.txt`. Byte-identical archive provenance: this repo's
(re)build for the fixed engine version — `ts-evo-poc/0.6.7` at branch
`issue15/l2-observer-rescue`; PR head records the exact commit.
