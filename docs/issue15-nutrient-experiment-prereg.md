# Issue #15 Track B — Preregistered initial nutrient-function experiment E15-PILOT-0

> Status: PROPOSED (design gate). No cohort launched. Feasibility checks below are
> unregistered pilot probes on 2 seeds × 500 ticks, NOT verdicts.
> Baseline: `ts-evo-poc/0.6.3`, source `8956699`, viability diagnostic config
> (NOT declared defaults) unless a stratum says otherwise.
> Pure read-only measurement needs no biology redesign. Any new/altered engine
> semantics needs Owner approval on issue #15 BEFORE implementation — Tier 1 below
> is a decision packet, not an implementation.

## B.0 Hypothesis + causal pathway (one function, one mediator)

**H1 (primary):** Accepted biotic mineralisation flow (`bioticMineralization.accepted`,
summed over guild×pool×source) supplies nutrient that producers capture
(`photoUptake` PRODUCER) and convert to energy/growth/births under the tested
circumstances. **Prediction:** zeroing accepted biotic flow (B1) reduces producer
per-pool capture/energy/realised births vs matched control (A) in the stratum
where pools actually limit producers. **Falsifier:** B1 zeroes accepted bio flow
yet producer capture/energy/births do not fall (compensation/saturation) — then
H1 is FALSIFIED for that stratum, which is a valid result, not a failed measurement.

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
| A2 LIMITED-CONTROL | A with `nutrientFloor:0, basalFoodPerCell:0` (regen 0.0002, cyclic true kept) | nutrient-limited stratum reference; config-only, no engine change |
| B1 NO_BIO | A/A2 + `bioticMineralisation:0` | GLOBAL process sensitivity; NOT decomposer-specific (also zeroes cyclic regen via `mineralisedCell=0` — disclosed confound) |
| B2 NO_EXCR | A/A2 + `excretionRate:0` | second global sensitivity + comparison |
| P POSITIVE | A/A2 + `producerCaptureScale:0` | must collapse producer uptake; proves chain can see an effect |
| N NEGATIVE | repeat A/A2 same seed/config/command | must be byte-identical; observer on/off digests must match |
| S ABIOTIC-SENS (label!) | full biotic off + `nutrientRegen:0.01` | abiotic sensitivity ONLY; never called rescue |
| C MEASURED RESCUE | — | **BLOCKED pending Owner decision** (no measured replacement exists; see Tier 1) |
| D PROVIDER-SPECIFIC | read-only sampling only (Tier 0) | per-guild flux split + live mineraliser census by trait bins; no suppression |

D Tier-0 sampling (no engine change): for each sample tick, tally live
`bioticMineraliser==1` organisms by displayed guild AND by heritable-phenotype bins
(`photo<0.34` gate + `carrion>0.55`/`recalc>0.5`/`speed<2.4` from `role.ts:208-211`;
read expressed traits, do not mutate). Join against per-guild accepted bio flux.
This shows label≠function (already seen: 46/134 mineralisers display CONSUMER seed
517/500t) but does NOT attribute each flux unit to a phenotype — per-unit books need
Tier 1 Option 3.

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
4. **Saturation check:** if B1/B2 zero accepted flow yet producer uptake/energy do
   not fall (observed 500t: photo 9220→9238 / 8174→8422), the stratum is
   saturated/compensated — do NOT scale to 12+24 expecting reliance. Either move to
   A2-limited or record FALSIFIED/INCONCLUSIVE for that stratum.

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
- **Cost (measured):** 500t viability world ≈0.55 s compiled (≈3.3 s for 6 worlds).
  Full Tier-0 pilot ≈ 12 seeds × 6 arms (A,A2,B1×2,B2,P,N + sampling) × 2000t
  ≈ 72–84 worlds ≈ 3–4 min + analysis. Confirmation 24 seeds similar ≈ 6–8 min.
  Peak RSS ~149 MB. Feasible on device; no paid resources.

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
- Baseline validation clean: typecheck, 40/40 gates, 11/11 contract (C1 pins hold),
  154/154 workflow (this worktree, before any change).

## B.5 Tier 1 — Owner decision packet (BLOCKED; present alternatives, do not implement)

Capability-specific B/C/D need new world mutation semantics. Smallest bounded
options (all null-default, individually reversible, version-bumped, parity-proven
when null; never shipped into ordinary biology as permanent rules):

- **O1 per-path mineralisation scales** (recommended smallest behavioural flag):
  e.g. `bioticMineralisationByPath:{carrion:number|null,recalc:number|null}` or
  `mineraliserClassScale`, read per-organism at `world.ts:2633/2687/2756` alongside
  the existing rate, written to existing per-guild books. Meaning: suppress the
  recalc-path (mobile-inclusive) vs carrion-path (sessile) independently, organisms
  and all other processes unchanged. Prediction: recalc-path suppression moves
  accepted bio flow by the mobile share (~43% at 500t/517) with decomposer-displayed
  flow intact. Reversibility: null restores declared behaviour exactly (round-trip
  C2-style). Contamination: flagged diagnostic arm only; ordinary runs null.
  Version: bump engine + requalify pins (must still hold when null).
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

Recommendation: approve Tier-0 sampling + A2-limited pilot now; defer O1–O3 until
Tier 0 shows a stratum where returns limit producers. If O-any approved, implement
one option only, with pre-registered predictions/falsifiers and full
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
