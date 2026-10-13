# Diagnostics — `chemistryPredationMatter` ride-along (post-hoc)

**Date:** 2026-10-13
**Engine:** `ts-evo-poc/0.7.0+chem/0.7.0`
**Runner:** `scripts/chem-predation-knob.mjs`
**Raw output:** `evidence/chem-predation-knob-gd3-10seed-20261013.txt`

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
| base | 6 | 3–29 | 10 | 0.0000 | 0.0002% | 0.074 |
| predationMatter | 9 | 2–52 | 17 | 6.9466 mol | 0.0002% | 0.078 |

Population increases on 6/10 seeds, decreases on 2/10, and is unchanged on 2/10.
Births increase on 7/10 seeds, decrease on 3/10. Median population is 6->9 and
median births 10->17.

## Per seed

| seed | base pop | matter pop | pop delta | base births | matter births | birth delta | matter carbon |
|---|---:|---:|---:|---:|---:|---:|---:|
| 517 | 28 | 52 | +24 | 36 | 64 | +28 | 2.0960 |
| 1013 | 3 | 3 | 0 | 3 | 3 | 0 | 6.2879 |
| 24601 | 4 | 6 | +2 | 6 | 21 | +15 | 4.8169 |
| 7 | 8 | 9 | +1 | 7 | 18 | +11 | 11.7571 |
| 99 | 6 | 7 | +1 | 2 | 8 | +6 | 7.7680 |
| 31337 | 4 | 2 | -2 | 13 | 5 | -8 | 20.1644 |
| 4242 | 3 | 3 | 0 | 4 | 4 | 0 | 3.0481 |
| 8080 | 6 | 12 | +6 | 10 | 17 | +7 | 16.2938 |
| 555 | 14 | 12 | -2 | 15 | 7 | -8 | 4.1515 |
| 12345 | 29 | 38 | +9 | 39 | 42 | +3 | 6.9466 |

## Immediate reading

- **The mechanism is active and finite.** Base arm moves exactly 0 carbon; the
  ride-along arm transfers 6.29 mol median. Arms differ.
- **Conservation is preserved.** The C residual remains within the normal
  sub-0.01% range; the ride-along does not mint matter. G35 additionally checks
  stoichiometric proportionality directly on synthetic slots.
- **The effect is mixed but consistently positive on births.** Median population is
  6→9; median births 10→17. The strongest single change is seed 517
  (28→52, births 36→64). Three seeds show fewer births with the knob on.

## Sexual reproduction and generation depth

The ride-along does **not** improve the sexually reproducing lineage:
- base: 4 sexual births total (2 each on seeds 555 and 12345); mean live
  generation depth 0.021; max 1.
- predationMatter: 2 sexual births total (both on seed 12345); mean live
  generation depth 0.005; max 1.

No arm demonstrates sustained multi-generation inheritance. This is a negative
result and is recorded as such.

## What is NOT claimed

- No viability rescue is claimed. A higher population on some seeds is not
  evidence of sustainability or ecology improvement.
- No sustained multi-generation outcome is claimed.
- No full food web is claimed. This only demonstrates that the prey→predator
  energy drain can carry a stoichiometric matter transfer internally.
- Default behaviour remains energy-only: the knob is null-default and does not
  change parity-pinned behaviour.
