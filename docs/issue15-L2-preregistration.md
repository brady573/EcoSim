# L2 — preregistered single prospective config-only candidate with an event-time Liebig observer

> **PREREGISTRATION — FROZEN BEFORE ANY L2 CANDIDATE OUTCOME WAS OBSERVED.**
> Owner authorization: issue #15 comment "ISSUE #15 OWNER-DIRECTED L2 DECISIONS
> RESOLVED — 2026-10-18" (the COMPLETE operative instruction). Exactly ONE
> prospective L2 condition. This prereg is committed and source-qualified
> BEFORE the first L2 candidate outcome is inspected; the execution commit
> will contain only results and archives. L1 remains frozen: its failed strict
> empty-pool criterion is NOT retrofitted and its descriptive B/C outcomes are
> NOT promoted. Engine under test: `ts-evo-poc/0.6.7` (measurement-only
> successor to the Stage-3 accepted 0.6.6 at merged `main`
> `06be7da259ff739b37c7d79a93aee14211f73da5`); no 0.6.6 data is relabelled.

## 1. The ONE candidate condition (L2) — frozen

Base = the existing viability diagnostic config used by the O2 evidence script
(`evidence/o2-rescue-20261016/o2-mediation.mjs`), all nonlisted entries
identical. Overrides, all existing knobs, frozen:

| Key | Viability | L2 candidate |
|---|---|---|
| `producerCaptureScale` | 0.35 | **1.0** |
| `nutrientFloor` | 0.05 | **0** |
| `nutrientRegen` | 0.0002 | **0.0002 (positive baseline restored — unlike L1)** |
| `nutrientCyclic` | true | **true (existing branch can operate)** |
| `photoObserver` | null | **true (observer on)** |

The cyclic regeneration branch is the LIVE difference from L1: `rate =
nutrientRegen (>0)` scaled by the one-tick mineraliser-throughput coupling.
This does NOT assume limitation will occur; it removes the coupling-kill L1
committed. Seeds **517 and 41001** (previously viewed diagnostic seeds, NOT
independent held-out replication). Horizon **750 ticks**. Snapshots
**0/100/250/500/625/750**. No candidate variations, no extra runs to seek a
preferred result, no seed hunting, no changed thresholds, no new biology, no
reset of unrelated defaults.

## 2. The event-time observer (instrument prerequisite — already landed)

Email-time data at the photosynthesis site, recorded BEFORE consumption, via
the opt-in `photoObserver` knob (null = off, byte-identical; G gate in
`src/gates.ts` proves observer-on/off `hashState` + photoUptake-book + census
parity on identical worlds at multiple checkpoints, recomputes the Liebig
identities from sampled events, exercises zero/partial/full limiting factors,
counts out-of-window events and holds memory bounded; bad values throw).
Per eligible event (photo > 0.02, valid cell, effective demand > 0, at least
one affinity > 1e-4): tick, spatial cell, stable organism ID, DISPLAYED guild,
per-pool affinity / desired (demand × affinity) / present (pre-supply),
actual event-time `lim`, binding pool(s), actual uptake, demand shortfall
`demand × (1 − lim)`. Aggregated by declared window 0-100 / 100-250 /
250-500 / 500-625 / 625-750 with unique-organism / unique-cell counts, limiter
distribution and a fixed-size sample; no unbounded per-event trace, no
simulation decisions from the observer, no field writes, no RNG draw.

## 3. Primary preregistered R1 reachability — checked A-FIRST

Count ONLY eligible producer-DISPLAYED actual photosynthesis events. A
materially limited event is observed EVENT-TIME `lim <= 0.90` (≥10% unmet
photosynthetic demand) — a predeclared practical screening cutoff, NOT a
universal biological threshold.

**R1 is MET** if, in the UNINTERVENED A world (O1 and O2 both null), at least
one fixed seed shows **>= 5%** limited eligible events in EACH of the two
late windows **(500,625]** and **(625,750]**, with **>= 100 eligible producer
photosynthesis events per window**. Repeated events from one organism are NOT
independent: unique stable organism IDs and spatial cells are reported
separately. Numerators/denominators, limiter distribution including lim = 0
and (0,1), bound pools, unique organisms and cells are reported. Fewer than
100 eligible events in a window => report **UNMEASURABLE** (an instrument/
population outcome, NOT a biological negative).

