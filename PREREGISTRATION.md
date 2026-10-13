# Pre-registration — chemistry-enabled ecosystem experiment

**Model identity:** `ts-evo-poc/0.6.0+chem/0.7.0`
**Written:** 2026-10-13, before any cohort in this document was run.
**Engine:** seed-driven, null-default chemistry knob, parity exact against
`ts-evo-poc/0.6.0`.

## Why this document exists

The engineering base is validated: 40/40 gates, elemental conservation to four
decimals across C, N, P, S and Fe, reproduction restored and demonstrated
counterfactually. **None of that says anything about whether the ecosystem
works.** Conservation proves matter is neither created nor destroyed. It is
compatible with a world where nothing is ever built, and one where nothing is
ever born — both were observed here before this document was written.

Everything below is a claim about ECOLOGY. Each states, in advance, what
observation would falsify it. A hypothesis with no falsification condition is
not a prediction.

## Standing rules (apply to every arm)

1. **One seed is not a verdict.** Every population claim uses ≥ 10 seeds and
   reports the distribution, not a mean alone.
2. **Arms must differ before either is read as biology.** Byte-identical output
   across different inputs means the variable never varied. Checked for every
   arm pair.
3. **A changed state digest is activity, not improvement.** A larger terminal
   population can accompany runaway growth, substrate collapse, or guild loss.
4. **Nulls are results.** A reaction that never fires is recorded as never
   firing, not omitted.
5. **Evidence predating `chem/0.7.0` describes older semantics.** Every
   conservation figure recorded before 2026-10-13 was measured on an engine in
   which no organism reproduced. It is provenance, not current behaviour.
6. Thresholds are the Owner's to set. Where a verdict would depend on an unset
   threshold, the result is reported as a measurement, not a pass or a fail.

## H1 — The ecosystem is nutrient-limited, not energy-limited

**Prediction.** Under `chem/0.7.0`, growth is more often limited by matter than
by energy: `nutrientLimited` events exceed `energyLimited` events by more than
an order of magnitude.

**Falsified if.** The ratio is below 10:1, or the two are within an order of
magnitude of each other.

**Confounds controlled.** Same seeds, same horizon, same config in both arms;
only the counted quantity differs. The counters are incremented inside
`grow()`, so a run that never grows cannot inflate either.

**Known before writing.** Seed 517 at 250 ticks gives roughly 81,000
`nutrientLimited` against 4 `energyLimited`. This hypothesis is therefore close
to already answered on one seed. It is registered because the ORDERING has not
been tested across seeds, and because a one-seed result of this kind has
previously overstated effects in this repository.

## H2 — Removing mineral nutrients stops reproduction

**Prediction.** Same seed, same horizon: births with nutrients present exceed
zero; births with nutrients removed are exactly zero.

**Falsified if.** Either arm is zero, or the starved arm produces any births.

**Status.** Already demonstrated by gate G29 on seed 517 (12 vs 0). Registered
across ≥ 10 seeds because a single-seed counterfactual is a demonstration, not a
cohort.

## H3 — Anaerobic guilds have nonzero realized opportunity

**Prediction.** Fermentation, sulfate reduction and denitrification each achieve
nonzero cumulative extent over ≥ 5 of 10 seeds, and the hypoxic fraction is
nonzero at some tick.

**Falsified if.** Any anaerobic reaction has zero extent on all 10 seeds, or
hypoxic fraction is identically zero throughout every run.

**Recorded now, before running.** At 300 ticks on seed 517 the hypoxic fraction
was measured at 0.0000 and denitrification at extent 0.000 with zero runs. This
hypothesis is **currently trending falsified** and is registered in that state
deliberately: it is the most interesting open question in the model, and
recording the expectation only if it were true would guarantee it could never
be tested.

**Note on the earlier reading.** An earlier update reported this as "a
biological finding, not a bookkeeping leak". That was wrong — it was a symptom
of a mis-stated baseline, since corrected. It is re-registered here as a fresh
question rather than a carried-forward conclusion.

## H4 — Chemosynthesis contributes measurable carbon fixation

**Prediction.** Sulfur oxidation and iron oxidation each achieve nonzero
cumulative extent on ≥ 3 of 10 seeds, and together account for a non-trivial
share of total organic carbon production on those seeds.

**Falsified if.** Both have zero extent on all 10 seeds.

**Confounds controlled.** Reaction activity is read from `chemEvidence.extent`,
which is cleared per organism per tick, so a reaction that stops firing reads
zero rather than retaining its previous value.

## H5 — Metabolic capability is heritable and variable

**Prediction.** Iron-uptake capability segregates within the population on ≥ 8
of 10 seeds, and offspring capability correlates with parental capability.

**Falsified if.** Capability is universal or absent on a majority of seeds, or
offspring capability is uncorrelated with parental capability.

**Known before writing.** Seed 517 at 600 ticks: 152 organisms carry iron
uptake, 45 do not. Registered across seeds.

## H6 — Performance holds at scale

**Prediction.** A 1,000-organism run sustains ≥ 20 ticks/s; 5,000 sustains
≥ 5 ticks/s; 10,000 sustains ≥ 2 ticks/s on this hardware.

**Falsified if.** Any scale misses its floor.

**Note.** This is a measurement on an ARM64 phone under Termux/proot and is not
a portable claim about the engine. Numbers are reported with the machine
described, not as an abstract benchmark.

## H7 — Long-horizon the ecosystem does not self-sustain

**Prediction.** Terminal population at 2,000 ticks is below the 400-founder
starting count on a majority of seeds.

**Falsified if.** Terminal population exceeds the founding count on ≥ 6 of 10
seeds.

**Recorded now, before running.** At 1,000 ticks on seed 517 the population fell
400 → 141. This hypothesis is registered because the fall is unexplained, and
because "the ecosystem dies out" is a substantive claim that must be measured
across seeds rather than inferred from one declining run.

## What is deliberately NOT hypothesised

- No target population. No arm is expected to reach any particular size.
- No expected guild composition or trophic structure.
- No expectation that chemistry *improves* the ecosystem. It may make it worse.
  The comparison is chemical-present versus chemical-absent on identical seeds,
  and either direction is reportable.
- No claim that the chemistry resolves the three-guild coexistence shortfall.
  That question is untouched by this document.

## Reporting rule

Every result below the line is reported with its seed, horizon, engine identity
and resolved configuration. A falsified prediction is reported as falsified in
the summary, not omitted. Under the Owner's decision of 2026-10-11, a green
workflow means the evidence is trustworthy — never that the hypothesis was
correct.

---

# RESULTS (recorded after the run; do not edit the section above)