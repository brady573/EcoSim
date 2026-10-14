# Diagnostics — `chemistryPredationMatter` ride-along (post-hoc)

**Date:** 2026-10-13
**Engine:** `ts-evo-poc/0.7.0+chem/0.7.7`
**Runner:** `scripts/chem-predation-knob.mjs`
**Raw output:** `evidence/chem-predation-knob-10seed-077-20261013.txt`

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
| base | 8 | 2–36 | 9 | 0.0000 | 0.0002% | 0.067 |
| predationMatter | 9 | 3–40 | 9 | 5.9226 mol | 0.0002% | 0.068 |

Population increases on 4/10 seeds, decreases on 4/10, unchanged on 2/10.
Births: 3 up, 4 down, 3 unchanged. Median population 8→9; median births 9→9.

## Per seed

| seed | base pop | matter pop | pop delta | base births | matter births | birth delta | matter carbon |
|---|---:|---:|---:|---:|---:|---:|---:|
| 7 | 10 | 7 | -3 | 11 | 8 | -3 | 9.8610 |
| 99 | 5 | 11 | +6 | 8 | 17 | +9 | 4.8662 |
| 517 | 36 | 40 | +4 | 47 | 41 | -6 | 1.0178 |
| 555 | 14 | 13 | -1 | 10 | 10 | +0 | 5.6183 |
| 1013 | 3 | 3 | +0 | 2 | 6 | +4 | 6.2269 |
| 4242 | 4 | 3 | -1 | 5 | 4 | -1 | 4.1488 |
| 8080 | 33 | 19 | -14 | 36 | 20 | -16 | 15.8937 |
| 12345 | 26 | 33 | +7 | 39 | 51 | +12 | 7.3150 |
| 24601 | 5 | 5 | +0 | 7 | 7 | +0 | 1.6428 |
| 31337 | 2 | 3 | +1 | 5 | 5 | +0 | 16.3044 |

## Immediate reading

- **The mechanism is active and finite.** Base arm moves exactly 0 carbon; the
  ride-along arm transfers 5.92 mol median. Arms differ.
- **Conservation is preserved.** The C residual remains within the normal
  sub-0.01% range; the ride-along does not mint matter. G35 additionally checks
  stoichiometric proportionality directly on synthetic slots.
- **The effect is mixed.** Median population 8→9 and median births 9→9, but
  the per-seed spread is wide in both directions: population +6 (seed 99) to
  -14 (seed 8080). The largest single regression, seed 8080, is also the only
  seed with sexual births in the base arm, so the ride-along does not
  consistently help even the lineages that can recombine.

## Sexual reproduction and generation depth

- base: 4 sexual births (seeds 8080); mean live generation depth 0.012; max 1.
- predationMatter: 6 sexual births (seeds 517, 8080); mean live generation depth 0.026; max 1.

Sexual recombination occurs on 1/10 base seeds and 2/10 predation-matter seeds, so the lineage is not strictly asexual, but it does not persist: no arm sustains a recombined lineage to a multi-generation outcome at 1000 ticks. Mixed result, recorded as such.

## What is NOT claimed

- No viability rescue is claimed. A higher population on some seeds is not
  evidence of sustainability or ecology improvement.
- No sustained multi-generation outcome is claimed.
- No full food web is claimed. This only demonstrates that the prey→predator
  energy drain can carry a stoichiometric matter transfer internally.
- Default behaviour remains energy-only: the knob is null-default and does not
  change parity-pinned behaviour.
