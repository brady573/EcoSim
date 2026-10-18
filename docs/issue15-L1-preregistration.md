# L1 — preregistered single config-only local nutrient-limitation screen

> **PREREGISTRATION — FROZEN BEFORE ANY CANDIDATE OUTCOME WAS OBSERVED.**
> Owner authorization: issue #15, "OWNER AUTHORIZATION — ONE CONFIG-ONLY
> NUTRIENT-LIMITATION SCREEN (2026-10-16)". Exactly ONE candidate. Committed
> ahead of execution; the execution commit contains only results and archives.
> Engine under test: `ts-evo-poc/0.6.6` at PR #19 head
> `18937824f1e9a1374e7af13a18e04f967716d4bd` (O2 accepted, Gate 3).
> Seeds fixed: **517, 41001**. Horizon fixed: **500 ticks**. Samples fixed:
> **t0/t100/t250/t500**.

## 1. Mechanism being tested (from source, before any measurement)

`World.actPhase` photosynthesis, `src/world/world.ts:2795-2868`, Liebig's law of
the minimum:

```
demand = photo_trait * 0.42 * localLight * captureMul      (per guild scale)
if (mixotrophyCarbon) demand *= substrateAvailability(ci)
w[p] = demand * affinity[p]                                 for pools A,B,C
lim  = min(1, min over p with affinity[p] > 1e-4 of  nut[p][ci] / w[p])
gained = demand * lim * yieldFactor
actualTake[p] = min(w[p]*lim, nut[p][ci])                  booked to photoUptake[guild][p]
```

Consequence used as the **predeclared limitation detector**: if ANY single pool
with `affinity[p] > 1e-4` is **empty** at a producer-displayed organism's cell,
then that term is `0/w[p] = 0`, so `lim = 0`, so `gained = 0`: that organism's
entire photosynthetic income for that tick is unsatisfiable. This is the
STRICTEST form of local limitation (limitation factor exactly zero) and it is
measurable **read-only** from public engine state — `store.trait(slot,
TRAIT.NUTRIENT_A|B|C)` plus `w.nutrients[p].data[ci]` — with no engine change,
no RNG draw and no behavioural perturbation.

Disclosed instrument limit: PARTIAL limitation (`0 < lim < 1`, the softer and
probably more common regime) is NOT observable without the private
`localLight`/`shadeMass`/disturbance-modifier chain that feeds `demand`.
Minimal nonperturbing proposal for the future, NOT implemented here and NOT
required by this screen: expose the per-organism per-tick `lim` (or
`nut[p][ci]/w[p]` per pool) as a read-only diagnostic alongside the existing
flux books. Any such exposure is an engine-interface change requiring a
separate Owner decision.

## 2. The ONE candidate configuration (L1)

All other settings are the accepted viability diagnostic config, unchanged.

| Key | Viability (reference) | **L1 candidate** | Why |
|---|---|---|---|
| `producerCaptureScale` | 0.35 | **1.0** | demand-side lever; demand scales linearly, so Liebig `lim` binds sooner at producer cells |
| `nutrientRegen` | 0.0002 | **0** | removes the abiotic supply term that refills every cell each tick |
| `nutrientFloor` | 0.05 | **0** | removes the unconditional floor write that pinned capUtil ~0.5 in the Tier-0 screens |
| `nutrientCyclic` | true | true (unchanged) | keeps the recalcOnly-mediated cyclic path live and measurable — it is the mediator under study |
| everything else | viability | unchanged | including `basalFoodPerCell 0.01`, `excretionRate 0.06`, `bioticMineralisation 0.45` |

Rationale: local limitation requires demand to outrun supply at producer cells.
Demand is raised 2.86x and the two abiotic smoothing supply terms are removed;
the biotic return path (recalcOnly mineralisation, excretion, cyclic broadcast)
is untouched so the suppression/rescue arms still test the same mediator.

Pool-specific prediction (mechanism, not fitted): under Liebig minimum the
binding pool is whichever has the smallest `nut[p][ci]/(demand*aff[p])`. Pool
capacities are `[1.0, 0.78, 0.62] x nutrientPerCell x fertility`, so B and C are
the expected binding pools. Reported per pool, never assumed.

Target: the `recalcOnly` expressed mineraliser phenotype (O3 classes), not the
decomposer displayed guild.

