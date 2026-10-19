# Nitrification omission — confirmation proposal, awaiting Owner acceptance

> **Status update (2026-10-19): SUPERSEDED by the isolation decision.** The
> Owner review of PR #14 (2026-10-18) found that `chem/0.8.0`'s live
> nitrification — a presence gate instead of a booked oxidant while energy was
> still earned — is a material mechanism departure. Under the accepted
> fallback the pathway is isolated as unsupported/disabled in `chem/0.8.1`
> (`ISOLATED_REACTIONS`), and its omission selector is a declared no-op whose
> contrast is VACUOUS (`CHO-081-RESULTS.md`). The confirmation panel proposed
> here cannot be run against an isolated pathway: a future nitrification
> mechanism requires an explicit Owner decision on vocabulary first
> (`CHEM-080-CONTRACT.md` §3.1). This document is retained as the record of the
> proposal and of the still-open registration choices it describes; nothing in
> it is an accepted preregistration.

Follow-up status: the Owner subsequently authorized bounded accounting
attribution and up to eight exploratory matched pairs. Results and remaining
repair decisions are in `CHO-ATTRIBUTION-ASSESSMENT.md`. This did not authorize
the held-out confirmation panel or fill its still-open registration choices.

One decision packet responding to PR #14 review 5555052030. **Not an accepted
preregistration or permission to execute.** No new simulations, physiology,
combined omissions, energy compensation or parameter changes are included.
The accepted archive issues remain closed. Issue #15 is separate.

## 1. Freeze the lead, not an ecological-success claim

Research implementation: `77a82f4337645f7581432ce074bb4709ee74e529`.
Accepted archive readout: `b24be07f12154810b073fa73115ac32356750c84`.
Base engine `ts-evo-poc/0.8.0`, chemistry `chem/0.7.8`, suite `gates/0.8.2`.
Control identity: `ts-evo-poc/0.8.0+chem/0.7.8`.
Treatment identity: `ts-evo-poc/0.8.0+chem/0.7.8+rxomit/1/nitrification`.
Only `chemistryReactionOmit` differs between matched arms: null versus
`nitrification`. Uptake capabilities and all other resolved settings stay intact.

The exploratory panel was 400 founders, seeds 41001/41002, 1000 ticks,
Node v24.21.0. These are **discovery seeds, not held-out confirmation seeds**.
The original command runs four arms, so it must not be reused blindly as the
two-arm confirmation runner:
`node scripts/reaction-omission-trials.mjs --out evidence/rxomit-rapid-20261016`.
Never overwrite that directory. Exact resolved configs, 77 measured source
digests, commands and archive definitions remain in that directory's protocol.

Frozen SHA-256 references (bytes, not reconstructed JSON):

| Original file in `evidence/rxomit-rapid-20261016/` | SHA-256 |
| --- | --- |
| protocol.json | f44300f4ae82056f6a4a93388f47a93d8a12c4cab18e6fb44687bd9cdb5a0ee2 |
| control-41001-config.json | 6394d2c71909edf956909a56c64ccd2fc62e5ab5fe9693522eb7bd65fb9453dc |
| nitrification-41001-config.json | b9be5be1cf6de17f8698532fdaccf3d01764cf759f922a4acc3f9d39d9d84310 |
| control-41002-config.json | b1a26a4e8a028bc87bfd01c1f87fbf734eef8b661023de8675a9d9db2547e65d |
| nitrification-41002-config.json | 9fa1fb4c457b075eeb50fb0876a63f2dab71d98b7d0e634e7f5a81ba0d5b1380 |
| control-41001-result.json | 60c770496f6626834d60a003a538cb764bf5acf3aca733ecf76c2a0704077460 |
| control-41002-result.json | 5551667bfa9f259de6d7075b5868985a55491f4ef25f96bab1e9e1f8480aa66b |
| nitrification-41001-result.json | bdfae19a77052d87c0fc2a40d9f7f6f76649db83c158807a2437b9955299a84a |
| nitrification-41002-result.json | dccc7243ef57bca24e29c3208c3e7e884cd94caf151e83100eb15752181295e2 |

