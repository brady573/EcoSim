# Diagnostics — `chemistryPredationMatter` ride-along (post-hoc)

**Date:** 2026-10-13
**Engine:** `ts-evo-poc/0.7.0+chem/0.7.5`
**Runner:** `scripts/chem-predation-knob.mjs`
**Raw output:** `evidence/chem-predation-knob-10seed-075-20261013.txt`

This is a **post-hoc diagnostic result**, not a pre-registered hypothesis run. A 5-seed first pass was superseded by this 10-seed panel.
The comparison is base chemistry versus the same config with the null-default
knob `chemistryPredationMatter: true`. Its purpose is to demonstrate a
conservation-safe mechanism, not to claim the ecosystem becomes more viable,
sustainable, or fully integrated.

## Arms

| arm | config delta |
|---|---|
| base | none |
| predationMatter | `chemistryPredationMatter: true` |

Seeds: 517, 1013, 24601, 7, 99, 31337, 4242, 8080, 555, 12345. Horizon 1000 ticks, founders 400, `genomeV2: true`.

## Results

| arm | pop median | pop range | births median | carbon transferred median | C residual median | settle clamp max |
|---|---:|---:|---:|---:|---:|---:|
| base | 6 | 3–39 | 6 | 0.0000 | 0.0002% | 0.077 |
| predationMatter | 8 | 1–46 | 9 | 7.0149 mol | 0.0002% | 0.076 |

Population increases on 5/10 seeds, decreases on 2/10, and is unchanged on 3/10.
Median population is 6→8 and median births 6→9. The effect remains mixed.

## Per seed

| seed | base pop | matter pop | pop delta | base births | matter births | birth delta | matter carbon |
|---|---:|---:|---:|---:|---:|---:|---:|
| 517 | 39 | 46 | +7 | 46 | 57 | +11 | 5.5430 |
| 1013 | 3 | 3 | 0 | 3 | 3 | 0 | 7.7881 |
| 24601 | 4 | 6 | +2 | 6 | 21 | +15 | 6.3171 |
| 7 | 8 | 10 | +2 | 6 | 10 | +4 | 9.2799 |
| 99 | 6 | 6 | 0 | 5 | 5 | 0 | 7.7126 |
| 31337 | 3 | 1 | -2 | 5 | 5 | 0 | 20.8456 |
| 4242 | 3 | 3 | 0 | 4 | 2 | -2 | 4.0862 |
| 8080 | 6 | 13 | +7 | 7 | 17 | +10 | 17.8297 |
| 555 | 17 | 13 | -4 | 17 | 7 | -10 | 5.6183 |
| 12345 | 18 | 24 | +6 | 30 | 27 | -3 | 5.0280 |

## Immediate reading

- **The mechanism is active and finite.** Base arm moves exactly 0 carbon; the
  ride-along arm transfers 7.01 mol median. Arms differ.
- **Conservation is preserved.** The C residual remains within the normal
  sub-0.01% range; the ride-along does not mint matter. G35 additionally checks
  stoichiometric proportionality directly on synthetic slots.
- **The effect is mixed.** Median population is
  6→8; median births 6→9. The strongest single change is seed 517
  (39→46, births 46→57). Six seeds show equal or fewer births with the knob on.

## Sexual reproduction and generation depth

- base: 0 sexual births; mean live generation depth 0.000; max 0.
- predationMatter: 4 sexual births; mean live generation depth 0.028; max 1.

This does not establish sustained multi-generation inheritance.

## What is NOT claimed

- No viability rescue is claimed. A higher population on some seeds is not
  evidence of sustainability or ecology improvement.
- No sustained multi-generation outcome is claimed.
- No full food web is claimed. This only demonstrates that the prey→predator
  energy drain can carry a stoichiometric matter transfer internally.
- Default behaviour remains energy-only: the knob is null-default and does not
  change parity-pinned behaviour.
