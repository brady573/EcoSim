# Issue #15 Track B — Tier-0 proposal: global-sensitivity feasibility + A2 reachability (PROPOSED, not preregistered)

> Status: PROPOSED design-gate draft (design gate). No cohort launched.
> Nothing here is a preregistered hypothesis verdict. H1 below is split into a
> narrow Tier-0 global-sensitivity question (answerable now, confounded) and a
> future isolated-H1 (needs Owner-approved Tier-1 semantics). Feasibility checks
> are unregistered pilot probes on 2 seeds, NOT verdicts.
> Baseline: `ts-evo-poc/0.6.3`, source `8956699`, viability diagnostic config
> (NOT declared defaults) unless a stratum says otherwise.
> Pure read-only measurement needs no biology redesign. Any new/altered engine
> semantics needs Owner approval on issue #15 BEFORE implementation — Tier 1 below
> is a decision packet, not an implementation.

## B.0 Questions (split: Tier-0 sensitivity now, isolated-H1 later)

**Q0 (Tier-0, answerable with current code, confounded):** does GLOBAL biotic
suppression (`bioticMineralisation=0`, which also zeroes cyclic regen via
`mineralisedCell=0`) measurably move producer capture/energy/births vs a matched
control in the tested stratum/interval? **Conditional falsifier:** B1 zeroes
accepted bio flow yet producer capture/energy/births do not move *in that
stratum/interval* — then Q0 is answered NEGATIVE for that stratum/interval only.
This says NOTHING about phenotype/service-level dependence (a Q0 negative does
not falsify reliance on any named provider or path).

**H1-isolated (future, needs Owner-approved Tier-1):** the accepted-flow share of
a NAMED heritable provider path supplies producer uptake. Untestable until
per-path suppression + trait-linked per-event books exist (O1+O3). No H1 verdict
is claimed from Q0 arms.

**Pathway (per pool, per location/time, per phenotype/guild):**
`organic processed → attempted → accepted/capLoss/eviction → net field change →
producer photo uptake/energy → growth/reproduction/survival/persistence`.
Standing inventory is not flux. Books: `attempted=accepted+capLoss`,
`accepted−eviction=measured clamp delta` (G30/G31/G32); these identities alone do
not prove conservation or reliance. Field movement checked where writers isolated
(G31); confounds named where not.

**Pools/units:** A/B/C = nutrient pools 0/1/2, engine flux units (cumulative books)
+ pool totals + per-cell capUtil/overCap. Organic routes sediment/detritus/litter
(`mineraliseThroughCeiling` src 0/1/2), excretion vs biotic vs abiotic regen/mineralization,
cyclic broadcast, diffusion, floors, initial stocks, fertility×capacity caps,
clamp/decay losses — all recorded from `getFluxSnapshot()` + field totals.

## B.1 Arms (matched; same source/engine/seed/config except stated delta)

All on compiled output (`node build/...`), never `tsx` for long horizons.

| Arm | Delta vs matched control | Interpretation (honest label) |
|---|---|---|
| A CONTROL | viability diagnostic config as-is | reference |
| A2 PROPOSED-LIMITING CANDIDATE | A with `nutrientFloor:0, basalFoodPerCell:0` (regen 0.0002, cyclic true kept) | PROPOSED regime, NOT established limiting; config-only, no engine change. Reachability verdict below: NOT limiting at 500t; harsher but inconsistent at 2000t — do NOT launch cohorts on it |
| B1 NO_BIO | A/A2 + `bioticMineralisation:0` | GLOBAL process sensitivity; NOT decomposer-specific (also zeroes cyclic regen via `mineralisedCell=0` — disclosed confound) |
| B2 NO_EXCR | A/A2 + `excretionRate:0` | second global sensitivity + comparison |
| P POSITIVE | A/A2 + `producerCaptureScale:0` | must collapse producer uptake; proves chain can see an effect |
| N NEGATIVE | repeat A/A2 same seed/config/command | must be byte-identical; observer on/off digests must match |
| S ABIOTIC-SENS (label!) | full biotic off + `nutrientRegen:0.01` | abiotic sensitivity ONLY; never called rescue |
| C MEASURED RESCUE | — | **BLOCKED pending Owner decision** (no measured replacement exists; see Tier 1) |
| D PROVIDER-SPECIFIC | read-only sampling only (Tier 0) | per-guild flux split + live mineraliser census by trait bins; no suppression |