This freezes a **research intervention**, not a default reaction rule. Raw
evidence and descendant readouts remain descriptive discovery evidence.
Recheck the table mechanically before accepting registration: compute SHA-256
over each named file's raw bytes and compare to the table (performed during
proposal preparation). These references are not newly added CI enforcement.

## 2. Two hypotheses, with different proof burdens

**Local mechanism:** in an eligible matched cell state, nitrification reserves
NH4 that would otherwise be accessible to organism N assimilation. Omitting
that reaction can increase actual organism N uptake. Prediction: positive
control reaction extent and gross NH4 reservation, zero omitted extent, more
remaining shared NH4 budget, followed by higher actual N credit in the matched
uptake opportunity. A larger substrate field alone is insufficient.

Falsifier for that local claim: in eligible matched opportunities, removing a
binding reservation does not increase actual uptake, or the alleged gain is
not traceable to the freed budget. Report nonbinding/no-capability cases as
ineligible or vacuous, not confirmation. Eligibility is fixed before outcome
inspection; all seeds and opportunities remain in the record.
G51 already establishes the minimal reaction/uptake control. The new burden is
the same chain in **live-world, matched reachable opportunities**, not another
helper-only demonstration.

**Demographic confirmation:** the *whole single-reaction omission*, including
its energy/product consequences, increases sustained descendant replacement
and population persistence over an independent seed distribution. Earlier
grandchildren alone do not establish this. A missing effect or worse outcome
under the accepted decision rule falsifies confirmation; inadequate precision
is inconclusive, not support. No numeric rule is adopted in this proposal.

| Local competition evidence | Demographic result | Permitted interpretation |
| --- | --- | --- |
| Supported | Supported | Local competition and whole-omission demographic effect; no nutrient-only mediation claim |
| Supported | Falsified/inconclusive | Local mechanism only; no confirmed persistence benefit |
| Falsified/inconclusive | Supported | Whole-omission effect only; proposed nutrient mechanism unconfirmed |
| Falsified/inconclusive | Falsified/inconclusive | No confirmation; distinguish falsification, inadequate precision and vacuity |

Any integrity failure blocks the affected inference, regardless of this table.

## 3. Controls, confounds and minimum measurements

- Two arms only: frozen chemistry baseline and nitrification omission. No
  other omission, subsidy, uptake change, cost retuning or compensating energy.
- Use identical initial seed/config/runtime per pair. Verify initial state,
  first divergence and its preceding projected state. Once states diverge,
  do not align later IDs/cells as identical environments. No RNG resets,
  extra draws or claimed stochastic coupling after divergence.
- At first matched opportunity, retain full local before/after books: NH4,
  shared gross reservations, reaction extent/products, actual N assimilation,
  tissue/stores, energy income/spend and organism identity/capability. Distinguish
  same-tick reservation effects from later energy-mediated physiology. Early
  flux can demonstrate local competition, **not nutrient-only demographic
  causation**. If the event sequence cannot separate those effects, report the
  ambiguity; do not add an energetic control without separate acceptance.
- Continue null/default parity, non-vacuous one-cell controls, invalid-input
  rejection, observer state/RNG equality and deterministic repeats. Preserve
  all reached reproductive records with zero unread loss. Retain complete
  chemical records for any interval claimed to support a causal reconstruction;
  sparse samples cannot replay cumulative chemical totals.
- Record all seeds, failures, deaths and extinctions. Execution/evidence failure
  is distinct from biological failure. Never reject growth or extinction as
  corrupted evidence. Do not drop seeds with no reproduction or inactive target.

## 4. Endpoints to register before confirmation

Seed is the experimental unit; ticks and related organisms are not independent
replicates. Report paired per-seed differences, both-arm distributions and
means with an Owner-accepted uncertainty method; no post-hoc best-seed selection.
Specify the primary endpoint and multiplicity policy before results exist.

Candidate endpoints, with no success thresholds yet assigned:

- **Lineage replacement:** actual placed births from founders versus nonfounders;
  exact primary-lineage grandchildren/later descendants; distinct reproducing
  nonfounders; time to first descendant birth. Also track descendant deaths,
  live descendant population and descendant births/deaths within fixed windows,
  so a transient burst cannot masquerade as replacement. Zero-denominator
  ratios are undefined, not successful. Secondary genetic ancestry stays
  unmeasured unless separately instrumented and qualified.
