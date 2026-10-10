# Evolution Simulator — Full Diagnostic Protocol

Source: `evo-sim-poc.html` (unmodified). Bundled engine: `ts-evo-poc/0.4.1`.

## Objective

Find **which parameter changes actual simulation execution, when the change appears, and how large the resulting ecological change is**. Record the engine version, resolved config, seeds, and state digests so a result is repeatable. Separate main effects from interactions. Treat a changed state digest as *activity*, **not** automatically as a biologically meaningful improvement.

## What is actually controllable

- 55 entries in `DEFAULT_CONFIG`: 53 experimental values plus `seed` and non-behavioral `label`. `nutrientCapacity` is a 3-element array tested one component at a time.
- `habitatSeed` is an **additional optional key** recognized by the `World` constructor but absent from `DEFAULT_CONFIG`.
- 42 continuous normalized heritable traits. The lab can manipulate each trait's **founder `init`** before world creation. Their bounds, mutation `sigma`, and founding `spread` are *not* swept by this version of the lab.
- 12 discrete body-plan genes. The lab can manipulate each one's **founder `init`** before world creation. Genetic mutations remain enabled during the subsequent run.
- Four important nullable/active balanced-mode mechanisms: `consumerPhotoScale=4`, `decomposerFounders=0.25`, `decomposerDormancy=0.05`, `sporeDispersal=1`. The baseline preset leaves all four `null`.
- In addition, **hardcoded** engine values such as `REPRO_SURPLUS_TICKS=90`, `LONG_RANGE_DISPERSAL=0.04`, and `FATAL_DAMAGE=100` have no config-level controls. A complete future *engine-constant* sensitivity study requires exposing them as config values. They are not falsely counted as tested here.

The provided `--all` suite enumerates **110 distinct intervention targets**: 53 config keys, two extra nutrient-array components, one habitat-seed target, 42 founder-trait initializations, and 12 founder body-gene initializations. These are distinct knobs, **not** 110 independent causal effects.

## Verified source-level findings

Four declared controls have no direct read in the shipped engine code:

| Config key | Default | Source inspection / short-run check |
|---|---:|---|
| `abioticPeriod` | 1 | Unused; 30-tick state hash unchanged under ±20% |
| `detritusDiffusivity` | 0.09 | Unused; 30-tick state hash unchanged under ±20% |
| `energyPerFood` | 5.2 | Unused; 30-tick state hash unchanged under ±20% |
| `energyPerCarrion` | 3.1 | Unused; 30-tick state hash unchanged under ±20% |

`baseLight` ±20% **did** change the state hash in the same smoke test. These findings are limited to this bundled engine; do not silently delete or repurpose declared values before deciding whether their intended mechanisms belong in the model.

The HTML `export` captures only seed, preset flag, tick, guild counts, dormant count, births/deaths, and transition matrix. It does not export the complete resolved config, state digest, field stocks, accounting residual, or time series. Also, the exported `baseline` flag is read from the **current** selector at export time, so changing the selector after pressing Run can mislabel the experiment. The headless lab records the actual configuration fingerprint and per-run metrics instead.

## Run the diagnostic kit

Requires **Node.js 20+**, no npm packages. Keep `evo-sim-poc.html` and `evo-diagnostics.mjs` in the same directory. Execute from a terminal or PowerShell:

```powershell
node .\evo-diagnostics.mjs --list
```

**1. Check a specific mechanism**, paired by identical world seeds:

```powershell
node .\evo-diagnostics.mjs --mode balanced --target consumerPhotoScale --seeds 11,42,517 --ticks 1000 --interval 100 --out .\diag-photo
```

**2. Isolate stochastic versus habitat variation.** Here the environmental map is held fixed for all world seeds. This is useful for identifying seed sensitivity from organism initialization, reproduction, movement, and disturbances while keeping the initial environmental heterogeneity fixed:

```powershell
node .\evo-diagnostics.mjs --mode balanced --target sporeDispersal --seeds 1:30 --habitat-seed 4242 --ticks 1500 --interval 100 --out .\diag-fixed-habitat
```

**3. Screen every world configuration parameter**, including the three independently modifiable nutrient capacities:

```powershell
node .\evo-diagnostics.mjs --mode balanced --all --config-only --seeds 1:10 --ticks 1500 --interval 100 --out .\diag-config
```

