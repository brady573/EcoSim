# `chem/0.8.0` correction tranche — preregistered re-measurement

Status: **PREREGISTERED, THEN MEASURED.** The section below was written before
any run of this panel started; the Results section was appended only after the
raw archive existed on disk (`evidence/cho-080-20261018/`, complete.json
written by the runner).

## What this panel is

A small re-measurement for the Owner-directed `chem/0.8.0` multielement C/H/O
contract (`CHEM-080-CONTRACT.md`), run under unchanged experiment settings:
**400 founders, 1000 ticks**, observer twins (plain + chemistry-boundary) with
byte-identical state at every tick, null control versus a single
nitrification omission.

Identity: `ts-evo-poc/0.8.0+chem/0.8.0`, omission arm
`ts-evo-poc/0.8.0+chem/0.8.0+rxomit/1/nitrification`. Raw archive:
`evidence/cho-080-20261018/`.

## Frozen selection (before outcomes)

- Seeds: `41001, 41002` (recorded discovery replays) and `41003, 41004` (the
  first two of the registered exploratory pool). No other seed may be added to
  this panel after this line without being recorded as a separate tranche.
- Arms: `null`, `nitrification` — the same single-reaction omission the
  recorded 0.7.8 panel used.
- Configs: the recorded `chem/0.7.8` base config with the seed and the omission
  swapped; the runner asserts 400 founders before starting.
- 4 seeds × 2 arms = 8 runs; plain + observer twins = 16 full-horizon
  executions.

## Prediction (falsifiable)

1. **Closure.** All seven elements close through all 1000 ticks in both arms
   and all seeds: every `firstFailures` grid entry is empty. Under `chem/0.8.0`
   the H/O residual that the 0.7.8 panel first recorded at tick 17 has no
   remaining declared source.
2. **Movement.** The correction MOVED the model: both discovery replays differ
   from their recorded 0.7.8 hashes and births. An unchanged hash would falsify
   the claim that the contract change reached these trajectories, and the runner
   fails loudly on it.
3. **Contrast survives.** The null-versus-omission difference remains
   measurable in demography — the omission arm still registers zero extent for
   nitrification.

**Falsification condition:** any non-empty `firstFailures` entry, or a
discovery replay hash equal to the recorded 0.7.8 value. A falsified prediction
is a result and will be reported as one; it does not retroactively reclassify
old audits or license a quick fix inside this tranche.

## Confounds controlled

- Observer twins byte-identical per tick (`hashState`), with boundary digest
  equality at ticks 17/34/120/600/1000; `unreadLost = 0` asserted for both
  trace channels.
- Omission arm asserted to have zero nitrification extent while all other
  reactions remain live (G51 covers the omission mechanism itself).
- The retired 0.7.8 panel is immutable: the new runner does not rewrite it and
  the new checker does not re-derive its explanations under the new contract
  (frozen convention in `scripts/chem-attribution-078.mjs`).
- One-cell controls for the new contract are recorded with this panel
  (`one-cell-controls.json`), including the reserve-vs-unreserved burial pair:
  claim path → zero clamp, zero created carbon; unreserved path → clamp =
  created carbon = the burial amount.

## Limits

Exploratory scale, not a held-out verdict: 4 seeds is small, and per the
repository's own distribution directive no balance claim rests on it. No
ecological saturating claim, no confirmation inference, no merge authority.

---

# Results (measured 2026-10-18)

Raw archive: `evidence/cho-080-20261018/` — 8 runs, 16 full-horizon
executions, observer twins byte-identical at every tick, `unreadLost = 0`.

## Outcome against the preregistered prediction

**1. Closure — SUPPORTED.** **0 of 8 runs carry any strict-audit failure**: every
`firstFailures` grid entry is empty, in both arms and all four seeds, across
all 1000 ticks. Terminal strict residuals (control-41001): C `+7.68e-10`,
H `+6.24e-8`, O `-2.79e-9`, all within the existing criterion — no audit was
reclassified to make this true.

**2. Movement — SUPPORTED.** Both discovery replays differ from their recorded
0.7.8 hashes (`hashChanged = true` for control and nitrification at 41001 and
41002). Births moved on three of the four replays (control 41001: 31 → 38;
nitrification 41001: 44 → 47; nitrification 41002: 60 → 58); control 41002
kept 17 births while its state hash still changed.

**3. Contrast survives — SUPPORTED.** The omission arm records zero
nitrification extent in every run (runner assertion) while all other reactions
remain live.

## Old-versus-new first-failure contrast (discovery replays)

Recorded 0.7.8 panel, all four discovery replays: first-failure grid
`H 17 → none, O 17 → none, C 34 → none` under `chem/0.8.0`. The old terminal
books (control-41001) carried H `+432.6`, O `-1731.7`, C `+0.0618` as failed
strict audits. The old tick-34 C failure is recorded in that panel's own
attribution as clamp-created carbon: residual 1.065e-5 vs clampCreation
1.065e-5 (unexplained 8.4e-10) — the burial defect this tranche repairs. The
new run's total settled clamp over 1000 ticks is 2.6e-18 mol.

This is a contrast between two recorded engines, not a biological verdict about
either.

## Demography (new panel)

| seed | population control → omission | births control → omission | offspring-with-children control → omission |
|---|---|---|---|
| 41001 | 21 → 30 | 38 → 47 | 11 → 30 |
| 41002 | 8 → 38 | 17 → 58 | 0 → 22 |
| 41003 | 18 → 14 | 35 → 36 | 0 → 6 |
| 41004 | 24 → 16 | 30 → 35 | 15 → 6 |

Mean population **17.75 → 24.5**; mean births **30 → 44**. Four seeds is small:
this records the direction of the recorded omission contrast under the new
contract and nothing more.

## Controls recorded with this panel

`one-cell-controls.json`: five single-reaction closures (all seven elements
ok, unexplained ≤ 1e-9), the nitrification correction (defect vector zero with
`minO2` still positive), the declared denitrification N vent, and the burial
pair — reservation path clamp 0 / created carbon 0; unreserved path
clamp = created carbon = the burial amount (8.999999999999406e-8). The
unreserved arm is a harness mutation, never injected into a measured world.

## Limits of this result

Four seeds, exploratory; the closure claim is a claim about the DECLARED books
under this contract, not a claim that every modelled process is materially
complete (see `CHEM-080-CONTRACT.md` §6, especially the nitrification gate and
the predator energy-only link). No merge authority is implied.
