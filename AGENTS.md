# AGENTS.md — ts-evolution-poc (standalone experiment)

This is the engineering contract for **this repository only**. It replaces the
Digital-Evolution-Ecosystem contract, which does not apply here: that contract
governs import boundaries across `packages/sim-core`, `sim-analysis`,
`sim-runtime`, `sim-decisions`, `apps/explorer`, `tools/validation` and a frozen
`legacy/prototype/` tree. **None of those exist in this repository.** Do not
import its rules and do not claim compliance with them.

The global team policy at `~/.config/opencode/AGENTS.md` still applies in full.
This file governs repository practice only.

---

## What this repository is

`ts-evolution-poc` — a disposable, evidence-driven experiment in whole-ecosystem
evolutionary simulation. Single TypeScript tree. Engine version
`ts-evo-poc/0.5.0`.

- **STATUS: EXPERIMENTAL. NOT PRODUCTION CODE.**
- Judged on **reproducibility, honest accounting, emergence without forcing,
  and multi-seed method** — not on conformance to any product architecture.
- The Project Owner is the sole product and design authority. The Coding Agent
  owns implementation, validation and evidence *within* an accepted direction.

## Layout

```
src/world/     simulation engine — the biological authority
src/bio/       interactions, genome, roles
src/core/      deterministic RNG, math
src/trace/     read-only probes (senesprobe and friends)
src/app/       browser viewer entry (60fps decoupled render)
scripts/       build + app assembly + probe retry wrapper
evidence/      every measured run output; the record, not source
REPORT.md      full experimental record — falsifications included
```

There is no `packages/`, no `apps/`, no `tools/validation`, no `legacy/`, and
no pnpm workspace. `package.json` scripts are the only entry points.

## Authority

- **`src/world` is the biological authority.** Nothing else may mutate
  biological state. Presentation and probes read; they never write.
- **`src/trace/*` are read-only instruments.** A probe may construct a world,
  step it, and report. A probe may not patch engine internals to produce an
  outcome.
- **Appearance is a readout, never authority.** Rendering must not introduce
  population caps, alter abundance, or change behaviour to make presentation
  easier.
- **Emergence is an outcome.** No target-population rules, scripted ecosystem
  composition, or artificial abundance control. A knob that flattens variety
  to raise the mean is a regression, not a win.

## Reproducibility

```
engine version + resolved configuration + seed + command = reproducible run
```

- `Math.random()` is forbidden. All stochasticity derives from seeded streams.
- Working-tree changes and uncommitted state are supported; **commits are not
  required** for an experiment.
- Exact per-seed determinism holds on one JS runtime. Browser ↔ Node diverges
  in the last bits (libm in the gaussian draw): patterns reproduce, exact states
  do not. Do not report a browser divergence as a behavioural difference.

## The knob discipline

Every biological parameter is a **null-default, individually reversible
diagnostic**. This is not a style preference — it is what makes the evidence
base interpretable.

- `null` = declared behaviour, exactly. A knob set must restore declared
  behaviour on rollback with no residue.
- Toggles carry no meaningful partial state; dials carry magnitude. Do not
  convert one into the other casually.
- **A cost discount that does not reach the viability gates is a bug wearing a
  knob's clothes.** If a knob scales a charge, every gate that reads the same
  quantity must read the scaled value. Route both through one shared helper.
  This has bitten twice (`dormantThreatBlind` sensing waiver,
  `consumerBasalScale` starvation/breeding gates).
- **Never report a value that was not passed through.** A knob that parses,
  prints, and is never handed to the engine is dead, not negative.

## Validation

The narrowest meaningful check first. Distinguish implementation evidence,
automated-test evidence, static evidence and runtime evidence — they are not
interchangeable.

```sh
tsc -p tsconfig.json --noEmit                    # typecheck
tsx src/gates.ts                                 # behavioural gates
```

Required before a change is considered done:

1. **Typecheck clean.**
2. **Gates pass** (`src/gates.ts`).
3. **Knobs-unset parity exact** against pinned values — currently seed 517 →
   `P778 C169 D63` and 24601 → `P597 C246 D103` at 500 ticks, engine
   `ts-evo-poc/0.5.0`. A change that alters these with no knob set has changed
   declared behaviour. These values were **re-pinned** when three defects were
   corrected in 0.5.0; the previous pin (`517 → P881 C187 D73`,
   `24601 → P658 C280 D98`) belonged to the defective 0.4.1 engine and is
   retired. Do not restore it, and do not compare 0.4.1 figures against 0.5.0
   runs — they are different simulation semantics, not two samples of one.
4. **Presence checks, not only parity.** Parity proves defaults behave; it
   cannot detect that an intended key is *absent* from a shipped artefact.
   Assert the keys you added are actually present in the artefact.
5. **Determinism** — repeat runs byte-identical per seed and config.
6. **Rejected inputs** — bad knob values throw loudly.

### Build traps

- The **app bundle** is built by `tsconfig.app.json` → `build/app/`.
  The **CLI probes** are built by `tsconfig.build.json` → `build/`.
  These are different output directories. Building only `tsconfig.build.json`
  leaves `build/app/` stale and the bundler will silently re-ship an old
  engine. Verify artefact timestamps before bundling.
- `build/` is generated and gitignored. Rebuild commands are in `.gitignore`.
- **Never run probe work through `tsx` for long horizons.** Transpilation holds
  the module graph in memory and exhausts the device; long runs fail with
  `ERR_MODULE_NOT_FOUND` on files that exist. Use the compiled output
  (`node build/trace/senesprobe.js`). Peak engine RSS is ~149 MB.
- `scripts/runprobe.sh` retries **only** module-resolution errors and passes
  everything else through. It must never mask a real fault.

## Evidence rules

These are the rules that keep the record trustworthy. They are not ceremony.

- **A result is written only after the data exists on disk.** Filling in a
  table from a small sample before the run completes is fabrication, and it has
  happened in this repository once already.
- **Arms must differ before either is read as biology.** Byte-identical output
  across different inputs means the variable never varied. Check this every
  time; it has caught two argument-position errors and one unwired knob.
- **Verify the header before trusting a number.** Positional probe arguments
  are easy to misalign. A silent slot error produces plausible, wrong data.
- **Pre-register before ladder runs**: hypothesis, falsifiable prediction,
  explicit falsification condition, confounds controlled. Verdicts distinguish
  *supported*, *falsified*, and *not measured*.
- **An unvaried variable is not a null result.**
- **Nulls are results.** Record them.
- **Never retroactively certify old logs.** Evidence predating a semantics
  change describes the old semantics.
- **One seed is not a verdict.** The Owner's distribution directive: balance
  rests on the mean over a large seed sample; seeds must differ from each
  other; the mean must not lean one way. Small-n probes have already
  overstated effects here — a 3-seed probe showed producers persisting where
  18 seeds showed 7 extinctions.
- **A changed state digest is activity, not improvement.** A larger terminal
  population can accompany runaway growth, substrate collapse, or the loss of
  a guild.

## Git and submission

Unless the Owner explicitly authorises it for the current task: do not commit,
push, merge, open pull requests, rewrite history, change remotes, or alter
permissions. Preserve unrelated work. Do not destroy working-tree state as a
troubleshooting shortcut.

The repository has **no remote**. Creating one is an Owner decision.

## When to stop and ask

Surface rather than guess when: a change would alter reproducibility semantics
or the meaning of a knob that other evidence depends on; multiple materially
different biological meanings are possible; a required dependency is missing;
or a verdict would depend on a threshold nobody has set. The Owner sets
thresholds and seeds. Do not invent them.