D Tier-0 sampling (no engine change): for each sample tick, tally live
`bioticMineraliser==1` organisms by displayed guild AND by DISJOINT
heritable-phenotype donor classes from `role.ts:208-211` qualifiers —
carrionOnly (carrion path true, recalc false), recalcOnly, dual (both true),
neither (flag true but neither qualifier — expect 0; nonzero is a diagnostic
anomaly). Substrate writers (sediment/detritus/litter) are a SEPARATE axis, not
a phenotype path: "path" below always means qualifying phenotype branch, never
the writer. Read expressed traits, do not mutate. Join against per-guild accepted
bio flux. This shows label≠function (46/134 mineralisers display CONSUMER seed
517/500t; A2 census recalcOnly-dominated: 72/88 and 131/141) but does NOT
attribute any flux unit to a phenotype — per-unit books need Tier 1 Option 3.

## B.2 Controls that prove the apparatus works (before any cohort)

1. **Negative:** N repeat byte-identical per seed/config/command; observer
   nonperturbation ON the experimental effective config (A AND A2): `hashState()`
   at every sample with observer on vs `--observer-off` — must match (existing
   13/13 evidence covers viability A; A2 must be re-proven, same method
   `scripts/opportunity-check.mjs`).
2. **Positive:** P must move producer `photoUptake` to ~0 and shift downstream;
   if not, the measurement is broken — stop, do not launch cohort.
3. **Knockout reaches site:** B1 must show `bioticMineralization.accepted==0`
   exactly and arms-differ (hashes differ). Already observed 500t (bio 1556.6→0.0
   seed 517; 2966.4→0.0 seed 41001) — feasibility PASS, biology still silent.
4. **Reachability gate (A2):** A2 must show producer uptake binding on a relevant
   pool/interval (pools drawn down, capUtil low, A2 uptake clearly < A, or an
   observable B1-vs-A2 move) before ANY cohort. Measured 2026-10-15
   (`a2-reachability.mjs`): at 500t A2 is NOT limiting (util 0.52–0.53 both
   strata; photo −3–4%; B1A2-vs-A2 −5%/+1% inconsistent). At 2000t A2 is harsher
   (util →0.43–0.46; photo −23–25% vs A; extinctions incl. full B1A2 collapse
   seed 41001) but the B1 contrast stays seed-inconsistent (−16% seed 517, +7%
   seed 41001) under collapse dynamics + cyclic confound. Valid outcome: A2 as
   specified is NOT a clean limiting regime — do NOT proceed to 12+24; return a
   test-design decision (next options in B.4).

## B.3 Seeds, horizons, cadence, metrics, uncertainty (proposed, not approved)

- **Proposed pilot:** 12 seeds `[517, 41001, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010]`.
  **Proposed confirmation:** 24 separate seeds `[2001..2024]`. Distinct, no overlap,
  no hunting, no retroactive thresholds. PROPOSED — Owner sets final seeds.
- **Horizons:** t500 interim + t2000 primary; full trajectories + event timings
  (extinction/persistence ticks), not endpoints only. Sample every 100t (flux +
  P/C/D + energy + pool totals + capUtil + phenotype census + birth/death pathways
  + stage/gate evidence where relevant). No early stopping except execution failure;
  extinct arms recorded as censored with tick, never rerun.