**4. Full declared-control screen:** world config, 42 continuous founder initializations, and 12 discrete body-gene founder initializations:

```powershell
node .\evo-diagnostics.mjs --mode balanced --all --seeds 1:30 --ticks 1500 --interval 100 --out .\diag-complete
```

**5. Test the four preset mechanisms jointly** with a full 2×2×2×2 factorial, 16 configurations per seed. This distinguishes a main effect from an effect that depends on another switch:

```powershell
node .\evo-diagnostics.mjs --factorial-core --seeds 1:30 --ticks 1500 --interval 100 --out .\diag-interactions
```

**6. Directly test a founder trait, a body gene, and habitat RNG:**

```powershell
node .\evo-diagnostics.mjs --mode base --target trait:photosyntheticRate --target body:shell --target habitatSeed --seeds 11,42 --ticks 800 --interval 100 --out .\diag-genes
```

For an externally defined seed panel, provide a newline-separated text file or JSON array:

```powershell
node .\evo-diagnostics.mjs --target baseLight --seed-file .\my-seeds.txt --habitat-seed 4242 --ticks 1000
```

Integer seed values are restricted to **1 through 4,294,967,295** to avoid 32-bit aliasing. Arbitrary **non-numeric string seeds** are also accepted by the engine. The POC web page, in contrast, exposes a numeric seed field with `min=1`, `max=999999`, and clamps to at least 1 on Run. A browser user cannot independently set the habitat seed through the current UI.

### Files produced

For one-at-a-time sweeps: `effects.csv` contains a row for each control × level × metric (baseline mean, paired mean/median change, relative change, per-seed range, approximate 95% interval when at least 10 seeds, and state-change count); `baseline-seeds.csv` exposes the between-seed baseline distribution; `runs.jsonl` records each run's checkpoint history, demographics, transitions, resolved-config fingerprint, elapsed time, and final state hash; `manifest.json` records the whole testing recipe and engine version.

For `--factorial-core`: `factorial-runs.csv`, `factorial-effects.csv` (four averaged main effects and six pairwise interactions for each metric), `runs.jsonl`, and `manifest.json`.

## Experimental sequence

### Gate A — Validate repeatability before interpreting effects

1. Fix HTML engine version, preset, complete override config, world seed, habitat seed, and tick count.
2. Run the same conditions twice. Check identical `hashState()` at the final tick. The lab does this automatically for the first baseline seed in single-knob mode.
3. Cross-check ecological metrics, not only the digest. Existing engine `hashState` is the supplied engine digest, not an independent proof that *all* future-relevant internal fields are included.
4. Test that headless batch stepping versus browser frame/speed selections reaches the same state at the **same tick count**. Rendering speed and frame rate should not be treated as biological parameters.
5. Compare state and metrics at common checkpoints (e.g. 100, 300, 600, 1000, 1500). An intervention can be inactive early yet decisive after reproduction or disturbance.

### Gate B — Verify actuator integrity

For each config knob, independently change it with all other resolved settings fixed. Check whether any state hash, ecological metric, or mechanism-specific counter changes. `NO_OBSERVED_STATE_CHANGE` is a diagnostic result, **not proof** that the knob is intrinsically useless; it could have a delayed threshold or never be reached under the tested conditions. A value with *no source-level read* is a stronger finding: it cannot affect this engine's logic via that config key.

Nullable controls require distinct **`null` (off), `0` (often still a configured value), and positive** conditions when the implementation distinguishes them. Negative rates, illegal diffusion coefficients, and biologically impossible values should be rejected rather than blindly swept.

### Gate C — Quantify isolated effects

For seed `s`, parameter `p`, endpoint `Y`, horizon `t`, and base configuration `C`:

```
Delta(p,s,t) = Y(C with p changed, s, t) - Y(C, s, t)
Relative change (%) = 100 * mean_seed(Delta) / abs(mean_seed(Y_base))
```

Report absolute changes when the denominator is zero. Compare a high and low intervention, not only enabled versus disabled. Record **all** seed-paired changes, not merely a single winning run. Prefer representative fixed or randomly generated seed panels and at least 30 seeds for confirmatory runs. The lab's small sample CI is an approximate t-based interval over chosen seeds and should not be overinterpreted.

