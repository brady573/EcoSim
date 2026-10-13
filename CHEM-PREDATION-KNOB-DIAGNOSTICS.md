# Diagnostics — `chemistryPredationMatter` ride-along (post-hoc)

**Date:** 2026-10-13
**Engine:** `ts-evo-poc/0.7.0+chem/0.7.0`
**Runner:** `scripts/chem-predation-knob.mjs`
**Raw output:** `evidence/chem-predation-knob-070-20261013.txt`

This is a **post-hoc diagnostic result**, not a pre-registered hypothesis run.
The comparison is base chemistry versus the same config with the null-default
knob `chemistryPredationMatter: true`. Its purpose is to demonstrate a
conservation-safe mechanism, not to claim the ecosystem becomes more viable,
sustainable, or fully integrated.

## Arms

| arm | config delta |
|---|---|
| base | none |
| predationMatter | `chemistryPredationMatter: true` |

Seeds: 517, 1013, 24601, 7, 99. Horizon 1000 ticks, founders 400, `genomeV2: true`.

## Results

| arm | pop median | pop range | births median | carbon transferred median | C residual median | settle clamp max |
|---|---:|---:|---:|---:|---:|---:|
| base | 6 | 3–28 | 6 | 0.0000 | 0.0002% | 0.074 |
| predationMatter | 7 | 3–52 | 18 | 6.2879 mol | 0.0003% | 0.078 |

### Per seed

| seed | base pop | matter pop | base births | matter births | matter carbon |
|---|---:|---:|---:|---:|---:|
| 517 | 28 | 52 | 36 | 64 | 2.0960 |
| 1013 | 3 | 3 | 3 | 3 | 6.2879 |
| 24601 | 4 | 6 | 6 | 21 | 4.8169 |
| 7 | 8 | 9 | 7 | 18 | 11.7571 |
| 99 | 6 | 7 | 2 | 8 | 7.7680 |

## Immediate reading

- **The mechanism is active and finite.** Base arm moves exactly 0 carbon; the
  ride-along arm transfers 6.29 mol median. Arms differ.
- **Conservation is preserved.** The C residual remains within the normal
  sub-0.01% range; the ride-along does not mint matter. G35 additionally checks
  stoichiometric proportionality directly on synthetic slots.
- **The effect is mixed.** Median population is 6→7 and median births 6→18; the
  strongest population change is seed 517, where population goes 28→52. Other
  seeds are small population changes with larger birth increases.

## What is NOT claimed

- No viability rescue is claimed. A higher population on some seeds is not
  evidence of sustainability or ecology improvement.
- No sustained multi-generation outcome is claimed.
- No full food web is claimed. This only demonstrates that the prey→predator
  energy drain can carry a stoichiometric matter transfer internally.
- Default behaviour remains energy-only: the knob is null-default and does not
  change parity-pinned behaviour.
