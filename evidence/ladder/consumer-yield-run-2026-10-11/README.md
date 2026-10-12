# consumer-yield — 18-seed panel, engine ts-evo-poc/0.6.0

**PROVENANCE — READ THIS BEFORE CITING.**

This is a **LOCAL** run, executed on the development device against the compiled
engine. It was **NOT** dispatched through GitHub Actions and it has **no Actions
run ID**. It is filed here because the verdict it supports was previously recorded
in `REPORT.md` without its underlying artifacts, and `evidence/` is the record.
It is *not* filed as an Actions run and must not be described as one.

  arm          consumer-yield
  engine       ts-evo-poc/0.6.0
  commit       1185003dad38c556a057980fb9f02eb38ae42904
  armSpecHash  1f4a9e01a8a310bd915b5720708c08705f38630be788a3f7fb56ea349e4caa74
  horizon      6000 ticks — the arm's DECLARED horizon, no override
  panel        41001-41018, all 18 measured exactly once across two legs
  integrity    INTACT
  verdict      **FALSIFIED** (exit 0)

## Result

| Criterion | Measured | Threshold | |
|---|---|---|---|
| consumers > 0 at tick 6000 | 14/18 | >= 12/18 | MET |
| all three guilds non-zero at tick 6000 | 5/18 | >= 12/18 | **NOT MET** |

Both clauses were required; one failed, so the prediction is falsified. The
workflow would exit 0 because the evidence is trustworthy — falsification is a
result, not a failure. See the exit policy in `AGENTS.md`.

## Reproducibility

Re-executing this panel reproduces these numbers exactly. The same 18 seeds gave
14/18 and 5/18 on three separate commits of this branch (daeeb6a, 498697b,
1185003), and seed 41001 was additionally re-run in isolation and matched
byte-for-byte. Determinism holds within one JS runtime; see `AGENTS.md` for the
cross-engine caveats, which do not apply here because every run used Node 24.

## Relationship to the prospective panel

This panel and `../prospective-guilds-run-38151553007/` are two 18-seed
measurements of the same *system*, on disjoint seed panels, with matching engine
settings. **They are not two measurements of the same registered prediction** —
the two arms made opposing calls, and each was scored against its own.

| | `consumer-yield` | `prospective-guilds` |
|---|---|---|
| seeds | 41001-41018 | 52001-52018 (unseen at registration) |
| run type | local (this directory) | Actions 38151553007 |
| registered prediction | three-guild **at least 12/18** | three-guild **at most 8/18** |
| measured, all three guilds | **5/18** | **7/18** |
| verdict | **FALSIFIED** | **SUPPORTED** |

The second arm was registered to test whether the *shortfall* generalised, and
it did — not as a second attempt at the original >=12/18 claim, which this panel
had already refuted. Reading them as "the same falsified prediction, twice"
would erase that the prospective registration predicted a different outcome and
was confirmed.

## What reproduces, and what does not

Per-guild presence, recomputed from the per-seed CSVs of both runs:

| Guild | `consumer-yield` 41001-41018 | `prospective-guilds` 52001-52018 |
|---|---|---|
| producers > 0 | 14/18 | 12/18 |
| consumers > 0 | 14/18 | 14/18 |
| **decomposers > 0** | **8/18** (extinct 10/18) | **14/18** (extinct 4/18) |
| all three > 0 | 5/18 | 7/18 |

**Low three-guild coexistence reproduces** (5/18 and 7/18, both below 12/18).
**Decomposer extinction does not.** Decomposers were gone on a majority of
`consumer-yield` seeds but on only 4 of 18 prospective seeds. Any earlier framing
of "decomposers go extinct on most seeds" as a replicated result is wrong and is
corrected in `REPORT.md`.

Note also what the prospective panel implies: decomposers are present on 14/18
and producers on 12/18, yet all three co-occur on only 7/18. There the binding
constraint is the *joint* requirement, not decomposer persistence alone.

## Contents

  leg0/  leg1/     one directory per shard, as uploaded by a ladder run
    manifest.json  declared arm, resolved identity, per-seed results
    summary.csv    per-seed guild counts, ledger residual, policy outcomes
    seed-*.txt     raw probe stdout, immutable

Per-leg outputs are deliberately NOT merged: merging hand-written rows into one
combined measurement would fabricate a result nobody ran.