Primary ecological endpoints: total population; producer, consumer, and decomposer counts; dormant decomposers; births and deaths (including starvation, age, injury); average population through time; peak sampled population; biomass; nutrient, detritus, sediment and litter stocks; generation depth; contested interactions; disturbance count; population-cap hits; and accounting residual fraction. A useful ecological parameter can be identified even if it has little effect on the final total population by changing *guild survival or energy flows*.

**Interpretation warning:** identical world seeds give paired initialization, but changes in reproduction or event counts can consume RNG draws differently later. That divergence is itself part of the intervention's realized effect and is *not* a pure controlled experiment on every subsequent random event.

### Gate D — Detect interactions

Use the 16-condition core factorial. For each of the four switches, the main effect is the mean **on−off** contrast averaged over the other three switches. For each pair, the interaction is a difference-in-differences averaged over the remaining switches:

```
interaction(A,B) = mean(Y11 - Y10 - Y01 + Y00)
```

This matters because enabling decomposer founders may do little without dormancy or dispersal. One-at-a-time scans alone cannot detect that dependency. Run focused two-factor sweeps for other highly ranked parameters (e.g., nutrient regeneration × recycling, reproduction threshold × birth cost, shading × light).

### Gate E — Seed ownership and complete replay

Current seed architecture:

1. `config.seed`: master `Rng` (xoshiro128**) controls founder genome jitter, founder placement, individual phenotype-seed allocation, behavioral stochasticity, reproduction, mutation, dispersal, and disturbances (via passed world RNG).
2. `config.habitatSeed ?? config.seed`: independently seeded generator for the initial habitat map. The kit can explicitly pin it.
3. `store.individualSeed[slot]`: phenotype-geometry seed generated internally from a master-RNG draw XOR slot-derived value. The kit can **observe** this in the engine, but cannot directly prescribe every individual's phenotype seed with the existing API.
4. Browser display: no evidence of a separate simulation RNG; the renderer reads existing world state.

To gain **complete per-stream seed control**, an engine change is required: define stable named RNG streams (`founders`, `habitat`, `disturbances`, `decisions`, `reproduction`, `mutation`, `dispersal`, `phenotypes`), permit independent uint32 seed overrides for each, record each stream's seed/state, and make replay regenerate identical outcomes from the full manifest. Prefer per-event, stable-key derivations (e.g. organism ID + birth count + stream name) where intervention-dependent draw counts would otherwise spoil synchronization. Such a refactor changes stochastic behavior: bump the engine version and validate it independently; do **not** silently mix old and new experimental results.

### Gate F — Attribution quality and reporting

Classify each parameter as:

- **Disconnected:** declared config value has no behavior-level reader. Test and source inspection both show no activity.
- **Reachable but not activated:** wired, but no state difference over the measured seed/tick panel.
- **Active, ecologically negligible in this panel:** state hash changes, but sampled ecological endpoint shifts are small.
- **Active, positive/negative:** consistent direction and material effect across seeds and checkpoints, with actual effect sizes reported.
- **Conditional:** substantial two-way interaction or sign reversal depending on the other mechanism.
- **Structurally confounded:** modifies world dimensions, field/grid size, founder count, or population caps; adjust baseline densities and ecological invariants before interpreting its effect.

Do not score a configuration as better using population alone: runaway population, rapid substrate collapse, elimination of a trophic guild, or violated accounting conservation can all accompany a larger terminal population.

## Completion criteria

A full diagnosis is finished when (1) every declared config parameter and founder-init control is inventoried; (2) each has a no-op/activation result plus a measured paired contrast across multiple seeds and horizons; (3) all four core preset switches have on/off and pairwise-interaction results; (4) every experimental run is recorded with exact engine version/config/seed/checkpoints and deterministic-replay evidence; (5) cosmetic versus ecological gene effects are distinguished; and (6) controls that cannot be isolated or independently seeded are explicitly recorded as **engine instrumentation gaps**, not misrepresented as tested.

The accompanying runner implements the config, trait-initialization, body-initialization, world/habitat seed, sensitivity, and 4-switch factorial workflows. It does **not** implement new independent seed streams, alter the HTML UI, or claim full coverage of hardcoded engine constants, gene bounds, mutation-sigma parameters, or gene-founder-spread settings.
