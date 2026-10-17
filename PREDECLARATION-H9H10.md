# Pre-declaration: H9 and H10

**Committed before the intervention matrix below was executed.**
Engine `ts-evo-poc/0.6.0+chem/0.7.0`. Seeds: 517, 1013, 24601, 7, 99.
Horizon: 1000 ticks. Founders: 400.

## Context these hypotheses come from

Seed 517 traced end to end, all boundaries reconciled:

- carbon residual 0.0003%, N/P/S/Fe 0.0000% — the books close
- weathering supplies 22,000 mol C; photosynthesis converts only **2,156** of it
  into organic carbon, and DIC accumulates to 22,503
- organisms assimilate 3,200 mol C into stores and build only **350** mol of
  tissue; 3,311 mol returns on death
- **chemical energy income is 3,865 — 0.0135% of legacy energy income (28.5M)**
- deaths: 261 starve, 11 age, 123 damage; births 136; net −259
- 95 of 141 survivors fail the reproduction gate first on **carbon**
- OC per cell median 0.166 mol × efficiency 0.62 = 0.103 mol/tick available
  against a 0.20 mol/tick cap: **supply-limited, not rate-limited**

## H9 — organic-carbon SUPPLY per cell is the binding constraint

**Prediction.** Raising CO2 weathering — and therefore the photosynthetic
supply of labile organic carbon — raises reproduction and terminal population
monotonically across at least a 10× range.

**Intervention.** `chemistryCo2WeatheringScale` ∈ {1, 3, 10, 30}.

**Falsified if.** Population is flat (within ±20%) across that range, or
non-monotonic.

## H10 — chemistry matter is invisible to the legacy food web

**Prediction.** Bridging chemistry death tissue into the legacy detritus field
raises population, because the legacy starvation clock is currently fed by a
book that chemistry matter never enters.

**Intervention.** `chemistryToLegacyDetritus` ∈ {false, true}, converting at a
declared **arbitrary** 0.5 legacy units per mole of tissue carbon.

**Falsified if.** The bridged arm is not higher than the unbridged arm.

## H11 — the mechanisms are additive

**Prediction.** Applying both interventions together exceeds either alone, and
the combined arm approaches or exceeds the chemistry-off population (~1640 on
seed 517, median across seeds).

**Falsified if.** The combination is no better than the better single arm.

## Controls

- `chemistryFreeNutrients` reported alongside as an upper reference, because
  the carbon gate and the general nutrient gate are not the same mechanism and
  must not be conflated.
- chemistry-off reported as the external reference.
- Every arm is checked for byte-distinct output; an arm identical to another
  means the variable never varied.
- Arms that are expected to be identical (`toLegacyDetritus` off, and
  `noAnaerobic`) are reported as identical rather than dropped.

## What would make a result untrustworthy

- If `chemistryCo2WeatheringScale` changes DIC but not OC, the intervention is
  not reaching the organic pool and H9 is untested, not falsified.
- If the bridged arm changes population but leaves legacy detritus unchanged,
  the bridge is not where the effect came from.

## Not claimed

No arm is expected to reach any particular population. A larger population is
not automatically the better result, and the chemistry-off arm is a reference,
not a target to be reached by tuning.

# RESULTS

(recorded after execution)
## Results (5 seeds, 1000 ticks, median population)

| arm | pop median | pops | births | starve | legacy detritus | OC |
|---|---|---|---|---|---|---|
| base | 10 | 141,7,19,10,9 | 191 | 1359 | 415 | 2024 |
| H9 scale 3 | 9 | 125,7,20,9,9 | 181 | — | 419 | 2052 |
| H9 scale 10 | 9 | 91,7,17,9,8 | 141 | — | 440 | 2034 |
| H9 scale 30 | 10 | 86,7,17,10,9 | 136 | — | 417 | 2037 |
| **H10 bridge** | 12 | 102,9,16,12,8 | 144 | 1350 | **726** | 2022 |
| H11 both | 11 | 90,9,19,11,10 | 147 | 1360 | 712 | 2034 |
| ref free nutrients | 290 | 900,519,290,131,253 | 3358 | 2573 | 315 | 1170 |

### H9 — UNTESTED, not falsified

Exactly the failure mode declared in advance: **the intervention changed DIC
but not OC.** Scaling CO2 weathering 30x raised DIC from 22,581 to 660,579 mol
and left OC flat at ~2,030. Population did not move.