- **Metrics (primary):** per-pool producer capture, producer energy, realised births
  (queued/placed, sexual/asexual via ReproProbe), survival/extinction time; causal
  timing + local resource availability. Secondary: provider capability frequencies,
  function-by-phenotype bins + readout guild, abiotic/standing-stock confounds,
  redundancy (consumer vs decomposer mineralisation shares).
- **Uncertainty:** matched within-seed paired contrasts (B−A per seed); report every
  per-seed delta, mean paired effect + SD, frequency of support/falsification/
  heterogeneous/censored outcomes. No invented power or pass thresholds; a
  well-executed negative is a deliverable. Labels: SUPPORTED/FALSIFIED/INCONCLUSIVE
  (hypotheses) separate from PASS/FAIL (evidence integrity).
- **Cost (measured, device-dependent):** portable `mini-flux.mjs` 6-world run
  ≈ 5.0 s wall on this device including node startup (~0.84 s/world; reviewer
  observed 5.307 s on theirs — same order, hardware differs).
  `a2-reachability.mjs` (12×500t arm-seeds + 6×2000t trajectories + census +
  P/N/observer controls, 2 seeds) ≈ 26–37 s on this device (archived `elapsed`
  line anchors each run; hardware/contention varies). Exact arm/cost register for anything
  further: per stratum/seed/horizon — 500t arms {A, A2, B1A, B1A2, B2A2, PA2} +
  N repeat + observer-read pair + branch census; 2000t trajectories {A, A2, B1A2}.
  A hypothetical 12-seed panel at this instrument density ≈ 12×(6×500t + 3×2000t
  + controls) ≈ 108 world-runs ≈ ~4–6 min + logging/analysis — PROPOSED ONLY,
  NOT approved, NOT launched (A2 failed its reachability gate).
  Peak RSS ~149 MB. No paid resources.

## B.4 Feasibility evidence (unregistered scratch, 2026-10-15, NOT a verdict)

Archived: `evidence/issue15-pilot-scratch-20261015/` (scripts + raw outputs +
source SHA 8956699; engine source unchanged — working tree adds only docs/ +
this evidence dir). Commands in README. Compiled build, never tsx.

- `node evidence/issue15-pilot-scratch-20261015/mini-flux.mjs` (viability, 500t, compiled): B1 zeroes bioAcc
  exactly, B2 zeroes exAcc exactly, arms differ; producer photo rises slightly —
  pathway SILENT downstream here (saturation/compensation, incl. cyclic-regen
  off-target 7.1→0.0 / 11.3→0.0 and floor 0.05 + excretion + stocks).
- `node evidence/issue15-pilot-scratch-20261015/mini-attrib.mjs`: bioAcc 1556.6 = 662.0 CONSUMER + 894.6
  DECOMPOSER; live mineralisers 134 = 0/46/88 — provider confound is real, guild
  census cannot stand in for function.
- `node evidence/issue15-pilot-scratch-20261015/a2-reachability.mjs` (PROPOSED-regime
  test, 2 seeds): 500t A2 NOT limiting (util 0.52–0.53; photo 9220→8904 seed 517,
  8174→7872 seed 41001; B1A2-vs-A2 −5%/+1%). 2000t harsher but inconsistent
  (util →0.43–0.46; photo −23–25% vs A; B1A2-vs-A2 −16%/+7%; extinctions incl.
  P0/C0/D0 B1A2 seed 41001 vs P5/C25/D0 A2). PA2 photo 0.0 (positive works);
  N byte-identical; observer reads nonperturbing at A2. Census (disjoint):
  recalcOnly 72/88 + 131/141 dominates; dual 13/8; carrionOnly 3/2; neither 0.
  Test-design decision RETURNED (no 12+24): (i) A2-as-specified is not a clean
  limiting regime — options: deeper limitation (lower regen? zero initial-stock
  arm? longer horizon with trajectory analysis?) each as a NEW proposal with its
  own reachability gate, or (ii) accept Q0-negative-for-tested-strata as the
  Tier-0 result and proceed to trait-linked per-event measurement design (O3)
  before any cohort. No option is pre-approved.
