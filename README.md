# Digital Evolution — Advanced Simulation TypeScript Proof of Concept

**STATUS: EXPERIMENTAL. NOT PRODUCTION CODE. DO NOT MERGE.**

This is a disposable, isolated experiment whose only purpose is to answer two
questions with evidence:

1. Can TypeScript sustain a biologically rich, spatially explicit, whole-ecosystem
   evolutionary simulation — and at what population scale?
2. Is there a hard performance wall that would justify a different execution
   approach (WASM, or something that is not TypeScript)?

Upstream: <https://github.com/brady573/EcoSim> (branch `main`).

Locally it lives at `/root/DEE-TS-POC/experiment/ts-evolution-poc`,
on branch `main`, with its own history. It originated as an untracked directory
inside the `DEE-TS-POC` worktree of Digital-Evolution-Ecosystem (based at
`c247dd9`) and was promoted out on 2026-10-10; that base commit is recorded in
the initial commit message for provenance, not as an ancestor. It touches **no
production package**, adds **no new dependency**, and has **no remote**.

See `AGENTS.md` for the engineering contract that governs this repository.

---

## What it simulates

A coupled dynamical system, not a backdrop:

- **42 heritable scalar traits** across metabolic, sensing, locomotor,
  reproductive, physiological, behavioural and nutrient-partitioning groups,
  plus **12 discrete body-plan genes** (segments, limb pairs, eyes, shell,
  spines, fins, antennae, tail, three pigment genes, pattern).
- **Genotype → phenotype**: morphology, scale relations, sensing radius,
  locomotion, and appearance are all derived from genes. Appearance is a
  *readout*, never a source of authority.
- **3 derived trophic guilds** (producer, consumer, decomposer) × **3 motility
  classes** (sessile, creep, mobile) × **3 life stages**, all computed from the
  genome. There is no species table. The finer feeding strategies — grazer,
  predator, scavenger — are read-only **behavioural readouts** resolved within
  the consumer guild, not separately assigned roles.
- **Ecology**: producer capture from nutrients + light (Liebig-limited),
  **herbivory** (bounded grazing on living producers, resisted by armour),
  scavenging, predation, territorial contests, reciprocal mating, excretion,
  corpse→detritus→sediment, abiotic and **biotic** mineralisation back to
  nutrients.
- **Habitat**: a seeded, spatially correlated map with heterogeneous fertility,
  shade, and drainage. Producers are **sessile** and permanently deplete the
  cell they root in, which is what makes succession and displacement reachable
  rather than narrated. A heritable `DISPERSAL` trait lets offspring escape a
  stripped cell.
- **Three independently limiting nutrients** with Liebig's law of the minimum, and
  three heritable affinity traits. This is load-bearing: coexistence of *p*
  species is impossible when fewer than *p* resources are limiting, so a
  single-nutrient substrate forbids a food web outright. See `RESEARCH.md`.
- **Benthic sediment compartment**: most corpses sink into a non-diffusing layer
  where detritus concentrates and detritivores can use it.
- **Disturbances**: six named, explicit, spatially localised events (bloom,
  organic rain, frost, drought, heat wave, ash fall) on a dynamic abiotic axis.
- **Life histories**: stable individual ids, parent links, generation depth,
  lineage branching on recombination, extinction, and trait drift tracking.

## What it deliberately is not

Read `REPORT.md` before drawing any conclusion. In short: no scientific
validation, no cross-platform determinism claim, no production readiness, and
several biological abstractions that are listed and justified there.

---

## Prerequisites