- **Persistence:** population time series, extinction time (or right-censored at
  the fixed horizon), terminal population, and predeclared late-window population
  trend. Extend the horizon only by a new registration, not until an arm wins.
- **Mechanistic secondary readouts:** actual N uptake and energy books by
  founder/nonfounder cohort and time window, alongside exposure/survival. Total
  uptake alone is confounded by more organisms living longer. Actual first
  failed/reached proposal gates are repeated decisions, not independent causes.
- **Integration:** per-guild survival/births and material/energy pathways. No
  integrated food-web claim from an energy-only predation link or a diagnostic
  chemistry-to-legacy subsidy. Balanced global totals alone are insufficient.

## 5. C/H/O prerequisite — recommendation: attribution before broad demography

**Recommend holding the broad confirmation panel until the existing C/H/O
failure is attributed and its interpretive consequences accepted.** Follow
`CHO-CLOSURE-INVESTIGATION-PLAN.md`: first failing tick, signed element/phase
books, minimal non-vacuous controls, boundary versus internal flux, and explicit
unresolved alternatives. This is a proposed next prerequisite, not authorization
to run that investigation in this packet.

Existing terminal books already show negative control O residuals and positive
omission O residuals in both discovery seeds; N passes the declared audit in
all four records. The O sign contrast is a reason to attribute the accounting
failure, **not proof of its causal pathway or a biological leak**. N closure
supports a scoped N-book check, not validity of oxygen-dependent physiology.
First-failing-tick/per-phase attribution is not reconstructible from sparse
archived chemistry alone: the next authorization would cover source/record
analysis, a read-only phase instrument, its parity controls, and bounded replay
of the existing discovery configs only until the discriminating failure.
Minimal control runs may be needed; no broad panel or biological repair is
included. Stop and report if that bounded replay cannot discriminate the cause.

Discriminating gate: reconstruct start/end fields+tissue+stores against declared
boundary inputs/outputs for each C/H/O element, using the existing strict audit
criterion without relaxing it. Challenge assimilation, reaction/growth, birth,
death and reservoir/clamp paths with nonzero controls and an intentionally
unbooked-transfer negative control in the test harness, never the engine.
Show whether an identical initial mismatch exists in both arms and whether
omission changes its causal pathway. Similar residual totals do not prove the
error harmless. Require observer nonperturbation and matched causal energy books.

If material accounting is wrong in a way that changes viable resources or
organism outcomes, **repair and qualify it before confirmatory demography**.
That requires separate accepted scope, new semantics identity where appropriate,
fresh controls and a new baseline; old pilot logs are not retroactively certified.
If the defect is reporting-only, require a demonstrated non-mutating attribution
and accepted correction before interpreting confirmation as conservation-valid.
If unresolved, stop at explicitly qualified exploratory observations. No global
closure or fully integrated ecosystem claim is permitted while strict audits fail.

## 6. One Owner decision before execution

Please accept or amend this design and supply/approve the following in one
completed registration:

1. Accounting-first prerequisite above, including whether a bounded attribution
   investigation is the next authorized execution and when repair is mandatory.
2. Independent held-out seed list and sample size; exclude 41001/41002 and
   other previously inspected development/discovery seeds. Audit prior panels
   before locking the list; never previously run under this omission is a
   minimum, not sufficient if a seed was selected using other outcomes.
   Do not pick seeds by preliminary performance.
3. Fixed confirmation horizon, sampling/windows and primary persistence/
   replacement endpoint; 1000 ticks is only the pilot horizon, not a proven
   adequate persistence test.
4. Effect/success/falsification thresholds, uncertainty method and inconclusive
   rule; no implicit positive-population or green-CI success criterion.
5. Exact two-arm runner/recording and analysis implementation scope, resource
   budget and fixed integrity-failure handling before any broad run. Archive
   immutable resolved configs, source digests, runtime and runnable command.

Acceptance of this packet's direction alone does not fill missing values or
authorize a broad panel. The completed registration must be accepted before
measurement. Thereafter: qualify instruments/runner → accepted accounting gate
→ fixed held-out panel → report all outcomes → independent review. No automatic
permanent D3/D4 physiology, D5 choices, combined treatment, merge or product
integration follows from any positive result.