So the lever was wrong, not the hypothesis. Photosynthesis declares
`limits: [DIC, PO4, NH4]` and is additionally light-gated, so organic carbon
production is not CO2-limited. **H9 remains open and needs a different
intervention** — phosphate/ammonium supply, or the photosynthetic rate itself.

### H10 — FALSIFIED

The first run of this arm was **byte-identical to base** and the cause was two
bugs in my own intervention, both recorded:

1. `detritus.index()` was passed WORLD coordinates (884.6, 1770.5) for a
   100x100 field, producing a fractional offset near 177,931 into a
   10,000-element array. The bridge wrote nowhere the food web reads.
2. I then read the flag off `chemistry.cfg` when the bridge reads
   `world.chemCfg` — different objects — and concluded the flag was unset when
   it was already correct.

An inert intervention that produces a null is the most dangerous result in this
repository, because it reads as evidence. Both bugs are recorded at the fix site.

With the bridge working, legacy detritus rises 415 → 726 (+75%) and the
population does not recover: median 10 → 12, and births FALL 191 → 144.
**Chemistry matter becoming visible to the legacy food web does not relieve the
constraint.**

### H11 — FALSIFIED

The combination is no better than either single arm (11 against 10 and 12).

### What survives all three

`chemistryFreeNutrients` still gives 290 against base 10 — a **29-fold**
difference. It is the only intervention in the matrix that moves the outcome,
and it is not one of the two hypothesised mechanisms. The binding constraint is
the nutrient gate itself.

The reconciliation with the earlier finding that 95 of 141 survivors fail first
on **carbon in stores** is this: OC is abundant and unaffected by every arm, so
the gate is not failing on carbon SUPPLY. It fails because the store is a
**throughput, not a stockpile** — carbon enters, becomes tissue, and leaves on
death faster than a full complement can accumulate. `canAffordOffspring` demands
a stock that this metabolism cannot hold.

## Ecology comparison (10 seeds, 1000 ticks)

| | chemistry ON | free nutrients | chemistry OFF |
|---|---|---|---|
| population median | 19 | 325 | **1465** |
| range | 3-141 | 131-900 | 1067-1903 |
| declining vs 400 founders | 10/10 | 6/10 | **0/10** |
| births total | 315 | 6282 | 19917 |
| asexual / sexual | 300 / 15 | 5964 / 318 | 18394 / 1523 |
| deaths: starve / age / damage | 2669 / 137 / 1188 | 4966 / 235 / 1165 | 6421 / 633 / 2770 |
| max generation depth | **1** | 2 | **4** |
| mean generation depth | 0.08 | 0.09 | 0.10 |
| conservation C / N / P / S / Fe | 0.0002 / 0 / 0 / 0 / 0 % | 0.0005 / 0 / 0 / 0 / 0 % | n/a |
| performance (median) | 253 ticks/s | 168 | 313 |

### Guild births (producer / consumer / decomposer), per seed

- **chemistry ON**: `136/0/0  8/0/0  12/4/0  18/4/0  2/2/5  4/3/0  5/3/0  15/0/0  13/2/0  46/7/0`
- **chemistry OFF**: `2110/54/7  1930/103/0  1649/155/0  1285/140/1  1535/322/6  1589/877/0  1741/188/2  1778/120/3  1937/134/2  2104/141/4`

**DECOMPOSERS PRODUCE ZERO BIRTHS UNDER CHEMISTRY ON 9 OF 10 SEEDS**, and on
the tenth they produce 5. With chemistry off they breed on 6 of 10 seeds. This
is the direct answer to the three-guild coexistence question this whole exercise
was opened to ask, and it is negative: **chemistry does not solve the shortfall,
it removes the decomposer guild from the reproductive process entirely.**

### Generations

Maximum generation depth is 1 with chemistry, 4 without, while MEAN depth is
~0.08-0.10 in every arm. Reproduction is overwhelmingly asexual (95%+) in all
three arms, so even the chemistry-off ecosystem is shallow in lineage terms. A
mean generation depth below 0.1 means almost the entire population is
founders or their immediate descendants — no arm demonstrates sustained
multi-generation inheritance at 1000 ticks.

### Performance

Chemistry costs essentially nothing: 253 ticks/s against 313 with chemistry
off, a 19% difference at these populations. Conservation is exact in both
chemistry arms.
