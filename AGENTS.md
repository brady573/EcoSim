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
`ts-evo-poc/0.7.0`.

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
node scripts/workflow-checks.mjs                 # evidence-layer fixtures
```

Required before a change is considered done:

1. **Typecheck clean.**
2. **Gates pass** (`src/gates.ts`).
3. **Knobs-unset parity exact** against pinned values — currently seed 517 →
   `P492 C136 D74` and 24601 → `P296 C171 D74` at 500 ticks, engine
   `ts-evo-poc/0.7.0`. A change that alters these with no knob set has changed
   declared behaviour.

   **`scripts/contract-checks.mjs` is the single source of truth for the live
   pins.** If this file and that script ever disagree, the script is correct
   and this paragraph is stale.

   These values were re-pinned **twice**. The chain of retired values is
   recorded in `scripts/contract-checks.mjs` beside the live ones:
   - `881/187/73`, `658/280/98` @ 0.4.1 — three behavioural defects corrected;
   - `808/159/58`, `558/290/96` @ 0.6.0 — **the Owner-authorised canopy
     correction of 2026-10-13.** The legacy photosynthesis path indexed the
     COARSE canopy array `shadeMass` with a full-resolution substrate cell, so
     Beer-Lambert self-shading was effectively disabled there and producer
     income had no density dependence. Every figure recorded under 0.6.0 —
     parity, populations, guild composition, cohorts, performance — was
     measured through that defect and is provenance, not current behaviour. See
     `EVIDENCE-INVENTORY.md`;
   - `778/169/63`, `597/246/103` @ 0.5.0 — the mineralisation broadcast was
     inflating substrate by the cell count, which changed producer growth and
     therefore everything downstream.

   **Every 0.5.0 figure describes a LEAKY engine.** Decomposer photosynthesis
   was never actually gated under `--zero` (issue #2 P0-2), so the flatline and
   consumer-yield verdicts recorded at 0.5.0 must be re-run, not re-read.

   Do not restore any retired pair, and do not compare figures across them:
   they are different simulation semantics, not two samples of one process.

4. **Presence checks, not only parity.** Parity proves defaults behave; it
   cannot detect that an intended key is *absent* from a shipped artefact.
   Assert the keys you added are actually present in the artefact.
5. **Determinism** — repeat runs byte-identical per seed and config.
6. **Rejected inputs** — bad knob values throw loudly.
7. **Evidence fixtures pass** (`node scripts/workflow-checks.mjs`). Required for
   any change to `tools/ladder/`, `tools/diagnostics/`, `scripts/`, or the
   workflows. Gates prove a *run* is sound; these prove the layer that reports
   the run cannot report a measurement it did not take.

### The evidence layer is not the engine

`tools/ladder/`, `tools/diagnostics/` and `scripts/` produce and report
measurements of the engine. They never compute biology, and a change there must
not alter declared behaviour — parity (item 3) is the check for that.

The rules this layer owes the record, each of which was violated at least once
before the fixtures in `scripts/workflow-checks.mjs` existed to catch it:

- **Absent evidence is never a pass.** A missing, truncated or non-finite
  ledger field is a *failure of the measurement*, distinct from a measurement
  that failed. The distinction must survive into the manifest, the CSV, and the
  exit code.
- **Balanced books are not compliance.** A system can mint energy, book it as
  capture, and reconcile. A declared capture policy is enforced per guild, and a
  guild that never existed is reported as a vacuous check, not as a pass and not
  as a violation.
- **A falsified prediction is a result.** Cohort integrity and scientific
  outcome are separate verdicts. Under the Owner's decision of 2026-10-11, a
  green workflow means **the evidence is trustworthy** — never that the
  hypothesis was correct. Non-zero exit is reserved for an evidence-integrity
  violation or an execution failure. Falsification must still be stated
  prominently in the step summary and in `cohort-verdict.json`, because a green
  tick that reads as confirmation is how a negative result gets misread as a
  confirmed one.
- **An override never masquerades as the pre-registered run.** A cohort executed
  at a different horizon cannot report the pre-registered verdict.
- **Dispatch input is data.** It reaches a step through `env:` and is read as an
  argv argument. It is never interpolated into a `run:` body.

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

## Owner authorization (experimental branch)

The Project Owner has granted blanket authorization for experimental implementation,
parameter choice, sequencing, hypothesis re-runs, ablation work, and integration
on this isolated branch. Routine experimental decisions are not Owner-gated during
this phase.

The only hard boundary remains: no merging and no integration into the
maintained Digital Evolution product without explicit Owner approval.

## When to stop and ask

Surface rather than guess when: a change would alter reproducibility semantics
or the meaning of a knob that other evidence depends on; multiple materially
different biological meanings are possible; a required dependency is missing;
or a verdict would depend on a threshold nobody has set. The Owner sets
thresholds and seeds. Do not invent them.

### Modular genome v2 (`genomeV2`)

`genomeV2: boolean | null`, **null = declared behaviour, exactly**. When set, a
genome becomes a short ordered sequence of MODULES — inherited construction
instructions carrying a magnitude, a developmental onset and an optional
condition gate — which express into the existing 42 traits. No new biological
mechanism is introduced; the trophic and competitive machinery is untouched.

It exists because **eight of the twelve v1 structural genes are decorative**.
Measured against the engine: only `eyeCount` (sensing radius) and `shell` /
`spines` (collision radius) have any survival consequence. `limbPairs`,
`fins`, `antennae`, `tail`, `segments` and all four pigment genes are inherited,
mutated, and read by nothing. A genome whose heritable variation mostly drives
appearance is a decorative system wearing a data structure.

Three rules hold it together, each pinned by a gate:

- **Every module carries an upkeep cost** (G14). A free capability would be
  selected for unconditionally and evolution would have nothing to choose.
- **Modules move traits, not just body genes** (G13). Expression adds to the
  existing trait GENES before materialisation, so structure that changes nothing
  biological is a failure, not a body plan.
- **A knob that is inert when off and active when on** (G19). Otherwise it is
  the dead-knob class: it parses, it prints, it may do nothing.

Five of those gates were green while the engine did nothing at all, because they
tested the helper and not the world. Four more rules follow from that:

- **A gate that proves a mechanism exists is not a gate that proves it runs.**
  Call `expressModules` directly and it will demonstrate development, condition
  gating and recombination perfectly while the engine applies none of them.
  Anything claimed about the simulation must be observed in a running world.
  G20-G24 exist for exactly this and may not be replaced by helper tests.
- **Assert the NET charge, not the metadata.** G14 checked that `upkeep > 0` was
  declared and passed while the cost was double-booked to exactly zero. A
  declared cost that does not reach the ledger is the knob-discipline failure
  wearing a different hat (G20).
- **Compare against the unexpressed baseline, not against a later snapshot.**
  Expressed traits rise with age and then FALL BACK as energy cannot sustain
  them. A begin/end comparison on one organism reads "unchanged" while
  development plainly happened in between (G21, G23).
- **A population difference between knob-set and knob-unset arms is not
  evidence of biology.** Enabling the knob draws extra randomness, so the arms
  diverge on the stochastic trajectory before anything is compared. This
  repository published such a figure as "measurably different" and withdrew it.
- **A trait-level assertion cannot see a structural one.** Module traits
  materialised correctly for the entire life of this feature while every module
  that altered body plan was a no-op, because the expressed structural view was
  seeded from the inherited genotype after the module deltas had been applied.
  Anything that changes STRUCTURE must be asserted on structure and on the
  geometry derived from it (G25).
- **A gate that counts bad outcomes has not excluded them.** G24 counted
  single-parent clones while asserting two-parent inheritance, and founders draw
  ~7 modules from 7 kinds, so two parents usually agree on every kind and a
  splice between them is indistinguishable from a clone. An inheritance claim
  must require the parents to DISAGREE and the child to resolve a disagreement
  in each parent's favour (G24).
- **Quote measured bytes, not derived ones.** This section published "80
  bytes/organism" for a buffer that is 256. The allocation is unconditional, so
  the cost is paid with the knob off.

### Declared integration limits (chemistry ↔ legacy)

These are **limits, not claims**. Each is stated so a reader does not have to
infer integration that does not exist.  The energy-integration line below is
guarded by G36, which enforces it two-sidedly (non-zero income/spend above the
tolerance, matching flux, bridge arm fires and closes, unbooked energy breaks
the identity).

- **`freeEnergy` relaxes the growth DECISION, not the spend.** With the knob set,
  the growth budget is exactly what the requested tissue costs, so growth depends
  on matter alone as its contract states — but the cost is still charged against
  `store.energy`, so maximal matter-permitted growth can still drive an organism
  into legacy starvation. The contract is satisfied for the decision and not for
  the organism; stated here because the original defect exploited exactly that
  ambiguity.
- **Energy is reconciled through the legacy causal ledger when chemistry is on.** Chemical reaction income and chemical growth expenditure are now booked as `chemicalIncome` and `chemicalSpent` against the same identity G3 enforces (G36), so a chemistry-enabled run no longer settles or mints energy silently. G3 itself still runs chemistry unset and therefore says nothing about chemistry. Chemical income is **8.246%** of legacy+chemical income by G33's measure (income only: flux versus `ledger.capture`) in `evidence/ledger-reconciliation-20261013.txt`; growth cost is treated as dissipation. The remaining separation is the mass book: chemical growth biomass is tracked as matter and is not counted by `Ledger.biomass()`, which sums `store.energy`.
- **Predation transfers energy but not matter.** The legacy predator/grazer
  interaction moves `store.energy` from prey to consumer with **no parallel
  elemental transfer** from prey tissue or stores. A chemical mass ledger that
  balances does not demonstrate an abiotic → producer → consumer → death →
  recycling cycle, because the consumer link is energy-only. The null-default
  diagnostic `chemistryPredationMatter` can add a stoichiometric transfer when
  explicitly enabled, but it is not declared default behaviour and no full food
  web is claimed from it.
- **Death reaches the two economies by different paths.** Legacy detritus is fed
  from an organism's remaining energy; chemistry pools are fed from its tissue.
  The two are coupled only through the organism, not through a shared pool, so
  mass that recycles through chemistry does not automatically become food for
  the legacy web. The `chemistryToLegacyDetritus` diagnostic bridges them and is
  how that separation was measured.  Enabling it now converts the chemical
  labile/litter pool into legacy detritus and books the same amount as
  `recordOrganicInput`, i.e. as an **exogenous** organic import on the
  legacy side. It does **not** debit any chemistry pool. That is deliberate: the
  bridge is a diagnostic subsidy/parallel accounting path, not a conserved
  transfer, and it must not be read as proof that matter has physically
  crossed between economies. Arms differ on `injectOrganic`, which G36 verifies.
- **Coarse-canopy status: SUPERSEDED.** The legacy
  photosynthesis path's use of the coarse `shadeMass` array was corrected
  under the Owner-authorized canopy correction, and parity pins were
  re-pinned. Do not describe the defect as "surviving" as a current declared
  limit; any historical reference to it is provenance evidence. See
  `REPORT.md`/`EVIDENCE-INVENTORY.md` for the correction chain.
- **Consequently**: this repository has NOT demonstrated a fully integrated
  food web. It has demonstrated a balanced chemistry subsystem coupled to the
  legacy ecosystem at the organism, not at the meal.
