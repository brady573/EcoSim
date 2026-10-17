# L1 result — prerequisite NOT met; STOP-A executed

> Execution of `docs/issue15-L1-preregistration.md` (committed BEFORE any
> candidate outcome was observed, at PR #19 head `1893782`).
> Engine `ts-evo-poc/0.6.6`. Seeds 517, 41001. Horizon 500 ticks.
> Samples t0/t100/t250/t500. Candidate L1 = viability + `producerCaptureScale
> 1.0`, `nutrientRegen 0`, `nutrientFloor 0`; `nutrientCyclic` true; all else
> unchanged. **No engine change, no seed change, no threshold change.**

## Verdict (read from the frozen rules, not chosen afterwards)

**R1 — local-limitation reachability: NOT MET.** The frozen rule required
>= 5% of alive producer-DISPLAYED organisms with an empty affinity-relevant
pool at BOTH t250 and t500, on at least one seed. Measured fractions:

| seed | arm | t250 | t500 | both >= 5% |
|---|---|---|---|---|
| 517 | A | 0.00% | 19.52% | no |
| 517 | B | 2.18% | 18.19% | no |
| 517 | C | 0.00% | 19.52% | no |
| 41001 | A | 0.00% | 31.82% | no |
| 41001 | B | 0.00% | 17.07% | no |
| 41001 | C | 0.00% | 31.82% | no |

No arm/seed pair satisfies the frozen conjunction, therefore **R1 fails on both
seeds**, therefore the preregistered **STOP-A** applies: stop after this
candidate, record the valid negative, no B/C expansion, no tuning, no second
candidate.

**H-L1: NOT EVALUATED.** It was declared conditional on R1 and R2 being met.
R1 failed, so no SUPPORTED/FALSIFIED/INCONCLUSIVE classification is issued and
none may be inferred from the descriptive numbers below.

**R2 (lost-flow interpretability) is moot** for the screen: the O2/O3 books
reconcile (G35) and the reported lost flow is non-zero, but it cannot be
promoted to a hypothesis test once R1 has failed.

## What the panel did show (descriptive only; not a verdict)

Local limitation under L1 is **late-emerging**: zero-affinity-pool producers at
t250, abundant by t500 (17–32%), while mean headroom falls 0.55 -> 0.24-0.35.
Binding pools at t500 are B and C (and C alone on seed 41001 arm A/B), i.e. the
lower-capacity pools, consistent with the prereg mechanism statement.

Arm C reproduces arm A **bit-identically** at every declared sample on both
seeds (census, producer energy, producer-displayed uptake). This is an
instrument result, not biology: with `nutrientRegen = 0` the cyclic regen term
is inert, so the exogenous same-event replacement exactly restores the
suppressed return and nothing else diverges. It confirms the O2 delivery
instrument restores state exactly under a configuration with no other
regeneration pathway — it says nothing about reliance.

Arm B (suppression) does not show a consistent reduction in producer-displayed
uptake relative to A on either seed (seed 517: higher on pools A/B, lower on C;
seed 41001: mixed). Reported as an observation only; with R1 unmet this is not
the preregistered falsifier firing.

## Disclosed deviations and defects (recorded, not repaired)

1. **Execution order.** All three arms were run in a single pass before R1 was
   evaluated; the prereg sequence implied reachability first and B/C only if
   met. B/C numbers therefore exist. They did not influence the STOP decision,
   which follows mechanically from the frozen threshold, and they are reported
   descriptively only. No seed, threshold or arm was chosen after seeing them.
2. **Rationale error in the prereg text.** It claimed `nutrientCyclic` "keeps
   the recalcOnly-mediated cyclic path live and measurable". With
   `nutrientRegen = 0` the term is `rate = nutrientRegen (0)` optionally scaled
   by the cyclic factor, so regen is identically zero and the cyclic coupling is
   INERT in L1 (`src/world/world.ts:2043-2055`). L1 therefore cannot test
   cyclic mediation at all. This is a design error in the candidate rationale,
   surfaced rather than silently fixed; repairing it would require a second
   candidate, which is not authorized here.
3. **Timescale mismatch.** R1's ">= 5% at BOTH t250 and t500" window is
   mismatched to when this candidate's limitation appears (absent at t250,
   17-32% at t500). Recorded as the observation any future, separately
   authorized reachability rule would have to account for. NOT applied here as
   a threshold change.

## Requirement -> evidence -> test -> status

| # | Requirement | Evidence | Test | Status |
|---|---|---|---|---|
| 1 | Preregistration frozen before observation | `docs/issue15-L1-preregistration.md` committed in `d972ed0`, before this script ran | commit order | PASS |
| 2 | One config-only candidate, no seed/threshold change | `l1-panel.json` candidate block; single run; no repeats except twin check | file inspection | PASS |
| 3 | Strict local-limitation detector, read-only | detector = empty affinity pool => Liebig lim = 0 (prereg s.1) | source derivation, no engine change | PASS |
| 4 | R1 reachability | table above | frozen threshold on measured fractions | **FAIL (STOP-A)** |
| 5 | R2 lost-flow interpretable | `l1-screen.output.txt` lostRecalc/exo rows; G35 reconciles | books | UNMEASURED (moot) |
| 6 | A/B/C matched, seeds 517/41001, 500 ticks, t0/100/250/500 | `l1-panel.json` | data inspection | PASS |
| 7 | Producer-displayed uptake never labelled all-guild | script emits both, labeled | source inspection | PASS |
| 8 | DIRECT demographics deaths | `l1-panel.json` deathsByGuildCause | engine counter | PASS |
| 9 | Cyclic feedback separated from exogenous | abioticRegen per pool reported separately | data inspection | PASS |
| 10 | H-L1 classification | conditional on R1 | rule | **NOT EVALUATED** |
| 11 | No merge / no biology change / no second candidate | working tree diff evidence-only | git status | PASS |

## Known limitations

- Two seeds, single horizon, one candidate: this screen can only establish or
  refute *reachability* of local limitation, not dependence or reliance.
- Partial limitation (`0 < lim < 1`) remains unobservable without the private
  `demand` chain; the detector sees only the strict `lim = 0` case (prereg s.1).
- The late-emerging limitation at t500 means the 500-tick horizon under-samples
  the constrained regime's duration.

## Replay

```sh
npm install && npm run view:build
node evidence/issue15-L1-20261017/l1-screen.mjs
```

Read-only; writes only `l1-panel.json`. Archived: `l1-screen.output.txt`
(stdout), `l1-panel.json` (machine-readable).