- Baseline validation clean: typecheck, 40/40 gates, 11/11 contract (C1 pins hold),
  154/154 workflow (this worktree, before any change).

## B.5 Tier 1 — Owner decision packet (BLOCKED; present alternatives, do not implement)

Capability-specific B/C/D need new world mutation semantics. Smallest bounded
options (all null-default, individually reversible, version-bumped, parity-proven
when null; never shipped into ordinary biology as permanent rules):

- **O1 per-path mineralisation scales** (smallest behavioural flag IF ever approved;
  WITHDRAWN prediction — no effect size asserted): e.g.
  `bioticMineralisationByPath:{carrion:number|null,recalc:number|null}` or
  `mineraliserClassScale`, read per-organism at `world.ts:2633/2687/2756`
  alongside the existing rate, written to existing per-guild books. "Path" means
  ONLY the qualifying phenotype branch (carrionOnly / recalcOnly / dual as
  defined in B.1 — disjoint by construction; dual-qualifiers form their own
  class and are suppressed only when their class is targeted), NEVER the
  sediment/detritus/litter substrate writer (separate axis). Prior draft's
  "~43% mobile share with decomposer flow intact" is WITHDRAWN: 42.5% was
  CONSUMER-displayed flux and recalc occurs in DECOMPOSER-displayed organisms
  too, so recalc suppression would move both guilds' books by an UNMEASURED
  amount. No O1 effect may be predicted before trait-linked per-event evidence
  (O3-style measurement first). Reversibility: null restores declared behaviour
  exactly (round-trip C2-style). Contamination: flagged diagnostic arm only;
  ordinary runs null. Version: bump engine + requalify pins (must still hold
  when null). DO NOT IMPLEMENT before explicit Owner decision.
- **O2 measured exogenous rescue** (only if O1 approved and interpretable):
  explicit per-cell per-pool injection arm logging amount/timing/cell/pool/source/cap
  effects to a separate ledger (NOT biology), e.g. test-only `injectNutrient` with
  `attempted/accepted/capLoss` books mirroring returns. Meaning: nutrient mediation
  test, not restored interdependence. Contamination risk highest — must never become
  a permanent subsidy; recommend separate probe-level driver, not a world default.
- **O3 per-event phenotype books** (smallest instrumentation):
  trait-bin counters for mineralisation events (no behaviour change, no RNG draw,
  no cap change). Meaning: attribute each accepted unit to phenotype bins, closing
  the D gap without touching selection. Still an engine change (new arrays +
  snapshot keys) → version bump + parity + G31-style writer-isolated proof.

Recommendation: Tier-0 Q0-negative-for-tested-strata stands as the read-only result;
A2-as-specified is NOT approved for cohorts. Next Owner decisions requested:
(R1) accept Q0/A2-reachability as the Tier-0 close-out, (R2) approve deeper-limitation
regime candidates each with their own reachability gate, and/or (R3) approve O3-style
trait-linked per-event measurement design before any O1/O2 behaviour. If O-any approved,
implement one option only, with pre-registered predictions/falsifiers and full
reproducibility (engine+config+seed+command+source SHA).

## B.6 What existing capabilities suffice for

- A/B-global/P/N/S + Tier-0 D-sampling: YES with current code (config-only + read-only probes).
- True B (capability knockout retaining organisms/other processes): NO — global `=0`
  entangles cyclic regen + all phenotypes. Blocked → O1.
- True C (measured replacement of the missing return): NO — regen knob is a different
  pathway/timing/cap. Blocked → O2.
- True D (isolate named heritable provider phenotype): NO — books are per displayed
  guild; per-unit phenotype attribution needs O3. Tier-0 sampling is the bounded
  interim.
- Safe read-only work (inventory, Tier-0 spec, A2 nonperturbation re-proof, P/N
  controls) proceeds WITHOUT blocking on the Owner decision.