## 3. Arms (one matched panel, per seed)

Same resolved L1 config in all three arms; only research knobs differ:

- **A** — natural mineralisation; `phenoMineralReturn` null, `phenoMineralRescue` null.
- **B** — O1 `phenoMineralReturn: {carrionOnly:1, recalcOnly:0, dual:1}`, rescue null.
- **C** — identical B suppression with O2 `phenoMineralRescue:
  {carrionOnly:false, recalcOnly:true, dual:false}` (same-event external
  replacement).

## 4. Prerequisites and STOP rules (declared before running)

- **R1 local-limitation reachability (primary prerequisite).** At each declared
  sample, for every alive producer-DISPLAYED organism: compute its cell `ci`,
  read `affinity_A/B/C` from expressed traits and `nut[p][ci]` for p with
  `affinity[p] > 1e-4`; count organisms where at least one such pool is
  `<= 1e-9` (empty). **R1 is MET** if, on at least one seed, that fraction is
  **>= 5%** at BOTH t250 and t500 (two consecutive declared samples spanning
  >= 250 ticks; with ~200-300 producers, 5% is ~10-15 organisms). Binding pool
  identified by the per-pool empty counts. Both seeds and all samples are
  reported regardless.
- **R2 lost-flow interpretability.** At the events themselves, `shadow.accepted
  − actual.accepted` for the `recalcOnly` class must be non-negligible and
  interpretable, and C's exogenous `attempted/accepted/capLoss/eviction` must
  reconcile against it. Never substitute between-world cumulative totals as a
  dose or a loss figure.
- **STOP-A (prerequisite unmet).** If R1 fails on both seeds → STOP after this
  candidate. Record the valid negative; no B/C expansion, no tuning, no second
  candidate.
- **STOP-B (loss uninterpretable).** If R2 fails → STOP and report. No rescue
  arm expansion, no global subsidy.

## 5. Bounded hypothesis (stated now, with direction-only falsifiers)

**H-L1.** *Conditional on R1 and R2 being met: under L1, suppressing `recalcOnly`
mineralisers measurably reduces producer-DISPLAYED nutrient uptake, producer
energy and realised placed births relative to matched A; and O2 same-event
replacement measurably moves producer uptake/energy back toward A relative to
B.*

Falsifiers (direction-only; NO magnitude threshold, NO post-hoc cut, NO seed
hunting):
- **H-L1 FALSIFIED** if B does not reduce producer-displayed uptake relative to
  A on EITHER seed, or if C does not move producer uptake relative to B on
  EITHER seed, in the direction the hypothesis requires.
- **H-L1 SUPPORTED** if B reduces producer-displayed uptake relative to A on
  BOTH seeds AND C moves that measure back toward A relative to B on BOTH seeds.
- **H-L1 INCONCLUSIVE** if the two seeds disagree in direction (heterogeneity).
No effect-size threshold is invented; green G35 and any single A-vs-C census
difference prove nothing about producer nutrient-mediated dependence.

## 6. Measured endpoints (declared now)

At t0/t100/t250/t500, per arm, per seed:
- producer-DISPLAYED photo uptake per pool `photoUptake[0][p]`; all-guild
  aggregate reported separately and never labelled producer uptake;
- alive producer-displayed energy (sum of `store.energy` over live
  producer-displayed slots; units = engine energy units) and census by displayed
  guild;
- realised placed births (engine counters), DIRECT `demographics().deaths`
  interval counts by guild and cause (starve/age/damage), plus births by path;
- local limitation: per-pool empty-affinity-pool producer counts and fraction
  (the R1 statistic), plus per-pool headroom `nut[p][ci]/cap[p]` summary for
  context;
- nutrient field stocks and per-pool cap utilisation;
- disjoint mineraliser phenotype counts and per-source (sediment/detritus/litter)
  accepted biotic return by class (O3 books);
- `shadow.accepted − actual.accepted` per class/pool/source (lost flow), and O2
  exogenous attempted/accepted/capLoss/eviction per class/pool/source;
- abiotic regeneration reported separately from exogenous replacement;
- matched-arm population histories at the declared samples.

## 7. Constraints

No seed hunting, no threshold shifting, no second candidate, no biology edits,
no merge, no main change, no PR #14 chemistry work, no 12+24 cohort.