- Node >= 24 (uses the repo's existing toolchain)
- Reuses `typescript`, `tsx` and `pixi.js` from the parent checkout's
  `node_modules`. **No install step, no new packages.**

If `node_modules` is missing, recreate the symlink to the canonical install:

```sh
cd /root/DEE-TS-POC && ln -sfn /root/Digital-Evolution-Ecosystem/node_modules node_modules
```

Define convenience aliases used below:

```sh
cd /root/DEE-TS-POC/experiment/ts-evolution-poc
TSX=/root/DEE-TS-POC/node_modules/.bin/tsx
TSC=/root/DEE-TS-POC/node_modules/.bin/tsc
```

> **Run long probes against the compiled build, not `tsx`.** Transpilation
> holds the module graph in memory and exhausts this device; long runs then
> fail with `ERR_MODULE_NOT_FOUND` on files that demonstrably exist. See the
> build-trap section of `AGENTS.md`.

---

## Run instructions

Every command below is bounded and intended to finish in seconds to a couple of
minutes on modest hardware.

### 1. Typecheck (fast, no execution)

```sh
$TSC -p tsconfig.json --noEmit --pretty false
```

### 2. Smoke test — 200 founders, 300 ticks (~1 s)

```sh
$TSX src/smoke.ts
```

Catches gross logic errors: non-finite population, broken accounting identity,
population identity mismatch.

### 3. Credibility gates — the five checks that matter (~10 s)

```sh
$TSX src/gates.ts
```

| Gate | Claim |
| --- | --- |
| G1 | Same seed → bit-identical state digests; different seed → diverges |
| G2 | No NaN/Inf, no negative energy, no out-of-bounds position, every live slot has a derived phenotype |
| G3 | `capture + organic + founding == biomass + detritus + dissipated` holds within tolerance |
| G4 | `population == founders + births - deaths` at **every** tick; death causes sum to total deaths |
| G5 | Contested interactions resolve deterministically, each pair exactly once, and at a non-zero rate |

Exit code is non-zero if any gate fails.

### 4. Whole-ecosystem acceptance evidence (~60 s)

```sh
$TSX src/acceptance.ts
```

Demonstrates, with executed output rather than assertions:

- E1 closed, source/sink-accounted nutrient→production→consumers→death→recycling cycle
- E2 bidirectional organism/environment feedback across multiple generations, with lineage trait drift
- E3 contrasting habitats **and a matched-control disturbance comparison** (same seed, disturbance on/off)
- E4 sessile producer vs motile consumer with distinct geometry/sensing/behaviour, plus advanced-organism seams
- E5 model complexity and ecosystem composition

### 5. Headless performance benchmark (~30 s)

```sh
$TSX src/bench.ts                                  # default: 1k/5k/10k, 120 ticks
$TSX src/bench.ts --ladder=1000,5000,10000 --ticks=150
$TSX src/bench.ts --ladder=25000 --ticks=100        # opt-in, slower
```

Reports ticks/sec, mean/median/p99/max tick time, per-subsystem cost shares
(ecology-field dynamics, organism biology, interaction resolution, lineage
bookkeeping, phenotype generation, rendering), memory, long-run degradation,
ecosystem composition, and model complexity.

**No renderer is loaded**, so these are simulation-capacity numbers, not FPS.

### 6. Long-run ecosystem dynamics (~minutes)

```sh
$TSX src/longrun.ts --ticks=3000 --seeds=11,202,3003
$TSX src/longrun.ts --ticks=8000 --seeds=11         # deeper, slower
```

Runs several independent worlds and **classifies** the outcome (equilibrium,
boom-bust cycling, expansion, collapse, extinction) without forcing any.

### 6b. Ecological regime sweep — finding a configuration that actually works

```sh
$TSX src/regime.ts --ticks=700
$TSX src/regime.ts --ticks=900 --subsidies=0,0.005,0.02,0.06 --regens=0.0032,0.008
```

Sweeps the exogenous-organic subsidy (`basalFoodPerCell`) and nutrient
regeneration, and reports for each regime: fraction of energy coming from
photosynthesis, final and peak population, producer share, mean generation
depth, lineage count and extinctions, contest volume, accounting residual, and
whether the outcome is expansion / limited / boom-bust / extinction.

**This is the tool for the headline problem.** The default configuration is
subsidy-driven and cannot reach a carrying capacity; this sweep is how a
producer-limited regime was found rather than guessed.

### 7. Behavioural diagnostic (~5 s)

```sh
$TSX src/viability.ts
```

Separates detection *opportunity* from *chosen* behaviour, so an inert ecology is
distinguishable from a broken detector.

### 8. PixiJS viewer

```sh
$TSC -p tsconfig.build.json --pretty false   # emit browser ESM into build/
$TSX src/view/serve.ts                       # then open http://127.0.0.1:5178/
```

- drag to pan, wheel to zoom, **click an organism to inspect** it
- speed controls: pause / 1× / 4× / 16× / Max (Max has a per-frame tick budget)
- toggles: procedural morphology, substrate/fertility overlay, disturbance radii
- the panel reports render FPS and simulation ms/tick **separately**

The viewer only ever *reads* simulation state. It cannot write biology.

---

## Test configurations and seeds

| Purpose | founders | world | ticks | seed |
| --- | --- | --- | --- | --- |
| smoke | 200 | 2000² | 300 | 7 |
| gates | 300 | 2000² | 250 | 4242 |
| acceptance | 400 | 2000² | 400–700 | 20260108 |
| bench | 1k/5k/10k (opt-in 25k/50k) | 4000² | 120–150 | 11 |
| longrun | 400 | 2400² | 3000+ | 11, 202, 3003 |
| viewer | 1200 (adjustable to 20k) | 4000² | interactive | 7 |

Habitat is seeded from `config.habitatSeed`, defaulting to `seed`. Set
`habitatSeed` explicitly to give two runs **identical substrate** while changing
only the organism seed — that is the matched-control setup.

## Reproducibility contract

```
engine version + resolved config + seed + tick count = reproducible run
```

Scope, stated precisely: this holds **within one engine version on one JS
engine build**. Transcendental functions (`Math.exp`, `Math.cos`) are not
guaranteed bit-identical across engines, and no such claim is made. The RNG is
integer-only (xoshiro128\*\*) and state hashing compares IEEE-754 bit patterns,
so what is actually asserted is exact reproducibility on a fixed runtime.

## What passed, and what did not

See `REPORT.md` (addendum at the end) and `RESEARCH.md`.

**Passes:** all five credibility gates (7/7 checks); resource ledger closes to
~0.005 % of total input; zero extinctions across regime runs.

**Now achieved:** the population is **resource-limited**. It grows to capacity
and *holds* there rather than expanding without bound, and photosynthesis
supplies ~53 % of energy input — up from 2.1 % before the multi-nutrient
redesign. Two consumer guilds (grazers, decomposers) now grow rather than
blinking out.

**Still not achieved:** a self-sustaining third trophic level. Predators do not
persist. Total abundance still trends down from its peak rather than settling.
Habitat contrast has little measurable effect on outcomes. The outcome classifier
is biased toward equilibria and would score a limit cycle as failure.

**Authority gap:** the Living Design Document and Simulation Foundation
Architecture were never accessible (Drive requires authentication), so none of
the biology here is validated against the authoritative sources.