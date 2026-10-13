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