**A is run FIRST for both seeds and R1 is enforced immediately.** If R1 fails
or cannot be measured validly => **STOP-A**: do not run B/C, do not tune L2.
A negative screen or an instrument gap is a valid delivered result. L1's t500
late depletion is discovery rationale for this window and never grounds to
rewrite L1.

## 4. Conditional paired mechanism test / R2 (ONLY if R1 passes)

On BOTH seeds, same 750-tick config, arms differing only in the research
knobs, no other biological difference:

- **A** — natural mineralization, no rescue; both research knobs null.
- **B** — O1 `phenoMineralReturn: {carrionOnly: 1, recalcOnly: 0, dual: 1}`
  (expressed recalcOnly mineralization return suppressed to fraction 0, other
  classes unaltered); rescue null.
- **C** — B plus O2
  `phenoMineralRescue: {carrionOnly: false, recalcOnly: true, dual: false}`:
  same-event exogenous accepted-remainder replacement in the exact tick,
  spatial cell and pool, source booked separately; dual/neither and
  displayed-guild boundaries preserved.

**R2 requires, on a seed that passed R1:** at least one actual lost-accepted
flow event above numerical dust AND **>= 1.0 total accepted nutrient unit
foregone** (shadow − actual for the suppressed recalcOnly class) accumulated
across the two late windows, with G35 four-book accounting (O1 shadow /
actual / exogenous attempted / accepted / capLoss / eviction) inside its
tested tolerance. Otherwise **STOP-B** and report R2 not met. Between-world
cumulative totals are NEVER substituted as the replacement dose. Cyclic
regeneration stays ACTIVE with the existing one-tick coupling. **C is NOT
required to recreate A exactly**: external replacement is a different path
than biotic mineralization through the cyclic feed-through, so exact A-parity
is NOT an instrument-validity condition here (unlike L1, where A-parity was an
artifact of a dead coupling). Direct biotic returns and cyclic abiotic
regeneration are reported separately, never summed into one "supply" number.

## 5. Measurements (declared now, per arm per seed)

At the declared snapshots plus from the observer stream:

- event-time `lim` distribution and limiting/binding pools per late window;
- producer-DISPLAYED nutrient uptake by pool per eligible producer photo
  event in the late windows (primary directional response), plus raw totals
  and denominators; all-guild totals labelled separately;
- living producer energy (engine units);
- actually placed births and birth pathways (engine counters);
- DIRECT `World.demographics().deaths` by displayed guild and cause
  (starve/age/damage), cross-checked against the aggregate census identity;
- survivor census / retention by displayed guild;
- local nutrient stocks and per-pool cap utilisation;
- mineralizing EXPRESSED classes by substrate source (sediment/detritus/litter,
  O3 books), disjoint class counts;
- real/shadow/exogenous four-book return accounting (attempted/accepted/
  capLoss/eviction, O1+O2 families) within G35 bounds;
- cyclic abiotic regeneration, reported separately from biotic and exogenous.

## 6. Scientific language (frozen)

Within each R1+R2 seed, **B < A uptake with C moving closer to A** is a
mechanism-compatible *directional* pattern. Agreement on both seed panels is
EXPLORATORY CONSISTENCY ONLY. Mixing, absent late response, unequal cohort
composition, and cyclic confounding warrant **INCONCLUSIVE** rather than a
global efficacy/dependence verdict. Never claim a two-seed exploratory result
proves obligate decomposition, calibrated biology, or general producer
limitation. No post-hoc statistical cutoffs. No efficacy or reliance claim;
a green CI suite is not evidence.

## 7. Deliverable and boundaries

One coherent substantive PR from merged main: raw machine-readable and
human-readable evidence, source/version/protocol identity (engine 0.6.7,
resolved config, seeds, command sequence), affected CI (typecheck, gates incl.
the new G36, contract, workflow), an acceptance matrix (each constraint ->
instrument -> probe -> actual result), and a skeptical self-review. The PR is
**NOT merged and NOT auto-merged**; the prior merge authorization covered ONLY
#17-19. Out of scope: additional candidates/seed cohorts including 12+24, PR
#14, permanent physiology/subsidy, population steering, and any inference of
validation from CI. A larger confirmatory study remains a FUTURE separately
authorized decision AFTER L2 evidence.
