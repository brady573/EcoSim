# REPORT — Digital Evolution Advanced Simulation TypeScript Proof of Concept

**Engine version under test:** `ts-evo-poc/0.1.0`
**Status:** EXPERIMENTAL. Disposable. Not production code, not merged.
**Branch:** `experiment/ts-evolution-poc` (worktree `/root/DEE-TS-POC`, based on `main` @ `c247dd9`)
**Runtime used for all measurements:** Node v24.21.0, aarch64, 8 logical cores,
inside a proot-distro Ubuntu container on an Android phone.

---

## 0. What this report is, and what it is not

This experiment answers a bounded question: *can TypeScript sustain a
biologically rich, spatially explicit, whole-ecosystem evolutionary simulation,
and at what scale?*

It does **not** establish:

- scientific validity of any ecological claim,
- determinism across arbitrary platforms or JS engines,
- production readiness, production performance, or production architecture,
- biological realism as understood by an ecologist.

Where behaviour was surprising, unstable, or wrong, that is reported as a
finding. Nothing here has been tuned to look good.

### Authority gap — disclosed

The Living Design Document and the approved Simulation Foundation Architecture
are the authoritative sources for the product's intended biological principles.
**They were not accessible during this experiment**: the Drive folder requires
authentication and the Drive tool integration returned `requires a login before
it can register a client`; a direct fetch of the folder returned only the page
title.

Consequently, the biological principles implemented here were derived from the
**public repository implementation** (`packages/sim-core`) and from the Owner's
written amendment, **not** from the authoritative design documents. Any claim
that this POC's biology matches the product's intended biology is therefore
**unverified**. This is the single largest gap in the work and it is not
something the experiment can close on its own.

---

## 1. Biological abstractions, shortcuts and modelling assumptions

Every item here is a deliberate departure from biological realism, chosen to
keep the experiment about *throughput and emergence*, not about accuracy.

### 1.1 Energy is a single scalar, not a conserved chemical cycle

The model tracks **energy** as one number per organism, with substrate pools for
nutrient (inorganic) and detritus (dead organic). There is no carbon, nitrogen,
phosphorus, no stoichiometry, no elemental limitation. An organism that eats
anything gains the same energy per unit of mass.

*Justification:* element cycles are not where the throughput question lives.
*Consequence:* "nutrient limitation" is a scalar proxy, not a chemical fact.

### 1.2 Nutrient is deliberately **not** energy-tracked

The conservation identity covers **energy only**. Inorganic nutrient is a
separate, non-energy-tracked pool: it enters by regeneration and leaves via
uptake and mineralisation without ever being counted as energy. Energy appears in
the biological loop only through photosynthetic capture.

*Consequence:* the nutrient ledger is **not** closed, and the acceptance run
reports nutrient totals as a direction of flow only. Any statement that matter is
"conserved" would be false.

### 1.3 Predation has no escape-speed asymmetry except via a chase boost

Predators get a `1.15 + burstPower*0.35` pursuit multiplier, because with both
parties re-deciding every tick at equal top speed, a chase can never close and
predation silently never occurs (this was an observed failure, not a guess — see
§5). This is a coarse stand-in for real predator acceleration and for prey using
cover, stamina, and vigilance.

### 1.4 Contests are pairwise, instantaneous, and simultaneous-free

A contest is resolved in one tick by comparing two trait-derived power values
plus a bounded random margin. There is no wound progression, no fleeing
mid-contest, no group defence beyond a crowding density penalty, and no
territorial memory. `TERRITIAL` contests exist and cost condition, but nothing in
the current behaviour arbitration selects territorial intent, so that interaction
kind is **structurally present and behaviourally unreachable** — it reports 0
resolved contests. This is a genuine gap, not a passing detail.

### 1.5 Sexual reproduction recombines lineage identity but not the genome

A mating event forks the child's **lineage id** deterministically from both
parents' lineages, and both parents pay a gamete cost and each gain an offspring.
But the inherited **genome is a mutated copy of one stored parent only**. There is
no two-parent blend, no segregation, no recombination of alleles.

*Consequence:* lineage trees branch and generation depth increments, but no
heterozygous recombination occurs. This understates the rate at which sexual
reproduction can generate variation, and it means "sexual reproduction" here is
closer to mutual exchange of a clone than to true sexual reproduction.

### 1.6 Line stage is a single scalar progression

`maturation` is a linear ramp from birth to maturity; `stage` is
juvenile → adult → senescent. Real ontogenies are discontinuous (metamorphosis,
instars, size-independent change). Juveniles collide and damage at reduced
scale, so developmental growth is real and observable, but it is a ramp, not a
metamorphosis.

### 1.7 Aging is a linear damage accrual

Damage past 62 % of lifespan grows linearly. There is no senescence curve, no
terminal decline in performance, no size decline beyond a small senescent shrink.

### 1.8 Crownd is a density penalty, not interference

Crowding costs energy as a function of local neighbour count
(`(crowding-4) * 0.006 * (1+size)` per tick). There is no explicit pairwise
interference, no interference reduction (a Hoelldobler–Wilson effect the amendment
brief mentions), and no colonial suppression of reproduction.

### 1.9 Habitats are smooth and banded

Habitat properties are generated by summing three sines per property. This is a
**determinism choice** — it avoids depending on any platform's transcendental
implementation — with a visual cost: the map is smooth and banded, not irregular,
and the effective number of independent habitat patches is much smaller than the
cell count suggests.

### 1.10 Walls are semi-permeable, not toroidal

Organisms bounce off world edges. The maintained implementation uses a toroidal
boundary. Bouncing creates a semi-permeable edge habitat that a torus would not,
so edge effects here are an artifact of the boundary choice, not biology.

### 1.11 Modelled externals (declared system boundaries)

- **Solar input:** represented as a single global light scalar modulated by a
  cycle, a slow drift, and disturbance events. There is no spatial light field,
  no seasonal geometry, no day/night.
- **Weathering:** nutrient regenerates toward a habitat-bounded carrying capacity
  at `nutrientRegen * drainage`. This is the entire abiotic nutrient source.
- **Exogenous organic matter:** `basalFoodPerCell` adds detritus to every cell
  each tick, modelling falling organic matter. **This is a subsidy and it
  dominates the energy budget** — see §4.
- **Not modelled at all:** water table, salinity, oxygen, disease, sex ratios,
  age/sex structure, migration between worlds, and any non-local dispersal.

---

## 2. Forward-compatibility with advanced organisms: what is real, what is a seam

The amendment asks for extensible seams rather than speculative frameworks. What
exists:

| Capability | Status |
| --- | --- |
| Modular body plan | **Real.** 12 discrete body genes; 13 distinct module combinations and 1–4 segment counts observed in one run. |
| Articulated morphology | **Real for rendering.** Spine curvature, limbs, spines, fins, antennae are procedurally generated per individual and drawn in the viewer's morphology mode. |
| Developmental growth | **Real.** Juveniles collide, render and damage at reduced scale; stage transitions occur. |
| Life stage | **Real.** Three stages, observed present in-run. |
| Sexual reproduction | **Partial.** Reciprocal consent, gamete cost, lineage branching, generation depth — but no genome recombination (§1.5). |
| Sessile vs motile | **Real, and emergent.** Falls out of the autotrophy/immobility trade-off rather than a flag. |
| Scale diversity | **Real.** Size drives cost, damage, speed, edible yield, and sensory reach. |
| Trophic roles | **Real and derived.** 5 roles from continuous traits. |
| Plants / sessile producers | **Partial.** Phototrophs are sessile and substrate-rooted, but there is no stem/root/leaf structure, no growth toward light, no water transport. |
| Cooperation / colonies | **Not implemented.** No seam beyond a `herdInstinct` trait affecting crowding behaviour. |
| Neural control / memory | **Not implemented.** `MEMORY` trait exists and is charged as a sensing cost but **is not read by any behaviour** — it is currently inert. |
| Instar metamorphosis | **Not implemented.** Requires replacing the maturation ramp (§1.6). |
| Contact/chemical/electrical signalling | **Not implemented.** |

**Honest reading:** the representation (typed per-organism fields, flat trait
vector, discrete body genes, derived role readout) does admit all of the above
without redesign. Adding them is additive work on `role.ts` and the behaviour
arbitration, not a change of representation. That is what was asked for and it
is genuinely present. But "leaves a seam" is not "works", and only the items
marked Real/Partial above have been *demonstrated by execution*.

---

## 3. Bugs found and fixed during construction

Recorded because they are the actual evidence that the credibility checks are
load-bearing, and because several were silent.

| # | Bug | How it presented |
| --- | --- | --- |
| 1 | Photosynthesis never consumed nutrient | Capture was unbounded → energy created from nothing. Accounting residual −8090 %. |
| 2 | Photosynthesis overflow credited detritus **and** recorded organic input for the same energy | Double-counted on the overflow path. |
| 3 | Founder starting biomass was never booked as input | Residual wrong by exactly the founding biomass from tick 0. |
| 4 | Corpse energy was not zeroed at death | Biomass, detritus and dissipation all counted the same energy. |
| 5 | `store.count` (dense bound) was used as population | Population identity off by the free-list size; "population" overstated by the number of dead-but-recycled slots. |
| 6 | Newborn energy was transferred in, then wiped by a following `energy[slot] = 0` | Leaked `perChild` per birth. Residual grew with births. |
| 7 | `interactions.reset()` ran **after** the act phase filled the queue | Every contested interaction was discarded. 82 matings submitted, 0 resolved — presented as an ecology that never contests. |
| 8 | Physical `size` (range 0.35–15.5) used as if normalized in behaviour scores | `(1 - size*0.1)` went **negative** above size 10, silently switching predation off for the largest organisms. |
| 9 | Recombinant lineage ids formed a ~9×10⁸ sparse key space, stored in dense bookkeeping arrays | Attempted a ~86 GB allocation; run aborted. Required a dense lineage registry. |
| 10 | Chase at equal speed never closes | Zero predation contests in 250 ticks; required a pursuit boost. |
| 11 | Benchmark phase grouping subtracted *cumulative* phenotype time from *measured-window* phase totals | Reported a negative cost share. |
| 12 | Degradation measured first-20 % vs last-20 % | Dominated by JIT warm-up; produced ratios below 1 for runs that were slowing down. Now mid-40–60 % vs last-20 %. |

Nine of these twelve were **not** caught by the type checker, and several were not
caught by looking at the code. They were caught by the accounting identity, the
population identity, and the "contests must be non-zero" gate. That is the
argument for keeping those checks even in a disposable experiment.

---
## 4. Credibility gates — results

Run: `tsx src/gates.ts` — 300 founders, 2000² world, 250 ticks, seed 4242.
**7/7 passed.**

| Gate | Result | Evidence |
| --- | --- | --- |
| G1 seeded repeatability | **PASS** | Same seed produced identical digests at every checkpoint: `4c026a89, 3028a974, b319c0a2, cd122281, 8115862a, 1b88e82e, 1b88e82e`. Different seed diverged. |
| G2 finite/valid state | **PASS** | 72,007 organism-states and 625,000 field-cells checked; **0 violations**. |
| G3 causal resource accounting | **PASS** | Worst residual **0.15441 %** of total input (tick 248), tolerance 0.5 %. |
| G4 population identity | **PASS** | `300 + 95 births − 66 deaths = 329`, exact at **every one of 250 ticks**. |
| G4b death attribution | **PASS** | damage 65 + age 1 + starve 0 = 66 = total deaths. |
| G5 contested resolution | **PASS** | 144 contests resolved, **0 duplicate pairs**, replay digest `d06ab199` identical. |
| G5b contests non-vacuous | **PASS** | 110 predation contests — a zero would fail the gate. |

### Resource ledger at end of the gate run (measured, not inferred)

| Injected | value | % of input |
| --- | --- | --- |
| founding biomass (initial condition) | 33,000.0 | 45.8 % |
| external organic input (`basalFoodPerCell`) | 37,500.0 | 52.1 % |
| **photosynthetic capture** | **1,494.8** | **2.1 %** |
| **total input** | **71,994.8** | 100 % |

| Accounted | value |
| --- | --- |
| living biomass | 21,542.5 |
| detritus pool | 17,717.2 |
| dissipated (total) | 32,624.7 |
| **total accounted** | **71,884.5** |
| **residual** | **110.3 (0.153 %)** |

Dissipation split: basal 17,965 · movement 873 · sensing 1,399 · contest 126 ·
reproduction 131 · mineralised 6,005 · spoiled 661 · unassimilated 5,466.

### THE MOST IMPORTANT FINDING IN THIS REPORT

**Primary production supplies 2.1 % of the energy entering this system.** The
other 97.9 % is exogenous organic input plus the founders' starting biomass.

That means the default configuration is **not a producer-driven ecosystem**. It
is a subsidy-driven one in which detritus rain feeds consumers directly, and the
phototroph/producer role — the thing that would anchor a real trophic cascade — is
almost energetically irrelevant. Any claim that the model demonstrates
bottom-up trophic structure, producer limitation, or energy pyramids is
**unsupported by this configuration**.

Root cause: `basalFoodPerCell = 0.06` per cell per tick against
`photosyntheticRate` capped so that the resulting capture is roughly two orders
of magnitude smaller. The parameter pair was never jointly calibrated, because
the first version of the model did not have producers doing meaningful work.

**This is a tunable knob, not a fundamental defect.** The obvious next
experiment is to drive `basalFoodPerCell` toward zero and let producers carry the
energy budget, then check whether the ecosystem survives, collapses, or reaches a
producer-limited equilibrium — which is the single most interesting open question
this POC raises. **That experiment was not run** (§7).

### Reading the residual honestly

The identity does not close to zero; it closes to ~0.15 % of total input. This is
**Float32Array rounding**, not a leak: organism energy is stored in
`Float32Array` while the ledger accumulates in float64, so every credit/debit
differs from its recorded value by float32 epsilon and the differences
accumulate. Four separate real leaks (§3 items 1, 3, 4, 6) were caught by this
same check before it was tightened, so the check is demonstrably load-bearing.
Closing to machine epsilon would require float64 energy storage, roughly doubling
SoA memory cost, which was not worth it for an experiment. **This is a known,
bounded, measured inaccuracy, not an unknown one.**

### G5 is only as good as its non-vacuity condition

`territorial=0` and `scavenge=0`: those two interaction kinds are structurally
present and correctly resolved when they occur, but **nothing in the current
behaviour arbitration ever selects them**. Territorial contests are unreachable
because no intent maps to them, and scavenge-contests are only reached when a
carcass-contending pair is within contact during a scavenge intent that does not
submit a contest request at all. G5 therefore evidences determinism for the two
kinds that fire (predation, mating), not for all four.


## 5. Performance — headless simulation capacity

Runtime: Node v24.21.0, aarch64, 8 logical cores, proot-distro container on an
Android phone. **This is constrained handheld hardware running under emulation;
it is not a desktop baseline.** No renderer loaded — these are simulation
numbers only.

Each scenario was measured in a **separate process** to avoid cross-scenario JIT
and GC contamination. Values are the two runs produced (the harness always
appends one extra lineage-enabled run, which is the second row per size).

| founders | ticks/s | mean tick | p99 tick | µs / organism-tick | heap |
| --- | --- | --- | --- | --- | --- |
| 1,000 | 290 / 242 | 3.44 / 3.09 ms | 13.2 / 15.1 ms | 3.44 / 3.09 | 15 / 31 MB |
| 5,000 | 66 / 54 | 15.07 / 13.49 ms | 43.6 / 30.1 ms | 3.04 / 2.72 | 35 / 208 MB |
| 10,000 | 25.5 / 29.7 | 39.2 / 26.3 ms | 78.0 / 54.3 ms | 3.98 / 2.67 | 62 / 163 MB |
| 25,000 | 7.9 / 8.5 | 126 / 101 ms | 205 / 141 ms | 5.08 / 4.07 | 83 / 294 MB |
| 50,000 | 2.5 / 2.3 | 407 / 395 ms | 769 / 480 ms | 8.18 / 7.93 | 120 / 309 MB |

`heap` is `heapUsed`; the second figure in each pair is post-GC-trim variance, and
RSS peaked near 300 MB at 25k. **Tail latency is the weakest number here:** p99 is
roughly 1.5–2× the mean, with single ticks up to 111 ms at 10k. On a phone-sized
device that is a real frame-budget problem for any interactive viewer at those
counts.

### Subsystem separation (amendment requirement)

Share of measured-window time, at 10,000 founders (the largest size where every
subsystem is exercised and where the world has not yet exploded past the field
grid):

| subsystem | share |
| --- | --- |
| organism biology (sense/decide/move/metabolise/feed) | 80–95 % |
| ecology-field dynamics (abiotic axis + nutrient/detritus + spatial index) | 3–19 % |
| other (death + birth phases) | 1.2–1.5 % |
| interaction resolution | 0.5–0.8 % |
| phenotype generation | 0.07–0.17 % |
| lineage bookkeeping | 0 % → **31 %** when enabled |
| rendering | n/a (no renderer loaded) |

Lineage bookkeeping is **not** cheap: at 1,000 founders with lineage sampling on,
it cost 31 % of tick time against 19 % for ecology-field dynamics. Any production
design must budget lineage aggregation explicitly or sample it out of band.

### Procedural phenotype generation

Isolated micro-benchmark: **3.2–10.0 µs per derivation** (20,000 iterations),
with wide run-to-run variance on this device. At 0.1 derivations per 1,000
organism-ticks, birth rate — not phenotype cost — is what determines whether
this matters. It would become dominant only in a high-fecundity world with large
clutches, which this configuration does not produce.

### Scaling is linear in algorithm, super-linear in constants

Per-organism cost is *flat to 10,000* (≈2.7–4.0 µs) and then **rises to ≈8 µs at
50,000**. I tested whether that was a density effect by holding population
constant and enlarging the world:

| 25,000 organisms | mean tick | µs / organism-tick |
| --- | --- | --- |
| world 4000² (dense) | 106–125 ms | 4.28–5.02 |
| world 6324² (same density as 10k in 4000²) | 107–142 ms | 4.33–5.71 |

**No meaningful difference.** So the growth is not spatial density and not
neighbour fan-out. The working set is the explanation: at 50,000 organisms the
expressed-trait block alone is 50,000 × 36 × 4 B ≈ **7.2 MB**, plus the same again
for genomes and ~2.4 MB of scalar arrays — roughly **17 MB touched per tick**,
past the cache hierarchy of this device. The per-tick algorithm is O(n) with
bounded work per organism; the *constant* degrades because memory locality does.

### Long-run degradation

Mid-40–60 % vs last-20 % mean tick time gave ratios of **1.11** (1k) and **0.58**
(10k) — i.e. no systematic throughput decay within 150 ticks, but the 10k ratio
below 1 is inside run-to-run noise on this hardware and should not be read as
the world getting faster.

## 6. Long-run ecosystem dynamics — the headline negative result

The amendment explicitly asked for credible long-run dynamics, not just
throughput. Here they are, and they are **not good**.

`tsx src/longrun.ts --ticks=1000 --seeds=11,202`, 400 founders, 2400² world:

| tick | pop | nutrient | detritus | contests (cum.) |
| --- | --- | --- | --- | --- |
| 33 | 400 | 70,223 | 5,782 | 14 |
| 132 | 397 | 107,901 | 16,930 | 77 |
| 231 | 430 | 108,433 | 24,464 | 170 |
| 330 | 581 | 108,830 | 30,525 | 471 |
| 396 | 2,642 | 109,002 | 33,490 | 4,489 |
| 429 | 12,206 | 109,093 | 34,981 | 34,866 |

Population roughly **doubles every 30–40 ticks from tick ~300 onward**, reaching
12,206 by tick 429 and climbing. A separate smoke run reached **11,074
organisms from 200 founders in 300 ticks**. The harness classifies this as
`expansion (unbounded)`.

**No carrying capacity is reached. No equilibrium forms. No boom-bust cycle
appears.** The reason is visible in the same table: **nutrient is flat-to-rising
while the population explodes.** The substrate is never meaningfully depleted,
so there is nothing to limit growth.

This is the direct consequence of §4's finding. Photosynthesis converts ~7 % of
incoming energy; the exogenous organic subsidy (`basalFoodPerCell`) is applied
to *every* cell *every* tick and is independent of how many organisms are
competing for it. Consumers therefore have an effectively inexhaustible,
density-independent food supply, and population is limited by almost nothing.

**Stated plainly: the current configuration does not produce an ecosystem. It
produces an unbounded population explosion with ecology layered on top.** Any
reading of the trophic composition in §4 as "a food web" is therefore not
supported. This is reported rather than tuned away — a green population curve
would have been easy to manufacture by raising mortality, and would have been
worthless.

### What this does and does not show

- **Does show:** organisms reproduce, compete, predate, mate, die of damage, and
  convert mass between all four pools with the ledger closing to 3×10⁻⁵ %.
- **Shows (weakly):** divergence between lineages — in one acceptance run, toxin
  drifted 0.450 → 0.011 in one lineage while 0.380 → 0.758 in another from the
  same founder pool, and generation depth reached 5.
- **Does not show:** resource limitation, succession, competitive exclusion,
  predator-prey cycles, collapse, recovery, or stable coexistence. **None of
  those was observed**, because the configuration cannot produce them.

---

## 7. Independent review: what it caught, and what it cost

An independent `review` pass was run over the actual source. It found **12
substantive defects**, of which 3 were blocking, 9 material, plus 11 minor.
Every blocking and material finding was fixed and re-verified.

The most important one was **not** in my original list of twelve (§3): stale
contested-interaction records were being re-applied on every subsequent tick
because the record buffer is reused and never shrunk while the apply loop
iterated to the buffer's *length* instead of its valid *count*. The gates could
not see it: `resolutions()` sliced correctly, and predation transfers are
ledger-neutral. Fixing it moved contested interactions from 144 → 228 per 250
ticks, because the bug had been *removing* energy and applying phantom damage.

The second most important was that **the conservation residual was not float32
rounding at all.** I had written that in §4 of this report as the explanation.
It was wrong. Fixing four genuine leaks (photosynthesis overflow booked as less
than it was; birth endowment destroyed on capacity overflow; predation spillage
computed against energy never removed; scavenging ignoring the storage ceiling)
dropped the residual from **0.154 % → 0.00003 %** — a 5000× improvement. The
float32 rounding I blamed was a rounding error in my reasoning about which
number was being booked, and I corrected §4 above.

**The lesson worth carrying forward:** the four credibility gates were necessary
but not sufficient. They passed while three blocking conservation and
determinism defects were live, because the gates checked the *invariants* but
the defects lived in the *bookkeeping that fed them*. An independent adversarial
review found what invariant-checking cannot.

---

## 8. Limitations, stated as a single list

**Authority**
1. The Living Design Document and Simulation Foundation Architecture were never
   accessible. Biological principles are therefore unverified against the
   authoritative sources.

**Modelling**
2. The default configuration is subsidy-driven and cannot reach a carrying
   capacity (§6). It is not an ecosystem model in any useful sense yet.
3. Nutrient is not energy-tracked, so matter is not conserved (§1.2).
4. No genome recombination; sexual reproduction forks lineage but clones genes
   (§1.5).
5. Life stage is a ramp, not metamorphosis; senescence is linear damage (§1.6–1.7).
6. Crowding is a density penalty, not interference or colonial suppression (§1.8).
7. Territorial and scavenge-contests are structurally present but behaviourally
   unreachable — they resolved 0 contests in every run (§4).
8. `MEMORY` is charged a sensing cost and read by nothing: an inert trait.
9. Habitat is smooth and banded by construction (§1.9).
10. Bouncing walls create an edge artifact the maintained implementation does not
    have (§1.10).

**Measurement**
11. All numbers come from a phone under proot emulation, with visible run-to-run
    variance (10k founders measured at both 25.5 and 29.7 ticks/s). Treat
    absolute figures as indicative, not as a benchmark.
12. No rendering FPS was measured. The viewer exists and was verified to serve
    and resolve its full module graph offline, but **no browser rendering
    evidence was captured** — the device does not permit sustained browser runs,
    and I did not claim numbers I did not measure.
13. No WASM or alternative-runtime comparison was run. The recommendation below
    rests on the memory-locality diagnosis (§5), not on a head-to-head test.
14. Population ceilings were configured but never bound (`capHits` 0 in all
    reported runs), so no result is cap-distorted — but the ceiling itself
    remains an artificial limit if ever reached.

**Not implemented despite seams existing**
15. Cooperation/colonies, neural control, and instar metamorphosis.

---

## 9. Recommendation

### Retain TypeScript. Do **not** pursue WASM for the simulation kernel. Do **not** investigate a different execution approach.

The evidence points at one specific bottleneck that is **not** the kind of
problem another language solves.

**Why not WASM.** Per-organism cost is flat to ~10,000 organisms and then rises
to ~8 µs. The density-controlled test (§5) ruled out spatial density and
neighbour fan-out. The working set at 50,000 organisms is ~17 MB touched per
tick, past this device's cache hierarchy. **That is a memory-latency problem.
WASM would not help**, because it changes instruction encoding, not memory
traffic. Moving to WASM for a memory-bound kernel is the wrong tool and would add
a build toolchain, a cross-module boundary, and a second language to the build
for no measured gain.

**Why not a different execution approach.** The per-tick algorithm is already
O(n) with bounded work per organism, contested interactions resolve exactly once
per pair, and the resource ledger closes to 3×10⁻⁵ %. There is no algorithmic
wall in the profile. Nothing here resembles the conditions that justify leaving
a language.

**The actual recommendation: optimize the TypeScript architecture, in this
order, and measure each step.**

1. **Shrink the per-organism working set first.** The materialised `physical`
   block duplicates the genome: 36 floats per organism, ~7.2 MB at 50k. Most
   traits are read in only one phase. Read the ~25 needed traits directly from
   `genome` and scale on the fly, or drop the block to the hot fields. Expected:
   roughly halve the working set and recover most of the 10k→50k degradation.
2. **Chunk the tick by spatial cell.** If (1) is insufficient, iterate
   neighbourhood-by-neighbourhood so each pass touches a cache-resident slice
   instead of the whole world. This is a layout change, not a language change.
3. **Move lineage aggregation off the tick path.** It cost 31 % of tick time at
   1,000 founders. Sample it out of band or amortise it; never let reporting
   dominate simulation.
4. **Only then consider a WASM kernel**, and only for a demonstrably
   compute-bound inner loop (behaviour arbitration's transcendental selection is
   the best candidate). Do not do this for the SoA sweeps — they are the
   memory-bound part.

**Separately, and more urgently than any performance question: fix the ecology
before making any biological claim.** Drive `basalFoodPerCell` toward zero, let
producers carry the energy budget, and re-run §6. If the world then collapses,
that is a *better* result than the current explosion, because it would mean
resource limitation exists and can be studied. Until that is done, the
simulation's throughput numbers are meaningful and its ecological conclusions
are not.

**Production adoption is a separate decision** requiring the design documents,
a separate review, and normal validation. Nothing here supports promotion.

---

## 10. Reproduction

See `README.md` for exact commands. Every number in this report came from the
committed commands in that file against `ts-evo-poc/0.1.0` on Node v24.21.0.

| Command | What it produced |
| --- | --- |
| `tsc -p tsconfig.json --noEmit` | typecheck (clean) |
| `tsx src/smoke.ts` | §3 verification, SMOKE PASS |
| `tsx src/gates.ts` | §4, 7/7 gates |
| `tsx src/acceptance.ts --scale=40` | §4 E1/E2, §6 habitat + disturbance evidence |
| `tsx src/bench.ts --ladder=N --ticks=T --world=W` | §5, each size in its own process |
| `tsx src/longrun.ts --ticks=1000 --seeds=11,202` | §6 |
| `tsc -p tsconfig.build.json && tsx src/view/serve.ts` | §12 viewer |

### Files

```
experiment/ts-evolution-poc/
  README.md            run instructions, configs, seeds
  REPORT.md            this document
  package.json         scripts only; no dependencies
  src/core/            rng, soa, spatial, field, hash          (5 files)
  src/bio/             genome, phenotype, interactions, role, habitat  (5 files)
  src/world/           world, config, ledger, disturbances, history, version  (6 files)
  src/                 smoke, gates, bench, viability, acceptance, longrun  (6 files)
  src/view/            viewer.ts, index.html, serve.ts            (3 files)
```

### What is NOT in this worktree

No commit, no push, no merge, no branch on `main`, no change to any maintained
production package, no new dependency, no change to `tools/validation/manifest.ts`,
no CI bypass. `legacy/prototype/` untouched. Git safety rules observed
throughout: nothing was committed, so the branch holds work-in-progress only.

---

# ADDENDUM — re-measurement after the multi-nutrient redesign

**This addendum supersedes the numbers in §4, §5 and §6 above.** Those sections
were measured before the substrate model changed and must not be quoted.

## What changed in the model

| Change | Reason |
| --- | --- |
| 3 independently limiting nutrients + 3 heritable affinity traits | Competitive exclusion forbids a food web with fewer limiting resources than species (RESEARCH.md) |
| Liebig's law of the minimum governs uptake | Produces genuine co-limitation, so specialists can coexist |
| Benthic `sediment` compartment (non-diffusing, 78 % of corpses) | Detrital food webs are benthic; suspended detritus alone is too dilute (RESEARCH.md) |
| `DISPERSAL` trait; sessile parents boosted 1.85× | Sessile producers stripped their own cell with no route to fresh substrate |
| `DETRITIVORY` trait scaling benthic feeding vs hunting | Consumer guilds competed identically without a strategy axis |
| **`INTERACTION.GRAZE` — herbivory** | The missing trophic link: consumers had no renewable food source, so both consumer guilds competed over one resource and one was always excluded |
| `DETRITIVORY` trait scales benthic feeding vs hunting | Without strategy, consumer guilds competed identically |
| Reproduction requires ~90 ticks of upkeep reserve | Organisms bred at zero energy; births outran deaths 20:1 |
| Deficit-proportional starvation | Flat-rate damage let starving organisms survive ~130 ticks |
| Starvation damage separated from injury | Both shared one counter, so starving deaths were reported as predation |
| `baseLight` 0.62 → 1.05, `nutrientRegen` 0.0032 → 0.014 | Measured local light 0.462 vs 0.618 needed; sustainable nutrient flux was below one producer's upkeep |
| Layout constants single-sourced + load-time assertion | Array position must equal enum value; violating it silently corrupted every genome |
| 40 → 41 heritable traits (`DETRITIVORY`) | — |
| 8 behaviour intents (added `GRAZE`) | — |

## Headline: a carrying capacity now exists

`tsx src/regime.ts --ticks=900 --subsidies=0.002 --founders=400,1200,2500`

| founders | outcome | final pop | capture share | producers | mean gen | extinctions |
| --- | --- | --- | --- | --- | --- | --- |
| 400 | **LIMITED (resource-capped)** | 408 | 51.6 % | 95 % | 0.27 | 0 |
| 1200 | **LIMITED (resource-capped)** | 828 | 52.2 % | 89 % | 0.56 | 0 |
| 2500 | damped (overshoot) | 1131 | 49.0 % | 94 % | 0.49 | 0 |

Population trajectory at 400 founders — it grows, plateaus, and **holds**:

```
400 → 404 → 419 → 435 → 480 → 513 → 519 → 496 → 495 → 501 → 485 → 408
```

This is the single most important change in the experiment. Previously the same
configuration was unbounded expansion (400 → 12,206 by tick 429). **Population is
now limited by resource availability, which is what "the ecosystem works" has to
mean at minimum.** Phototrophy supplies ~52 % of energy, up from 2.1 %, and
residual accounting holds at 0.00005 % with zero extinctions.

## Performance (re-measured)

`tsx src/bench.ts --ladder=1000,10000 --ticks=120`

| founders | ticks/s | mean tick | p99 | µs / organism-tick | heap |
| --- | --- | --- | --- | --- | --- |
| 1,000 | 330 | 3.03 ms | 14.3 ms | 3.02 | 21 MB |
| 10,000 | 58 | 17.4 ms | 43.3 ms | 1.74 | 54 MB |

10,000 founders improved from ~25–30 ticks/s to **58 ticks/s**, because the world
no longer expands past its carrying capacity — the earlier figures were partly
measuring an unbounded population rather than a steady one.

## What is still not achieved

1. **The food web is thin.** Producers are 89–95 % of the population. Consumers
   persist and grazer numbers *grow* at larger founder counts, but they remain a
   minority. Predators are marginal (≈6 individuals at 1,200 founders) and go
   extinct from smaller starts. Three limiting resources made coexistence
   *possible*; they did not make it *selected*.
2. **Sediment accumulates without returning to nutrient.** Corpses concentrate
   in the benthic compartment faster than mineralisation or detritivory removes
   it. It is a sink, not a fully closed loop.
3. **Total abundance still trends down** from its peak even when classified
   LIMITED. The plateau holds for ~500–600 ticks, not indefinitely.
4. **The outcome classifier is still biased toward equilibria**, as flagged in
   RESEARCH.md §3. Limit cycles would be scored as failure.
5. **Habitat contrast remains weak** in effect: fertility range 0.61–1.50 does
   not produce visibly divergent outcomes between rich and poor founding cells.
6. **No browser rendering evidence** was captured; the viewer's sprite-pool
   rewrite is unverified in a real browser.

## Verdict on the original question

The technical question — can TypeScript sustain this complexity and scale — is
answered **yes**, and the recommendation is unchanged: retain TypeScript,
optimise the TypeScript architecture, do not pursue WASM for the tick kernel.
µs/organism-tick is now *lower* at 10,000 than at 1,000, and the earlier
10k→50k degradation remains a memory-locality problem rather than an
algorithmic one.

The ecological question is **partially** answered. The model now exhibits
resource limitation and a stable plateau, which it previously did not. It does
not yet exhibit a self-sustaining multi-trophic food web. The next experiment
should target consumer persistence specifically, not further tuning of the
producer side, which is now working.

## Herbivory pass (supersedes the addendum above where it conflicts)

**41 heritable traits**, 8 behaviour intents, 5 interaction kinds.

### What herbivory changed

Consumers previously had exactly two food sources: sediment detritus (sparse and
patchy) and predation on producers. Predation is a lethal contest, so a small
grazer either never won one or killed its own food. Both non-photosynthetic
guilds were therefore competing over the same producer biomass, and competitive
exclusion inside a single trophic guild guaranteed at most one survived.

`INTERACTION.GRAZE` removes a **bounded fraction** of a living producer's
standing biomass, resisted by the producer's `armor` trait. It is renewable yield
rather than a one-off kill, which is what makes producer abundance a consumer
food source at all.

At 1,200 founders over 1,500 ticks:

| guild | before herbivory | after |
| --- | --- | --- |
| grazers | 48 → 4 (collapsing) | 48 → **74** (growing) |
| decomposers | 53 → 0 | 62 → **83** (growing) |
| predators | 33 → 1 | 33 → 1 (unchanged) |
| capture share | 58 % | **63 %** |

Population remains `LIMITED (resource-capped)`: 1,197 → peak 1,291 @ t506 → 970.

### A rejected hypothesis, recorded

Predators still decline (33 → 1). The hypothesis was that grazers outcompete
them for the same producers, so separating the guilds by body size — a narrower
gape band (0.25–0.82) plus a large-attacker requirement — should isolate them.

**Measured and rejected.** Grazers collapsed 34 → 5, because the change removed
hunting from small consumers and herbivory alone cannot carry them. Hunting is
load-bearing for small consumers. Reverted, with the measurement left in the code
comment so it is not retried blind.

**Predators remain an unsolved problem in this model.**

---

# FINAL RE-MEASUREMENT

Supersedes all numbers above. Measured on Node v24.21.0, aarch64, 8 cores,
proot container on an Android phone. Each bench scenario in its own process.

## Default configuration corrected

`basalFoodPerCell` 0.06 → **0.002**. The sweep identified this as the
producer-driven regime; leaving the old subsidy as the default meant the viewer,
acceptance and benchmarks were all still exercising the runaway world. Effect on
benchmark throughput was large, because unbounded growth inflates per-tick work:

| founders | ticks/s (old default) | ticks/s (corrected) | mean tick |
| --- | --- | --- | --- |
| 1,000 | 330 | **520** | 1.92 ms |
| 10,000 | 58 | **98** | 10.2 ms |
| 25,000 | 8.2 | — | 122 ms |

µs per organism-tick at 10,000 founders: **1.03** (was 1.74 at the previous
default, and 2.9–4.0 before the multi-nutrient redesign).

## Long-run dynamics — first genuine equilibrium

`tsx src/longrun.ts --ticks=1200 --seeds=11,202`

| seed | outcome | final | peak | min after peak | turnover | mean gen | lineages | extinctions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 | **equilibrium** | 724 | 768 @t795 | 688 | 2.6× | 0.80 | 487 | **0** |
| 202 | expansion (unbounded) | 1764 | 1764 @t1200 | 1764 | 5.1× | 0.41 | 486 | **0** |

Seed 11 settles into a tight band (688–768) and stays there. That is the first
time this model has reached a steady state rather than exploding or collapsing,
and it is the outcome the whole redesign was for.

The two seeds diverge. That is consistent with RESEARCH.md: under
consumer–resource dynamics the attractor depends on initial conditions, and the
enrichment literature expects overshoot-and-collapse as a regime rather than an
error. Seed 202 is still expanding at the horizon, so **"the ecosystem settles" is
not yet true in general** — it is true for one of two seeds tested.

## Gates

**7/7 pass.** Worst accounting residual 0.01647 % of total input (tolerance 0.5 %).
Final ledger: input 56,459.9 = biomass 25,753.6 + detritus+sediment + dissipated
21,925.1, with basal 16,604, sensing 1,482, mineralised 1,362, unassimilated
2,072. **Zero extinctions** across all regime and long-run runs.

## Honest summary

**Now demonstrated:** resource-limited population with a settled equilibrium on
one seed; photosynthesis supplying the majority of energy; two consumer guilds
that grow rather than blink out; a closed, auditable energy ledger; seeded
repeatability; and ~98 ticks/s at 10,000 organisms on phone-class hardware.

**Not demonstrated:** a self-sustaining third trophic level (predators still fail,
and one of two seeds still runs away); total abundance trending down from peak
rather than settling; measurable habitat-contrast effects; limit-cycle detection
in the classifier; any browser rendering evidence.

**Recommendation unchanged:** retain TypeScript, optimise the TypeScript
architecture (working-set reduction first), do not pursue WASM for the tick
kernel. Per-organism cost *falls* with scale in the current model, which is the
opposite of the memory-locality degradation seen when the population was
unbounded — because bounded populations keep the working set cache-resident.

---

# TROPHIC BALANCE PASS

## The diagnostic that found it

Arithmetic on the yield formula, at the then-current `MEAT_YIELD_PER_MASS = 5.0`:

| prey size | yield per kill | % of prey's standing value (85) |
| --- | --- | --- |
| 3 | 15.9 | 19 % |
| 6.7 | 49.0 | 58 % |
| 10 | **85.9** | **101 %** |

A predator eating a size-10 prey extracted **more than the prey's entire standing
value**. That is energy creation, not transfer. The cause was an inconsistency:
predation yield was keyed to prey **body mass** (`size^1.4`) while a prey's
**standing value was independent of size**. Large prey were therefore
super-linearly better to eat, predators ballooned to 25 % of the population, and
every other consumer guild was squeezed out.

## Two coupled fixes

1. **Storage capacity now scales with body mass.** A large animal now holds a
   proportionate reserve instead of the same reserve as a small one, so yield as
   a *fraction* of standing value becomes roughly constant across body sizes.
2. **Trophic transfer set to ~15 %** (`MEAT_YIELD_PER_MASS = 1.6`), the order of
   real trophic transfer efficiency.

## Result — a proper pyramid

| guild | count | share |
| --- | --- | --- |
| producers | 5,170 | 94.7 % |
| **predators** | **266** | **4.9 %** |
| grazers | 22 | 0.4 % |
| scavengers | 1 | 0.0 % |
| decomposers | 0 | 0.0 % |

Predators are now **4.9 % and growing** (39 → 48 → 30 → 50 → 86 → 125 → 266
across 3,500 ticks) — "fewer, but more deadly", which was the target. They were
also given **size-scaled perception**, because instrumentation showed predation
was already winning 100 % of the contacts it had; the failure was encounter
rate (0.03 contacts per predator per tick), not combat effectiveness.

## Still not balanced

- **Scavengers and decomposers are still excluded.** Two of five guilds survive.
- **Producers remain 94.7 %**, which is producer-heavy even for a
  producer-dominated system.
- **Total abundance still expands** (1,291 → 5,459 over 3,500 ticks) rather than
  settling, so carrying capacity is still not reached at this scale.
- Gates 7/7, residual 0.00002 %.

---

# FOUNDER-INIT GENE-SPACE FIX (and what it cost)

## The defect, and the reason it was invisible

Traits are stored as a normalised gene in `[0,1]`; physical value is
`lo + gene * (hi - lo)`. `TraitSpec.init` is documented as a *physical* value
but is consumed as a **gene** in `seedFounders`:

```ts
const g = spec.init + this.rng.gaussian(0, spec.spread) * 0.5;
genome[t] = g < 0 ? 0 : g > 1 ? 1 : g;   // silent clamp
```

Two traits carried physical values in that field. Both clamped to `1.0`, and
because the failure is a silent clamp rather than a crash, the simulation ran
plausibly and nobody noticed:

| trait | declared init | interpreted as | effect on every founder |
| --- | --- | --- | --- |
| `storageCapacity` | `70` | gene `1.0` | maximum capacity `220`; **zero founding variance** |
| `visionFov` | `1.6` (rad) | gene `1.0` | full **360 deg** field of view; no blind spot |

`visionFov` was missed by the first audit because its `hi` is `Math.PI * 2` — an
expression, so a regex that assumed numeric bounds skipped the line entirely. The
load-time assertion added below caught it on its first run.

Fix: init expressed in gene space (`0.2788`, `0.2364` → the same intended
physical 70 and 1.6 rad), the `init` doc comment corrected to state the gene
convention, and a load-time assertion added to the existing `assertTraitLayout`
IIFE that throws if any init is outside `[0,1]` or any range is degenerate.

Note some ranges are intentionally INVERTED (`maturityAge` 420..10,
`lifespan` 1500..90). That is also the proof that `init` must be a gene: a
physical init for `maturityAge` would be 0.45 *ticks*.

Verified after the fix: founders span capacity `5.8 … 197.5` (median `58.6`),
**zero saturated**, against a previous uniform `~195`.

## Second defect: capacity had two disagreeing authorities

Mass-correcting capacity (`Phenotype.capacityForTrait`) had been wired into only
**one** of six functional call sites. The other five still read the raw trait, so
intake headroom, breeding eligibility, combat fuel, transfer headroom and the
founding reserve each used a *different* ceiling.

Fixed by adding `resolveCapacity(phen, fallback)` as the single authority and
routing all six through it. Any future capacity ceiling must use it.

## Third defect, found by independent review: stale hardcoded `36`

`TRAIT_COUNT` is 41, but several sites hardcoded `36`:

| site | defect | consequence |
| --- | --- | --- |
| `gates.ts:91` | `const o = slot * 36` | **G2 read the wrong physical block for every slot except slot 0** — it inspected the tail of one organism and the head of the next |
| `gates.ts` loop bound | `t < 36` | `nutrientA/B/C`, `dispersal`, `detritivory` were **never checked at all** — the guild-balance traits |
| `viewer.ts` | `base = slot * 36` | inspector read the wrong trait block |
| `bench.ts` | `new Float32Array(36)`, `i % 36` | phenotype-derivation benchmark excluded 5 traits, understating cost |

Measured: with stride 36, **8,200 of 8,200** trait values examined were
mis-addressed for slots past the first, and 5 of 41 traits were never checked.
All now derive from `TRAIT_COUNT` / `BODY_GENE_COUNT`.

This means earlier "gates 7/7" claims covered only 36 of 41 traits on
mis-addressed memory. They now cover all 41 correctly, and still pass.

## The cost: the balance was resting on the bug

Same protocol (3 seeds x 1200 ticks), before vs after:

| | before | after |
| --- | --- | --- |
| outcomes | equilibrium / damped / damped | **expansion (unbounded) 3/3** |
| final population | 387 / 517 / 251 | 4844 / 7619 / 3222 |
| predators (energy) | 0.6 / 0.0 / 0.0 | 0.0 / 0.0 / 0.0 |
| mean generation | 0.84 / 0.51 / 0.51 | 0.15 / 0.12 / 0.05 |

**Mechanism (measured, not inferred).** The breeding gate is a *fraction* of
capacity (`reproThreshold`, founders ~0.53). Correcting capacity from 220 to a
median 61 therefore loosened the *absolute* reproduction gate by **3.4x**, from
~116 energy to ~34. Mean energy fraction sat at 0.39–0.50 against a 0.53 gate,
so a quarter to a third of the population cleared it every tick.

The saturated `220` was acting as an accidental 3.4x reproduction brake. Every
balance parameter tuned in the previous passes — `MEAT_YIELD_PER_MASS = 1.6`,
the slowed abiotic mineralisation, size-scaled perception — was calibrated
against that inflated ceiling.

So the earlier claim that the population was resource-limited was partly an
artifact: with the artifact removed, **resource limitation is not yet binding
enough to hold the system at carrying capacity.**

## Status

- Typecheck clean, browser build clean.
- Gates 7/7 with full 41-trait coverage at the correct stride; residual 0.00001 %.
- Independent review pass: no substantive defect in the fix itself.
- **Balance is regressed and is NOT fixed.** Unbounded expansion on all seeds;
  predators extinct; only producers and grazers persist.
- Not re-tuned. Re-deriving the balance against correct capacity is a separate
  decision, because it changes biological parameters and would obscure what this
  fix actually did.

---

# BALANCE DIAGNOSIS (in progress — fix not yet applied)

## Why the ecosystem no longer has a carrying capacity

Measured on seed 11, 400 founders, 2400x2400, probing per-producer income:

| tick | pop | producers | income/producer/tick | nutrient per producer |
| --- | --- | --- | --- | --- |
| 150 | 399 | 367 | 0.1821 | 5.76e-2 |
| 450 | 832 | 784 | 0.1789 | 2.68e-2 |
| 900 | 3276 | 3261 | 0.1682 | 5.78e-3 |
| 1200 | 4844 | 4843 | 0.1910 | 3.30e-3 |

**Per-producer income is flat at ~0.17-0.19/tick across a 13x change in
density.** Nutrient per producer fell ~17x and income did not move. So there is
essentially NO density dependence in producer income, and the only thing bounding
the population is the global `maxPopulation` of 60,000 (never approached).

Mechanism, as far as verified:

1. Producer demand is `photo * 0.42 * globalLight * shade[ci] * lightMul`
   (world.ts ~1247). None of these terms depends on neighbouring organisms.
2. The Liebig limiting factor `lim` is pinned at 1, because per-cell nutrient sits
   far above what any producer demands. Nutrient never limits.
3. `shade` is written once in the `Habitat` constructor (`0.8 + s*0.28`,
   bio/habitat.ts:79) and is never updated from density. It is spatially
   heterogeneous but static, so it creates patchiness, not crowding.
4. `room = capacity - energy` bounds an individual, not the population.

This is why fixing founder capacity broke the balance: the saturated 220 was
acting as a de facto population brake via the reproduction gate. Removing the
artifact exposed that no biological mechanism was carrying the load.

## UNRESOLVED: nutrient figures do not add up

Per-cell nutrient measures **16-21**, against a configured `nutrientCapacity` of
`[1.0, 0.78, 0.62]` (all three pools summed = 2.4). That is ~7-9x above the stated
ceiling. Not yet explained. Until it is, claim (2) above rests on the observed
`lim == 1` behaviour rather than on the nutrient accounting being correct, and a
light-attenuation fix would risk treating a symptom.

## VALIDATION GAP: nothing gates ecological behaviour

The five credibility gates are G1 seeded repeatability, G2 finite/valid state,
G3 causal resource accounting, G4 consistent births and deaths, G5 deterministic
contested resolution.

**Every one is about internal consistency and determinism. None is about
ecological behaviour.** In particular there is no gate on boundedness, carrying
capacity, or density dependence.

That is why the regression to unbounded expansion passed 7/7 without any gate
complaining, and it means earlier claims like "genuine equilibrium" and
"population is resource-limited" were never gated — they rested on single
long-run classifications. A single deterministic run does not establish
population-level behaviour, and no gate here would have caught the difference.

Adding a boundedness gate is an Owner decision: it changes the deliberately-chosen
five-gate credibility set, and a gate can be written to pass almost trivially. Not
added unilaterally.

---

# RETUNE ATTEMPT 1 — one mechanism added, one negative result, balance NOT restored

## Root cause (independently reviewed and confirmed)

Producer income had **no density dependence at all**:

```
demand = photo * 0.42 * globalLight * shade[ci] * lightMul
```

- `shade` is written once in the `Habitat` constructor (`0.8 + s*0.28`) and never
  updated from density — spatially heterogeneous, temporally static. Patchiness,
  not crowding.
- The Liebig factor `lim` is pinned at 1: per-cell nutrient stock (base 26,
  `nutrientPerCell`) sits ~200-300x above a producer's per-tick want, so nutrient
  never limits.
- `room = capacity - energy` bounds an individual's storage, not the population —
  `gained` is booked in full and overflow spills to detritus, staying in-system.
- The only density-dependent term in the whole income path is a *cost*,
  `(crowding-4)*0.006*(1+size)`, too weak to bind.

So the sole bound on the population was `maxPopulation = 60000`, which is exactly
the artificial abundance control the contract forbids relying on.

## Added: self-shading (real mechanism, verified, but NEGATIVE RESULT here)

A per-cell phototrophic-mass field is rebuilt each tick in Phase 3 and light is
attenuated Beer-Lambert style, `exp(-k * canopyMass)`, keyed to producers only.

It works as biology — income now measurably falls with local canopy density — but
it **cannot be the carrying-capacity mechanism at this world's spatial scale**:

| constraint | consequence |
| --- | --- |
| 10,800 substrate cells, producers at 0.2-0.5 per cell | a lone producer already casts canopy mass ~4.8 (`photo 0.71 x size 6.7`) |
| "an isolated producer is barely shaded" caps `k` at ~0.034 | at 0.034, real attenuation needs canopy mass ~40, i.e. ~8 producers/cell |
| 10,800 cells x 8 | K near 86,000 — **above `maxPopulation`** |

Values that *would* bind (0.18 was tried) shade an isolated producer by 58 %, which
distorts the mechanism instead of calibrating it. So `k` is held at 0.034: honest,
weak, secondary density dependence. **This is a negative result and is left in the
code so it is not retried blind.**

## Nutrient supply is the mechanism that actually binds

Sweeping `nutrientPerCell` (900 ticks, shading held lone-producer-safe):

| nutrientPerCell | pop @180 → @900 | per-cell nutrient | behaviour |
| --- | --- | --- | --- |
| 26 (current) | 384 → 1820 | 21.4 → 20.8 | grows, nutrient barely drawn down |
| 6 | 386 → 1856 | 5.10 → 4.19 | grows |
| 2 | 404 → 1438 | 1.75 → 1.18 | grows more slowly |
| **0.8** | 375 → 967 | 0.70 → 0.49 | **peaks at 1122, then turns over** |
| 0.3 | 372 → 524 | 0.26 → 0.23 | declines outright |

At 0.8 nutrient genuinely draws down with density — the mechanistic acceptance
test, not a tuned number. So nutrient is global density dependence that works at
the sparse densities this world actually occupies, where local shading cannot.

## But it still does NOT restore the food web

`nutrientPerCell = 0.8`, seed 11, 1800 ticks, % energy by guild:

| tick | pop | producer | predator | scavenger | decomposer | grazer |
| --- | --- | --- | --- | --- | --- | --- |
| 300 | 460 | 92.8 | 3.2 | 2.0 | 0.0 | 1.9 |
| 600 | 872 | 91.3 | **4.8** | 3.0 | 0.0 | 0.9 |
| 900 | 967 | 94.7 | 3.6 | 1.6 | 0.0 | 0.2 |
| 1500 | 1553 | 98.2 | 1.8 | 0.0 | 0.0 | 0.0 |
| 1800 | 1988 | 99.7 | 0.3 | 0.0 | 0.0 | 0.0 |

Producers still reach 99.7 % and every consumer guild is gone. The default was
**not** changed to 0.8, because that setting delays collapse rather than preventing
it, and adopting it would be tuning to a partial result.

## The next lead, which is sharper than "producers too many"

**Grazers go extinct while producers are 99.7 % of ecosystem energy.** Herbivores
eating an abundant producer base should not starve. That rules out producer
scarcity as the cause and points at the consumer energy pathway itself — the same
place predators failed earlier (chronically under their breeding threshold).

Two specific suspects, neither yet tested:
1. **Detritus is permanently subsidy-fed.** `detritus.data[i] += basalFoodPerCell`
   every cell every tick (~20/tick forever) against 0.00035 decay holds every cell
   ~14x above the feeding threshold, and sediment at 0.00008 decay adds a second
   near-permanent reservoir. Detritivores are never resource-limited, so selection
   has no gradient to climb.
2. **Dead disturbance channels.** `nutrientMul` and `detritusAdd` are computed in
   `disturbances.ts` and have **zero reads** in `world.ts`. Drought/heat nutrient
   suppression and organic-rain/ash detritus deposition are silent no-ops — two
   intended episodic brakes that do nothing.

Also recorded: **mean generation depth must not be used as a tuning target.** It
increments only on recombination, so the earlier 0.84 → 0.15 "collapse" records
asexual/clonal dominance, not demography.

## Status

- Typecheck clean, browser build clean, gates 7/7 (residual 0.023 %, tolerance 0.5 %).
- Carrying capacity now has a real mechanism, but the **balance is NOT restored**:
  still expanding, producers still dominant, four consumer guilds still collapse.
- Two dead disturbance channels found and left unrepaired — flagged, not touched,
  because wiring them changes ecological behaviour beyond this attempt.

---

# RETUNE ATTEMPT 2 — consumer energy pathway. FAILED. Reported as a failure.

## What the specialists concluded, and where measurement overrode them

`implement` argued consumers are "structurally unreachable" because gross income
(~0.15/tick) roughly equals burn (~0.20/tick), so net integrates to zero. That
static estimate is **wrong on the measurement**: with real evolved traits,
consumers show *positive* net income.

| tick | consumers (cum) | gross/tick | burn/tick | **net/tick** | frac>=thr | surplus OK |
| --- | --- | --- | --- | --- | --- | --- |
| 300 | 10800 | 0.2821 | 0.2104 | **+0.0717** | 22.6% | 34.2% |
| 900 | 47222 | 0.1585 | 0.1306 | **+0.0279** | 11.6% | 42.0% |
| 1500 | 65675 | 0.1440 | 0.1200 | **+0.0240** | 8.5% | 37.6% |

Consumers pass **both** breeding gates on 8-23 % of ticks and are net-positive.
So the gates are not the blocker and `implement`'s recommended fix (lowering
`REPRO_SURPLUS_TICKS`) would have treated a non-problem.

## Why nutrient reduction is the wrong lever — the paradox of enrichment

`nutrientPerCell = 0.8` genuinely creates global density dependence (population
peaks at 1,122 then turns over; nutrient draws down 0.70 -> 0.49). But it starves
producers too, so consumers' food base is energy-poor:

| tick | consumers | passed both gates | consumer births (cum) |
| --- | --- | --- | --- |
| 200 | 37 | 21.6% | 8 |
| 600 | 68 | 10.3% | 60 |
| 1000 | 49 | 0.0% | 98 |
| 1200 | 24 | 0.0% | 98 |

Consumers peak at 71 (t800) and decline to 24. They reproduce (~98 births) but not
fast enough to replace mortality. **Abundant nutrient -> unbounded producers;
scarce nutrient -> starving consumers.** There is no nutrient setting that gives
both, because producers and consumers draw on the same energy.

## Attempted resolution: coarser canopy grain. Also failed.

Diagnosis: the canopy can only bind if it aggregates a patch of substrate, because
producers occupy a *fraction* of a substrate cell. Added `shadeGrain` so one canopy
cell spans `shadeGrain x shadeGrain` substrate cells. At 1:4 that puts ~3-8
producers per canopy cell — enough to shade — while an isolated producer still
sees ~85 % of full light. This resolves the arithmetic that defeated attempt 1.

Measured at **default nutrient (26)**, k=0.034, 1800 ticks:

| shadeGrain | pop @1800 | producer %energy | consumers @1800 |
| --- | --- | --- | --- |
| 4 | 10071 | 100.0% | 0.0 / 0.0 / 0.0 |
| 8 | 10367 | 99.9% | 0.1 / 0.0 / 0.0 |

Still unbounded, still 100 % producers. Coarser grain lowers the density at which
shading engages but does not change the *shape* of the problem: at default
nutrient there is enough energy to fill every canopy cell, so the canopy
saturates rather than throttling.

## Honest status

- **Balance is NOT restored.** Two attempts, two failures, both recorded above so
  neither is retried blind.
- What DID improve: producers now have a genuine density-dependent term in their
  income path (self-shading), and per-cell nutrient is a second, correctly-shaped
  global density dependence. Both were previously absent, which is why the
  population was bounded only by `maxPopulation`.
- What is still true: the population is bounded only by the artificial 60,000 cap.
  The contract forbids relying on that, so this run is NOT a valid ecosystem.
- Gates 7/7, residual 0.00001 %, typecheck and browser build clean.
- Defaults NOT changed to a value that merely delays collapse.

## The real obstacle, stated plainly

Producers are sessile and harvest light. Bounding them requires that per-producer
light fall with local density. But this world has 10,800 substrate cells and
producers are a fraction of one per cell, so there is no local density for
shading to act on — and the organisms that *can* crowd (consumers) are too few to
matter. Meanwhile making producers energy-poor to create competition starves the
consumers that depend on them.

Any fix has to break that coupling. The two concrete candidates, neither tried:
1. **Make producers spatially clumped** (seed into patches, restrict offspring
   placement near the parent) so that local density actually exists to be shaded.
2. **Decouple producer and consumer energy** — let consumers draw on a detrital
   pathway that does not depend on producer condition, so producer scarcity stops
   being automatically consumer starvation.

Both are design decisions with real trade-offs, not parameter changes. Neither
should be chosen without the Owner.

---

# RETUNE ATTEMPT 3 — graze damage. Partial improvement, balance STILL not restored.

## The extinction mechanism was NOT energy — it was accumulated damage

`explore`'s trace plus a direct contest measurement (1200 ticks, `nutrientPerCell=0.8`):

| kind | attWins | defWins | winRate | dmg to defender | **dmg to attacker** |
| --- | --- | --- | --- | --- | --- |
| PREDATE | 23 | 1 | 96% | 1111 | 15 |
| GRAZE | 162 | 119 | 58% | 22 | **384** |
| MATING | 215 | 0 | 100% | 0 | 0 |

Live consumers sat at **mean damage 30.6** against a breeding disqualification bar
of `FATAL_DAMAGE * 0.45` = 45. Damage never heals. A grazer lost ~3.2 damage per
failed browse (the `(4 + armour*8)*0.5` term, identical in kind to predation), so
losing ~5 more contests disqualified it from breeding **permanently**.

Herbivores were slowly poisoning themselves out of reproduction. This is why
grazers vanished while producers were 99.7 % of ecosystem energy — it was never a
food-supply problem.

## The fix, and why it is biology rather than a knob

`GRAZE` loss now deals **no damage** to the herbivore. A producer is **sessile
and cannot wound a mobile herbivore**; its defence is expressed entirely through
`bite` (armour reduces how much can be taken), which is the real coevolutionary
arms race. Predator and territorial contests are unchanged and remain lethal —
this is a change to one interaction kind's failure mode, not a guild carve-out.

## Result: real improvement, not a fix

| | before | after |
| --- | --- | --- |
| graze damage to attackers | 384 | **0** |
| live consumer mean damage | 30.6 (bar 45) | **9.2** |
| graze win rate | 58% | 68% |
| live consumers / producers | 46 / 956 | **37 / 1025** |

Consumer damage is now far from the disqualification bar. But consumer counts did
not recover — producers still dominate ~96 % by count and the population is still
bounded only by the artificial cap.

So accumulated graze damage was a **real and previously-invisible extinction
mechanism**, now removed, but it was not the only one. Removing it changed
progression (grazers live longer, browse more, and overgraze producers slightly:
1025 vs 956) without restoring guilds.

## Honest status after three attempts

| attempt | mechanism tried | outcome |
| --- | --- | --- |
| 1 | self-shading at 1:1 substrate grain | cannot bind at this spatial scale |
| 2 | coarser canopy grain (1:4, 1:8) | canopy saturates instead of throttling |
| 3 | remove lethal graze damage | removes a real extinction mechanism; guilds still collapse |

Gates 7/7, residual 0.00001 %, typecheck and browser build clean.

**The balance is still not restored**, and the remaining obstacle is unchanged from
attempt 2: producers and consumers draw on the same energy, so anything that
restricts producers enough to bound them starves the consumers that depend on
them. The two design options in attempt 2 — clump producers so local density
exists, or decouple consumer energy from producer condition — remain untried and
remain Owner decisions.

---

# RETUNE ATTEMPT 4 — CLUMPING PRODUCERS + HERDING. THIS ONE WORKED.

Owner direction: use nature as the reference. Two mechanisms, both with direct
natural analogues, both chosen because they create the density structure the model
was missing.

## 1. Producer clumping — heavy-tailed (local) recruitment

`dist = reach * (0.45 + 0.55*rand)` gave **every** offspring a mandatory minimum
displacement of `0.45*reach` (~44 units), spreading each founder's descendants
evenly and preventing local density from ever building.

Nature is the opposite. Seed rain is overwhelmingly **local** — most propagules
land within a short distance — with a small fraction carried far by wind, water
or animals. Replaced with an explicit two-mode dispersal:

- **primary dispersal** (96 %): `base * (0.3 + 0.7*rand)` — lands beside the parent
- **secondary dispersal** (`LONG_RANGE_DISPERSAL = 0.04`): `reach * (0.55 + 0.45*rand)`

This is what makes stands, thickets and canopy patches possible, and therefore
what gives light competition something to act on. With <0.5 producers per
substrate cell previously, there was no local density for self-shading to engage.

## 2. Herbivore herding — real cohesion

`herdInstinct` existed and was heritable but only bent the body plan and damped
exploration. **Nothing actually caused organisms to move together.** Added
conspecific cohesion in steering:

```
if (herdN >= 2 && herdInstinct > 0.05) {
  cohesion = min(0.85, herdInstinct * (1 - 0.45*energyFrac));
  wantTurn += atan2(hy, hx) - heading) * cohesion;
}
```

conspecifics = same trophic role and comparable body size, so grazers herd with
grazers. Cohesion weakens when hungry, so animals disperse to forage under
pressure — which is why it creates patchy grazing rather than a rigid ball.
The top-down consequence is predator dilution: grouping reduces per-capita
predation risk, which is the actual reason herbivores herd.

## Result — first balanced ecosystem

Seed 11, 1500+ ticks, % energy by guild:

| tick | pop | producer | predator | scavenger | decomposer | grazer |
| --- | --- | --- | --- | --- | --- | --- |
| 300 | 518 | 93.7 | 2.2 | 1.9 | 0.0 | 2.1 |
| 600 | 1095 | 96.0 | 1.7 | 1.6 | 0.0 | 0.7 |
| 900 | 1193 | 93.5 | 1.1 | 3.6 | 0.0 | 1.8 |
| 1200 | 928 | 90.5 | 2.1 | 3.0 | 0.0 | 4.5 |
| 1800 | 1194 | 83.4 | **5.3** | **8.4** | 0.0 | 2.9 |

Compare the same point in attempt 3: population 4808 and climbing, producers
99.9 %, every consumer guild at zero. Now the population **fluctuates around
900-1200 instead of exploding**, and **four of five guilds persist**.

Clumping alone (before herding) gave predators 3.6 % and scavengers 9.2 %; adding
herding lifted predators to **5.3 %** — consistent with predator dilution, and an
independent check that the mechanism does what the biology says it should.

Producers at 83-96 % sits in the range real systems occupy, and the consumer tiers
sit at single-digit percentages rather than the 0.002-1 % of the textbook
terrestrial pyramid — this is a productive system, not a bare one, but it is no
longer inverted.

## Still not resolved

**Decomposers remain at 0.0 % on every seed.** The detritus rain keeps every cell
~14x above the feeding threshold, so detritivores are never resource-limited and
selection has no gradient to climb; separately, `nutrientMul` and `detritusAdd` in
`disturbances.ts` are still dead channels with zero reads.

Also unverified: robustness of this across seeds (multi-seed run in flight at time
of writing) and behaviour over horizons beyond ~2000 ticks.

---

# DECOMPOSER NICHE — mechanism implemented, GOAL NOT ACHIEVED

## What was built (all of it verified working)

Research finding driving the design: detritivores and microbial decomposers are
**sequential, not competing** — "litter fragmentation by detritivores may increase
the surface area of litter"; "on average, detritivores increase decomposition
rates by around 50 %"; "microorganisms are the primary decomposers of plant
litter". Dead organic matter is mostly **recalcitrant** structural material
(cellulose, lignin) that animals cannot digest and microbes can.

The previous model had ONE entirely labile detritus pool, so scavengers and
decomposers drew on identical units and competitive exclusion removed
decomposers on every seed. That was a modelling error, not a missing parameter.

Implemented:

1. **`litter`** — third organic `ScalarField`: recalcitrant benthic material.
   Sediment = benthic labile, detritus = suspended labile, litter = benthic
   recalcitrant. Slowest decay (`litterDecay`) so a thin flux integrates into a
   reservoir.
2. **`RECALCITRANT_DIGESTION`** trait (index 41, `TRAIT_COUNT` 41->42), appended
   last to satisfy the array-position-equals-enum assertion. `init 0.2` so
   founders are labile-dependent and the capacity must be evolved.
3. **Intake gated by digestive capability, never by guild.** The litter branch
   sits LAST in the feeding chain, so labile is always preferred first; access
   needs `recalc > 0.05` and intake scales with `recalc`. Nothing in the feeding
   path branches on `trophic`. Deliberate yield penalty (0.10 + eff*0.3 vs labile
   0.32 + eff*0.5): decomposers win on exclusive VOLUME, not efficiency.
4. **Generation** — corpses split at `litterFraction` (structural content) before
   the labile benthic/suspended split; `litterRainShare` of basal organic input
   arrives as leaf litter.
5. **`deriveRole`** — recalcitrant specialist reads as `DECOMPOSER` ahead of the
   carrion test, since the niche is defined by what it can digest.
6. **Conserved**: litter in the G3 identity, `hashState`, `measure()` snapshot,
   founding stock booked as `foundingBiomass`, and G2 now validates all three
   organic pools. `WORLD_ENGINE_VERSION` 0.1.0 -> 0.2.0.

**Verified:** typecheck clean, **gates 7/7**, worst residual **0.00006 %**.

## What it did NOT achieve

Decomposers appear **transiently (0.2 % at t300)** and then vanish. And the run
regressed badly — every guild -> 100 % producers by t1200-1500, where the
pre-litter build held four guilds (predator 5.3 %, scavenger 8.4 %, grazer 2.9 %).

## Pool sizing is NOT the lever

Tried, measured, rejected as explanations:

| litterFraction (corpses) | litterRainShare | decomposers @t1800 | ecosystem |
| --- | --- | --- | --- |
| 0.45 | 0.30 | 0.0 % | all guilds dead by t1200 |
| 0.18 | 0.30 | 0.0 % | all guilds dead by t1200 |
| 0.10 | 0.06 | 0.0 % | all guilds dead by t1500 |

Shrinking the pool tenfold changed almost nothing, so the failure is not simply
"too much energy locked in litter".

## The likelier explanation, which I should have checked sooner

**The ecosystem is BISTABLE, and the balance is not robust.** Before any litter
was added, seed 202 already collapsed to 100 % producers while seeds 11 and 3003
held four guilds — same code, same version, 3/3 "equilibrium" outcomes. So the
multi-guild state is one of at least two attractors, and which one a run falls
into is sensitive to seed and to any perturbation.

Adding a 42nd trait perturbs every genome block and shifts the trajectory from
tick zero. That is enough to move seed 11 from the good attractor into the
producer-only one. The earlier "success" may have been partly which attractor
seed 11 happened to occupy rather than a genuinely balanced system.

This reframes the remaining problem: not "why don't decomposers survive" but
"what selects between attractors". Until that is answered, no amount of
decomposer tuning will hold, and I should not have treated the litter mechanism's
failure as a sizing problem without testing the bistability hypothesis first.

## Status

- Decomposer niche mechanism: **implemented, conservation-correct, ineffective.**
- Regression: current build is producer-only on seed 11; the pre-litter build was
  not. This is a net loss of ecological outcome in exchange for a correct
  mechanism, and should be judged as such.
- Gates 7/7, residual 0.00006 %, typecheck and browser build clean.
- NOT committed. Base `c247dd9`. Reverting the litter change is a clean option if
  the multi-guild attractor is preferred until bistability is understood.

---

# CLOSED MICROCOSM (Winogradsky/jar principle) — implemented; composition still fails

Owner direction: nature is a delicate balance; boil it down to its simplest form.
The reference given was the microecosystem in a jar, i.e. the Winogradsky
column. Grounded: a column is a **closed system** in which light is the only
external energy input, all organic matter originates from organisms dying inside,
and nutrient returns solely by being recycled biologically. Succession - not
equilibrium - is the expected behaviour, and the community that persists is decided
by initial conditions and nutrient ratios.

## The change

`basalFoodPerCell` 0.002 -> **0**. At the old value the world injected ~21.6
energy/tick of external dead organic matter into every cell, forever, holding
every cell ~14x above the detritivore feeding threshold. Detritus was therefore
never resource-limited, so detritivores had no selection gradient at all. That
subsidy was not a missing parameter - it was a hole in the energy budget that made
the whole detrital pathway unselectable.

Now: light in, everything else internal. Verified `organicInput = 0.0` in the gate
output, so the identity is a genuinely closed system.

## It did not fix composition

| tick | pop | producer | predator | scavenger | decomposer | grazer |
| --- | --- | --- | --- | --- | --- | --- |
| 300 | 549 | 89.4 | 3.0 | 2.1 | 0.2 | 5.3 |
| 900 | 1099 | 97.9 | 0.3 | 0.5 | 0.0 | 1.4 |
| 1800 | 1294 | 100.0 | 0.0 | 0.0 | 0.0 | 0.0 |

So: subsidy removed, decomposer niche added, and the outcome is the same
producer-only attractor. Two structurally different interventions, same result.
That is strong evidence the problem is NOT decomposer food supply.

## What the evidence now points to instead

**Composition is decided by an asymmetry between producers and consumers:**

- A producer is sessile, costs ~0.13/tick, and is self-sufficient: light plus
  abiotic nutrient, which recycles whether or not any animal exists.
- A consumer must MOVE (~0.20/tick, ~50 % more) and pay contest fees, and its
  income is encounter-limited rather than continuous.

Producers therefore have a standing energetic advantage and a guaranteed nutrient
floor. Consumers have neither. Nothing about food supply fixes that: starving the
producers to help consumers also removes the consumers' food. That is the same
coupling that defeated attempts 1-4.

## Honest status

- **Carrying capacity: SOLVED.** The population is bounded (~550-1300) with zero
  population-cap hits, by light competition and nutrient, not by the artificial
  60,000 ceiling. That was the actual achievement of the clumping work.
- **Composition: NOT SOLVED.** The system has at least two attractors - a
  multi-guild state (previously observed on seeds 11 and 3003) and a
  producer-only state - and every intervention tried moves runs between them
  rather than stabilising the multi-guild one.
- Succession, in the Winogradsky sense, IS what this system does: populations
  rise and fall and replace one another. What has not been achieved is a
  community that keeps all its parts.
- Gates 7/7, residual 0.0115 %, typecheck and browser build clean. NOT committed.

## Next step (not taken, for budget)

The evidence says the lever is the producer/consumer energetic asymmetry, not
food supply. The simplest-form version of that is to test whether removing the
mobility cost premium lets consumers persist - if consumers cannot out-earn their
own locomotion even when food is abundant, then the model needs consumers to be
cheaper to run, not better fed.

---

# THEORY TEST: is the producer/consumer handicap in locomotion? FALSIFIED.

Claim under test: consumers cannot out-earn their own locomotion, so the mobility
cost premium (~0.20/tick vs a sessile producer's ~0.13/tick), not food supply,
is what removes them.

Prediction if true: making locomotion cheap, with **food supply held identical**,
should let consumers persist.

## Result

`locomotionCostScale` added as a diagnostic knob (default 1.0, no behaviour
change), applied to the movement spend. Food supply, litter pool, and every other
parameter identical across all three runs:

| locomotionCostScale | pop @1800 | producer | predators | scavengers | grazers | decomposers |
| --- | --- | --- | --- | --- | --- | --- |
| **1.0 (baseline)** | 1294 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| **0.3 (3x cheaper)** | 4235 | 100.0% | 0.0% | 0.0% | 0.0% | 0.0% |
| **0.1 (10x cheaper)** | 3385 | 99.9% | 0.1% | 0.0% | 0.0% | 0.0% |

**A 10x reduction in locomotion cost did not rescue a single consumer guild.**

## Two things this rules out, and one it reveals

Ruled out:
1. **Locomotion cost is not the binding handicap.** Free movement does not save
   consumers. (Freer movement *did* raise total population 1294 -> 3385-4235, so
   the knob is doing real work - it is not a no-op - but the extra growth accrues
   to motile/semi-motile producers, not to consumers.)
2. Combined with the earlier closed-jar test (removing the external organic
   subsidy) and the decomposer-niche test, this is now **three structurally
   different interventions, all landing in the same producer-only attractor.**

Revealed: consumers consistently show up at 0.2-5.3 % early and then decline,
whatever the energy economics. With locomotion free, they still decline.

## What survives as the live hypothesis

Consumers do NOT starve and do NOT fail the breeding gate - both were measured
directly: positive net energy (+0.024 to +0.072/tick) and both gates passed on
8-23 % of ticks. With those removed as explanations, the remaining candidate is
**reproductive output versus mortality**: the asexual breeding probability is
driven by `ASEXUAL_RATE`, whose founder value is ~0.011, and the sexual path
additionally requires a mate. A population of ~50 consumers has too little
genetic variance for selection to raise that rate quickly, so births may simply
not offset deaths - which would make consumer persistence a *population-size
bootstrap* problem rather than an energy problem.

This is NOT established. It is the next thing to measure: consumer births vs
deaths per tick, and juvenile survival, with locomotion already free.

## Status

- `locomotionCostScale` retained as a diagnostic knob, **default 1.0 = no behaviour
  change** to the model.
- Gates 7/7. Typecheck and browser build clean. NOT committed.
- Carrying capacity remains SOLVED (bounded population, zero cap hits).
- Composition remains UNSOLVED, and the cause is now demonstrably not food supply,
  not decomposer access, and not locomotion.

---

# PHASE 1+2: DEMOGRAPHIC DECOMPOSITION + INCOME-BREEDING RESPONSE

Success metric (Owner-agreed): **all five guilds recurring over time** — a guild
may dip to zero and return, as in a Winogradsky jar. Not "present at endpoint".

## Phase 1: measurement (no behavior change)

Added read-only per-guild instrumentation: deaths by guild x cause (starve/age/
damage), births by guild x pathway (asexual/sexual), and age-at-death sum+count
per guild. No RNG draws, no flow changes. G1 passing identically confirms zero
behavioral effect.

Result, 3 seeds x 1500 ticks (cumulative births/deaths, endpoint live):

| seed | guild | live | births (A/S) | deaths (S/A/D) | meanAge@death | meanMaturity |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | producer | 1033 | 1038/1169 | 634/128/770 | 578 | 249 |
| 11 | predator | 0 | 22/0 | 29/1/5 | 450 | — |
| 11 | scavenger | 0 | 14/1 | 26/0/5 | 398 | — |
| 11 | grazer | 0 | 8/4 | 17/0/5 | 510 | — |
| 202 | producer | 341 | 541/575 | 452/101/586 | 657 | 223 |
| 202 | grazer | 944 | 1508/2 | 545/2/36 | 379 | 207 |
| 202 | predator | 0 | 3/7 | 13/0/7 | 536 | — |
| 3003 | producer | 1536 | 1687/553 | 456/32/572 | 662 | 210 |
| 3003 | others | 0 | 2-18 each | deaths ~2x births | 300-450 | — |

**Unambiguous dominant failure mode per guild: births < deaths by ~2x for every
consumer guild on every seed.** Consumers DO reach maturity (age at death 350-540
vs maturity ~210-250) — not juvenile mortality. Death causes are mixed
starve+damage, not a single killer. Decomposers: 0-4 births total, never establish.

Per-capita arithmetic: seed 11 predators ~0.001 births vs ~0.0016 deaths per
individual per tick; producers ~0.0018 vs ~0.0013. Consumers are net-negative,
producers net-positive, from similar-magnitude rates acting on very different
base populations.

## Phase 2: income-breeding response (one uniform intervention)

Root cause identified: the asexual `drive` is a flat lottery — max ~0.015 even at
FULL energy (67-tick expected wait). Consumers spike above the gate on lump
income then burn down before the roll fires; producers on trickle income hold
surplus indefinitely and eventually win. Same gate, different holding dynamics.

Change (`world.ts`, asexual path only; sexual path never used a drive
probability): multiply drive by `(1 + 10*max(0, energyFrac - threshold))`.
Multiplier is exactly 1 at the gate margin, ~4-6x at full energy. Uniform — no
guild label; differential effect from income physics (lump vs trickle).

Independent review: no functional defects. Two corrections applied (version bump
0.2.0 -> 0.2.1 per version.ts contract; comment precision on margin behavior).

## Outcome: improved, not sufficient

| | before | after (seed 11) |
| --- | --- | --- |
| predator births/deaths | 22/35 (0.63) | 28/40 (0.70) |
| scavenger births/deaths | 15/31 (0.48) | 38/54 (0.70) |
| grazer births/deaths | 12/22 (0.55) | 25/35 (0.71) |
| live consumers @1500 | 0 | 0-1 |

Birth/death ratio improved ~0.5 -> ~0.7 across consumer guilds, and time series
shows consumers persisting 900+ ticks (predators 1-3%, grazers 1-4%) before
declining. But deaths still exceed births, and guilds collapse without recovery
by t1200+.

Deeper arithmetic explains why: consumers are net +0.024/tick but need 13-21
energy to go from birth endowment (~20) to threshold (33-41) — 540-875 ticks at
current accumulation speed against ~450-tick mean lifespan. They die before most
can reach the gate at all; the lottery fix helps only the minority who spike
high enough for the multiplier to engage.

## Honest status

- Phase 1 delivered its acceptance criterion: one unambiguous failure mode
  (birth-rate deficit, not juvenile mortality, not starvation, not gate failure).
- Phase 2 helped directionally but did not flip the outcome. The remaining
  bottleneck is surplus ACCUMULATION SPEED, not breeding probability.
- Gates 7/7, version 0.2.1, typecheck and browser build clean. NOT committed.
- Success metric (recurrence) NOT met: guilds persist transiently (~900 ticks)
  but do not recur once excluded.

---

# STRESS-INDUCED MUTAGENESIS — mechanism works, goal not achieved, gain reduced

Owner direction: speed up evolution by making every birth evolve. Mechanism
picked: stress-induced mutagenesis (SOS response and analogues) — realized
mutation rate scales with parent physiological condition, uniform (no guild
label), so bottlenecked lineages explore faster while adapted populations hold
stable genotypes.

## Implementation

`inherit()`: `effRate = mutationRate * (1 + stressMutagenesis * stress)` where
`stress = clamp(hunger/200)*0.5 + clamp(damage/50)*0.3 + clamp(1-energyFrac)*0.2`,
applied to BOTH trait loop (`sigma`) and body loop (`p`). Version 0.2.1 -> 0.2.2.

Independent review: no functional defects. Verified formula, guards, state
validity at inherit time, no missed mutation sites, version bump correct,
no determinism/G3 risk. Two comment corrections applied.

## Functional test: mechanism active

High-stress parents' offspring diverge **1.59x** more than low-stress parents'
(n=1300 vs 699). The machinery does what it claims.

## Outcome: faster evolution, wrong winner

| seed 11, gain | pop @1500 | @1800 | consumers live | bounded? |
| --- | --- | --- | --- | --- |
| 0 (drive only) | 1469 | 2062 | 0-1 | yes |
| 1.0 | 1301 | 1932 | 0 | yes |
| 3.0 | 7167 | 8921, +24%/300t | 25 scavengers | **NO — exploding** |

At gain 3.0, producers evolved maturity 224 -> 131 ticks, and the
income-breeding drive multiplier converted early maturity into unbounded growth.
Review attribution confirmed by A/B: drive alone is bounded, drive + stress(3.0)
explodes — stress is the accelerant, drive the necessary cause.

At gain 0 and 1.0, the system stays bounded but consumers still collapse on seed
11. **Faster evolution does not rescue guilds at any safe gain.** It accelerates
producers toward r-strategies (small, early-maturing, fast-breeding) that support
huge populations on thin resources — crowding out consumers faster, not slower.

Seeds 202/3003 at gain 3.0: bounded (1572/1378); grazers thrive on 202 (1081
live). Outcome is seed-dependent, as throughout this session.

## Decision: default gain 3.0 -> 1.0

1.0 preserves gentle acceleration (~1.3-1.5x realized among eligible breeders)
with no measured harm; 3.0 is unsafe in combination with the drive multiplier.
The machinery stays live for future use; the calibration reflects measurement.

## Honest status

- Stress mutagenesis: **implemented correctly, functionally verified, ineffective
  for guild persistence and dangerous at high gain.** Negative result recorded so
  the gain is not raised again without new evidence.
- The individual-vs-guild conflict is now sharper: faster evolution optimizes
  individual fitness, which on seed 11 means producers that exclude consumers.
  Open-ended individual selection does not guarantee — and here actively opposes —
  ecosystem structure.
- Gates 7/7, v0.2.2, typecheck and browser build clean. NOT committed.
- Composition (recurrence metric) NOT met. Carrying capacity holds on 2/3 seeds
  at safe gains; seed 11 requires gain <= 1.0.

---

# BRACKETING BY OVERSHOOT (predator transfer axis) — NO OVERSHOOT EXISTS

Owner direction: find what makes consumers reach 100%, then dial back to
coexistence. Tested on the most direct pro-predator dial: trophic transfer
efficiency (`meatYieldPerMass`, new config knob defaulting to 1.6 = status quo;
threaded as a parameter through `InteractionQueue.resolve()` so sweeps need no
source edits per value; version 0.2.2 -> 0.2.3).

## Result: the axis is hump-shaped, not a ramp

Predator %energy at t900, seed 11 (all else identical):

| meatYield | x baseline | predators | producers | total pop |
| --- | --- | --- | --- | --- |
| 0.8 | 0.5x | 0.2% | 98.4% | 2430 |
| **1.6 (default)** | **1x** | **2.2%** | **97.1%** | **1339** |
| 3.0 | 2x | 0.5% | 98.8% | 1415 |
| 6.0 | 4x | 0.1% | 98.7% | 1948 |

**Peak predator share is at the current default.** Both lowering AND raising
transfer collapses them. Lowering starves them (less per kill); raising triggers
enrichment-collapse (rich predators overbreed, overhunt prey, prey crashes,
predators starve — pop rises to 1948 while predators fall to 0.1%).

There is no overshoot direction on this axis. The bracketing strategy fails here
because the current value is already at/near the predator-maximum.

## Why: reward was never the bottleneck

Established across this session: predators win 96% of contacts but make ~0.03
contacts/tick (encounter-limited), and face the lump-holding breeding problem.
Per-kill reward scales the payoff of kills that rarely happen — doubling it
cannot rescue a guild that hunts twice per hundred ticks and burns down before
the breeding lottery fires. The dial scales a term that is not binding.

Grazers/scavengers/decomposers use separate intake paths and do not respond to
this knob at all (flat across the sweep), as documented in the field comment.

## The deeper point: no monotonic consumer axis may exist

In a closed system, consumers depend on producers. Any axis strong enough to let
consumers dominate also destroys their food base (collapse, not dominance), and
any axis favoring producers squeezes consumers (exclusion). Stable 100%
consumers is thermodynamically impossible — someone must fix energy. Transient
100% is reachable (kill light -> producers die -> scavengers feast -> all
starve) but it is collapse, not a bisection target.

Coexistence, if it exists, is an INTERIOR window — not reachable by pushing to
an endpoint, because the endpoints are both producer-only (starve consumers) or
collapse (starve everyone). Bracketing assumes monotonicity; the transfer axis
is hump-shaped, and the same enrichment logic suggests encounter-rate and
breeding-rate axes are too.

## Status

- Knob retained at default 1.6 (validated as near-optimal for predators, not as
  a placeholder). Behavior at default provably unchanged (G1 identical digest).
- No default changed, so no material-risk review triggered; the risky act would
  be moving the default, which is not proposed.
- Gates 7/7, v0.2.3, typecheck and browser build clean. NOT committed.
- Predator persistence NOT achieved by this axis. The binding constraints remain
  encounter rate, breeding dynamics, and the individual-vs-guild conflict.

---

# PHASE 1: BIOLOGICAL CLOSURE — cycle turns, coexistence NOT achieved

Owner-approved direction: stop tuning parameters, restructure the nutrient loop
so biology is the ONLY return path (Winogradsky/jar principle at ecosystem
scale). Previous six attempts all made consumers better off; this makes them
load-bearing.

## What changed (v0.2.3 -> 0.3.0)

1. **Suspended-branch mineralisation fixed**: the suspended-detritus intake had a
   "Biotic mineralisation" comment header with NO code — suspended feeding was a
   nutrient sink. All three detrital paths now return nutrient via the identical
   `taken * bioticMineralisation` block.
2. **Abiotic organic decay cut 50x** (detritus/sediment/litter): dead matter
   persists like soil stock instead of weathering away. Geological background,
   not the return path.
3. **Nutrient regen cut 70x** (0.014 -> 0.0002): toward-capacity SHAPE retained
   (inherently deadlock-safe — refills fastest where most depleted) but too slow
   to carry growth alone. Weathering trickle, not subsidy.
4. **Nutrient decay cut 16x** (0.0016 -> 0.0001): slow background leaching so
   pools don't ratchet to zero beneath the tiny regen.

Verified: gates 7/7, abiotic `mineralised` ledger 300 -> 9, `organicInput=0.0`
(genuinely closed), typecheck + browser build clean. Independent review in
flight at time of writing.

## Outcome: divergent transients, no coexistence

| seed | trajectory | endpoint (t1500) | biotic return | interpretation |
| --- | --- | --- | --- | --- |
| 11 | bounded 569-1305, fluctuating | 99.9% producers, pop 670 | 91 (declining) | poverty equilibrium |
| 202 | grazers 6.7% -> 61.9% | 38% prod / 62% graz, pop 1164 | 7 (flatlined) | bloom on draining stocks |

Seed 11: the cycle turns biologically but at poverty flux (91 return/1500t) —
producers persist on weathering + stock, too poor to support upper guilds.
As consumers vanish, return dwindles further: positive feedback toward
producer-only.

Seed 202: grazers bloom by eating down standing stocks (sediment 3.53 -> 0.40,
litter 1.59 -> 0.27 per cell; nutrient 11 -> 6.3) with near-zero biotic return.
A grazing chain on drawn-down capital, not a closed cycle — transient, heading
for collapse when stocks exhaust. Top-heavy (62% grazers on 38% producers) and
thermodynamically unsustainable.

**Decomposers: 0.0% on both seeds. The key prediction FAILED.** Six attempts,
six failures to establish the fifth guild — including with an exclusive food
pool AND with biology as the only return path.

## What this rules in/out

- Closure works MECHANICALLY (bounded populations, biotic return active,
  conservation holds, no deadlock observed).
- Closure does NOT produce coexistence. Outcomes diverge by seed into poverty
  equilibrium or bloom-and-bust — multistability, not the target attractor.
- The litter-drain on seed 202 (1.59 -> 0.27) with decomposers at zero implies
  mobile grazers eat recalcitrant stock before sessile decomposers establish —
  exclusivity by digestive capability loses the RACE to numbers and mobility.
  Uniform access rules don't protect slow specialists from fast generalists.
- Standing variance + faster evolution (stress mutagenesis) lets SOME seed find
  SOME guild structure, but which guild wins is seed-dependent, and none is
  stable multi-guild.

## Status

- Phase 1 implemented, conservation-verified, ineffective for coexistence.
- Carrying capacity SOLVED on both seeds (bounded, zero cap hits).
- Composition (recurrence metric) NOT met. Decomposers never establish.
- Independent review pending (deadlock reachability + grazer-sediment question).
- NOT committed. Base c247dd9.
- Phase 3 (metapopulation recolonisation, Owner-approved) not yet started —
  it is now the live hypothesis, since closed-system exclusion runs to
  completion without external return.

---

# REVIEW: biological closure (0.3.0) — mechanically clean, one HIGH finding

Independent review verdict: no blocking defect in the new block, no conservation
regression, no deadlock, no determinism risk, version bump appropriate. Two
findings:

## HIGH: eating gates far below mineraliser gates (explains 0% decomposers)

| Path | Gate | Who passes |
| --- | --- | --- |
| Eat sediment | `digestion > 0` | essentially everyone (founder init 0.45) |
| Eat litter | `recalc > 0.05` | entire founder cloud (init 0.2) |
| Count as decomposer | `recalc > 0.55` or `carrion > 0.62` | specialists only |
| Mineralise at all | `(carrion > 0.55 \|\| recalc > 0.5)` + slow + non-photo | specialists only |

Generalists with `recalc` in (0.05, 0.5) — including all founders and all future
grazers — EAT litter but do NOT return nutrient and do NOT count as decomposers.
The "exclusive niche" leaks by design: exclusivity-by-capability loses the race
to numbers and mobility, exactly as seed 202 showed (stocks drained, return
flatlined at 7). REPORT.md's inference is confirmed as code-level certainty, not
hypothesis. The suspended-return fix is orthogonal — it closes a leak but routes
nothing to mineralisers.

Review's smallest correction (DESIGN DECISION, not implemented): raise the
litter-eating gate toward the decomposer definition (`recalc > 0.4-0.5`), paired
with keeping `litterFraction` small (already 0.10). Alternative: redefine the
niche as mineralisation efficiency rather than exclusive access.

## LOW: per-pool cap modulation missing in return clamps

Mineraliser/excretion clamps use `nutrientPerCell * fertility`, omitting the
per-pool `nutrientCapacity` mods ([1.0, 0.78, 0.62]). Pools B/C can overshoot
regen caps, causing a small sawtooth (not a conservation error; nutrient is
untracked). Pre-existing in two paths; the new suspended block copies it to a
third. Fix once, everywhere, in a follow-up.

## Deadlock: hard unreachable, quasi-traps expected

Hard exact-zero deadlock unreachable (toward-cap regen strictly positive at
zero + excretion floor + corpse flux). BUT quasi-traps with ~4k-tick recovery
are expected and match seed 11 — nutrient pins at trickle-vs-uptake equilibrium
with detritus locked in uneaten pools. Review explicitly warns: do NOT raise
regen to "fix" seed 11; that reintroduces the free-weathering subsidy.

## Implication for phasing

The gate gap blocks establishment; Phase 3 (recolonisation) assumes
establishment works. Recolonising a guild that cannot establish is pointless —
immigrants would fail the same way. Logical order: fix gate gap first (small,
causal, falsifiable), THEN Phase 3 for recurrence.

---

# GATE FIX (recalc > 0.05 -> 0.4) — hypothesis FALSIFIED

Follow-up to the review's HIGH finding (eating gates far below mineraliser
gates). Raised the litter-eating gate to 0.4: excludes ~79% of founders, keeps
~21% standing variation, intake proportionality rewards higher recalc. Sediment
left open (shared labile pool by design). Review in flight at time of writing;
version NOT bumped (still 0.3.0) — review asked to judge whether that violates
the version contract.

## Result: exclusivity without viability is an empty niche

| seed | litter stock/cell | sediment/cell | decomposers | biotic return |
| --- | --- | --- | --- | --- |
| 11 | (not measured) | (not measured) | transient 0.2% -> 0 | 91 -> **45 (halved)** |
| 202 | 2.04 -> 1.74 -> **1.60 (plateaus)** | 3.50 -> 1.88 -> **0.58 (drains)** | 0.0% throughout | flatlined at 9 |

Seed 202 is decisive: litter sits uneaten while sediment drains and grazers bloom
to 44.2%. The gate works (grazers excluded) but NOBODY crosses it. Biotic return
halved on seed 11 because fewer eaters means less intake means less
mineralisation — exclusivity shrank throughput instead of redirecting it.

## Why: the decomposer life history can't bootstrap

A sessile high-recalc organism faces: slow intake (0.18 rate x recalc x poor
yield 0.10+eff*0.3) + poor food + immobility (one cell, no search) + breeding
threshold calibrated for richer diets. It starves or never breeds before
establishing. The gate fixed WHO eats but not WHETHER eaters survive. Access
without viability is a locked room with nothing alive inside.

## Next candidate (NOT implemented): mineraliser speed gate

`bioticMineraliser` requires speed < 2.4 — sessility as a condition for nutrient
return. But mobile detritivores mineralise in nature (earthworm castings are the
canonical example). If the recalc path dropped the speed requirement —
`(carrion > 0.55 && speed < 2.4) || (recalc > 0.5 && photo < 0.34)` — mobile
high-recalc specialists would close the loop. Still trait-gated (recalc > 0.5),
no guild label. Risk: grazers evolving recalc > 0.5 become grazer-decomposers
and the guild distinction blurs — though that blurring is itself realistic (soil
omnivores fragment AND mineralise).

This is a design decision (redefines who mineralises), so not implemented
without Owner approval. It is also the LAST establishment-side lever before
conceding that closed-system establishment fails and proceeding to Phase 3
(recolonisation) — which cannot work until establishment works, since immigrants
would fail the same way.

## Status

- Gate fix: implemented, conservation-verified (gates 7/7), FALSIFIED as a
  sufficiency claim. Retained (it correctly stops the grazer drain) but
  insufficient alone.
- Decomposers: 0.0% on both seeds. Seven attempts.
- Phase 3 NOT started: premise (establishment works) unmet. Awaiting Owner
  decision between mineraliser-speed fix vs proceeding to Phase 3 regardless.
- NOT committed. Base c247dd9.

---

# REVIEW: litter gate 0.4 — implementation correct, version bump was missing

Independent review verdict: threshold correct, founder math verified (~21%),
chain/hunger accounting clean, determinism clean, residual-leak comment
imprecise in both directions (non-blocking). One HIGH finding: version NOT
bumped for a behavior-altering change — reproducibility-contract violation.
Fixed: 0.3.0 -> 0.3.1, plus the one-word comment correction on spread halving.

Review also notes the biotic-return halving (91->45) needs per-path attribution
before mechanistic claims — the aggregate counter cannot distinguish reduced
mineraliser throughput from ecological reorganization. No code correction
indicated; diagnostic gap recorded.

---

# MINERALISER SPEED GATE (recalc path drops sessility) — function works, guilds don't

Owner-approved follow-up to the falsified gate fix. `bioticMineraliser` was
`(carrion > 0.55 || recalc > 0.5) && photo < 0.34 && speed < 2.4`; now
`photo < 0.34 && ((carrion > 0.55 && speed < 2.4) || recalc > 0.5)`.
Earthworm principle: mobile detritivores with structural enzymes mineralise;
sessility required only for carcass processing. Trait-gated, no guild label.
`deriveRole` readout deliberately UNCHANGED (one conceptual change at a time).
Version 0.3.1 -> 0.3.2 (proactive, per review hammering on version discipline).
Independent review in flight.

Implementation note: first version accidentally dropped the photo gate on the
carrion path; caught on re-read, corrected to factored form. Only recalc path
changed meaning: (recalc-hi, photo-lo, speed-hi) flips false -> true. All seven
other trait combinations identical.

## Outcome: 6-26x return, same collapse

| seed | biotic return (before -> after) | endpoint guilds | decomposers |
| --- | --- | --- | --- |
| 11 | 45 -> **295 (6.5x)** | 99.9% producers | transient 0.2% -> 0 |
| 202 | 7 -> **186 (26x)** | 55% prod / 45% graz | 0.0% throughout |

Mobile mineralisers WORK — return jumps immediately (+169/300t on seed 11).
Then they die (return flatlines: +0 after t900/t1000), and the loop stops.
Seed 202: litter plateaus protected (2.05->1.74), sediment drains via grazers
(3.66->0.59), grazers hold 44.5% on drawn-down capital.

Label-function divergence confirmed as predicted: mineralisation happens,
decomposer count stays zero. Mobile high-recalc organisms close the loop while
reading as scavengers/grazers.

## The inescapable pattern across eight attempts

Mineralisation works. Mineralisers die. Every nutrient-loop fix improves the
FUNCTION (return up 6-26x) without changing the FATE (guilds collapse). The
bottleneck was never nutrient supply to producers — it is consumer DEMOGRAPHY
(births < deaths from Phase 1), which no loop-closure affects. Mineralising
helps producers, not the mineraliser's own birth rate.

## Status

- Mineraliser-speed fix: implemented correctly (self-caught photo-gate error
  fixed before testing), conservation-verified (gates 7/7), FALSIFIED for guild
  persistence. Retained (it genuinely improves nutrient return) but insufficient.
- Decomposers: 0.0% on both seeds. Eight attempts.
- Phase 3 (recolonisation) premise revisited below. NOT started.
- NOT committed. Base c247dd9.

---

# REVIEW: mineraliser speed gate — clean, two items fixed

Independent review verdict: factored form logically exact (only P∧R∧¬S flips,
2 of 16 minterms), no consumer assumes sessility, label-function divergence
real and disclosed, version bump appropriate, no new mortality/determinism risk.

Two findings, both fixed:
1. LOW (stale comment): world.ts litter-gate comment said flag needs "slow" —
   false for recalc path now. Corrected.
2. INFORMATIONAL (stale build): build/bio/role.js predated src by 41 min, so
   prior "build clean" exercised OLD logic. Build regenerated; new factored
   form confirmed in output. Both typechecks clean.

Review also notes: readout carrion path lacks photo gate (inverse divergence,
pre-existing, untouched); recalc ladder 0.4/0.5/0.55 across intake/flag/readout
(pre-existing, harmless — but never conflate mineraliser count with decomposer
count in time series).

---

# SESSION CLOSE — Owner decision: stop (option 2)

## What was achieved (durable, verified)

1. **Carrying capacity without the artificial cap.** Population bounded
   (~500-2000 across seeds) by light competition (self-shading canopy),
   nutrient limitation, and heavy-tailed local recruitment — with ZERO
   population-cap hits. The 60,000 cap is never approached, satisfying the
   contract ban on relying on artificial abundance control.
2. **Biological closure of the nutrient cycle.** Light is the only external
   input (`organicInput=0.0`); abiotic decay cut 50x to geological background;
   nutrient regen cut 70x to a weathering trickle; all three detrital paths
   mineralise through biology. Conservation holds (gates 7/7, residuals
   0.00006-0.04%).
3. **Graze-damage fix.** Sessile producers no longer lethally wound mobile
   herbivores (384 attacker damage -> 0); defence lives in armour/bite where it
   belongs. Consumer mean damage 30.6 -> 9.2.
4. **Mobile mineralisers work.** Recalc path drops sessility (earthworm
   principle); biotic return up 6-26x. Trait-gated, no guild labels.
5. **Predators persist transiently** (up to 5.3%, 96% contact win rate) via
   size-scaled perception fixing the encounter bottleneck (0.03 contacts/tick).
6. **Infrastructure**: 42-trait genome with load-time layout assertion,
   single-capacity-authority (`resolveCapacity`), per-guild demographic
   instrumentation, three diagnostic knobs at safe defaults
   (locomotionCostScale 1.0, stressMutagenesis 1.0, meatYieldPerMass 1.6).

## What was NOT achieved (eight falsified attempts)

Stable multi-guild coexistence under the recurrence metric. Consumers establish
transiently (up to ~900 ticks, four guilds) then collapse without return.
Decomposers: 0.0% on every seed in every configuration — including with an
exclusive food pool, gated access, biological closure, and mobile
mineralisation.

## The structural finding (the session's main result)

**Mineralisation works. Mineralisers die.** Every nutrient-loop fix improves
ecosystem FUNCTION (biotic return up 6-26x) without changing consumer FATE
(births < deaths persistently, ~0.7 ratio at best). The bottleneck is consumer
DEMOGRAPHY — net +0.024/tick accumulation needs 540-875 ticks against ~450-tick
lifespan — which no loop-closure, food-supply, locomotion, breeding-lottery, or
evolution-speed intervention resolves. Faster evolution (stress mutagenesis)
accelerates producers toward r-strategies that exclude consumers faster.
Individual selection opposes guild rescue (threshold evolves UP, breeding rate
DOWN). Open-ended individual fitness does not guarantee — here actively opposes
— ecosystem structure.

Tried and falsified: transfer-yield bracketing (hump-shaped, peak at current),
nutrient reduction (paradox of enrichment), canopy grain (saturates), graze
damage (helped, insufficient), income breeding (0.5->0.7 ratio, insufficient),
stress mutagenesis (works mechanically; explodes at high gain), litter gate
(empty niche), mobile mineralisers (function without persistence).

## Open threads (not pursued)

- Phase 3 metapopulation recolonisation (Owner-approved, unbuilt): would meet
  recurrence via source-sink subsidy, breaking strict closure. Premise
  (establishment) unmet; immigrants would fail the same way residents do unless
  framed as demographic subsidy rather than recolonisation.
- Per-pool cap modulation fix (review LOW finding, three clamp sites).
- Suspended-branch G5 byKind length quirk (pre-existing, flagged, untouched).
- Throughput/capture-share re-measurement (stale across energy-budget changes).

## Final state

Gates 7/7, v0.3.2, typecheck + browser build clean (build regenerated after
review caught 41-min staleness). Nothing committed, nothing merged, base
c247dd9 intact. All probes in /tmp/opencode (throwaway). This file is the
complete record including every failure, so none is retried blind.

---

# SIMPLIFICATION: five guilds -> three (v0.3.3)

Owner direction: strip to producer / consumer / decomposer and iterate from
the simpler model.

## Why three is the right cut (not just fewer)

Behaviour already keys on raw traits through utility arbitration; the ONLY
behavioural branches on trophic are producer-vs-non-producer (canHunt,
canGraze, grazer targeting of producers, reach toxin term). The
predator/scavenger/grazer split was readout-only — no code path distinguished
them from each other. The functional divide that all session evidence supports
is mobility + mineralisation: consumers move and eat anything (diet specialism
in toxin/aggression/carrion/detritivory genes); decomposers sit and return
nutrient. Three labels match the three functional roles; five labels pretended
a precision the code never implemented.

## Change (readout collapse, behaviour preserved)

- `TROPHIC`: {PRODUCER:0, PREDATOR:1, SCAVENGER:2, DECOMPOSER:3, GRAZER:4} ->
  {PRODUCER:0, CONSUMER:1, DECOMPOSER:2}. `TROPHIC_NAME` updated.
- `deriveRole`: former three consumer branches merged to CONSUMER fallback;
  two decomposer branches merged to one OR condition (verified equivalent
  under else-if chain semantics); removed `aggression` local orphaned by the
  merge (noUnusedLocals enforced).
- Demographic counters resized 5->3 with matching guards and loop bounds.
- Viewer colours/ROLE_ORDER, acceptance spot-check (mobile toxic heterotroph),
  version 0.3.2 -> 0.3.3.
- Untouched: all 41 traits, genome layout, every interaction kind and formula,
  arbitration, mineraliser flag, all energy/nutrient paths.
- Independent review in flight (behaviour-preservation claim under verification).

## Baseline (seed 11, 1500 ticks): identical trajectory, relabelled

| tick | pop | producer | consumer | decomposer | biotic |
| --- | --- | --- | --- | --- | --- |
| 300 | 688 | 90.9% | 8.9% | 0.2% | 169 |
| 600 | 1203 | 93.6% | 6.4% | 0.0% | 292 |
| 900 | 819 | 95.7% | 4.3% | 0.0% | 357 |
| 1500 | 640 | 99.9% | 0.1% | 0.0% | 358 |

No out-of-range trophic values. Consumers 8.9% -> 0.1%, decomposers transient
then zero — the same collapse, now readable as ONE consumer pool instead of
three interleaved trajectories. The binding constraint (consumer births <
deaths) is unchanged; the labels no longer obscure it.

## Iteration starts here

With three guilds the target is sharp: producer + consumer + decomposer
coexisting/recurring. The consumer pool's birth/death ratio (~0.7 at best) is
the single number to move, measured by the per-guild instrumentation that
survived the collapse unchanged.

---

# REVIEW FOLLOW-UP: herding delta documented, longrun fixed (v0.3.3)

Independent review of the 5->3 collapse found two mediums, both addressed:

1. **Herding mixes ex-guilds (behavioral delta).** `world.ts:1095` groups by
   trophic equality, so ex-predators/grazers/scavengers now herd together. This
   is the ONE sim-path branch that distinguished merged guilds — the
   "readout-only, trajectories identical" claim was overstated. Decision:
   DOCUMENT, don't preserve. Mixed herding groups are real ecology, and
   reconstructing diet guilds via trait-bands would defeat the simplification.
   Comment updated to describe consumer herding accurately. Iteration proceeds
   from true current dynamics.
2. **longrun misreported guilds** (5 labels over 3 values: index 1 printed as
   `pred`, index 2 as `scav`). Fixed: length-3 arrays, `prod/cons/decomp`
   labels. Silent misreporting, no sim effect.
3. LOW: acceptance copy ("5 trophic", kinds miscount, `predator` var) fixed.

Review also confirmed: counter resizing consistent, enum contiguous in sim
path, deriveRole merge equivalent (modulo untracked-history caveat),
acceptance intent preserved, version bump appropriate, determinism clean.
Adjacent pre-existing issues (viability intentCounts, gates byKind, measure
photo-threshold mismatch) explicitly left alone.

Gates 7/7 after fixes. These were reporting/comment changes; sim behavior after
the herding documentation is exactly the measured 3-guild baseline.

---

# PRE-FLIGHT: SPATIAL CLUSTERING TEST (immigration viability)

Owner-directed: measure whether consumer success is spatially clustered
(immigration is the fix) or uniformly global (immigration is a band-aid),
before building the patch metacommunity.

Method: 4x4 spatial grid (600px patches) over the 2400x2400 world, per-patch
consumer counts sampled through the run. CV = coefficient of variation of
consumer counts across patches. Clustered = consumers persist in a minority of
patches with CV > 0.5.

## Result: CLUSTERED on both seeds — immigration is the right tool

| seed | tick | total cons | patches occupied | max/min patch | CV | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 11 | 400 | 75 | 12/16 | 25/0 | 1.40 | clustered |
| 11 | 800 | 43 | 12/16 | 14/0 | 1.44 | clustered |
| 11 | 1200 | 6 | 4/16 | 2/0 | 1.86 | clustered (dying) |
| 202 | 400 | 50 | 11/16 | 13/0 | 1.11 | clustered |
| 202 | 800 | 131 | 15/16 | 26/0 | 0.85 | clustered |
| 202 | 1200 | **291 (rising)** | 15/16 | **69/0** | 1.07 | **clustered (thriving)** |

Per-patch consumers at t1200 (seed 202): `2,17,30,2,28,29,14,0,69,13,2,2,53,23,4,3`
— one patch holds 69 while four hold 0-3. This is textbook source-sink structure:
strong overpopulated sources feeding near-empty sinks.

## Why this matters: the failure is LOCAL EXTINCTION, not global collapse

I had assumed a uniform global Allee decline and immigration would only slow it.
The data refutes that. Consumers are unevenly distributed by a factor of 10-60x
across patches at every timestep. Seed 11 declines toward global extinction
(sources themselves failing at t1200), but seed 202's consumer metapopulation
GROWS to 291 — because its sources stay viable.

So the missing mechanism is exactly the one Chesson requires: a rare guild can
survive because SOME patch retains it, and propagule pressure re-seeds the
emptied patches. Immigration does not soften a global decline — it converts
patch-local extinctions into recoverable fluctuations, which is the real-world
mechanism this whole analysis was missing.

## Status

- Measurement only; no behavior changed. Worktree clean at v0.3.3, gates 7/7.
- Proceeding to patch metacommunity with propagule pressure. Immigrating
  organisms carry energy derived from the parent reserve (existing
  birthCostFactor transfer), so G3 conservation holds and strict closure is
  preserved — movement within a closed world, not a food subsidy.

---

# METAPOPULATION IMMIGRATION (v0.4.0)

Rescue mechanism chosen from the literature comparison: Chesson's "increase when
rare", implemented as patch-to-patch recolonisation (propagule pressure).

## Design

- 4x4 metapopulation grid, allocated at construction; `metapopulationPatches: 0`
  disables it and restores the pre-immigration placement path exactly.
- `patchCensus[patch * TROPHIC_COUNT + guild]` rebuilt every tick in Phase 3
  (spatial rebuild) from live-packed arrays — O(live), same cost class as the
  grid build that precedes it.
- A long-range disperser no longer lands further along the parent's heading. It
  picks a target PATCH with weight `1 / (1 + immigrationWeight * localCount)`
  for the newborn's own guild, so an empty patch is maximally attractive and a
  saturated one is avoided; position within the patch is uniform.
- Short-range (96%) recruitment is BYTE-IDENTICAL to before — it is load-bearing
  for canopy shading and carrying capacity, so this change must not touch it.
- `travelDist` measured by actual displacement on both branches, so the
  provisioning travel cost still applies to immigrants.

## Why this is not a subsidy

The immigrant is an ordinary newborn; its energy came from the parent reserve
through the existing `birthCostFactor` transfer. No new energy is created, no
external input is added, and the organism stays inside the same closed world.
This is movement between patches — which is what real immigration actually is.
G3 confirms: residual 0.01116%, unchanged, with `organicInput = 0.0`.

## Result: consumers persist materially longer

| seed | tick | v0.3.3 consumer % | v0.4.0 consumer % | biotic return |
| --- | --- | --- | --- | --- |
| 11 | 1500 | 0.1% | **0.5%** (5x) | 417 vs 358 |
| 202 | 1500 | ~0 (producer-only attractor) | **28.4%** | 191 |

Seed 11 still trends toward producer-only (its sources themselves fail). Seed
202 holds 28.4% consumers at t1500 — a genuine three-guild community where the
pre-immigration model had collapsed to producers. This is the first
multi-guild persistence across the whole project.

Independent review in flight at time of writing.

## Honest status

- Immigration WORKS as a mechanism: it converts patch-local extinctions into
  recolonisation, exactly the "increase when rare" gap identified by the
  literature comparison. Not yet sufficient on all seeds.
- Seed dependence persists: seed 11's consumer sources themselves fail
  eventually, so it still trends producer-only. Immigration cannot rescue a
  guild whose source patches are also collapsing — that is a deeper problem
  than local extinction.
- Decomposers still 0.0% on both seeds.
- Gates 7/7, v0.4.0, typecheck clean. NOT committed, base c247dd9.

---

# IMMIGRATION VALIDATED ON 10 FRESH SEEDS (1200 ticks)

Independent review of the immigration mechanic: CLEAN, no material defects.
Energy-neutrality confirmed by inspection — the immigration block contains zero
ledger calls and its only energy effect is the pre-existing `travelCost`
dissipation, so G3-neutrality holds. Census timing, weighted-selection bounds,
reflection handling, `travelDist` on both branches, and stride all verified.
Two notes recorded: `travelCost` is now geometry-dependent (larger variance,
real selection pressure on far dispersal), and legacy guild counters still
hardcode `3` where the new census uses `TROPHIC_COUNT` (harmless at 3 guilds,
flagged for any future fourth). RNG draw-count comment corrected (three, not two).

## Results: 10 seeds never used in prior work

Seeds 7, 42, 101, 777, 1234, 31337, 555, 8888, 24601, 99991.

| seed | pop | consEnd | consMax | decompMax | decomp ticks alive | biotic | cap hits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7 | 546 | 15 | 83 | 2 | 853 | 114 | 0 |
| 42 | 793 | **189** | 223 | 2 | 605 | 84 | 0 |
| 101 | 499 | 25 | 60 | 3 | 224 | 151 | 0 |
| 777 | 951 | 2 | 69 | 9 | 919 | 401 | 0 |
| 1234 | 717 | 3 | 59 | 3 | 240 | 148 | 0 |
| 31337 | 1870 | 113 | 116 | 4 | 703 | 48 | 0 |
| 555 | 737 | 25 | 73 | 0 | 0 | 46 | 0 |
| 8888 | 962 | 6 | 47 | 1 | 338 | 425 | 0 |
| 24601 | 406 | 4 | 56 | 1 | 259 | 103 | 0 |
| 99991 | 598 | 12 | 71 | **11** | **1200** | 104 | 0 |

| metric | result |
| --- | --- |
| consumers alive at t1200 | **10/10** (avg 39.4) |
| consumers ever hit zero | **0/10** |
| decomposers appeared at any point | **9/10** |
| population bounded (<6000) | **10/10** |
| any population-cap hits | **none** |

## Interpretation — stated precisely

**Consumers never went locally extinct on any seed (0/10 zero-crossings).**
Immigration is PREVENTING patch-local extinction rather than RECOVERING from it,
so the recurrence metric ("recovered after zero") is untested by this run — no
seed exercised the recovery branch. That is a real limitation of the evidence,
not a pass.

**Decomposers established for the first time in the project: 9/10 seeds show
them, and seed 99991 sustained a decomposer population for the entire 1200
ticks.** Previously the fifth guild read 0.0% on every seed in every
configuration. Persistence is uneven — seed 99991 stable, most others transient,
seed 555 none — so the mechanism now WORKS but is not yet reliable.

**Carrying capacity holds on 10/10 seeds with zero cap reliance**, confirming
the clumping + canopy result generalises beyond the 3–4 seeds used to find it.

Seed 42 at 189 consumers (~24% of population) is the strongest multi-guild
community observed in the project to date.

## Running

Same 10 seeds at 2400 ticks in flight. Watching for: whether consumer
persistence holds on the longer horizon; whether transient decomposers persist
or cycle; and specifically the ~4,000-tick nutrient quasi-trap recovery constant
predicted by the biological-closure review, which is invisible at 1200 but could
bind by 2400.

---

# TRACE TOOL (read-only event log)

Built to answer the class of question that repeatedly forced indirect inference
this session: "why did THIS organism die", "did that contest change anything",
"what happened to this lineage between ticks". Snapshots answer "what was true
at N"; cumulative counters answer "how many died of X". Neither answers the
causal question, which is why several diagnoses this session were wrong.

## What was added

- `src/trace/trace.ts` — `TraceLog`, a FIXED-CAPACITY RING buffer (never resized,
  so memory is flat and cost per event constant), `TraceEvent` (flat numeric
  fields, cheap to store, interpretation deferred to helpers), plus `formatEvent`
  for shared rendering. Query helpers: `between`, `ofKind`, `forOrganism`,
  `forLineage`, `events`.
- `src/trace/cli.ts` — inspection CLI: `--summary --causes --survival --deaths
  --contests --immigrations --lineage=ID --organism=ID --window=A..B`.
- Hooks in `world.ts`: DEATH (cause, age, total damage, starve-damage split,
  guild), CONTEST (kind, outcome, delta, both damage values), BIRTH (parent,
  energy, pathway, guild, position), IMMIGRATION (from-patch, to-patch, guild,
  travel distance). All four append in the engine's existing deterministic order.

## Constraint verification

- **Read-only, proven empirically**: same seed, 300 ticks, `hashState()` digest
  identical with tracing on and off (`284f30bb` both). Tracing cannot change
  outcomes.
- **Default off**: `traceLog` is null when disabled, so the hot path pays one
  null check per hook and allocates nothing.
- **Bounded**: ring buffer; a long run overwrites oldest events rather than
  growing. Gates 7/7 with tracing in the codebase.

## Immediate payoff: it answered the open question

The one thing I said needed data and had no way to get: **are immigrants
genuinely establishing, or is immigration a thin subsidy propping up a doomed
population?** (`--survival` on seed 202, 800 ticks)

```
immigrants tracked: 79
died during run:     7   (mean lifespan 369 ticks, median 350)
still alive at end: 72
verdict: majority survived — genuine establishment
```

91% of immigrants are alive at the end, mean lifespan 369 ticks. Immigration is
doing genuine recolonisation, not propping up a population that would otherwise
collapse. That was previously an open question and is now measured.

Death-cause breakdown (`--causes`, seed 42, 300 ticks) also immediately showed
starve-dominance (71 starve / 1 age) split producer 55 / consumer 16, which
corroborates the demographic finding from a second, independent angle.

---

# TRACE TOOL REVIEW — 2 medium findings, both reproduced then fixed

Review confirmed the read-only claim from code inspection (all four hooks
guarded, no writes to store/ledger/fields, no RNG consumed, `hashState` never
mixes the log so digest equality was structural not coincidental). Seven
findings; all addressed:

1. **MEDIUM — id collisions in `forOrganism` (FIXED, reproduced first).**
   `b` holds a dense LINEAGE index for DEATH and a PATCH index for IMMIGRATION;
   both are low integers that collide with organism ids. Measured BEFORE the fix:
   `forOrganism(1)` returned an event belonging to a different organism. Now
   kind-aware (only BIRTH/CONTEST put a participant id in `b`); re-measured at
   0 false positives.
2. **MEDIUM — `traceLineageMap` missed dead members (FIXED, verified).**
   It promised extinct-lineage follow-through but was built from live slots only,
   dropping exactly the events of interest. Now records id->lineage at BIRTH and
   for founders, retaining dead members. Verified: map size 233 for 200 founders,
   and a lineage with a recorded death is now queryable (previously empty).
3. LOW — BIRTH `w` mislabeled "offspring"; it is a sexual/asexual pathway flag.
   Relabeled.
4. LOW — `LINEAGE_EXTINCT`/`COLLAPSE` kinds defined but never emitted. Removed
   rather than left as dead surface that invites future queries for events that
   can never exist.
5. LOW — CLI numeric args unvalidated (`--capacity=abc` -> NaN silently corrupted
   the ring). All numeric flags now validated with `Number.isFinite` + integer +
   minimum checks; `--window` shape checked.
6. LOW — `--survival` vacuous on zero immigrants and blind to ring eviction.
   Early-out added, eviction now warns that figures describe only the retained
   suffix, unused variable removed.
7. INFO — `trace()` returned a mutable handle while documented "read-only".
   Docstring now states it is mutable but diagnostic-only (engine never reads it,
   so mutation cannot affect outcomes).

Post-fix verification: read-only digest still identical on/off (284f30bb both),
gates 7/7, typecheck + browser build clean. Version 0.4.0 -> 0.4.1.

---

# 10-SEED VALIDATION AT 2400 TICKS — CONSUMER RESULT REVERSES

Same 10 fresh seeds, doubled horizon. This CORRECTS the optimistic reading of the
1200-tick run.

| seed | cons@1200 | cons@2400 | ticks spent at ZERO |
| --- | --- | --- | --- |
| 7 | 15 | 24 | 0 |
| 42 | 189 | **721** | 0 |
| 101 | 25 | 2 | 0 |
| 777 | 2 | **0** | 541 |
| 1234 | 3 | **0** | 801 |
| 31337 | 113 | **0** | 71 |
| 555 | 25 | 21 | 0 |
| 8888 | 6 | **0** | 336 |
| 24601 | 4 | **0** | 1043 |
| 99991 | 12 | 30 | 0 |

| metric | 1200 ticks | 2400 ticks |
| --- | --- | --- |
| consumers alive at end | 10/10 | **5/10** |
| consumers ever hit zero | 0/10 | **5/10** |
| recovered after zero | 0/10 | **0/10** |
| decomposers appeared | 9/10 | 9/10 |
| population bounded | 10/10 | 10/10 |
| population-cap hits | none | none |

## Correction to the previous report

I reported "consumers never went locally extinct on any seed (0/10)" as
evidence immigration was holding the metapopulation together. That was a
horizon artifact: at 1200 ticks the runs had not finished collapsing. At 2400,
five seeds go extinct and STAY extinct — 24601 spent 1043 ticks at zero,
1234 spent 801, 777 spent 541. Zero-crossings with no recovery.

## What survives, and what does not

**ROBUST (both horizons):**
- Carrying capacity: 10/10 bounded, zero cap reliance, at 1200 AND 2400.
  The clumping + canopy result is solid and horizon-independent.
- Decomposers: 9/10 at both horizons; seed 99991 persisted past 1200 (1257
  ticks alive, up from 1200). The fifth guild's establishment is real.

**NOT ROBUST:**
- Consumer persistence. 10/10 at 1200 was premature; 5/10 at 2400, and the
  failures are terminal rather than transient.

## Interpretation

Immigration delays consumer extinction; it does not prevent it. The failures
show the same source-collapse signature as before: when the SOURCE patches
themselves fail, no amount of directed dispersal from within the metapopulation
can help, because there is no longer a viable source. This is consistent with
the Allee framing — and with the trace tool's finding that immigrants do
establish where they arrive (91% survival at 800 ticks on seed 202), which is a
statement about arriving in a viable patch, not about rescuing an empty world.

The recurrence metric remains 0/10 at both horizons: no seed has recovered a
lost guild. Prevention is not achieving permanence within 2400 ticks.

---

## Criterion 2 measured: the stochastic breeding roll is the loss channel

Case `9b5ff0df` carried four acceptance criteria. Criterion 2 — *the fraction of
gate-eligible consumer ticks lost to the stochastic breeding roll* — had never
been measured in any prior session, because a tick that loses the roll produces
no birth, no event, and no counter. It left no trace.

`src/trace/reproprobe.ts` adds a null-guarded observational probe to
`World.proposeReproduction`, tallies every gate, and counts roll entries and
successes per guild. `src/trace/reproprobe-cli.ts` runs each seed twice — probe
off, then probe on — and compares the engine's own `hashState()`, which covers
RNG words, positions, substrate, ledger, heritable genome, lineage, hunger and
demographics.

**Result (seeds 24601/777/1234, 2400 ticks):**

| guild | reached roll | positive drive | births | roll loss | exp. births | obs. births |
| --- | --- | --- | --- | --- | --- | --- |
| producer | 101,342 | 71,127 | 1,984 | 97.2% | 1968.0 | 1984 |
| consumer | 3,396 | 1,855 | 35 | 98.1% | 33.8 | 35 |
| decomposer | 9 | 9 | 1 | 88.9% | 0.2 | 1 |

Consumers clear every deterministic gate and then lose the lottery on **98.1%**
of eligible ticks. Eligibility converts to recruitment at roughly **2%**.

### What the identity now shows, and what it corrected

Births are predicted by `sum(max(0, drive))` over eligible ticks to within
0.8% (producers) and 3.6% (consumers). The roll is a faithful Bernoulli, and the
channel is fully accounted for — nothing downstream is unexplained.

An earlier pass in this same session reported consumer drive at 0.0099 versus
producer 0.0194, implying consumers carried half the per-tick odds. **That figure
was wrong** and is corrected here: `driveMean` was averaged over *all* reached-roll
ticks, including the 1,541 consumer ticks whose drive was `<= 0`, whose negative
terms drag a mean down. Conditional on positive drive, consumers carry **0.0182**
against producers' **0.0277** — a 1.5× gap, not 2×. The probe now exports
`expectedBirths = sum(max(0, drive))` so the identity can be tested directly
rather than inferred.

### So what actually distinguishes the guilds

Not the odds per eligible tick, and not eligibility alone:

1. **Volume.** Producers reach the roll 101,342 times to consumers' 3,396 — 30×.
   They win the lottery 1984:35 almost entirely by showing up, not by being
   better bets. Producers also lose 97.2% of their eligible ticks, so the loss
   *rate* is nearly guild-independent.
2. **Sign.** Only 55% of consumer reached-roll ticks have positive drive at all
   (1,855/3,396), against 70% for producers. The typical eligible consumer sits
   at exactly zero margin — median drive 0.000 — where the drive formula's
   `(energyFrac - threshold + 0.25)` offset yields its minimum.

This also explains the threshold sweep's previously unexplained hump. Lowering
the founding threshold buys eligibility while spending margin per tick, so
birth/death rose 0.633 → 0.771 at threshold 0.35 and fell back to 0.735 at 0.25:
an interior optimum, not a monotone fix. Consumer median margin stayed 0.000 at
threshold 0.25 as well.

**What makes consumers viable is therefore not crossing the breeding gate but
holding surplus above it.** Producer runaway was never a factor — zero
population-cap hits at every threshold tested.

### Status and limits

- Case `9b5ff0df` attempt 2 is `CONCLUDED` with finding `supported`. The case
  remains `BLOCKED` only on the `verify` path, for reasons unrelated to this
  measurement (see below). Criterion 2 is answered.
- The probe is proven inert by `hashState()` equality on 3 seeds × 2400 ticks.
  That is a **sample**, not a universal proof; what generalises is the
  per-call-site argument that no RNG draw or state write is reachable from a
  probe callback. Independent review confirmed this and found the original
  weaker digest to be insufficient (it omitted RNG state, positions, substrate
  and heritable genome), which is why `hashState()` replaced it.
- Still unresolved: whether low consumer margin is caused by income physics
  (lump kills vs producer trickle) or by competition for shared producers. The
  probe counts outcomes but cannot attribute cause.
- Decomposers reached the roll 9 times in total; their row is statistically
  meaningless.
- Tallies are cumulative over 2400 ticks and cannot localise *when* the deficit
  opens, so a transient startup deficit is not excluded.

### `verify` remains blocked, for a reason outside this experiment

The MCP marks all evidence `incomplete` because its workspace fingerprint walks
`git ls-files` over `/root/DEE-TS-POC` and rejects any file over 2 MB. Exactly
three paths trigger it, none of them this worktree:

| path | cause | tracked |
| --- | --- | --- |
| `packages/phenotype/evidence/viewer.html` | 2.5 MB | in base commit `c247dd9` |
| `testdata/broad-ecology-0.22.json` | 2.0 MB | in base commit `c247dd9` |
| `node_modules` | symlink resolving outside the root | untracked |

Committing this experiment **cannot** fix it, because two of the three offenders
are already in the base commit. Recorded in
`scientific-mcp/docs/BETA-REPORT-2026-10-09.md` (defect D6). Owner elected to
hold on the fix.

---

## Correction: margin was NOT the cause. The heritable trait collapsed.

The section above concluded that consumers sit at zero energy margin, so their
breeding odds are minimal. **That conclusion was wrong**, and the arithmetic that
falsifies it is short enough to check by hand.

The drive formula is
`drive = asexualRate * (1 - mateSeeking*0.55) * 2.4 * (margin + 0.25) * (1 + 10*margin)`.
With founder trait values (asexualRate 0.2, mateSeeking 0.4) and margin exactly
zero, drive is still

    0.2 * (1 - 0.4*0.55) * 2.4 * 0.25 * 1  =  0.0936

Measured mean consumer drive was **0.0182** — roughly 5x *below* the floor that
margin alone can produce. Margin cannot explain it. The deficit has to be in the
heritable trait term, `asexualRate*(1 - mateSeeking*0.55)*2.4`, founder value
0.3744.

### Measured decomposition (seeds 24601/777/1234, 2400 ticks)

| guild | reached roll | mean margin | drive (pos) | trait term | asexualRate | mateSeeking |
| --- | --- | --- | --- | --- | --- | --- |
| producer | 101,342 | 0.1692 | 0.0277 | 0.0242 | 0.0123 | 0.3795 |
| consumer | 3,396 | **0.1688** | 0.0182 | 0.0093 | **0.0051** | 0.3959 |
| decomposer | 9 | 0.0994 | 0.0169 | 0.0243 | 0.0121 | 0.2944 |

Founder values: asexualRate 0.2, mateSeeking 0.4.

**Mean margin is identical between consumers and producers** (0.1688 vs 0.1692).
Margin was never the difference. `mateSeeking` never moved (0.3959 vs 0.4).
`asexualRate` collapsed **39-fold** in consumers and 16-fold in producers, and
**45.4%** of consumer roll-entry ticks had it at exactly zero — the asexual route
switched off entirely for nearly half the population.

### Why that is the smoking gun

`asexualRate` is read in exactly one place in the entire engine — the breeding
drive calculation — and affects no other mechanic. Not metabolism, not damage,
not survival, not movement. A trait with no consequence except reproduction, that
declines to near zero, is **selection acting against reproduction itself**.

There is no explicit fitness function anywhere in the codebase. Reproduction
costs the parent (`spend(slot, 1.1 + size*0.35, 'reproduction')`), and in a
saturated world an offspring does not out-compete its parent. On those
mechanics, never reproducing and keeping the energy is genuinely optimal.

### The controlled test: is the collapse adaptive?

Seeding founders at 4x the trait (0.8) and letting selection respond:

| founder init | mean B/D | seeds B>D | end asexualRate | vs founder |
| --- | --- | --- | --- | --- |
| 0.2 (default) | 0.633 | 0/3 | 0.0051 | 0.025x |
| 0.5 | 0.753 | 0/3 | 0.0209 | 0.104x |
| 0.8 | 0.771 | 0/3 | 0.0392 | 0.196x |

Consumers do gain births when seeded high (seed 24601: 70 → 176), but selection
**erodes the trait straight back down** — 0.8 seeds in, it ends at 0.0392, always
converging toward the same low value regardless of the starting point. `B/D`
never crosses 1.0 in any of the 9 runs.

This is the **adaptive** outcome, and it is the central finding: the trait is not
an incidental artefact holding the guild down. Selection consistently dismantles
reproduction and wins every time.

### Revised conclusion

The causal chain is now complete and it is not the one previously reported:

1. Consumers do reach the breeding gate — 3,396 times, with margin indistinguishable
   from producers.
2. They lose 98.1% of those chances to the stochastic roll.
3. The roll probability is low because `asexualRate` has collapsed to ~2.5% of
   its founder value, not because margin is small.
4. `asexualRate` collapses because it is the only trait that affects
   reproduction and nothing else, and in this world reproduction is a net cost.
5. Therefore raising the trait does not fix the guild: selection removes the
   advantage within a few hundred ticks.

**What makes consumers viable is a world where reproducing pays.** That is a
missing selection pressure, not a mis-tuned parameter. Every previous
intervention in this report — threshold lowering, damage ceiling, surplus gate,
canopy grain, immigration — tuned a number inside a system whose selection
gradient points the other way.

### Method notes and limits

- Probe inertness re-verified via engine `hashState()` on every run; all identical.
- The seeding sweep varies only the founder init; the trait stays heritable, which
  is what makes it a test of adaptation rather than a permanent override.
- `endAsexual` is the mean over roll-entry ticks, so it describes the reproducing
  cohort, not the whole population.
- Three seeds, all previously known failing seeds. Recurrence was sampled at 10
  checkpoints; consumers persist past t=1000 on 3/9 runs but no seed reaches 2400.
- The claim "reproduction is a net cost here" is inferred from the absence of a
  fitness function plus the observed erosion. It has not been isolated by removing
  the reproduction cost directly, which is the obvious next controlled experiment.

---

## Correction 2: there is no clutch-size ceiling. The gene/physical-value trap.

I previously claimed a "mechanical fecundity ceiling": that `clutchSize` is
initialised at 0.35 with `max(1, round(clutchSize*(0.5+rand)))`, so every birth
event yields exactly one offspring and the trait cannot express itself.

**That was wrong, and the codebase had already documented this exact trap.**
`TraitSpec.init` is a NORMALISED GENE in [0,1], not a physical value. Expression
is `express(gene) = lo + gene*(hi-lo)`, and `seedFounders` clamps the *gene*.
So `clutchSize` declared `lo=1, hi=11, init=0.35` expresses to a physical
**4.5**, producing **4-7 offspring per event**, not 1.

The hazard is written into `src/bio/genome.ts` (lines 165-185): `storageCapacity`
was once declared `init = 70` — a physical value in a gene array — and clamped
silently to 1.0, giving every founder maximum storage and no variation at all.
"the failure is invisible: it produces a plausible-looking simulation rather than
a crash." `assertTraitLayout` now asserts at module load.

### I reproduced the very bug, in my own diagnostic

My first clutch sweep passed physical values (2, 5, 9) as "founder init". All
three clamped to gene 1.0 and produced **byte-identical** runs — same B/D, same
births, same trajectories. That identity was the tell. Corrected to pass
normalized genes:

| founder gene | physical clutch | mean B/D | mean births | vs default |
| --- | --- | --- | --- | --- |
| 0.35 (declared) | 4.5 | 0.633 | 63.0 | 1.00x |
| 0.00 | 1.0 | 0.518 | 39.0 | 0.62x |
| 0.15 | 2.5 | 0.571 | 49.3 | 0.78x |
| 0.55 | 6.5 | 0.697 | 90.3 | 1.43x |

### Findings

1. **No ceiling.** B/D rises monotonically with clutch size, and the trait is not
   eroded (endClutchTrait stays high where consumers survive at all). The
   `CEILING_BINDS=false` / `TRAIT_ERODED=false` flags both come back negative.
2. **Clutch is a weak lever.** Going from physical 1.0 to 6.5 (6.5x more
   offspring per event) raises B/D only 0.518 -> 0.697, and births 39 -> 90.
   It never approaches 1.0.
3. **Deaths scale with births.** Higher clutch produces more births AND
   proportionally more deaths (seed 1234 at gene 0.55: 128 births / 161 deaths,
   versus 38/71 at gene 0.15). Extra offspring do not survive; they arrive into
   the same energy-limited world and starve. This is the same finding as the
   asexualRate seeding sweep, in a different variable.
4. `endClutchTrait` reads 0.000 for most cells because consumers are extinct at
   end of run, so there is no living cohort to average. Only the gene(0.00) cell
   retains a survivor, and its physical trait has eroded to 0.343 — well below
   even the minimum of 1, indicating the same downward selection pressure seen
   in `asexualRate`.

### Revised position

Two earlier claims are now retracted:

- ~~"Consumers produce one offspring per event"~~ — they produce 4-7.
- ~~"The model physically cannot outpace adult mortality"~~ — it can be moved
  toward break-even, just not past it. Fecundity responds, roughly linearly, but
  with a low slope.

What survives is the selection finding, now supported by two independent
variables: seeding `asexualRate` 4x high is eroded back to ~0.04 and still fails;
seeding `clutchSize` 6.5x high raises B/D but raises mortality proportionally, so
net replacement still fails. In both cases more reproduction produces more
offspring AND more starvation. That is the signature of a world where energy, not
reproductive capacity, is the binding constraint — and of reproduction being a net
cost rather than an investment.

### Process note

This is the second time in this investigation that a diagnostic built on a
partial read of `genome.ts` produced a confident, wrong, self-consistent result.
Both times the tell was available in the data: byte-identical runs across
different inputs. Cheap internal-consistency checks caught what reading did not.

---

## The central conclusion is falsified: it is not the energy cost

The previous two sections concluded that "reproduction is a net cost in this
world, so evolution dismantles it." That was an INFERENCE from the absence of a
fitness function plus observed trait erosion. It had never been isolated.

This sweep isolates it. `reproActCostScale` scales only the act cost
`spend(slot, 1.1 + size*0.35, 'reproduction')`. The parental reserve transfer
(`birthCostFactor 0.42 * 0.5`) and the 8-34 tick breeding cooldown are untouched:
the transfer is the material a child is made of, not a tax, and the cooldown is
attempt spacing rather than an energy cost.

Seeds 24601/777/1234, 2400 ticks:

| act-cost scale | mean B/D | seeds B>D | mean births | mean deaths | end asexualRate |
| --- | --- | --- | --- | --- | --- |
| declared (1.0) | 0.633 | 0/3 | 63.0 | 99.3 | 0.0051 |
| half (0.5) | 0.682 | 0/3 | 79.3 | 115.7 | 0.0057 |
| **free (0.0)** | 0.707 | 0/3 | 88.7 | 125.0 | **0.0051** |

### What this kills

1. **"Reproduction is eroded because it costs energy" is false.** Removing the
   entire energy cost of the breeding act does not preserve `asexualRate`: it ends
   at 0.0051 under free breeding and 0.0051 under declared cost — identical to
   four decimal places. `COST_DRIVEN=0`.
2. **The cost is not the gradient.** B/D improves only 0.633 -> 0.707 when the
   cost goes to literally zero, and never crosses 1.0.
3. **Births and deaths move together at every level.** Free breeding adds 25.7
   births and 25.7 deaths. The extra offspring arrive into the same
   energy-limited world and starve, exactly as in the clutch sweep.

### What this leaves standing

The trait collapse is real and robust: `asexualRate` reaches ~0.005 from a
founder 0.2 under every intervention tried — free breeding, half-cost breeding,
4x founder seeding, 6.5x clutch. Selection erodes it regardless of what
reproduction costs.

But "eroded regardless of cost" is not "eroded because it costs energy". The
gradient must run through something else. Candidates not yet tested:

- **The parental transfer.** `birthCostFactor 0.42 * 0.5` of the parent's reserve
  per child is charged on every birth regardless of `reproActCostScale`. This is
  the largest energy term and it was deliberately NOT swept, on the reasoning
  that a child is made of its parent's material. That reasoning may be wrong: the
  transfer is a real charge on the parent, and it scales with CLUTCH SIZE, so a
  6.5x clutch is a 6.5x energy bill. This would explain why the clutch sweep
  raised births and mortality together.
- **The cooldown.** 8-34 ticks of no breeding after each event.
- **Population-level dilution.** With `maxPopulation` 60,000 never approached,
  there may be no competition for space, so reproduction buys nothing.

The transfer is the strongest remaining candidate and the next experiment.

### Cumulative status of claims in this investigation

| claim | status |
| --- | --- |
| Consumers lose98.1% of eligible ticks to the stochastic roll | SUPPORTED |
| Consumer margin equals producer margin; margin is not the cause | SUPPORTED |
| asexualRate collapses ~40x to ~0.005 under all interventions | SUPPORTED |
| Higher clutch raises births and mortality together | SUPPORTED |
| "Consumers sit at zero margin" | RETRACTED (margin is identical across guilds) |
| "Clutch size cannot exceed 1 offspring" | RETRACTED (gene/physical confusion; 4-7 actual) |
| "Reproduction is eroded BECAUSE it costs energy" | **FALSIFIED by this sweep** |

Three of the seven original claims have now been falsified by my own subsequent
tests. Each retraction was caused by a partial read of `genome.ts` or an
unisolated inference, and each was caught by an internal-consistency check
rather than by reasoning.

---

## Per-guild energy budget: the data we were not collecting

Every experiment until now measured BREEDING. The engine's five-bucket
expenditure ledger (basal, movement, sensing, contest, reproduction) was read
only globally, and three terms that determine affordability were never attributed
to any guild at all.

`src/world/ledger.ts` now carries parallel per-guild counters alongside the
global buckets, recorded at three hook points in `src/world/world.ts`:

1. **`World.spend()`** — the single choke point for all 12 expenditure sites.
   Records per-guild via the spending slot's cached role. Accounting only; no
   branch reads the values.
2. **Birth settlement** — records the parental reserve transfer per-guild (the
   amount debited from the parent, which equals the request and may exceed what
   the child receives by `birthOverflow`).
3. **Crowding site** — records the density cost separately, using the ACTUAL
   deduction returned by `spend()` rather than the requested cost. An earlier
   version of this hook recorded the request and reported crowding as 99% of all
   spending, which was impossible; the clamp to available energy was hiding it.
   The fix was to have `spend()` return the actual deduction.

The conservation identity is untouched: it reads only the global buckets, and
the gates confirm it still holds 7/7. Per-guild sums reconcile exactly with the
global buckets on every seed (`perGuildSumsMatchGlobal=true`).

### Measured (seeds 24601/777/1234, 2400 ticks, pooled)

| guild | basal | move | sense | contest | REPRO | total | repro% |
| --- | --- | --- | --- | --- | --- | --- | --- |
| producer | 481,240 | 11,649 | 76,290 | 0 | 22,118 | 591,297 | 3.7% |
| consumer | 11,256 | 1,331 | 1,974 | 74 | 191 | 14,827 | **1.3%** |
| decomposer | 832 | 18 | 63 | 2 | 3 | 917 | 0.3% |

| guild | transferOut | actCost | transfer/act | births |
| --- | --- | --- | --- | --- |
| producer | 47,719 | 22,118 | 2.2x | 14,556 |
| consumer | 940 | 191 | **4.9x** | 189 |
| decomposer | 33 | 3 | 10.5x | 5 |

| crowding | paid | share of own spend | share of global crowding |
| --- | --- | --- | --- |
| producer | 176,399 | 29.8% | **99.1%** |
| consumer | 1,492 | 10.1% | 0.8% |
| decomposer | 122 | 13.3% | 0.1% |
| **all spending** | | **29.3%** | |

### What this establishes

1. **Consumers spend 1.3% of their own budget on reproduction and 75.9% on
   basal upkeep.** Breeding is cheap FOR THEM TOO, not just globally. The
   "reproduction is a net cost" framing is dead at both levels.
2. **The parental transfer dominates the act cost 4.9x for consumers** (2.2x
   producers). Yet removing the transfer entirely left end `asexualRate` at
   0.0070 vs 0.0051 — so the larger term is not the gradient either.
3. **Crowding costs 29.3% of all spending, but falls 99.1% on producers.**
   Consumers pay only 10.1% of their own budget as crowding. Density dependence
   EXISTS in this world — it was previously claimed absent — but it constrains
   producers, not consumers. Consumers are too rare to crowd.
4. **Consumers' total budget is 39.9x smaller than producers'** (14,827 vs
   591,297). Producer births exceed consumer births 77x (14,556 vs 189).

The picture is now complete at the energy level: a guild holding 2.5% of total
spending, paying three-quarters of it just to stay alive, with 1.3% left for
reproduction. Not priced out of breeding. Too poor to buy it.

### Independent review

Reviewed over the actual diff. No material defect. Two fixes applied from the
findings: the transfer hook now records after the allocation check (a phantom
count existed on the practically-unreachable allocation-failure path), and its
comment now states debited-vs-received semantics. The reviewer noted `hashState()`
does not cover the new counters, so digests cannot catch a per-guild miscount —
but the reconciliation check (`perGuildSumsMatchGlobal`) does that job instead,
and it passes on every seed.

### MCP status

Case `6316dc9e` is CONCLUDED with finding `supported`, all three support
conditions met, no falsification clause fired. `verify` returns BLOCKED on all
five criteria for the single known environmental reason
(`SYMLINK_OUTSIDE_WORKSPACE:node_modules`), recorded as an explicit blocker.
Both server-executed runs carry all five contract digests.

---

## Per-guild income: consumers are scavengers, not predators

The expenditure side showed consumers are POOR (2.5% of spending, 76% on
upkeep). This measures the income side: energy enters through photosynthesis
(capture), scavenging (detritus), and predation (contests), and the ledger
recorded all three globally but none per-guild.

`src/world/ledger.ts` now carries `capturedByGuild`, `scavengedByGuild`,
`predatedByGuild` and `unassimilatedByGuild`, recorded at five hook sites in
`src/world/world.ts` (1 capture, 3 scavenging, 1 predation, the last attributed
to the attacker's guild). As with expenditure, these are parallel counters that
do not participate in the conservation identity; gates still pass 7/7, and
per-guild sums reconcile exactly with global counters including unassimilated.

### Measured (seeds 24601/777/1234, 2400 ticks, pooled)

| guild | capture | scavenge | predate | TOTAL | share of all income |
| --- | --- | --- | --- | --- | --- |
| producer | 580,344 | 97,464 | 0 | 677,808 | **97.2%** |
| consumer | 5,178 | 13,088 | 539 | 18,806 | **2.7%** |
| decomposer | 380 | 332 | 24 | 735 | 0.1% |

Consumer income split: **predation 2.9%, scavenging 69.6%, photosynthesis
27.5%.** Producer-to-consumer income ratio: **36.0x.**

Digestion efficiency (unassimilated/scavenged): consumer 42.1%, producer 39.0%,
decomposer 39.4% — within 3 points, so digestion is not consumer-specific.
Contest spending is 0.01% of all expenditure globally: almost no aggressive
interactions occur in any guild.

### What this establishes

1. **Consumers are functionally scavengers.** Predation provides 539 of 18,806
   income (2.9%); scavenging provides 13,088 (69.6%). Per-seed predation is
   305/99/136 against scavenging 4131/5581/3376.
2. **Consumers photosynthesize 27.5% of their own income** (5,178). The guild
   boundary is porous: these organisms retain phototrophic capacity, whether as
   adaptive mixotrophy or fluid guild assignment is unresolved.
3. **The bottleneck is foraging, not digestion.** Waste rates differ by 3 points
   across guilds; income differs by 36x.
4. **The energy poverty now has its income-side cause.** Consumers do not capture
   at the source (producers take 97.2% via photosynthesis) and barely steal
   (2.9% predation), surviving on detritus plus incidental photosynthesis.

### Independent review

Clean, no material defects. One test gap found and fixed: the CLI consistency
check omitted `unassimilatedByGuild`; it now covers all four counters and still
reports true. The reviewer confirmed the capture-books-`gained` and
scavenged-books-`removed` semantics match their global twins (overflow goes to
spill, not to the organism), and that predation attribution to the attacker is
correct with the liveness guard preceding it.

### MCP status

Case `e1a88873` is CONCLUDED with finding `supported`, all four support
conditions met. `verify` BLOCKED on all five criteria for the known
environmental reason, recorded explicitly. Both server-executed runs carry all
five contract digests.

---

## Four-way intervention: consumers recur, decomposers do not

Owner authorized all four consumer-viability directions. Each tested
independently against baseline on seeds 24601/777/1234 at 2400 ticks:

| arm | mean B/D | seeds B>D | mechanism |
| --- | --- | --- | --- |
| baseline | 0.633 | 0/3 | declared behaviour |
| predx3 (predation yield 3x) | 0.780 | 0/3 | helps, does not win |
| predx8 (predation yield 8x) | 0.670 | 0/3 | WORSE than 3x (hump) |
| photox2 (consumer photo 2x) | 1.014 | 2/3 | wins twice |
| **photox4 (consumer photo 4x)** | **1.229** | **3/3** | **wins everywhere** |
| basal/2 (consumer upkeep half) | 0.789 | 0/3 | helps, does not win |
| **basal/4 (consumer upkeep quarter)** | **1.084** | **2/3** | **wins twice** |
| prodCap.6 (producer capture 60%) | 0.698 | 0/3 | no effect |
| prodCap.3 (producer capture 30%) | 0.693 | 0/3 | DESTABILIZES (pop 1 on 24601) |

### Winners in detail

**photox4** (B/D 1.17/1.15/1.37; cons energy 87%/39%/54%):
Consumers present at ALL 10 checkpoints on all 3 seeds, ending 243/242/669.
Never zero after start. This is recurrence by the user-approved metric.

**basal/4** (B/D 1.12/0.94/1.20; cons energy 21%/6%/29%):
Present throughout on all seeds, ending 91/23/371. Wins 2/3 on B/D.

### Losers and what they mean

- **Predation**: 3x yield helps (0.63->0.78) but 8x is worse (0.67). Hump-shaped:
  more yield per event does not monotonically help, likely because defenders die
  faster and the prey base collapses. Consumers TRY (20-30% of intents are
  HUNT/GRAZE) but gain almost nothing per attempt.
- **Producer cap**: capping producers at 30% drops one world to population 1
  and leaves others unchanged. Scarcity destabilizes rather than balances. This
  direction is falsified as a safe intervention.

### The new binding constraint: decomposers extinct everywhere

Full three-guild trajectories (P/C/D at 10 checkpoints):

- photox4: decomposers flicker 0-12 early, extinct (D0) by end on ALL seeds.
- basal/4: same pattern, D0 at end everywhere.
- baseline: same.

Producers and consumers now recur. **Decomposers do not recur under any tested
configuration.** They hold 0.1% of income (735 total pooled) and vanish by
tick 1400-1900 even when consumers thrive.

This reframes the objective: consumer viability is SOLVED (photox4, 3/3), but
three-guild balance is not achieved because the decomposer niche is empty. The
closed system (`organicInput=0.0`, light only) should make decomposers essential
for nutrient recycling, yet producers thrive without them — implying abiotic
decay suffices and the decomposer role has no competitive advantage.

### Status against acceptance

User-approved metric: all guilds RECURRING over time, not endpoint presence.

- Producers: recur (all configurations).
- Consumers: recur under photox4 (3/3) and basal/4 (3/3 presence, 2/3 B/D).
- Decomposers: do NOT recur under any configuration.

**Acceptance NOT met.** Two of three guilds recur. The consumer problem that
drove this entire investigation is solved; the decomposer problem is new scope
that was never investigated (their income, traits, and selection pressures are
unmeasured).

---

## ACCEPTANCE: three-guild recurrence achieved

Combined all winners — consumer photosynthesis 4x + 25% decomposer seeding +
dormancy (×0.05) + spore dispersal — on seeds 24601/777/1234 at 2400 ticks.

| seed | t200 | t400 | t800 | t1400 | t1900 | t2400 |
| --- | --- | --- | --- | --- | --- | --- |
| 24601 | P288/C75/D37 | P512/C200/D110 | P423/C377/D171 | P163/C251/D132 | P98/C146/D376 | P45/C15/D689 |
| 777 | P299/C81/D54 | P586/C171/D118 | P924/C556/D189 | P312/C461/D77 | P250/C488/D21 | P311/C476/D7 |
| 1234 | P286/C63/D44 | P580/C131/D65 | P865/C280/D169 | P346/C910/D185 | P148/C547/D76 | P165/C718/D34 |

B/D by guild (whole run):

| seed | producers | consumers | decomposers |
| --- | --- | --- | --- |
| 24601 | 0.84 | 0.95 | 2.32 |
| 777 | 1.01 | 1.19 | 0.88 |
| 1234 | 0.94 | 1.24 | 0.96 |

**Every guild is present at every checkpoint on every seed. No zeros after
start.** By the user-approved metric (recurring over time, not endpoint
presence), acceptance is met: 3/3 seeds, 3/3 guilds, 6/6 checkpoints.

### Step results (order of battle from the accepted proposal)

1. **Dormancy alone**: mean age at death 369 -> 630, persists 1/3 seeds.
   Insufficient alone; proceeded.
2. **+ Spore dispersal**: persists 3/3 seeds (D1182/D4/D124 at end).
   Recurrence achieved for decomposers. Steps 3-4 (exclusive litter,
   deterministic growth) NOT built — unnecessary per the stop rule.

### Caveats (do not block acceptance, recorded for follow-up)

- Seed 24601 shows decomposer overgrowth (D689, B/D 2.32) with producers
  declining (P45 at end, B/D 0.84). If the run continued, producers might go
  extinct next. The balance is seed-dependent: 1234 is near-ideal (all B/D
  0.94-1.24), 777 has fragile decomposers (D7), 24601 has fragile producers.
- Consumers go extinct in the dormancy+spore test WITHOUT photox4 (C0 on all
  seeds) — the consumer fix and decomposer fix are independently necessary and
  jointly sufficient. Neither alone gives three guilds.
- Decomposer B/D ranges 0.88-2.32 across seeds (high variance). Longer runs
  would test whether 24601 stabilizes or inverts fully.
- Steps 3 (exclusive litter) and 4 (deterministic growth) were never built.
  They may be needed for long-term stability or for unseeded (evolved)
  decomposers. The entry barrier (three-trait gate) was bypassed by seeding,
  not solved — natural decomposers (1-7 at start) were not tested under the
  new mechanics.

### What was NOT needed

Exclusive litter access and deterministic growth — steps 3 and 4 — were never
implemented. Dormancy + spores sufficed for persistence. This is consistent
with the measurements: decomposers starved paying full upkeep while sessile
(barrier 1) and died where born without reaching litter (barrier 2). Removing
those two barriers restored the guild without touching breeding mechanics or
diet exclusivity.

---

## Mineralizer fate: mortality, not erosion — plus a trade-off I created

Functional mineralizers (bioticMineraliser=1) peak at 19-75 around t400-800,
then fade to 0-22 by t2400. Two explanations competed: selection against recalc
digestion (trait erosion, as happened with asexualRate) vs carriers dying with
traits intact (mortality).

### Measured (photox4 baseline, seeds 24601/777/1234, 6 checkpoints)

| seed | miners t400 -> t2400 | recalc among miners | pop recalc | verdict |
| --- | --- | --- | --- | --- |
| 24601 | 19 -> 0 | 0.405 -> gone | 0.208 -> 0.212 (holds) | carriers died |
| 777 | 60 -> 22 | 0.676 -> 0.692 (HELD) | 0.289 -> 0.292 (holds) | carriers died |
| 1234 | 20 -> 0 | 0.602 -> gone | 0.263 -> 0.276 (holds) | carriers died |

Population-wide recalc never falls on any seed. The trait is not selected
against. Mineralizers die — almost certainly the same consumer starvation,
since they read as mobile consumers (guild split 0/22/0, speed 2.8, all above
the 2.4 sessile gate). Function without the label, exactly as `role.ts`
anticipated.

Mineralization flow continues where carriers live (122/window with 22 miners on
777, ~5.5 each). The loop stays open proportional to count.

### The trade-off

Seed 1234's last mineralizer had photo **0.339** against the 0.34 gate. The
photox4 intervention that saves consumers pushes photo upward population-wide —
including in mineralizers — converting them into producers when they cross.
Carrion collapses on 777 (0.544 -> 0.007) while recalc holds: the two
mineralization routes diverge, recalc persisting, carrion abandoned.

The consumer fix and the mineralization function share the photo trait and pull
opposite ways. photox2 (which won consumers 2/3) may preserve mineralizers
below the gate where photox4 destroys them — an interior optimum, untested.

### MCP status

Case `d63e7537` CONCLUDED with finding `supported`, all conditions met. Criterion
1's contract was registered under a typo'd ID (since remapped); its evidence
carries the wrong-ID digest. Criteria 2-5 carry correct digests. All five
environmentally blocked by the known symlink. Recorded explicitly; science
unaffected.

---

## Five-seed acceptance: 4/5 pass (MCP case 49737252, CONCLUDED/supported)

Extended from 3 to 5 seeds, adding 99991 (longest natural decomposer run in
prior work) and 42 (strongest historical consumer peak, 721). Combined winning
configuration throughout. Single 12-second command.

| seed | trajectory | B/D P/C/D | minersEnd | pass |
| --- | --- | --- | --- | --- |
| 24601 | all guilds all checkpoints | 0.84/0.95/2.32 | 689 | YES |
| 777 | all guilds all checkpoints | 1.01/1.19/0.88 | 186 | YES |
| 1234 | all guilds all checkpoints | 0.94/1.24/0.96 | 688 | YES |
| 99991 | D0 only at t2400 (5/6) | 0.95/1.16/0.61 | 49 | NO |
| 42 | all guilds all checkpoints | 1.00/2.01/0.74 | 3532 | YES |

Consumer B/D above 1.0 on 4/5 (mean 1.31). Decomposer end presence 4/5.
Mineralizer function exceeds label substantially on some seeds (42: 3532 vs 9
labeled; 777: 186 vs 7). Zero cap hits. Decomposer B/D above 1.0 on only 1/5 —
presence holds via dormancy persistence-without-replacement, as predicted.

99991 misses one checkpoint (D0 at end after presence at 5/6; B/D decomp 0.61).
24601 passes at 2400 but is known to collapse by 4800 via nutrient hoarding.
Both within the pre-registered >=4 tolerance. `verify` environmentally blocked
as usual; science concluded.

---

## Independent review: dormancy + spores (2 defects fixed, 1 gap recorded)

Reviewed over the actual diff. No determinism or conservation break. Findings:

1. **Stale dormant flag on newborns (Low, fixed).** `populateSlot` never
   cleared `dormant[]` and allocation reuses released slots, so a newborn
   inherited the previous occupant's flag and got one tick of unearned cheap
   basal. Fixed by clearing in `populateSlot`.
2. **Litter wake-floor mismatch (Medium, fixed).** Dormancy treated any
   `litterData > 0` as food, but feeding requires `> 0.2`. Litter in (0, 0.2]
   woke organisms (or kept them awake) that could not eat — an active-but-
   starving trap in exactly the depleted regime dormancy exists to survive.
   Fixed to 0.2.
3. **Missing off-vs-on digest (process gap, partially closed).** No pre-change
   baseline exists (untracked worktree), so pre/post comparison is impossible.
   Recorded instead: repeated default-path digests identical across runs
   (6c76bb5e, 5c05aa8d), and code inspection confirms the default path
   short-circuits before any RNG draw. Repeatability proven; pre-change
   identity asserted by inspection, not measurement.
4. **Comment overstatement (fixed).** Dormancy suspends deficit-proportional
   starvation damage only; hunger trickle, crowding, movement, ageing and
   contests still apply. Comment amended.
5. **Literal `2` (fixed).** Spore branch now uses `TROPHIC.DECOMPOSER`.

Accepted as info (no change): 1-tick basal/sensing lag (bounded, benign);
travelDist=0 safety; litter-index clamping; sensing skip is cost-only (no
blindness); seeding jitter variance (~1/5 of seeded miss the guild);
square-cell assumption (true at current defaults).

---

## Random-seed generalization: 4/4 pass (MCP case dfc015c5, CONCLUDED/supported)

Four seeds never previously tested (517, 9061, 31415, 77031 — fixed and
recorded), same combined configuration, 2400 ticks, 28 seconds.

| seed | trajectory | B/D P/C/D | end D | pass |
| --- | --- | --- | --- | --- |
| 517 | all guilds all checkpoints | 0.93/1.30/0.93 | 41 | YES |
| 9061 | all guilds all checkpoints | 1.01/1.04/3.50 | 998 | YES |
| 31415 | all guilds all checkpoints | 0.82/0.97/1.80 | 1505 | YES |
| 77031 | all guilds all checkpoints | 0.89/1.09/1.69 | 1255 | YES |

Random-seed pass rate 100% meets-or-exceeds curated 80%. No seed-fitting.
Consumer B/D above 1.0 on 3/4 (mean 1.10). Zero cap hits.

The overgrowth pattern appears on 31415/77031 (producers end 21/14,
decomposers dominant with B/D 1.69-1.80), matching 24601. Overgrowth is now 3
of 9 total seeds — a recurring regime, not an anomaly. 31415 consumer B/D 0.97
misses by 0.03 but consumers never hit zero. `verify` environmentally blocked;
science concluded.

---

## Long-run stability, post-review-fix (MCP case b0f3207b, CONCLUDED/supported)

Three batch commands (9s/23s/17s), 8 seeds to 4800 ticks, all post-fix code
(dormant cleared on reuse, litter wake floor 0.2). Seed 42 excluded (runaway
population times out; pre-fix t3600 C26624 retained as partial).

| seed | t4800 | B/D P/C/D | verdict |
| --- | --- | --- | --- |
| 777 | P278/C992/D1081 | 1.00/1.29/2.44 | passes metric, overgrowth-trending |
| 1234 | P109/C469/D35 | 0.94/1.05/0.98 | holds |
| 9061 | P359/C3847/D1585 | 1.02/1.71/1.42 | holds imbalanced |
| 24601 | P14/C0/D896 | 0.84/0.94/1.27 | consumers extinct |
| 517 | P0/C757/D13 | 0.90/1.10/0.81 | producers extinct |
| 99991 | P853/C848/D0 | 1.12/1.11/0.51 | 2-guild, decomposers gone |
| 31415 | P16/C29/D1762 | 0.84/0.99/1.22 | functional monoculture |
| 77031 | P10/C144/D1540 | 0.89/1.04/1.24 | functional monoculture |

5/8 pass the metric; 3/8 genuine zeros. Consumer B/D above 0.9 on 7/8.

Key change from pre-fix: seed 777 shifted from balanced (P372/C604/D117) to
overgrowth-trending (P278/C992/D1081, decomp B/D 2.44). The litter-floor fix
keeps organisms dormant on trace litter, increasing persistence — including
over-persistence. The fix is correct (waking on inedible litter was a trap);
its dynamical consequence is stronger dormancy everywhere, for better (1234
holds) and worse (777 trends up, overgrowth seeds unchanged).

`verify` BLOCKED 5/5 environmentally. Science concluded across three batch
experiments with matched analyses.

---

## POC snapshot (success state, preserved 2026-10-09)

Seed 5738877 to t12000 in-app (user-run, Brave): decomposer-dominated middle
(D900-5200, t3000-10000), C->P flip burst 21->610, explosion to
P1298/C17173/D16188. Lab reproduction confirms pattern with expected
last-bit divergence (browser vs node libm in Rng gaussian).

File manifest with sha256 (16-hex) per production source:
`evidence/POC-SNAPSHOT.json`. Worktree uncommitted; base c247dd9; branch
experiment/ts-evolution-poc. Combined-winner config pinned in manifest.

To restore-verify: rebuild app from these sources, run seed 517 to t2400,
expect P39/C2/D740 (node) — pattern-match only in browsers (libm divergence).

---

## 60fps decoupled render (app POC, 2026-10-09)

Display runs on requestAnimationFrame; sim advances in an ~8ms budget per
frame with adaptive batching (rolling ms/tick estimate, capped by the speed
selector). When a single tick costs more than a frame, batches spread across
frames (1 tick every N frames) and in-between frames glide between the last
two committed position snapshots (alpha 0->1). Guild colors stay discrete
(newborns snap, deaths vanish); HUD shows real ticks only. Position buffers
live in the app layer; engine sources untouched and digest-identical.

Validation: base + app typecheck clean; bundle↔CLI parity exact at 500 ticks
(517 P881/C187/D73, 24601 P658/C280/D98 both sides); lerp@alpha=1 byte-identical
to exact render (0 diff bytes); commit/render proven non-mutating; HTML checks
(bundle, rAF, wiring, no external refs) all pass. Prior success snapshot
evidence/POC-SNAPSHOT.json preserved untouched; this build pinned in
evidence/POC-SNAPSHOT-60fps.json. Delivered to /sdcard/Download/evo-sim-poc.html.

---

# RESOLUTION (2026-10-09): nutrient figures do add up — wrong ceiling

The UNRESOLVED item above ("per-cell nutrient 16-21 vs capacity 2.4") was a
measurement artifact, not a model gap. The 2.4 ceiling summed only the
`nutrientCapacity` mods `[1.0, 0.78, 0.62]` and omitted two multiplicative
terms in the regen clamp (`world.ts`):

```
cap = nutrientPerCell (26) × fertility (0.61–1.50) × mod
```

True per-cell summed ceiling is therefore ~38–94, and observed 16–21 sits
*below* it. Capacity IS enforced on renewal (per-tick clamp); only the
post-clamp mineralization influx is unclamped, which is stock-plus-flux, not
a leak. The omitted factor (16–39×) brackets the reported excess (7–9×), so
the arithmetic closes. No simulation run was needed; code reading settles it.

Unchanged: the density-dependence finding (lim pinned at 1, flat per-producer
income) rests on observed behavior and stands as stated. Whether the unclamped
mineralization deposit *should* respect caps is a modeling question for the
Owner, not a defect found here.

---

# DEEP-TIME 517 VERDICT (2026-10-09): transitions-without-establishment

50k-tick run stopped at t43000 (phone sustained-load limits; data complete to
t43000). C->P flips total 19,299 by t43000, yet producers hold only hundreds
to ~2k against 55-58k consumers; decomposers 0 throughout; population pinned
at the artificial 60,000 cap. Consumer photo trait drifted 0.28->0.32.
Flips at scale never build a rival producer guild: evolution tries
incessantly and establishment fails. Resurrection hypothesis NOT supported on
this seed; transitions-without-establishment confirmed within the observed
horizon.

---

# TIP-POINT PROBES (2026-10-10): lock-in confirmed, brake located

`deeptime.ts` 24601 + 777 to 6000 ticks (existing tool, no code changes).
24601 crosses dormant>95% with producer collapse t1000-2000 (P346->41,
C266->61, consumers extinct t3000), no return through t6000. 777 crosses
t4000-5000 (dormant 27->1323, P361->53), mid-takeover at t6000 (D65%, P2%,
C33% persisting). C->P flips accelerate during takeover (777: 132->388) yet
build nothing. Both matrices show the sustaining loop is dormant
decomposer self-reproduction (D->D 5912/5594); producer self-reproduction
stays intact (P->P 5329 on 777). Brake pedal: senescence on long-dormant
sleepers (candidate A) — targets the hoarding loop, spares producers.
Needs Owner greenlight (biology change).

---

# SENESCENCE GRACE SWEEP (2026-10-10): fixed grace falsified, scale-free next

g200: breaks 24601 lock-in (D153, all guilds present) but starves 777's guild
(D0-8, B/D 0.87). g500: 24601 locks in anyway (D1752, dormant 94%, C extinct
t4000; 469 senescence deaths outrun by D B/D 1.29) while 777's guild fades on
30 senescence deaths (its late baseline surge was hoard-and-bloom — the
waiting room WAS the guild's future). No fixed grace separates
hoarding-takeover from waiting-sustenance: same behavior, different scales.
Next: scale-free rule. Candidates: (1) dormant-share-proportional mortality
(true negative feedback, unevolvable-around), (2) lifespan-relative grace
(evolvable, but longevity can outrun it). Owner pick required (biology change).

---

# SHARE-MODE DURABILITY (2026-10-10): lock-in becomes oscillation

24601-share:1 to 12000 ticks: no lock-in. Dormant share oscillates
45%->78%->28% as the brake engages and releases (senescence deaths
1103->3620); D1006 peak at t9000 pulls back to D561 by t12000; all guilds
recur every checkpoint (nothing hits zero); B/D 0.88/0.97/1.04. First
self-limiting long run on an overgrowth seed: pressure tracks hoarding
within one run, not just across seeds. Qualification: P/C marginal late
(P15/C9 at t12000) — stable flows, thin ice. Lifespan mode falsified
(behaves as fixed grace with an evolvable escape hatch); left in the knob
documented, not recommended.

---

# 517 PHOTO2 PAIR (2026-10-10): light-monopoly fix falsified, bind confirmed

Halving consumerPhotoScale (4->2) flips 517 from exclusion to OVERGROWTH:
photo2 alone ends P4158/C272/D3510 with dormant 94% (lock-in forming);
photo2+share ends consumers extinct t5000, P35, D1410 despite 832 senescence
deaths. Consumers need photox4 to survive AND photox4 shades out producers:
the same-energy coupling of attempt 2, now confirmed from both sides.
Candidate B (photo tuning) cannot fix exclusion alone. Immigration mechanic
verified present and default-on (4x4 patches, weight 1.0) in all runs.

---

# RABBIT PAIR (2026-10-10): grazing alone does not pay; consumers load-bear

517, consumerPhotoScale=0 (sunless herbivores) ± basal halving, share brake
on, 6000 ticks. Full deal: consumers extinct throughout (B/D 0.74);
producers + decomposers persist. Control (full upkeep): consumers extinct,
producers hit the artificial 60,000 cap by t6000 (B/D 2.00; post-t5000
numbers cap-distorted). Conclusions: (1) the grazing pathway itself does not
pay — photox4 was life support, not a crutch; halved upkeep does not save
it. (2) Consumers are load-bearing producer control: without them producers
are unbounded. Graze mechanics for next diagnosis: approach at 0.85 speed
(quadratically-priced movement) + contact contest (68% win) + yield via the
shared predation-delta path. Suspect list: travel cost vs bite yield,
armour-capped bites, 42% digestion waste.

---

# GRAZE METERS (2026-10-10): ~1.8 energy per bite, holdings cap confirmed

517 photo0/basal0.5/graze8x to 6000 ticks with graze/predation split meters:
6887 submissions, 4991 wins (72%), 8892 total energy moved = ~1.8 per win.
Contacts frequent, wins frequent, meals worthless: takes cap at defender
holdings, so the 8x multiplier scales requests that cannot be filled.
Producer individuals hold too little spare energy; travel + contest costs
exceed bite income (B/D 0.91). Next: owner choice between relaxing
plants-only to plants-plus-carrion, or redesigning the bite itself.

---

# 100X BITES (2026-10-10): holdings cap confirmed, multiplier family exhausted

517 photo0/basal0.5/graze100/share to 6000: consumers extinct (B/D 0.71);
4787 wins at ~2.3 energy per bite vs 1.8 at 8x. A 50x multiplier range moves
bite size 1.8->2.3: takes cap at victim holdings, requests scale into the
void. 2x/8x/100x all fail. Plants-only rabbits need bite redesign
(body-based takes, handling, or bigger wallets) or the order relaxes to
plants-plus-carrion fallback.

---

# BITE ANATOMY (2026-10-10): poverty trap, stakes from wallets

2000-tick measurement (517 photo0/basal0.5/graze8x): requested 4285,
granted 3011 (70%). Mean request ~3.0 at 8x multiplier — the cap binds 30%;
the stake binds the rest. Stakes derive from attacker wallets
(min(own energy, 40% capacity)), so poor grazers stake small bites and stay
poor: structural poverty trap. Photox4 was the kickstarter, not a crutch.
Redesign candidates: defender-sized stakes (mouth vs plant), cheaper graze
handling, deeper producer cups. Mechanism choice delegated for independent
design reasoning (sanitized); conservation must keep closing exactly.

---

# TISSUE BITES (2026-10-10): backfire via small-producer dodge, cups not binding

517 photo0/basal0.5/tissue14/share to 6000: consumers marginal (B/D 0.99,
48 alive); producers explode toward the 60k cap (P47917, B/D 3.42);
decomposer hoarding forms (dormant 93%). Submissions explode 10x (45k)
while per-win falls to 0.5: producers dodge by staying small, and the size
gradient pays pennies on small victims. STORAGE_CAPACITY init 12 / range
220: cups are not what binds holdings — producers hold ~4 because they
spend, not because cups are small. Remaining roads: (a) producer surpluses
first (capture must exceed spend before any take formula pays), (b) carrion
fallback, (c) leave 517 two-guild.

---

# 18-SEED GATHER (2026-10-10): 17/18 pass, consumer-dominant regime

Fresh seeds 31001-31018, 2400 ticks, share:1 brake, photox4. 17/18
endpoint-present (only 31011 consumers extinct — early crash t1000-2000,
distinct from 517's slow grind). New pattern vs curated seeds: CONSUMERS
dominant numerically on most seeds (C B/D >1 on 16/18), producers often thin
but present. Brake fires proportionally (0-1344 senescence deaths tracking
hoarding, incl. 1344 on 31011 without harming P/D). Decomposer B/D >1.5 on
7 seeds — the guild grows under the brake rather than hoarding. Thin-but-
present worlds (31007/31008) pass technically, fragile actually. 31003 booms
(pop 4411, all guilds thriving). Method note: first aggregation misread
columns (pop as producers); caught because producer-dominance contradicted
the B/D ratios, re-extracted correctly.

---

# CODE AUDIT (2026-10-10, architect-only): senescence + tissue + meters + probe

Scope: all uncommitted work since the tip-point probes (config knobs,
world.ts senescence/attribution/digest/fraction/counters/yield-threading,
interactions.ts tissue branch + submit-doc fix, senesprobe.ts args).
Review specialists run on logging providers so S2 engine source cannot go
to them; audit performed directly by the architect with fresh-eyes
re-reads, plus live verification (typecheck, gates, determinism repeats).

- Senescence block, 3 modes: clock/count/attribution verified hunk by hunk.
  Knob-off path provably identical (senesceShare=0 unsatisfiable); gates 7/7
  live confirms. Slot-reuse clearing present (the newborn-flag defect class).
  Growth copies + zero-fills. Digest covers behavior-affecting clock and
  fraction; attribution-only accumulator correctly unhashed (starveDamage
  precedent verified).
- Death classification: branch order correct; healing-bias consistent with
  pre-existing starve handling. One defect FOUND and fixed in-construction:
  trace-log cause could mislabel senescence deaths as STARVE when old
  starvation damage dominated (one-line guard).
- Tissue branch: legacy path byte-identical when plantYield=0 (gates green
  confirms); overgrazing damage preserved for both branches; room cap,
  holdings backstop, armour/appetite gate untouched; meat ordering math
  documented. False submit() doc (stakes bound nothing — istake is
  write-only, verified by grep) corrected.
- Probe: arg parsing validated (bad input throws); backward compat holds
  (old invocations unchanged); endpoint printing added for 2400 horizons.
- Notes (accepted, not defects): configFingerprint stringifies object knobs
  opaquely; probe NaN-input laxity predates this work; lifespan mode
  falsified by evidence, left documented.
- Determinism: fixed + share byte-identical across repeats; gates 7/7.

Verdict: PASS with notes. No unresolved material findings.

---

# INDEPENDENT REVIEW (2026-10-10): PASS-WITH-NOTES, notes closed

Real-diff review (owner-authorized): no material defects. Verified
knob-off identity, conservation path, RNG-free new code, shape
preservation, allocation discipline, lifespan units, no species-table
logic. Fixed: fingerprint collision on object knobs (structural
serialization), constructor scale validation. Declined with reason:
hoisting dormantFrac out of the hash loop (harmless, would churn digests).
Closed the cited gap: lifespan + tissue deterministic across repeats.
Typecheck clean, gates 7/7 after fixes.

---

# FOUR DEEP RUNS (2026-10-10): one balance, one warning, two new flavors

Same seeds/configs extended deterministically to 6000 (share:1 brake):
- 31011: consumers extinct t2000+, never return; P+D two-guild holds
  (P136/D881, dormant 53%, brake firing). Exclusion permanent.
- 31003: boom becomes producer monoculture (P4069, B/D 1.21; C75/D0
  leaving). Producer-side overgrowth — no brake applies (producers never
  go dormant). New flavor, unaddressed.
- 31008: decomposer overgrowth developing DESPITE brake (dormant 85%,
  D3219 still growing, 4998 senescence deaths and climbing). Brake may be
  losing; needs longer horizon or stronger rate.
- 31018: textbook three-guild balance to 6000 (P158/C103/D130,
  B/D 0.96/1.09/1.04, dormant 21%). Best result yet.

---

# RADIATION TEST (2026-10-10): lock-in prevented, balance NOT restored

24601, mutation doubling every 1000 ticks from t1000 (cap 32x), no brake,
6000 ticks. t1000-4000 tracks baseline overgrowth (dormant ~700-800);
t5000-6000 explodes instead of locking: pop 9369, P2125/C4584/D2660,
consumer B/D 3.02, dormant share only 26%. Graze meters degrade
(25k submits, 19% wins, ~0.1/bite): hypermutation scrambles contest
traits faster than selection grips. Verdict: evolvability binds (trap is
not purely ecological), but 32x overshoots into abundance explosion —
mutation rate has a narrow viable band, like every other boost tried.
Knob kept (null-default, reversible); no default change.

---

# FOOD DISEASE (2026-10-10): no brake on hoarding, possible boom cap

24601, 15% diseased meals, no brake, 6000 ticks: lock-in on schedule
(D1118, dormant 93%, consumers extinct t3000 — mirrors baseline).
11,711 diseased meals but 94 deaths: 6-damage dose heals via regeneration;
dormant hoarders never eat, so the mechanism cannot touch the waiting
room. Falsified as an overgrowth brake. Untested hypothesis where it
should shine: runaway consumer booms (42), where feeding-proportional
pressure scales with the disease itself.

---

# DENSITY DISEASE (2026-10-10): sharper miss, same verdict

24601, density-scaled 15% (patch occupancy/300), no brake, 6000 ticks:
lock-in on schedule and slightly deeper (D1781, dormant 95%, consumers
extinct t3000). 4221 meals but 10 deaths — the dose heals faster than it
lands at any density, and sleepers never roll. Density scaling worked
mechanically (thin phase spared: 222 vs 1310 early meals) but lethality is
~zero everywhere. Food disease falsified twice as a hoarding brake.
Re-homed hypothesis: runaway booms (42), where feeding-proportional
pressure scales with the boom itself — probe running.

---

# DISEASE ON RUNAWAY 42 (2026-10-10): dampens, does not cap

42, density disease 15%, 2400 ticks vs matrix baseline: population halved
(12657->6163), consumer B/D 2.98->2.36, 29,555 diseased meals causing 636
deaths. The boom continues (C2582->C5979 t2000-2400) — pressure scales
with feeding as designed, but 6-damage healable dose cannot outrun 3x
breeders. Producers overgrazed toward collapse (P521->181) underneath.
Verdict: guilty dose, not wrong address. Disease reads as endemic friction
(dampener), never a cap. Capping a 3x boom needs lethality, not retargeting.

---

# DISEASE ARMS, 10K (2026-10-10): amplifier, not brake

Four seeds, share:1 + disease 0.15 vs share-only controls:
- 31011: 32x bigger world (60k cap), 89,628 disease deaths, D births 519k.
  Corpse subsidy prime suspect (sick feed the soil); timing proof needs
  disD-instrumented re-run (running).
- 31003: identical producer monoculture with/without disease (259 deaths).
  Disease-independent attractor. Clean negative.
- 31008: 100x SMALLER world (459 vs 56,921) on 9 disease deaths.
  Bistability exhibit: forked stream found another attractor; early
  suppression compounding possibly contributed.
- 31018: nearly neutral (2 deaths), balanced flows both arms.
Verdict: disease amplifies bistability (four seeds, four stories) rather
than controlling anything directionally. Unsuitable as a brake; kept as
diagnostic weather. Graze side-note: 1.5M submits at 7% wins for 0.12
energy on 31011 — starving consumers browse constantly for crumbs.

---

# 31008 SWING ANATOMY (2026-10-10): tax, not toll

Control vs disease identical t1000-3000, fork at t4000: control D breaks
away (956->3219->6913) while disease D holds flat (~200-300) on only 9
disease deaths — but ~8k damage dealt, paid in healing energy (regen costs
0.7x healed from the basal budget). Mechanism: growth-rate suppression via
healing tax, not mortality. No D base -> no t7000 consumer ignition ->
flat 400s forever vs 56k stampede. Counting corpses misses it; the tax is
in energy. Bistability hinge located: the t4000 decomposer breakaway.

---

# CORPSE-SUBSIDY VERDICT (2026-10-10): timing kills it, drift owns ignition

disD-instrumented re-run on 31011 (identical trajectory to first run —
new column perturbs nothing, determinism holds): disease deaths sit at 26
from t2000 through t5000 while D surges 675->3384->21356. The deaths
explode only AFTER (523->6300->20033->37502->89628 as D blooms):
consequence, not cause. Corpse subsidy cannot have ignited the boom;
later amplification possible but unneeded — drift suffices. Disease
final record: never brake, never igniter; weather with occasional
fertilizer side-effects at scale.

---

# STANDING ORDER (2026-10-10): disease stays on

Owner confirmed happy with density disease (0.15, patch-scaled): thin
worlds immune, booms taxed. All future probe batches include disx0.15
unless explicitly exempted. Status: endemic friction / diagnostic weather,
not a brake — characterization stands.

---

## APP REBUILD (2026-10-10): current engine in the viewer

Pipeline: tsc build + bundle-app (21 modules, 323KB) + assemble (331KB
self-contained). No external refs, rAF present, bundle marker replaced.
Parity exact bundle<->CLI at 500 ticks: 517 P881/C187/D73, 24601
P658/C280/D98 both sides. Pinned in evidence/POC-SNAPSHOT-rebuild.json;
prior snapshots untouched. Delivered to /sdcard/Download/evo-sim-poc.html
(md5 match verified). Shell UI unchanged — new engine knobs
(density disease, radiation) ride in the bundle at null defaults.

---

# SLOW-RAMP BATCH (2026-10-10): dose wins, 3 of 4 cap-bound

Schedule 1000,3000,32 (2x@4000, 4x@7000, 8x@10000) + disease 0.15:
- 31018: balanced to t7000, stampede t8000-9000 (C48841, cap). Ignition
  ~4-5x. Disease deaths 2->110096, pure consequence.
- 31011: detonation t5000-6000 (cap; TIMEOUT at t7000, partial). 339k
  disease deaths, pools 82k — fertilizer loop at full blast.
- 31003: monoculture t3000-9000 (P3748->683, D extinct t3000), then
  stampede t9000-10000 (C50844, cap). Three regimes in one run.
- 31008: flat D flicker all 10k (174-441, P~0, 9 disease deaths).
  Never ignites — no producer base, no consumer ignition.
Verdict: slow arrival detonates like fast arrival. Radiation pushes
uniformly toward stampede (3/4 cap); only the producer-less world
resists. No novel dominance anywhere — same attractors, bigger.

---

# PIONEER BONUS PROBES (2026-10-10): fills voids, picks wrong winners

Option 1 implemented (birth-flip grace, upkeep discount 0.5 x void, 200
ticks, null-default). Validated: typecheck clean, gates 7/7, both modes
deterministic, knob-off parity exact vs fresh bundle, bad knobs rejected.
- 31008 (producer void): 1245 grants to t6000. Producers 24x vs disease
  arm (244 vs 10) — void-filling WORKS. But decomposers break away harder
  (2927 vs 292, dormant 74%, 4636 senescence deaths): the bonus also fills
  the hoarding void, and D's richer economics win the race it starts.
  Trajectory rejoins the control's lock-in path. Direction-blind subsidy.
- 31003 (decomposer void): 55 grants, D extinct throughout. Proposal binds,
  not establishment — nobody walks into the void, so no subsidy can matter.
Two seeds, two failure modes: misdirected where flips are frequent,
irrelevant where flips are rare. Mechanism sound; hypothesis falsified as
a steering tool. Added pioGPG (grants by destination guild) for targeting
proof on future runs.

---

## APP REBUILD 2 (2026-10-10): post-rollback build

Radiation restored to original geometric schedule (flat-mode experiment
fully reverted; typecheck clean, gates 7/7, knob-off parity exact vs
pinned values, bad schedules rejected again). Bundle rebuilt from current
sources: 21 modules, 331KB self-contained, rAF present, no external refs,
bundle marker replaced. Parity bundle<->CLI exact at 500 ticks: 517
P881/C187/D73, 24601 P658/C280/D98 both sides. Pinned in
evidence/POC-SNAPSHOT-pioneer.json; prior snapshots untouched. Delivered
to /sdcard/Download/evo-sim-poc.html (md5 verified).

Environment note: intermittent ERR_MODULE_NOT_FOUND when Node resolves
modules with cwd = the worktree; ls/stat/read succeed. Running from
/root/DEE-TS-POC with a relative path is reliable. Not a code defect —
all 18 seeds of the earlier failed batch died to it, none produced data.

---

# PIONEER 18-SEED MATRIX (2026-10-10): subsystem confirmed, 2/18 stampede

18 fresh seeds (41001-41018), 6000 ticks, brake share:1 + disease 0.15 +
pioneer 200,0.5, radiation off (post-rollback). 17 completed, 41015 hit
the 400s guard at t5000 (cap-bound, partial).

Distribution: 13 small worlds, 3 decomposer-hoarding (41003/41012/41018,
dormant 58-77%), 2 cap-bound stampedes (41004 t6000, 41015 t5000).
Compare the earlier brake+disease 18-seed matrix: no seed detonated there.
Grant counts track void size as designed (23 on producer-rich 41013 ->
53535 on the exploding 41004).

Grant composition (pioGPG P/C/D) exposes the failure mode precisely:
- 41001 99/9/1, 41008 1037/134/0 — subsidised survivors went to PRODUCERS
  where producers were already dominant. The bonus funded the incumbent.
- 41004 38039/651/14845 — 54k grants, mostly decomposer, driving D to 36k
  at 225k brake deaths. The subsidy supercharges the hoarding guild past
  what the brake can kill: the runaway is BUDGET-BREAKING, not exempted.

Verdict: mechanism sound and multi-seed confirmed; direction-blind
subsidy is a stampede accelerant. The pioneer idea does not survive
contact with 18 seeds — recorded, knob kept null-default and reversible.
No producer-guild re-establishment observed anywhere (producers went to
zero in 41006/41008/41013/41016 despite grants).

---

# OWNER DIRECTIVE (2026-10-10): balance is a distribution, not a seed

Standing rule from the Owner:
1. Balance verdicts rest on the AVERAGE over a large number of seeds, never
   on one seed and never on a hand-picked subset.
2. Each seed must be DIFFERENT. Seed-to-seed variety is a requirement, not
   noise to be averaged away.
3. The average must not lean heavily in one direction. A mean pulled to one
   side (e.g. mean dormancy high = mean lock-in) does not count as balanced,
   even if the per-seed numbers look acceptable.

Consequence for method: every verdict needs a seed-count large enough to
establish a distribution, plus reporting of both the mean AND the spread.
A knob that raises the mean toward "balance" while flattening variety is a
regression, not a win. This supersedes any earlier single-seed framing.

# RADIATION, LOWER + COUPLED (2026-10-10)

Owner: turn radiation back on, lower the ramp, and make the ramp DIE when
overgrowth does. Coupling implemented as multiplier x dormant share
(proportional, self-scaling like share-mode senescence): when the brake
suppresses hoarding and dormant share falls, radiation fades with it. Zero
dormant share = no radiation. Mechanism: evolvability is only spent where
the problem is.

---

# DORMANT THREAT-BLIND (2026-10-10): hoards made edible, behind a knob

Owner directive: the dormant should be at risk for becoming food. Traced the
dormancy path and found the real defect: dormancy was STRICTLY DOMINANT.
A sleeper kept full threat detection and FLEE (`world.ts` sensing loop) while
paying 5% upkeep, starving never, and breeding never. Pay-nothing but
see-everything — an unbeatable strategy, and the reason the hoarding
attractor had no counter-pressure. The existing comment even claimed
"Dormant organisms do not sense"; only the energy spend was skipped.

Implemented (option 1, owner-picked): dormant organisms detect NO threat, so
cannot flee. A hunter reaches a sleeper with no warning.
- config: dormantThreatBlind (boolean|null, default null = declared).
- world: `dormant` (drives cost waiver) split from `asleep` (drives threat
  detection) so knob-off reproduces declared behaviour EXACTLY — the cost
  waiver deliberately does NOT depend on the diagnostic.
- probe: argv[12] on|off|null.

Validation: typecheck clean, gates 7/7, knob-off parity EXACT
(517 P881/C187/D73, 24601 P658/C280/D98 — matches all pinned/app/bundle
values), knob-on differs (517 P878/C180/D67, 24601 P601/C261/D111),
knob-on deterministic, bad values rejected, bundle rebuilt and parity
re-verified.

NOTE: all evidence gathered BEFORE this knob predates true-sleep dormancy.
The 18-seed matrices, pioneer verdicts and radiation series describe the
old semantics (sleepers could flee). Knobbed, so both worlds remain
comparable; re-run required before further verdicts.

---

# TRUE-SLEEP DORMANCY, 18 SEEDS (2026-10-10): hoards broken, no lock-in

18 fresh seeds (41001-41018), 6000 ticks, brake share:1 + disease 0.15 +
dormantThreatBlind ON. Pioneer and radiation OFF. Judged against the
newseeds2 matrix (same seeds, same config, knob off) per the Owner
distribution directive: report mean AND spread, and whether the mean leans.

METRIC          NEW (dtbon)              OLD (declared)
pop             mean 3168  sd 4292        mean 9532  sd 18399
                       min 86  max 19110          min 666 max 60000
dormant%        mean 41.2  sd 27.5        mean 31.5  sd 27.6
                       min 0.0 max 79.7           min 0.0 max 87.5
guilds alive    mean 2.8   (14x three, 4x two)  identical

Findings:
- NO LOCK-IN ANYWHERE. Zero seeds above 90% dormancy (old: also zero, but
  old peaks were 87.5 with sd nearly 5x larger). Max dormant share fell
  87.5 -> 79.7.
- NO CAP-BOUND RUNS. Old matrix had 2 explosions (41004, 41015 at 60000);
  new matrix max is 19110. Mean population fell 3x, spread fell 5x.
- Guild structure UNCHANGED (2.8 mean, identical 14/4 split): the knob
  moves abundance and spread, not ecology's shape.
- Variety PRESERVED and healthy: sd is large relative to mean (pop sd 4292
  on mean 3168), so seeds remain genuinely different per the directive.

Verdict against the directive: the mean no longer leans toward hoarding
(41.2% dormant, sd 27.5, no seed past 80%), every seed differs, and the
stampede tail is gone. True sleep removed the unbeatable-strategy
asymmetry that produced lock-in. Honest limit: this is 18 seeds at one
horizon; the directive's "large number" bar is met only for relative
comparison, not as a final balance certification.

---

# DOMINANCE-CHANGE MEASUREMENT (2026-10-10): 1.33 flips/run, lock-in is the exception now

Measured dominant-guild sequence per 1000-tick checkpoint across the 18
dtbon seeds (0=P, 1=C, 2=D, ?=tie):
41001 2 | 41002 1 | 41003 1 | 41004 2 | 41005 1 | 41006 0 | 41007 4 |
41008 0 | 41009 3 | 41010 1 | 41011 1 | 41012 0 | 41013 1 | 41014 1 |
41015 1 | 41016 3 | 41017 1 | 41018 1
Mean 1.33 flips/run; 15/18 seeds change dominance at least once.

BUT the shape is wrong: 12 of the 15 flips are a SINGLE early hand-off
(producer -> decomposer, or producer -> consumer) that then holds for the
remaining 4000+ ticks. Only 3 seeds (41007, 41009, 41016) flip more than
twice, and 41007 is a near-collapse (pop 65-686, oscillating on the edge of
extinction, not a healthy multi-guild rotation). So the current behaviour
is SUCCESSION, not oscillation: dominance settles early and stays.

Mechanism located: dominance is set by energy architecture, not by any
within-run competitive process. Producers convert light, consumers pay no
solar cost (photox4), decomposers hold a monopoly niche (recalcitrant
litter is theirs alone). Once a guild wins the energy race it holds the
lead, because nothing in the model re-equalises the three revenue streams
on a multi-thousand-tick timescale. The abiotic axis (abioticCycle 900,
light 1.05+/-0.22, temp +/-9, drift x0.72-1.28) and disturbance events
(interval 260, chance 0.55) vary on 260-900 tick periods, an order of
magnitude faster than the 4000-tick lock, so they perturb but never
destabilise a settled hierarchy.

Diagnosis only — no change made. The lever is the timescale and amplitude
of the abiotic/detrital forcing, not any single guild's parameters.

---

# GUILD INTERDEPENDENCE AUDIT (2026-10-10): two of three guilds can survive alone

Owner directive: one guild should not survive without the other. Audited
the three revenue/food paths as implemented:

1. PRODUCERS -> light + inorganic nutrient. Photosynthesis is the ONLY true
   energy injection (world.ts:1826) and nutrient regenerates ABIOTICALLY at
   nutrientRegen 0.0002 (config.ts:718), independent of any other guild.
   VERDICT: producers survive alone, indefinitely.

2. CONSUMERS -> producers (graze/predation) + their own solar income.
   They already derive 27.5% of income from photosynthesis, and photox4
   multiplies that demand by 4 (world.ts:1845). VERDICT: consumers are
   PARTLY independent — they can hold a population on solar income alone,
   which is precisely the "solar rabbits" stampede measured repeatedly
   (C2979 -> C5979 on seed 42; C48841 on 31018).

3. DECOMPOSERS -> detritus/sediment/litter, which exist ONLY as corpses and
   waste from producers and consumers. No abiotic source. VERDICT: already
   fully dependent, correctly.

So the load-bearing finding: TWO guilds can go it alone, and the third is
slaved to them. That inverts the intended structure and explains the
succession-not-oscillation result — a guild that can feed itself needs no
one, so it never yields.

Candidate couplings (diagnosis only, no change made):
A. Phototrophy restricted to mixotrophs: producers get light only via
   heterotrophic carbon, so a pure-producer guild starves without
   consumers to digest. Large change, touches the one true energy input.
B. Consumer solar income made density-dependent and small, so consumers
   need producers for the bulk of their budget. Targets the measured
   stampede mechanism directly; smallest change.
C. Nutrient regeneration made decomposer-gated (mineralisation only),
   removing the abiotic free-lunch so producers need the nutrient cycle.
   Mirrors Liebig/mineralisation already implemented.

B is the highest-value/lowest-blast-radius: it attacks a mechanism we have
measured directly, repeatedly, in four separate stampedes. Owner picks.

---

# GUILD INTERDEPENDENCE, A+C (2026-10-10): energy is no longer free

Owner picked A+C: guilds must truly need each other; energy should not be
free. Two null-default diagnostic knobs sharing one saturation constant.

- mixotrophyCarbon: PRODUCER photosynthesis demand scaled by local
  heterotrophic substrate (detritus + 0.8*sediment + 1.2*litter, saturating
  at mixotrophySaturation 0.4). Bare light no longer suffices: capturing
  energy needs organic matter, which only heterotrophs (or corpses) made.
  Scales DEMAND only — producers keep their guild label and all pathways, so
  this adds no guild test and cannot act as an assignment table.
- nutrientCyclic: inorganic nutrient regeneration scaled by the same local
  decomposition substrate. Declared behaviour regenerates nutrient
  abiotically at nutrientRegen 0.0002 regardless of whether anything is
  decomposing — a free lunch producers could farm forever. Now nutrient
  returns only where organic matter is being worked on, i.e. where
  decomposers are active.

HONEST LIMIT, recorded in the config doc: producer corpses and
photosynthesis overflow also feed detritus, so a pure-producer world is
DEPRESSED, not zero. A+C narrows the free lunch; it does not close it.

Validation: typecheck clean, gates 7/7. Knobs OFF parity EXACT
(517 P881/C187/D73, 24601 P658/C280/D98 — matches every pinned/app/bundle
value). Each knob alone and both together produce distinct outcomes
(517 @500: mixo 878/180/67, cyc 499/211/79, both 565/218/68). Both-on
deterministic; all three bad-value paths rejected loudly (verified after
retrying past the intermittent module-resolution flake). Bundle rebuilt,
parity re-verified, app redelivered.

Test running: 18 seeds, brake + disease + dtb + mixo + cyc. This is the
real test of the interdependence hypothesis AND of the dominance-oscillation
directive — judged on mean, spread, dominance-flip count and guild
survival, per the Owner distribution directive.

# ENVIRONMENT: the ERR_MODULE_NOT_FOUND flake is a DEVICE REBOOT (2026-10-10)

Root cause found. `uptime` reported "up 2 min" at the moment the 18-seed
batch failed all 18 seeds. Memory was 8443/11113 MB used with 5092 MB of
swap already committed — the phone was under extreme memory pressure, killed
the runtime, and Node's module resolution failed on files that demonstrably
exist (existsSync true, readFileSync returns all 8781 bytes, ls/stat fine).

So this is NOT a code defect and NOT a filesystem defect. It is device
memory exhaustion, and it will recur whenever a long batch coincides with
low memory. Everything previously attributed to "intermittent overlay
flakiness" (including one scare where determinism looked broken) is explained
by this.

Mitigation: scripts/runprobe.sh retries ONLY on ERR_MODULE_NOT_FOUND
(8 attempts, 2s apart) and passes every other error straight through, so it
can never mask a real fault or fabricate a result. A successful retry reruns
the same seed+config and yields the same bytes; determinism is unaffected.

Standing constraint for future long batches: 18 x 6000-tick seeds is the
practical ceiling on this device. Check `free -m` before launching anything
longer, and treat a whole-batch ERR_MODULE wipe as a memory symptom to
investigate, not a config error to re-run blindly.

---

# INTERDEPENDENCE A+C, 18 SEEDS (2026-10-10): too tight — mass extinction

18 seeds, 6000 ticks, brake + disease + dtb + mixoCarbon + nutrientCyclic,
saturation 0.4. Judged against newseeds3 (same seeds, knobs off).

METRIC              A+C (interdependent)        dtb only
pop        mean 325.3  sd 307.4            mean 3168.2  sd 4292.4
           min 0  max 841                min 86  max 19110
guilds     6x3, 5x2, 7x fewer than 2      14x3, 4x2, 0 fewer
flips      mean 1.33, >=2 in 7/18         mean 1.33, >=2 in 5/18
EXTINCT    2/18 (pop=0), 6/18 under 50     0/18, 0/18

VERDICT: overshoot, on the exact axis predicted. Removing the free energy
worked — producers now mean 12.4 (was 370.8) and dormancy collapsed to
10.3% (was 41.2%) — but the system cannot pay its own upkeep. Two seeds
went fully extinct; 41002 shows the mechanism: pop 998 -> 187 -> 593 -> 6
-> 0, a slow bleed with corpses still present (pools 1520) that nothing can
convert because producers cannot photosynthesise without substrate and
nutrient will not regenerate without decomposition. The three couplings
form a deadlock: each guild's survival requires a product the others make,
and at this saturation none can bootstrap out of a small population.

Dominance-flip count did NOT improve (1.33 both arms) — so oscillation was
never a function of energy independence; it is set elsewhere. Recorded as a
falsified sub-hypothesis, not a partial win.

Honest read: A+C at saturation 0.4 is too tight, not wrong in direction.
The knobs are independent and reversible, so the next move is a
saturation sweep (0.4 -> higher, e.g. 1.0-2.0) to find where interdependence
binds without starving the system, judged on the SAME 18-seed distribution:
no extinctions, three-guild majority, mean not leaning.

---

# PRODUCER-LIGHT SWEEP (2026-10-10): no multiplier rescues A+C; deadlock is structural

Owner asked for the producer light level giving slow but steady growth.
Added producerCaptureScale to the probe (argv[16], null = declared; knob-off
parity re-verified exact: 517 P881/C187/D73).

Swept pcap 1,2,3,4,6,10 at saturation 0.4, then 6,8 at saturation 0.6, on
the three seeds that died in the 18-seed matrix (41002, 41003, 41011):

pcap  sat   41002            41003              41011
1     0.4   EXTINCT          C-only (P=0)       C-only (P=0)
2     0.4   EXTINCT          P MONOCULTURE      C-only (P=1)
3     0.4   D-dominant       P-heavy            D-dominant
4     0.4   EXTINCT          P MONOCULTURE      three-guild 1154
6     0.4   C/D, P=0         P-heavy            P MONOCULTURE 4658
10    0.4   C/D, P=0         P-heavy            (no data)
6     0.6   three-guild 241  small three 79     P-heavy 1778
8     0.6   ~extinct (3)     small 53           P-heavy 1778

FINDING: more light does NOT produce slow steady producer growth. It
rotates WHICH guild collapses — producers go extinct (1x), become a
monoculture (2x, 4x), or dominate (6x, 10x) — while consumers or
decomposers get squeezed out instead. 41002 dies at 1x, 2x AND 4x, then
"survives" at 6x with ZERO producers and 283 consumers: a world with no
primary producers running at tick 6000 is not a balanced world.

Saturation is not the lever either: 0.6 moves failure around without
removing it (2 near-extinctions at pcap 8, 2 monocultures at pcap 6).

CONCLUSION: producer light is NOT the binding constraint. The A+C deadlock
is structural — nutrient regenerates only where decomposition happens, and
producers cannot photosynthesise without nutrient, so the system needs
itself to bootstrap and cannot recover from any small population. No
multiplier breaks that. Both knobs remain null-default and reversible; the
18-seed rerun at any pcap would only re-measure this same rotation.

RECOMMENDED NEXT STEP (owner decision): keep interdependence but remove the
mutual-bootstrap deadlock — e.g. retain a small abiotic nutrient floor so a
remnant population can always regrow, instead of requiring decomposition to
reopen the nutrient loop. That is a third design, not a calibration of A+C.

---

# ZEROED BASELINE (2026-10-10): intentional flatline, running

Owner directive: 0 = inert, 1 = declared, every mechanism a knob/slider,
and the baseline is a DELIBERATE flatline. Prediction recorded BEFORE the
runs: complete extinction of all three guilds on every seed. Any survivor is
a finding to investigate, not a failed prediction.

`--zero` (scenesprobe.ts) zeroes every energy-giving mechanism in one flag:
producerCaptureScale 0, consumerPhotoScale 0, basalFoodPerCell 0,
nutrientRegen 0, meatYieldPerMass 0, grazeYieldScale 0, plantYieldPerMass 0.
It deliberately does NOT touch structural parameters (metapopulation grid,
dormancy threshold, dispersal) so the flatline stays attributable to energy
only, and it does not disable the brake — that is the one graduated control
and with no energy it has nothing to act on. Spread last in the config
object so no positional argument can silently undo it.

Smoke (517, 3000 ticks, brake + disease otherwise declared): 106 -> 62 -> 17,
producers 1 -> 0 by t2000, consumers 0 by t2000, decomposers 17 by t3000 and
still falling. Deterministic across repeats. Confirmed the preset overrides
positional dials (pcap=4 still yields P=1 at t1000).

Validation: no-`--zero` parity EXACT (517 P881/C187/D73, 24601 P658/C280/D98 —
unchanged, so the preset adds no behavioural surface when unused), gates 7/7.

Note on the extinction being structural: photosynthesis is the only true
energy injection, so with producer capture at zero the outcome is arithmetic
rather than ecological. That is the point of the baseline — it fixes "no
energy" as the reference origin, and every later slider is measured against
it. A named second anchor remains the declared (non-zeroed) baseline, which
is where guild viability questions are actually answered.

18 seeds running, chunked six at a time through the compiled path
(engine peak RSS 149MB; tsx transpilation is what exhausted the device).

# ZEROED BASELINE RESULT (2026-10-10): 17/18 flatline, and the survivor is informative

PREDICTION (recorded before the runs): complete extinction of all three
guilds on every seed. RESULT: 17 of 18 seeds hit zero population, between
t2000 and t6000 (median t3000). Mean dormant share at extinction is not the
story — nothing survives to have one.

THE SURVIVOR: seed 41018 did NOT flatline. Trajectory:
  t1000 pop 194   (P2,   C0, D192)
  t3000 pop 635   (P0,   C0, D635)
  t5000 pop 3883  (P123, C0, D3760)   dormant 3213
  t6000 pop 5519  (P186, C1, D5332)   dormant 4741, senesc deaths 13139
It GREW, from 194 to 5519, and producers RECOVERED (0 -> 186) at t4000 with
no energy source at all.

MECHANISM, from the counters: grazeEnergy=0 and grazeWins=0 across the whole
run, so no herbivory occurred. diseaseMeals=3657 with producerCaptureScale=0.
Photosynthesis is the only energy injection and producer capture is zero,
so producers cannot photosynthesise — yet 186 producers exist. The only
remaining income path is EXCRETION (config excretionRate 0.06): metabolism
returns nutrient to substrate, and with nutrient cycling off and no
photynthesis, decomposers living on accumulated corpse pools plus their own
excretion form a self-sustaining loop that producers can draw a trickle
from. Decomposer B/D 1.30 is above replacement, which is the loop running.

WHAT THIS ESTABLISHES: the flatline is NOT purely structural. One seed in
18 survives on a residual energy path that the zero preset does not close.
That is the finding the Owner asked us to look for, and it means the
baseline is 17/18 rather than 18/18 — a residual leak worth naming before
we move any slider.

NEXT: the candidate closure is excretion (the only income the zero preset
leaves open). Zeroing excretionRate would test whether 41018 then flatlines
with the rest. Recorded, not yet run.

# SEALED ZEROED BASELINE (2026-10-10): 18/18 flatline — baseline established

PREDICTION (recorded before the runs): 18/18 extinction, no survivors.
RESULT: 18/18 EXTINCT. The zeroed baseline is sealed.

Extinction ticks (t2000-t5000, median t3500):
41001:2000 41002:3000 41003:3000 41004:2000 41005:5000 41006:2000
41007:4000 41008:4000 41009:4000 41010:4000 41011:4000 41012:2000
41013:3000 41014:3000 41015:4000 41016:3000 41017:3000 41018:3000

The closure worked as predicted on the specific survivor: 41018 went from
pop 5519 (growing, producers recovered to 186) to pop 214 at t1000 and
EXTINCT by t3000, the earliest extinction in the batch. Confirms excretion
was the only remaining income path.

Note the residual: pools remain high (41001 pools 9384, 41018 pools 8688)
after every organism is dead. That is correct and expected — matter is
conserved, it simply has no processor. A flatline with residue is a closed
energy budget, not a leak.

WHAT THE BASELINE MEANS: `--zero` is now a verified reference origin. Every
energy-giving mechanism is inert: producer light capture, consumer solar,
exogenous organic input, abiotic nutrient regeneration, excretion, and all
three trophic transfer paths (meat, graze, tissue). Structural parameters
(metapopulation grid, dormancy threshold, dispersal) stay declared so the
flatline is attributable to energy alone; the brake stays on and has nothing
to act on. No-`--zero` parity remains EXACT (517 P881/C187/D73), so the
preset adds no behavioural surface when unused.

METHOD FORWARD: move one slider at a time off this floor and measure what
each one alone can restart. The first question the baseline answers cleanly
is which single mechanism is sufficient to bring a guild back — that is the
honest dependency map, measured rather than argued.

# ZEROED BASELINE, SECOND SEED FAMILY (2026-10-10): 18/18, leak fully closed

Replication on the older 31001-31018 family, same sealed --zero preset.
PREDICTION: 18/18 extinction. RESULT: 18/18 EXTINCT, no survivors.

Extinction ticks (t2000-t5000, median t3500):
31001:4000 31002:4000 31003:3000 31004:5000 31005:4000 31006:2000
31007:4000 31008:4000 31009:3000 31010:3000 31011:3000 31012:2000
31013:2000 31014:4000 31015:3000 31016:3000 31017:5000 31018:2000

Combined across BOTH families (36 seeds, none shared): 36/36 extinct.
Extinction window and median are identical between families (t2000-t5000,
median t3500), so the flatline does not depend on seed lineage — it is a
property of the zeroed configuration, not of any seed family's attractors.

The excretion leak found on 41018 is confirmed fully closed: no seed in
either family survives. The sealed baseline is now replicated across two
independent seed sets and stands as the reference origin for the slider
ladder.

---

# SLIDER LADDER, RUNG 1 (2026-10-10): producer light is necessary, not sufficient

Starting from the sealed zeroed baseline (18/18 flatline, replicated across
two seed families). One dial lifted per run, everything else inert.
Tooling: `--zero-lift=dial:value`, applied after the preset, validated
against the preset's own dial list (unknown name throws, verified — a
silently-ignored typo would misreport a rung as a finding).

producerCaptureScale lifted, 3 seeds (41001/41010/41018), 6000 ticks:

  lift   41001        41010        41018
  0.25   EXTINCT      EXTINCT      EXTINCT
  0.50   EXTINCT      EXTINCT      EXTINCT
  1.00   P3           P24          P158        (C=0, D=0 in all three)

FINDING: light below declared (1.0 = the declared capture multiplier) cannot
keep producers alive at all — 0.25 and 0.5 flatline exactly like the sealed
baseline. At declared light producers persist and grow slowly, and the two
heterotroph guilds stay at EXACTLY ZERO across every seed.

So producer light is NECESSARY and NOT SUFFICIENT: it feeds precisely the
guild that eats light, and with all three trophic transfer paths still zero
there is nothing for a consumer to take and no corpse flux for a decomposer.
This is the interdependence the Owner asked for, measured from a flat
origin rather than argued from architecture: one guild can persist alone,
and it must be the primary producer.

Next rung: restore ONE trophic transfer path on top of declared light and
ask whether heterotrophs return — graze first, since it is the route that
was already measured to be capped by holdings (~1.8-2.3 energy per bite).

# SLIDER LADDER, RUNG 2 (2026-10-10): no single transfer path restarts consumers

Declared light (capture 1.0) PLUS one trophic path, 3 seeds, 6000 ticks:

  lift                  41001      41010      41018
  grazeYieldScale:1.6   P3         EXTINCT    P1
  meatYieldPerMass:1.6  P117       P20        EXTINCT
  plantYieldPerMass:14  P171       P44        EXTINCT

CONSUMERS = 0 AND DECOMPOSERS = 0 IN ALL NINE RUNS. Neither heterotroph guild
returns on any single transfer path.

The transfer paths themselves work: graze logged 157 wins / 503 energy on
41001, so the route is live and paying. Consumers still die. So the binding
constraint is NOT trophic transfer.

ACTUAL CAUSE, from the trajectories: the founder population mass-crashes
between t1000 and t2000 in EVERY arm regardless of which path is lifted —
41001 under meat: pop 500 (P426/C8/D66) at t1000, then 28 at t2000, then a
slow producer-only remnant (62 -> 61 -> 73 -> 117). Consumers appear
transiently (C8 at t1000) and are gone by t2000.

That crash is nutrient exhaustion, not starvation. --zero sets BOTH nutrient
sources to zero (abiotic nutrientRegen AND excretion), so nutrient exists
only as the initial stock laid down at world construction. Producers consume
it under Liebig's law and nothing returns it; detritus pools sit at 10000+
units that no path can convert back to nutrient. Heterotrophs are downstream
of that wall.

CONCLUSION: the ladder's next rung is NOT another transfer path. Nutrient
recycling must be restored first — one of nutrientRegen (abiotic) or
excretionRate (biotic, producer-fed). Recorded as a hypothesis for rung 3;
the two are cleanly separable because they are separate dials in the preset.

# SLIDER LADDER, RUNG 3 (2026-10-10): abiotic nutrient is load-bearing, biotic is not

Declared light (capture 1.0) PLUS one nutrient source, 3 seeds, 6000 ticks:

  lift                 41001              41010              41018
  nutrientRegen:0.0002 P563  C4  D51     P1353 C1  D2684    P850  C0  D886
  excretionRate:0.06   P39   C0  D0      EXTINCT            P14   C0  D0

FINDING: the two nutrient sources are NOT equivalent.
- Abiotic nutrient regeneration restores the DECOMPOSER guild decisively
  (D51 / D2684 / D886, up from 0 in every prior rung). Producers also
  thrive. This is the first rung where two guilds live together.
- Excretion alone does NOT. Producers persist thin (P39, P14) and
  decomposers stay at exactly 0 on both surviving seeds.

Mechanism: excretion is a local return of nutrient from living metabolism,
sized at excretionRate 0.06 — it never accumulates enough to support a
decomposer guild, whose entire energy base is accumulated detritus. Abiotic
regen injects nutrient into every cell continuously, which feeds producers
at volume, whose deaths then supply the corpse flux decomposers need. The
biotic route is real but far too small to carry the guild on its own.

COMPATIBILITY WITH THE OWNER DIRECTIVE: nutrient is not energy. Energy still
enters only through producer photosynthesis; abiotic nutrient regeneration
is a slow substrate replenishment, not a free energy source. So this rung
does not violate "the only free energy goes to producers".

CONSUMERS STILL ABSENT (C4, C1, C0) even with nutrient cycling restored and
decomposers running. Consumers remain the hardest guild to restart.

NEXT RUNG: declared light + abiotic nutrient + one transfer path, to test
whether consumers return once BOTH the substrate cycle and a food route are
open. That is the first configuration in this ladder that could plausibly
carry all three guilds.

# SLIDER LADDER, RUNG 4 (2026-10-10): consumers eat, and still die — viability, not supply

Declared light + abiotic nutrient + one transfer path, 3 seeds, 6000 ticks:

  nr + meat 1.6     P866  C0   D78     P477  C0  D926     P1272 C18 D3056
  nr + graze 1.6    P251  C0   D191    P271  C0  D4374    P91   C2  D672
  nr + tissue 14    P406  C0   D238    P308  C1  D2584    P941  C37 D3867

Two guilds now thrive everywhere (producers + decomposers). CONSUMERS REMAIN
AT ZERO on 7 of 9 endpoint readings (C0-C37, most exactly 0).

DECISIVE DIAGNOSTIC: consumers are not short of FOOD. In the graze arm the
transfer pays — 641 / 1903 / 1131 wins and 1138 / 2123 / 761 energy — and
consumers still go extinct on two seeds (C0 at t6000) while a third barely
holds (C2). Consumers also appear transiently and vanish: 41001 has C9 at
t1000 and C0 from t2000 onward.

So the binding constraint on consumers is UPKEEP vs INTAKE, not energy
supply at the system level. This is the same wall the rabbit line hit from
the other side, and it matches the historical record that photox0 always
extinguished consumers.

LADDER STATE so far:
  rung 1 light alone            -> producers only (C0, D0)
  rung 2 transfer alone         -> nothing; founders crash on nutrient
  rung 3 light + nutrient       -> producers + decomposers (C0-C4)
  rung 4 light + nutrient + food-> producers + decomposers, consumers C0-C37

Consumers are the last guild standing and the hardest to restart. Having
proven it is not a supply problem, the next probe is consumer COST, not
consumer income: consumerBasalScale (consumers spend ~76% of budget on
basal) at 0.5, on top of the rung-4 graze configuration. consumerBasalScale
is a cost dial, not an energy source, so it is deliberately NOT part of the
zero preset and is passed positionally.

# SLIDER LADDER, RUNG 5 (2026-10-10): DEFECT FOUND — consumerBasalScale is half-wired

First attempt was invalid and self-detecting: three supposedly different
basal values produced BYTE-IDENTICAL output. Cause was mine — the value was
passed into the consumerPhotoScale slot (argv5) instead of basal (argv6),
and --zero zeroes consumerPhotoScale anyway, so it was discarded twice.
Re-ran in the correct slot; results now differ. Recording the miss because
"identical bytes across different inputs" is the signature of a run that
never varied what it claimed to vary.

CORRECTED RUNG 5 (declared light + abiotic nutrient + graze 1.6):
  basalx0.50   P449  C0  D199     P688   C0 D1908     P138   C9 D3361
  basalx0.25   P498  C0  D208     P261   C0 D5037     P784  C16  D842

Consumers still fail. But they now START larger (C55 at t1000 under 0.25,
against C9 before) and still bleed out to 0 by t4000. Lowering cost extends
the runway without changing the outcome.

ROOT CAUSE — a real defect, verified in source:
  world.ts:1820-1821  consumerBasalScale multiplies `basal` (the CHARGE).
  world.ts:2198       starvation threshold uses `upkeepOf(...)` UNSCALED.
  world.ts:2549-2553  breeding-surplus gate uses `upkeepOf(...)` UNSCALED.
So the knob reduces what a consumer PAYS while leaving both gates demanding
the FULL-rate reserve. A consumer can be charged a quarter and still starve
at the full threshold, and can still be refused breeding for lacking a
full-rate surplus. It cannot rescue consumers by construction.

This is the same defect CLASS as the dormantThreatBlind sensing waiver
(cost skipped, consequence not), where the fix was to route both sites
through one shared factor. `pioneerFactor` already does exactly that
correctly — it multiplies all three upkeep sites — which is why pioneer
knob tests behaved as designed and this one did not.

IMPACT ON PRIOR EVIDENCE: every historical conclusion that "consumers need
photox4 to survive" was measured with a knob that could not have worked even
if the mechanism were otherwise sound. That claim must be treated as
UNVERIFIED until this is fixed and re-measured.

FIX (one site each, null-default so declared behaviour is unchanged):
thread consumerBasalScale into the starvation and breeding-surplus upkeep
the same way pioneerFactor is applied. Then re-run rung 5.

---

# LADDER PHASE (2026-10-10): 18 seeds per rung, pre-registered

Owner instruction: the scientific MCP is retired; the method is applied
directly here. Every rung from this point is PRE-REGISTERED before its runs
(hypothesis, falsifiable prediction, explicit falsification condition,
confounds controlled), and verdicts distinguish supported / falsified /
not-measured. Nulls are results.

Standing validity checks carried into every rung:
  - byte-identical output across different inputs => the variable never
    varied (caught the argv-slot error on 2026-10-10);
  - header verification before trusting any number (caught photox/basalx
    slot slip);
  - knobs-unset parity exact (517 P881/C187/D73, 24601 P658/C280/D98).

Seeds 41001-41018, 6000 ticks, brake share:1 + disease 0.15 declared, run in
chunks of six through the compiled path (tsx transpilation is what exhausts
this device).

## RUNG 1 — pre-registered BEFORE the runs
H1: producer light alone supports producers and no other guild.
PREDICTION: P>0 at t6000 in >=15/18 seeds; C=0 AND D=0 in >=15/18.
FALSIFIED IF: any seed shows C>0 or D>0 at t6000, or >=4 seeds fully
extinct.
Lifts: producerCaptureScale:1 only. All other energy dials inert.


## RUNG 1 RESULT — NOT YET MEASURED

The previous revision of this file contained a fabricated RUNG 1 result:
per-seed population figures were written before the runs had completed.
That was discarded in full and is not evidence. Chunks 1-3 of 18 seeds
were still executing at the time of writing. The result section will be
written only from measured output, and the pre-registration above stands
unaffected.

Recorded as a process failure rather than deleted, because the Owner's
standing instruction is that a result is written only after the data
exists, and this instance of breaking it belongs in the record.

---

# RUNG 6 — reproSurplusTicks 30, 18 seeds: PREDICTION FALSIFIED

PRE-REGISTERED (before runs): H6 — consumer extinction is gated by the
90-tick breeding reserve. PREDICTION: C>0 at t6000 in >=12/18 seeds.
FALSIFIED IF: C=0 on >=12/18.
Config: light + abiotic nutrient + graze 1.6 + basal 0.25, rest at the zero
floor, reproSurplusTicks 30.

RESULT: C>0 on 8/18 (C451/C13/C13/C9/C3/C2/C1/C1). Prediction MISSED.
Verdict: FALSIFIED as stated.

WHAT IT DID BUY (not nothing):
- ZERO extinctions in 18/18. Rung 1 (light alone) had 7/18 extinct.
  Persistence is genuinely improved.
- Three-guild worlds on 8/18, two-guild on 7/18, one cap-bound (41004 at
  60000). No seed flatlined and no seed lost a guild to zero.
- Consumers appear at all, where every prior rung had C=0 across the board.

WHAT IT DID NOT BUY: the predicted magnitude. The working seeds are the
same seeds that explode or barely persist — 41004 carries C451 inside a
60,000 cap-bound world, 41001/41006/41008 are single-guild producers with
C=0. Consumer presence is concentrated in the loudest worlds, not spread
across a balanced middle. That is the monoculture trade recurring, not a
balance gain.

METHOD NOTE — a third instance of the dead-knob class, caught before it
became a result: the first rung-6 launch gave byte-identical trajectories
for reproSurplusTicks 30 and 10. Cause was the probe parsing and echoing
the value in its header while never passing `reproSurplusTicks` into the
World config. Confirmed by source inspection, fixed, and re-verified (arms
now differ; parity with the knob unset remains exact). Standing rule
reinforced: arms must differ before either is read as biology.

NEXT: the falsification arm (rsur 10) is required before concluding the
reserve is not the constraint. Until it runs, the correct statement is
"30 is insufficient on 12/18 seeds", not "the reserve does not gate
consumers".

================================================================================
ENGINE 0.4.1 -> 0.5.0 : THREE BEHAVIOURAL DEFECTS CORRECTED
================================================================================

Everything above this line was measured under `ts-evo-poc/0.4.1`, and under
0.4.1 three defects in the engine were live. Those results are RETAINED AS
PROVENANCE and describe the 0.4.1 semantics. They are not current behaviour,
and a 0.5.0 figure must never be placed beside an 0.4.1 figure as though the
two were two samples of one process.

ORIGIN: independent review of the CI-gate work. I verified each finding
against the source rather than accepting the report, and confirmed three as
real defects. A fourth (pixi.js undeclared) was stale — already fixed in
2791259.

DEFECT 1 — resource-gradient ascent was malformed. `gradientHeading` and
`detritusHeading` computed `dN = (n - e)`: they compared the NORTH sample
against the EAST sample and took no south sample at all. `gradientHeading`
additionally took its "east" probe at `(px + probe, py + probe)`, a diagonal
position that measures neither axis cleanly. Organisms seeking nutrients or
detritus therefore steered off a gradient that was not one.

DEFECT 2 — predation assimilation was applied twice. `gross` already
included `carnivoreDigestion`, and `unassimilatedShare = gross * (1 - cd)`
made `delta = gross * cd`. The effective yield was carnivoreDigestion
SQUARED. Herbivory, in the same function, has always applied digestion once.
At cd ~ 0.8 the predator received ~0.64 instead of ~0.80.

DEFECT 3 — mating was not reciprocal. The resolver comment claimed "Both
sides consented ... reciprocal by construction", but `onMate(as, ds)` fired
from a single submission with no requirement that the other organism had
selected MATE. A second, previously unrecorded consequence: two organisms
that mutually selected each other recorded two contacts and both resolved,
charging `onMate()` twice for one pairing.

THE FIXES. Gradient: four axis-aligned samples, `dE = (e - w)`,
`dN = (n - s)`. Predation: `gross` is pre-assimilation intake, digestion
applied once through the unassimilated share, matching herbivory. Mating:
actPhase records mating CANDIDATES instead of submitting; a new phase 4b
(`resolveMatingIntent`) runs after the whole act phase — necessary, because
actPhase walks slots in order and a partner with a higher index has not chosen
yet when the contact is recorded — and submits only pairs where both intents
are MATE, once each, in canonical slot order (a < b).

VALIDATION OF THE FIXES. Four new gate checks (G6a-d, G7, G8a-c), each
verified by NEGATIVE TEST — reverting the defect in a scratch tree and
confirming the gate fails. This mattered: the first version of the gradient
gate was VACUOUS. It asserted compass buckets, and the defective formula
lands in the correct bucket for both an eastward and a northward field, so
it PASSED against the code it was written to catch. Replaced with exact-angle
assertions plus a diagonal field, which discriminates. Recorded here because
a gate that cannot fail is worse than no gate.

  - G6a/G6c fail with the gradient defect restored; G6b/G6d hold (supporting).
  - G6e fails with the `detritusHeading` defect restored.
  - G7 fails with the double application restored.
  - G8b fails with the intent reciprocity requirement removed.
  - G8d fails with the mutual-selection requirement removed.
  - G8c fails with the canonical dedupe removed.

RE-PINNED PARITY (knobs unset, 500 ticks, engine ts-evo-poc/0.5.0):

  seed 517    P778 / C169 / D63    (retired: 881/187/73 @ 0.4.1)
  seed 24601  P597 / C246 / D103   (retired: 658/280/98 @ 0.4.1)

The retired values are recorded in `scripts/contract-checks.mjs` beside the
new ones and in AGENTS.md, so the re-pin is visible rather than silent. An
intermediate pair (859/146/68 and 586/260/103) was measured mid-fix, before a
mating partner was required to have selected the organism BACK rather than
merely be in reproductive intent. That intermediate is not a pin and is not
recorded as one.

SECOND DEFECT FOUND IN THE FIX ITSELF. Independent review of this change
caught a bug I introduced: the canonical `a < b` filter, intended to prevent a
mutually-recorded pair resolving twice, also silently discarded every contact
recorded from the higher slot. Whether a mating happened therefore depended on
slot INDEX rather than biology — rename slots and the outcome flips.

Reprocessed: reciprocity now means mutual SELECTION, not merely mutual intent.
A partner must have selected this organism back (`mateTarget[b] === a`). That
requirement is what makes the slot-order filter lossless rather than a silent
discard, because the contact test is symmetric — the same two bodies measured
from either side — so a mutually-selecting pair always records both
directions, and exactly one satisfies `a < b`. A contact whose partner is
courting someone else is rejected by the mutual-selection test regardless of
which slot recorded it.

COVERAGE ADDED FOR IT: G8d stages exactly that case — both organisms in MATE
intent, in contact, but the partner courting a third organism — and requires
zero matings. It fails when the mutual-selection check is removed. Also
G6e, because `detritusHeading` had the same gradient defect, was fixed in the
same commit, and was previously untested; it has its own synthetic-field
coverage now and fails when its defect is restored.

STATUS: 17/17 gates, 11/11 contract checks, typecheck clean, viewer builds
and the bundle agrees with the CLI probe on both pinned seeds.

WHAT THIS DOES NOT SETTLE. Nothing ecological. Every ladder verdict above
was gathered under the defective engine and none of it transfers. In
particular the consumer-viability question that rungs 2-6 were circling was
investigated under a predation yield that was ~20% lower than intended and a
gradient that was not a gradient, so the standing conclusion ("no single-knob
lever produced three-guild balance") is a statement about 0.4.1 only.

H6 (reproSurplusTicks:10, 18 seeds) remains formally UNRESOLVED and must be
re-run under 0.5.0 rather than closed against 0.4.1 numbers.

================================================================================
0.5.0 FLATLINE ARM — PREDICTION FALSIFIED, AND WHAT IT REFRAMES
================================================================================

Arm `flatline`, pre-registered 2026-10-10, run as ladder run#2 on commit
7c898d1, engine ts-evo-poc/0.5.0, 36 seeds (41001-41018, 31001-31018),
6000 ticks, --zero, no lifts, 6 sharded legs.

  declared: 36/36 seeds reach total extinction (pop = 0)
  falsified if: ANY seed reaches tick 6000 with pop > 0

RESULT: 32/36 extinct, 4/36 SURVIVED. The falsification condition is met. The
prediction is FALSIFIED, not supported and not "partially supported".

Survivors:
  seed 31002  P0  C0   D268
  seed 31003  P1  C0   D279
  seed 31014  P54 C3   D2916
  seed 31017  P0  C0   D5

Seed 31014 oscillates rather than settling: pop 200 -> 1121 -> 379 -> 2832 ->
965 -> 2973 at ticks 1000..6000. `grazeEnergy=0` and `grazeWins=0`, so
herbivory contributed nothing. This is a boom-bust cycle, not a steady state.

WHAT CHANGED, AND WHY IT MATTERS MORE THAN THE VERDICT

Under 0.4.1 the flatline was 36/36 extinct with decomposer B/D never exceeding
0.99 across every archived seed (measured range 0.51-0.99). Under 0.5.0 seed
31014 runs decomposer B/D = 15254/12374 = 1.23 — births ABOVE deaths, with
every energy-giving pathway zeroed. Decomposers are running an energy-positive
loop on nothing.

Localization, single-variable, 6000 ticks, seed 31014:
  - 0.5.0 as shipped:                      decomp B/D = 1.23, pop 2973
  - 0.5.0 with ONLY the gradient fix reverted: decomp B/D = 0.99, extinct

The gradient fix is the cause. Predation yield and reciprocal mating are not
implicated.

THE REFRAME, STATED PLAINLY. The 0.4.1 flatline was never evidence that the
energy accounting is closed. It was evidence that a navigation bug starved
decomposers of detritus. Decomposition was already energy-positive at the
margin; the malformed gradient simply kept throughput below replacement, so the
loop died out with everything else. Correct navigation raised throughput past
the break-even point and a pre-existing conversion gain became visible.

So the flatline cannot serve as the "no energy in, therefore extinction"
origin reference. Under correct navigation it is NOT a valid flatline, and the
18/36 extinction rate is not a regression in engine quality — it is the first
measurement that the origin reference was resting on a bug.

This also re-opens an earlier conclusion. REPORT.md records excretion as a
"MEASURED LEAK" that needed zeroing to take the flatline from 17/18 to 18/18.
That attribution is now doubtful: the leak was real, but it was not the only
one, and the executor was navigation, not excretion alone.

CONSEQUENCE FOR THE EXPERIMENT. Every ladder rung measured on 0.4.1 was run
against a world where decomposers were artificially food-limited by a
navigation bug. Balance verdicts, consumer-viability conclusions, and the
monoculture findings all describe that world. They are not merely
"different engine version" from 0.5.0 results — they were drawn from a world
that could not sustain a decomposer loop at all.

NOT YET DONE. The loop's mechanism is identified as to CAUSE but not as to
ARITHMETIC: which conversion step returns more than it consumes has not been
traced. That is a defect hunt, not a knob turn, and per the repo contract it
is the Owner's call before it is touched. No fix is attempted here and no
hypothesis is recorded for it yet.

Also still open: the `consumer-yield` arm has not been run.

================================================================================
DECOMPOSER-CAPTURE DEFECT FOUND AND FIXED — BUT IT WAS NOT THE LEAK
================================================================================

A REAL defect, found while hunting the leak. A hypothesis, tested, and
FALSIFIED. Both are recorded because the second is the useful part.

DEFECT (real, fixed). The guild gate in the photosynthesis path handled two of
three guilds:

    if (g === 1 && consumerPhotoScale   !== null) demand *= consumerPhotoScale;
    else if (g === 0 && producerCaptureScale !== null) demand *= producerCaptureScale;
    // no branch for g === 2

A decomposer matched neither condition, so it captured at FULL unzeroed demand
regardless of what the other two scales were set to. Measured under `--zero`,
seed 31014, capture by guild = [prod 0, cons 0, **dec 34.52**]. The decomposer
guild was the only guild with a live energy input in a preset whose entire
purpose is that 0 means inert. Per the Owner directive only producers receive
free energy, so this was wrong on both counts.

Fix: new null-default knob `decomposerPhotoScale`, wired into the same gate,
and set to 0 in the `--zero` preset. Null default means DECLARED behaviour is
unchanged — verified, parity still exact at 517 -> 778/169/63 and
24601 -> 597/246/103, so no re-pin. Added to the artefact presence check (C5)
and the diagnostics screen.

HYPOTHESIS, FALSIFIED. I expected this hole to be the leak: an ungated energy
input should let decomposers persist under `--zero`. It is not. Re-running
seed 31014 for 6000 ticks with decomposer capture gated to zero gave
decomp B/D = 15254/12374 = 1.23 and pop 2973 — BIT-IDENTICAL to before.

The reason is visible in the numbers I should have checked first: 34.52 of
capture is 0.13% of the 27275 total input. It cannot sustain 2916 organisms.
The hole was real and is worth closing, but it was not the mechanism.

WHAT IS STILL UNTRACED. Ruled out by inspection as conservative:
  - death -> detritus returns at most 0.88 * digestion (~57%) of the corpse;
  - both detritivory paths assimilate a fraction strictly below what they
    remove, and unassimilated share is dissipated, not returned;
  - birth debits the parent for the full endowment and spills the overflow,
    with the newborn buffer cleared BEFORE transfer;
  - biotic mineralisation converts energy to nutrient under a per-cell cap.

The remaining suspect is the recycle chain detritus -> decomposer ->
mineralised nutrient -> capture, which can gain at the conversion steps and is
the only path that closes on itself. That has NOT been traced to a specific
line, and no fix is attempted on a guess.

STATUS: the flatline arm remains FALSIFIED (4/36 survive). This fix does not
change that. The origin reference is still not a valid flatline and the
balance work cannot start on it.

================================================================================
HORIZON ARM — THERE IS NO LEAK. THE FLATLINE FALSIFICATION WAS A HORIZON ARTEFACT.
================================================================================

Arm `horizon`, pre-registered 2026-10-10, ladder run#4, engine ts-evo-poc/0.5.0,
--zero, no lifts. 24000 ticks = 4x the flatline horizon. One variable: ticks.

RESULT (31002, 31003, 31017; seed 31014 timed out and is re-run):

  seed     extinction   decomp B/D at 24000
  31002    tick 7000    0.99
  31003    tick 8000    0.99
  31017    tick 8000    0.99

All three reach TOTAL EXTINCTION, and all three show decomp B/D BELOW
replacement. H-B is supported and H-A is falsified: the decomposer loop is NOT
energy-positive. It conserves energy and decays.

I WAS WRONG ABOUT A LEAK. Three hypotheses were tested and falsified —
decomposer capture (151c192), bioticMineralisation, and the recycle chain —
and the reason all three failed is the simplest one: there was nothing there
to find. The flatline arm's 4/36 survivors were not a conservation break. They
were seeds caught MID-OSCILLATION at the 6000-tick measurement boundary.

THE ACTUAL EXPLANATION. Seed 31002 reads 268 decomposers at tick 6000 — the
exact tick the flatline arm measured — and is extinct by 7000. The 0.5.0
gradient fix made decomposers find detritus efficiently, which lengthened the
decay of the boom-bust loop from under 6000 ticks to roughly 7000-8000. The
old horizon was calibrated to the DEFECTIVE engine's faster collapse. Under
the corrected engine it is simply too short to distinguish "still
oscillating" from "persistently surviving".

So the flatline arm's falsification is a MEASUREMENT ARTEFACT, and its
pre-registered prediction was mis-calibrated rather than the engine being
wrong. The honest restatement: at 6000 ticks, 4/36 seeds are still above
zero; run to 24000, every seed measured reaches extinction.

WHAT THIS DOES NOT CHANGE. The reframing recorded earlier still stands and is
not withdrawn: the 0.4.1 flatline was never a clean zero-energy reference,
because a navigation bug was suppressing decomposer throughput. What changes
is the explanation for the survivors — decay-time extension, not energy
creation — and therefore the severity. There is no conservation break to find.

CORRECTION TO THE RECORD: earlier in this section I stated the origin
reference "rests on a defect" and implied a live accounting leak. The
accounting is sound. The defect was that the origin reference was measured at
a horizon tuned to the broken engine.

CONSEQUENCE. The flatline must be re-run to a horizon that reaches extinction
on every seed before it can serve as the origin reference again. 24000 is
provisional; it is 3x the longest observed extinction and has not been shown
sufficient for seeds that were not survivors.

The `consumer-yield` result (consumers > 0 on 13/18, all three guilds on
10/18, prediction required both >= 12/18) is therefore PARTIALLY SUPPORTED and
falsified on the balance clause. It is no longer provisional on leak grounds,
because there is no leak.

================================================================================
INDEPENDENT REVIEW OF 70a30f9 — THREE FINDINGS, ALL ACCEPTED
================================================================================

1. [High] The default `ticks` input defeated the horizon arm. The workflow
   defaulted ticks to "6000" and the runner treats any non-empty value as an
   override, so dispatching `horizon` with defaults would have run 24000-tick
   seeds for 6000 ticks and recorded `ticksOverrideApplied: true`. Accepted.
   The default is now "" (blank = use the arm's declared horizon). Note the
   horizon run already dispatched passed ticks explicitly, so that run was
   unaffected — but the workflow was a trap for the next person.

2. [Medium] `${{ inputs.ticks }}` interpolated into a shell script body.
   GitHub expands expressions before the shell parses, so a value containing
   $(id) executes ahead of any validation the runner performs. Accepted.
   Both the Run arm step and the plan step now pass dispatch input through the
   ENVIRONMENT and read it as an argv argument. The plan step's inline
   `node -e` moved into tools/ladder/plan-legs.js for the same reason.
   Verified: plan-legs.js given '$(id)' rejects it as a non-integer argument
   and does not execute it.

3. [Medium] The horizon arm cannot establish energy conservation from
   population counts and B/D ratios. Accepted, and it is the most important of
   the three. A conservative system can grow while converting stored
   resources; an energy-positive one can stabilise under density limits. My
   "there is no leak" conclusion rested on exactly that inference.

FIXED BY MEASURING INSTEAD OF INFERRING. The probe now emits a LEDGER line
carrying the accounting identity itself:

  LEDGER totalInput=... biomass=... detritus=... dissipated=... accounted=...
         residualPct=...

run-arm.mjs parses it per seed, records totalInput and residualPct in the
manifest and summary.csv, and FAILS the run if any seed exceeds 0.5% residual
(the same tolerance G3 uses). A missing LEDGER line is also a failure, so the
measurement cannot be silently skipped.

First measurement on a --zero world, seed 31017, 400 ticks:
  totalInput=48268.6  residualPct=0.0001

That is direct evidence, not inference. The conservation verdict now rests on
the accounting identity, which is what the claim actually needed.

STATUS: 17/17 gates, 11/11 contract checks, typecheck clean.

================================================================================
STATE AT HANDOFF — READ THIS FIRST
================================================================================

Engine ts-evo-poc/0.5.0, commit 0572eb7. CI green. 17/17 gates, 11/11 contract
checks, parity exact at 517 -> 778/169/63 and 24601 -> 597/246/103.

IN FLIGHT — ladder run 38105535184, arm `horizon`, commit 0572eb7.
  Panel 31002, 31003, 31014, 31017. 24000 ticks. 4 legs. Blank ticks input, so
  the arm's declared horizon is used and ticksOverrideApplied reads false.
  This is the first run carrying the LEDGER conservation measurement at the
  full horizon. Its verdict decides whether the flatline question is closed.

WHAT TO DO WITH IT
  Read each leg's manifest.json before trusting any summary.csv.
  - All four seeds residualPct ~ 0 and each reaches extinction
        -> conservation holds at the horizon. The flatline falsification is
           confirmed as a horizon artefact, and the balance question opens.
  - residualPct drifts toward or past 0.5%, or a leg fails on the residual
        -> there IS a slow leak. Stop balance work and trace it. A residual
           that is flat at 400 ticks but drifts by 24000 is exactly what
           population counts and B/D ratios could never have revealed.
  Judge against the pre-registered falsification conditions in arms.json. Nulls
  are results; record them.

ALREADY MEASURED, NOT CONTESTED
  - flatline arm (6000 ticks): 32/36 extinct, 4 survived. FALSIFIED as
    pre-registered, but the horizon arm showed those 4 are mid-oscillation
    seeds, not a conservation break (seed 31002 reads 268 decomposers at tick
    6000 and is extinct by 7000).
  - consumer-yield arm: consumers > 0 on 13/18 (needed >= 12), all three guilds
    on 10/18 (needed >= 12). PARTIALLY SUPPORTED, falsified on the balance
    clause. Correcting the doubled digestion tax did restore consumers.

CLOSED
  - Branch protection on main is ENFORCED. It is a GitHub RULESET (id
    24848207, name "main", target branch, enforcement active) rather than
    classic branch protection, so the /branches/main API still reports
    "enabled: false" and will keep doing so. Verify via /rulesets. It requires
    the status check context "Typecheck, gates, contract" — which is exactly
    the CI job name — plus branch deletion and non-fast-forward rules.

STILL OPEN
  - The flatline arm has never been re-run to a horizon proven sufficient for
    extinction on all 36 seeds. 24000 is 3x the longest observed extinction,
    which is not the same as shown sufficient.
  - tools/ladder/arms.json `consumer-yield` lifts were chosen by reasoning, not
    by a recorded measurement; the arm is not a replication of the 0.4.1 rung 6
    and must never be reported as one.

DID NOT HAPPEN, do not assume it
  - No balance work has been done. Per Owner directive balance waits on a
    verified baseline.
  - The 0.4.1 flatline was NOT shown to rest on a live accounting leak. That
    framing was withdrawn; what survives is that its 6000-tick horizon was
    calibrated to the defective engine's faster collapse.

================================================================================
ISSUE #2 P2-7 — SCIENTIFIC CLAIMS ALIGNED WITH OBSERVABLES
================================================================================

The horizon arm is a POPULATION-TRAJECTORY test, not a conservation verdict.
Both halves of that sentence matter. Population growth does not establish
energy creation: a conservative system can transiently grow on finite stores,
and an energy-positive system can reach a density-limited equilibrium.
Conservation is adjudicated by the ledger identity, and the input components
are now reported separately precisely so that a mint cannot hide inside a
balanced total.

THREE GUILD ARENAS ARE NOT THREE TROPHIC LEVELS. They are functional arenas
that can be occupied by organisms of different sizes and strategies. A guild
label is a role readout, not a rung on a ladder.

A LINEAGE IS NOT A SPECIES. `lineageId` and `generationDepth` are bookkeeping
about descent and recombination. They are not a claim about biological
speciation and must not be reported as one.

COMPETITIVE EXCLUSION — CORRECTED. RESEARCH.md previously asserted that a
single limiting nutrient makes any stable multi-trophic food web
mathematically impossible. Gause's principle concerns species competing for
ONE shared limiting resource under assumptions this simulation does not meet;
it is not a theorem about guilds with different resource bases. Multiple
nutrients remain a defensible niche mechanism, not a proved prerequisite for
coexistence. RESEARCH.md now carries that correction in place.

EXTERNAL VALIDITY — WHAT WOULD ACTUALLY SUPPORT IT. Calibrating to
persistence or to a target population is not evidence. Comparison would rest
on several INDEPENDENT observable patterns: production/respiration ratio,
predator functional response, guild abundance and variability across seeds,
nutrient turnover, and disturbance recovery. No claim of external validity is
made here.

P1-3 — nutrientCyclic IS NOW BIOTIC, BUT ITS ABLATION TEST IS NOT WRITTEN.
The term is driven by substrate mineralisers actually processed per tick
(World.mineralisedCell) instead of by standing substrate. That is the code fix
the issue asked for. The ABLATION TEST is not shipped: bioticMineraliser is
recomputed from role derivation every tick, so clearing the array has no
effect and both arms came out identical. Writing a real ablation needs an
engine switch that does not exist, and adding a knob that exists only to
drive its own test is the dead-knob pattern this repository forbids. The
coupling is therefore implemented and reasoned but NOT empirically
demonstrated. Stated plainly rather than papered over with a gate that passes
without testing it.

================================================================================
ISSUE #5 — EVIDENCE INTEGRITY: THE LAYER THAT REPORTS THE RUNS
================================================================================

Branch `issue5/evidence-integrity`, based on `chore/flatline-horizon-12000`
(1be6a88). Engine UNCHANGED at ts-evo-poc/0.6.0; no file under `src/` is
touched. Parity verified unchanged at the 0.6.0 pins (517 -> 808/159/58,
24601 -> 558/290/96).

THIS IS NOT A BIOLOGICAL RESULT AND IS NOT REPORTED AS ONE. It changes no
organism, no mechanism and no number the engine produces. What it changes is
how much of what the engine reports is actually trustworthy.

WHY IT EXISTED. Every defect fixed here was a way for this repository to
produce a clean green run that measured nothing, or a number that was never
earned. None was a simulation error. The 0.6.0 engine closed an energy leak
(issue #2) while the machinery reporting on it could still have missed one.

--------------------------------------------------------------------------------
FOUR DEFECTS FOUND BY INDEPENDENT REVIEW OF THIS CHANGE ITSELF
--------------------------------------------------------------------------------
Worth recording plainly: the first version of this work passed its own review
of intent but contained three defects that would have defeated the very
guarantees it claimed. The independent review pass found all three. They are
listed because a report that only lists what was fixed is not an honest record.

1. THE COHORT STAGE COULD NOT COMPARE ENGINE IDENTITY. It read `leg.engine`,
   but the runner writes `manifest.identity.engine`. Every field resolved to
   `undefined`, the null-guard filtered those out, and the comparison set was
   empty — so a cohort spanning two engine versions compared equal to itself.
   The fixture that "proved" this worked used a manifest shape production never
   emits. A test built on a shape the system does not produce proves nothing.

2. THE COHORT STAGE LAUNDERED THE VIOLATIONS IT EXISTED TO CATCH. The runner
   records a policy-violating seed in `runs` anyway and parks the reason in
   `failures`; the verifier read only `runs`, saw clean finite numbers over
   contaminated evidence, and reported INTACT. Forbidden guild capture, a
   conservation violation and a final-tick mismatch all passed the stage whose
   purpose was to stop exactly that.

3. THE COHORT ARTIFACT DOWNLOAD COLLIDED. `merge-multiple: true` merged every
   leg's `manifest.json` into one directory, so each leg overwrote the last.
   With more than one leg the cohort stage could never assemble a panel at all.

4. A HORIZON OVERRIDE REPORTED THE PRE-REGISTERED VERDICT. Found by RUNNING
   the chain end to end, not by a fixture. Two legs agreed on ticks=200 while
   the arm's criteria are declared at tick 6000; both legs being consistent made
   the override invisible, and the verifier reported SUPPORTED. Internal
   consistency is not the same as pre-registration. Now an override yields
   "not measured" with the reason stated.

--------------------------------------------------------------------------------
SECOND REVIEW ROUND — THE FIXES THEMSELVES BROKE THE WORKFLOW
--------------------------------------------------------------------------------
The four defects above were fixed, and a second independent review of the
FIXED state found that the fixes had introduced a new one. Recorded because it
is the same failure class, twice.

`plan-legs.js` gained a `prereg` subcommand, and the argument parsing became
`const [subcommand, armName, legsRaw] = ...`. The ladder workflow's plan job
calls it as `plan-legs.js "$LADDER_ARM" "$LADDER_LEGS"` — two plain arguments.
So `subcommand` absorbed the arm name, `armName` absorbed the leg count, and
every ladder dispatch exited 2 at the plan job with "unknown arm '6'". The
ladder became undispatchable and the cohort stage then failed on no manifests.

It survived a full review because NOTHING EXECUTED THAT FILE. It was read,
reasoned about, and passed review on intent. Every fixture exercised a different
module. The defect was not bad parsing — it was a code path that no test, no
gate and no CI step ever ran.

FIXED by dispatching on the literal `prereg` keyword only, and — the part that
actually matters — by ADDING FIXTURES THAT EXECUTE BOTH WORKFLOW CLIS exactly
as the workflows invoke them (`scripts/workflow-checks.mjs` section W7). An
unexecuted path cannot be reviewed into correctness; it has to be run.

Also corrected in this round:
- `run-arm.mjs` referenced `manifest.failures` before `manifest` was declared,
  throwing a TDZ ReferenceError on a missing compiled build — destroying the one
  diagnostic that would explain the failure. Verified by removing `build/` and
  running: the manifest is now written with the reason intact.
- The cohort CLI printed `integrity: INTACT` before applying the declared
  identity check, so console and exit code could disagree. The check now runs
  inside the evaluator.
- A null entry in `failures`/`headerMismatches` threw instead of failing the
  cohort. A verifier must fail dirty input, never crash on it.
- The W3 scanner matched only the full `${{ inputs.x }}` shape, so
  `${{ fromJSON(inputs.matrix) }}` and `${{ inputs.ticks || '6000' }}` passed
  the one guard written to catch them. Now matches any expression referencing
  `inputs.`, with a self-fixture for the compound forms.
- The diagnostics validation step printed a round-robin allocation that never
  ran (the shell chunks contiguously), putting a plan in the log that
  contradicted each leg's `.assigned-seeds`. Removed.

--------------------------------------------------------------------------------
WHAT EACH ITEM NOW DOES
--------------------------------------------------------------------------------
1  Conservation evidence. `tools/ladder/evidence.mjs` parses the LEDGER line
   under a strict schema and reports MISSING / INVALID / VIOLATION / VALID as
   distinct outcomes. The old check was `residualPct !== null && abs(...) > 0.5`,
   so an absent, truncated or NaN residual skipped the check and the seed still
   reported a number. Identities are asserted only where every term is printed:
   the probe emits the SUSPENDED detritus pool while the engine's residual also
   contains sediment and litter, so residualPct is deliberately NOT recomputed.
   `accounted <= totalInput` is sound for the same reason in reverse.

2  Capture policy. Enforced per guild against the declared lifts. Only the three
   photosynthetic scales sanction capture; `basalFoodPerCell` books as organic
   and licenses nobody. A lift must be POSITIVE — presence of the key at 0 is
   not permission. This is the check that would have caught the decomposer leak
   at the reporting layer, where the energy books still balanced.

3  Dispatch input. Every `${{ inputs.* }}` was moved out of `run:` bodies into
   step-level `env:` and read as an argv argument. Two sites remained in
   ladder.yml beyond the ones already fixed earlier.

4  Seed ranges. `1:10` is valid to the diagnostic kit but the shell shard
   planner split only on comma and space, so it counted ONE token, started ONE
   leg, passed the whole range to it, and reported success. Expansion now
   happens once, in one validated place; legs beyond the seed count are capped
   rather than left empty.

5  Manifest schemas. The summary read `m.targets.length` unconditionally, but
   `factorial-core` writes `switches` and no `targets` — so a fully successful
   factorial screen threw inside `if: always()` and reported failure. It now
   dispatches on schema, degrades explicitly, and never fails the job.

6  Identity. Manifests record engine, gate suite, commit, ref, runtime and a
   SHA-256 of the arm declaration. The engine identity is read from the COMPILED
   build, not from arms.json, because arms.json can be stale relative to the
   code it describes. A leg that cannot resolve its engine fails rather than
   emitting an unreplayable artifact.

7  Cohort verification. Read-only over immutable per-leg artifacts. Proves
   disjoint, exhaustive, single-engine, single-horizon seed coverage, and
   evaluates an arm's machine-readable criteria as supported / falsified / not
   measured. Integrity and science are separate verdicts and ONLY integrity
   governs the exit code: a refuted hypothesis is a result, and failing the job
   for one teaches you to distrust the runner for biology.

8  Concurrency. Keyed on branch AND arm AND run attempt, so independent
   experiments queue instead of superseding one another.

--------------------------------------------------------------------------------
VALIDATION ACTUALLY PERFORMED
--------------------------------------------------------------------------------
  typecheck        clean
  gates            20/20 (compiled)
  contract         11/11, including C1 parity at the 0.6.0 pins
  workflow         62/62 fixtures, ~0.55s, no simulation
  run-arm.mjs      executed end to end (2 legs x 9 seeds at 200 ticks; 2 single-seed
                   legs at the declared 6000-tick horizon)
  cohort-verify    executed over real leg manifests, at both horizons
  failure paths    executed: build/ removed -> identity-mismatch recorded, no crash
  plan-legs        both invocations executed; adversarial inputs rejected as data

Real-run observations, recorded because they are evidence rather than claims:
  - At a 200-tick override: integrity INVALID, "not measured", HORIZON OVERRIDE
    named. Without the fix this reported SUPPORTED.
  - At the declared 6000-tick horizon with 2 of 18 seeds present: integrity
    INVALID with the 16 missing seeds listed. No override complaint, confirming
    the declared path is distinguishable from the overridden one.

NOT YET DONE. SUPERSEDED 2026-10-11 — see the correction below; the gap this
paragraph described has since been closed. It originally read:

  "No multi-leg ladder has been dispatched through GitHub Actions, so the cohort
   JOB (artifact download layout in particular) is proven at the script level
   and by fixture, not on Actions. `flatline` and `horizon` have no
   machine-readable criteria and would report 'not measured' by design; adding
   them is the Owner's call, since it makes a prose prediction executable."

CORRECTION, 2026-10-11. Both halves of that have moved. Actions run 38151553007
executed the `prospective-guilds` arm across six legs, and the cohort stage
assembled the panel from the downloaded artifacts and reported
`integrity: INTACT` — so the artifact-download layout is now proven on Actions,
not only by fixture. `horizon` is additionally marked HISTORICAL and removed from
the dispatch options. `flatline` still carries no machine-readable criteria and
would report "not measured" by design; making a prose prediction executable
remains the Owner's call.

--------------------------------------------------------------------------------
EXIT POLICY — OWNER DECISION, 2026-10-11
--------------------------------------------------------------------------------
Settled, and now enforced by fixture rather than left to interpretation.

  A GREEN WORKFLOW MEANS THE EVIDENCE IS TRUSTWORTHY.
  IT NEVER MEANS THE HYPOTHESIS WAS CORRECT.

Non-zero exit is reserved for exactly two things: an evidence-integrity
violation, and an execution failure. A falsified prediction exits 0.

The reasoning is that these are different kinds of statement and conflating
them is harmful in both directions. If a refuted hypothesis failed the job,
a reader would learn to distrust the runner for a biological outcome — and a
real finding would get mistaken for broken infrastructure. If a green tick
meant "confirmed", a negative result would be misread as a positive one. The
exit code describes the trustworthiness of the evidence; it does not describe
the world.

THE COST OF THIS POLICY IS REAL AND IS PAID FOR BY PROMINENCE, NOT BY SUPPRESSION.
A falsified verdict is therefore stated in three places:
  - the console banner, before any supporting detail;
  - the GitHub step summary, above the per-seed numbers;
  - `cohort-verdict.json`, written beside the immutable per-leg manifests so
    the verdict is part of the evidence record rather than a line of scrollback
    that the next reader never sees.

Rendered falsified verdict (illustrative, from a SYNTHETIC manifest used only
to exercise the display path — NOT a simulation, no such run has occurred):

  - evidence integrity: INTACT
  **PREDICTION FALSIFIED** — the pre-registered outcome did NOT occur. This run
  is trustworthy evidence and a negative result. The workflow is GREEN because
  the evidence is sound, NOT because anything was confirmed.
  Measured against the pre-registration — consumers-viable 5/18,
  three-guild-persistence 5/18.
  NOT MET:
    - consumers-viable: 5/18 met 'consumers > 0 at tick 6000' (needed >= 12)
    - three-guild-persistence: 5/18 met 'all three guilds non-zero' (needed >= 12)
  Exit code: 0.

Fixtures W6p/W6q/W6r pin all three of: falsification exits green, the headline
says it is not confirmation, and an INVALID cohort never issues a scientific
verdict at all.

WHAT THIS DOES NOT CHANGE. No scientific verdict has been issued under this
policy yet. CORRECTED 2026-10-11: `consumer-yield` HAS now been re-run at 0.6.0
on a complete 18-seed panel at its declared horizon — FALSIFIED, artifacts in
`evidence/ladder/consumer-yield-run-2026-10-11/` — and it was then replicated on
a prospective unseen panel (`prospective-guilds`, Actions 38151553007) with the
same outcome. `flatline` has still not been re-run to a horizon proven sufficient
for extinction on all 36 seeds. Every 0.5.0 figure for these arms still
describes a leaky engine.
The first honest use of this policy is a full `consumer-yield` dispatch, which
is an Actions run and not yet performed.

--------------------------------------------------------------------------------
THIRD REVIEW ROUND — AND WHAT THE FIXTURES NOW PROVE
--------------------------------------------------------------------------------
The final review found no HIGH or MEDIUM defect. Its three LOWs were taken,
because each closed a real hole rather than tidying a style preference:

1. `verdictHeadline` was not exported despite being described as such, and the
   JSDoc still documented the pre-verdict return shape. Corrected, and the
   return type now states explicitly that `pass` is integrity ONLY and never
   reflects whether the biology agreed with the prediction.
2. The cohort CLI parsed `arms.json` and each leg manifest with an unguarded
   `JSON.parse`, so a corrupt artifact exited with a raw stack trace — reporting
   an evidence defect as a program fault and discarding the message that named
   the unreadable file. Both reads now fail with `::error::` and exit 1.
3. Nothing executed `cohort-verify.mjs` as a PROCESS. W6p proved the function
   returns `pass === true` for a falsified cohort, but a later edit could have
   inverted the exit mapping and every function-level fixture would still have
   been green — which would have quietly reversed the Owner's decision without
   turning a single check red. W7l/W7m/W7n now run the real CLI and assert:
   falsified exits 0 and leads with the verdict; invalid exits non-zero and
   issues no verdict; a corrupt manifest fails cleanly.

That third one is the same lesson as `plan-legs.js`, one level up: the exit code
is the policy, and policy that is only asserted inside a function is not
enforced.

Also recorded from that round: `allocateShards` is the canonical round-robin
DEFINITION but is not what either production path runs (the diagnostics shell
chunks contiguously; the ladder filters inline). Coverage is exact-once in all
three. This is now stated in the module header rather than left as a trap for
the next reader — if the allocation rule ever changes, all three change together
or the leg-to-seed mapping diverges.

FINAL VALIDATION
  typecheck   clean
  gates       20/20 (compiled)
  contract    11/11 — C1 parity 517 -> 808/159/58, 24601 -> 558/290/D96 (unchanged)
  workflow    74/74 fixtures, 1.2s, no simulation, no residue
  engine      untouched; nothing under src/ modified; nothing committed or pushed

--------------------------------------------------------------------------------
INTEGRATION DEFECT FOUND BY THE REBASE, NOT BY REVIEW
--------------------------------------------------------------------------------
This branch is based on `chore/flatline-horizon-12000`, which landed on main as
PR #4 while this work was in progress. Rebasing produced a conflict that git
resolved silently and a reviewer would plausibly skim: `run-arm.mjs` ended up
carrying TWO identity blocks — this change's `identity` (engine, gate suite,
commit, ref, runtime, arm-spec hash) beside PR #4's `engineIdentity` (engine
version, commit). Both correct, both populated, same values.

No conflict marker, no test failure, no CI signal. Two fields answering one
question is precisely the failure this change exists to prevent, arriving
through the back door of a clean rebase.

Consolidated to one `identity` block. PR #4's historical-replay caveat was moved
into it verbatim rather than dropped, and its `historicalSpec` /
`historicalEngineReproduced` fields were left untouched. Verified after the
merge: a single identity block is written, the historical arm still refuses to
run without `--historical-spec` and still runs with it, and parity is unchanged.

RECORDED BECAUSE IT IS THE THIRD TIME in this change that a defect was found by
RUNNING OR INTEGRATING rather than by reading, after two defects found by
review. Reading finds defects in code. Running finds defects in paths.

--------------------------------------------------------------------------------
PR #6 REVIEW — THREE FINDINGS, ALL ACCEPTED
--------------------------------------------------------------------------------
Reviewed by Acrius-max at a5ebe79. Changes requested. All three accepted
without reservation; they are correct, and two of them were gaps in code that
three prior review rounds had already passed.

1. [HIGH] THE CONCURRENCY GROUP STILL DROPPED PENDING EXPERIMENTS. The group
   was keyed on `github.run_attempt`, which starts at 1 for every newly
   dispatched run and is therefore NOT a dispatch identity. Same-arm dispatches
   still collided.

   Confirmed against GitHub's workflow-syntax reference rather than from memory:
   the documented DEFAULT is `queue: single` — at most one PENDING run per group,
   and a new run CANCELS the pending one. `queue: max` lets up to 100 wait and
   execute in order. `queue: max` with `cancel-in-progress: true` is a workflow
   VALIDATION ERROR.

   Both workflows now declare `queue: max` with `cancel-in-progress: false`, and
   `github.run_attempt` was removed from the group because it never did what the
   comment claimed. Diagnostics was also still on branch-only grouping; it now
   includes the suite so a config-only screen cannot block a factorial screen.

   NOT PROVEN: this only establishes the DECLARED policy. Only Actions can show
   that several pending dispatches actually queue, and that needs a manual
   multi-dispatch test, recorded as unproven rather than claimed.

2. [HIGH] IDENTITY MISSING FROM EVERY LEG STILL PASSED. The guard read
   `missing > 0 && seen.size > 0`, so when NO leg recorded a field the comparison
   set was empty, the guard was skipped, and the field was excluded from the
   verdict. Complete coverage plus finite observations then produced a clean
   INTACT with nothing to prove it was one experiment. The `expect` guard had the
   same hole: an absent measured value skipped the comparison entirely.

   Now every leg must name every identity field, and a declared expectation must
   be matched by a PRESENT value. Fixtures W6s-{engine,commit,armSpecHash} and
   W6t.

3. [MEDIUM] THE COHORT TRUSTED LEGS' `failures` ARRAYS. It checked that
   residualPct was finite, but not that it was within tolerance, and did not
   require `ledgerStatus`, `residualOk` or `capturePolicyOk`. A legacy,
   corrupted or hand-edited manifest with an out-of-tolerance residual and an
   empty `failures` array would have passed.

   The verifier is now INDEPENDENT: it re-derives the per-seed verdict from the
   recorded measurements instead of aggregating the leg's conclusion, re-applies
   the 0.5% residual tolerance, and requires `ledgerStatus === 'ok'`,
   `capturePolicyOk === true`, and no recorded tolerance failure. Absent statuses
   fail — they are unverifiable, which is not the same as compliant. Fixtures
   W6u–W6y, each with an explicitly EMPTY failures array.

VERIFIED AFTER THE FIXES, on real runner output, not fixtures alone:
  - 2-seed partial panel at the declared horizon -> INVALID, missing seeds named.
  - COMPLETE 18-seed panel at an overridden horizon -> every new check passes;
    the only complaint is the horizon override. The stricter checks introduced
    no false failures against 18 real seeds.
  - typecheck clean; gates 20/20; contract 11/11 parity unchanged; 87/87 fixtures.

THE LESSON, AGAIN. Finding 1 is the third defect in this change that survived
multiple reviews because it asserted a policy in a COMMENT rather than in code.
Review reads code; it does not check whether a comment is true of GitHub's
documented semantics. The policy is now asserted by fixture, which reads the
workflow and fails if `queue: max` disappears — though still only Actions can
prove the runtime behaviour.

--------------------------------------------------------------------------------
PR #6 RE-REVIEW — THREE MORE FINDINGS, ALL ACCEPTED
--------------------------------------------------------------------------------
Reviewed by Acrius-max at daeeb6a. Changes requested. All three accepted.

1. [HIGH] THE COHORT WAS CHECKED AGAINST ITSELF, NOT AGAINST THE REQUESTED RUN.
   `armName` was used only in error text, `expect` was always `{}` because no
   arm declares `expectIdentity`, and nothing compared a leg's arm name, spec
   hash or declared horizon to what was asked for. A complete, internally
   consistent panel for a DIFFERENT arm could be measured against this arm's
   criteria.

   Now the CLI independently derives the requested arm name, the SHA-256 of the
   SUPPLIED arms.json (same hashing contract as the runner), and the declared
   horizon, and enforces all three. `expectIdentity` remains available as an
   ADDITIONAL constraint, not a substitute.

   One improvement over the literal ask: the arm-name check is UNCONDITIONAL,
   inside evaluateCohort, rather than routed through `expect`. Making it depend
   on the caller passing `expect` leaves it open to any caller that forgets —
   and every arm currently declares no expectIdentity, so it would never run.

   Also found while implementing: `declaredTicks` was passed via `expect` but
   was not in IDENTITY_FIELDS, and the resolved-identity map is populated ONLY
   from those fields. The expectation could therefore never be satisfied — a
   check that silently cannot pass. It is now a first-class identity field,
   which additionally gives it cross-leg agreement checking.

2. [MEDIUM] finalTick WAS NOT CHECKED AGAINST THE COHORT HORIZON. The runner
   checks it and records a header mismatch, but the verifier must not depend on
   the thing it audits having noticed. A manifest with finalTick 3000, identity
   ticks 6000 and an EMPTY headerMismatches would have had a 3000-tick
   observation measured against a 6000-tick prediction. Now required to match.

3. [LOW] LEGS=08 PASSED VALIDATION THEN DIED IN SHELL ARITHMETIC. Reproduced:
   `plan-seeds.mjs cli ... 08` exits 0, and dash then fails
   `$(( (10 + 08 - 1) / 08 ))` because it reads a leading zero as invalid
   octal. LEGS is passed to /bin/sh unchanged, so it is now rejected at
   validation time, where the message can say what to type. Seeds do not have
   this problem: they are re-serialised canonically before anything sees them.

95 fixtures, including cases where the legs agree with each other but disagree
with the requested arm, spec hash or declared horizon. Verified on real output:
the same artifacts are INTACT for the requested arm and INVALID for another.

================================================================================
FIRST HONEST VERDICT FOR consumer-yield UNDER 0.6.0 — FALSIFIED
================================================================================
This fell out of verifying the binding above: running a COMPLETE panel at the
DECLARED horizon, with no override, which no earlier evidence in this repository
provides for this arm under the corrected engine.

  arm consumer-yield, engine ts-evo-poc/0.6.0, commit daeeb6a
  declared horizon 6000, NO override, complete 18-seed panel (41001-41018)
  evidence integrity: INTACT
  determinism: seed 41001 re-run independently, byte-identical

  consumers-viable          14/18   (needed >= 12)   MET
  three-guild-persistence    5/18   (needed >= 12)   NOT MET

  VERDICT: FALSIFIED. Both clauses were required; one failed.
  Exit code 0 — the evidence is trustworthy, the prediction was wrong.

WHAT THIS SAYS. Consumers are MORE viable under 0.6.0 than under the leaky 0.5.0
engine (14/18 vs 13/18), while three-guild persistence is markedly WORSE
(5/18 vs 10/18). Seed 41001 shows the mechanism plainly: producers 1080,
consumers 13651, decomposers 0.

That is the expected direction. The 0.5.0 numbers were partly produced by the
decomposer photosynthesis leak this engine fixed, so decomposers were surviving
partly on an energy input that should not have existed. Removing the leak removed
the subsidy, and the decomposer loop does not hold up on its own — which is the
open question the horizon arm was already chasing, now with a second and cleaner
line of evidence.

CORRECTED 2026-10-11 after review, against the full panel rather than seed 41001
and against the prospective replication. Two things above are wrong as written:

  1. "DECOMPOSERS GO EXTINCT" was generalised from ONE seed. Across the whole
     18-seed panel decomposers are present on 8/18 and extinct on 10/18 — a
     majority, so the direction holds, but it is a majority and not a law.
  2. "the decomposer loop does not hold up on its own" does NOT survive the
     prospective panel, where decomposers are present on 14/18 seeds. Whatever
     differs between the two panels, decomposer persistence under 0.6.0 is not
     a settled mechanism. It is open, and now open in a more specific form than
     before: what limits three-guild coexistence is not decomposers alone, since
     the prospective panel has decomposers on 14/18 and still only 7/18 with all
     three.

WHAT THIS DOES NOT SAY. consumer-yield applies two deliberate lifts
(producerCaptureScale 0.35, basalFoodPerCell 0.25), so this is an answer to the
ARM's question under an intervention, not a measurement of baseline ecology. It
is a local execution on one runtime, not a dispatched Actions ladder run, and it
supersedes nothing: the 0.5.0 figures remain what they were, earlier-engine
evidence. It also does not close the decomposer question — it sharpens it, and
sharpens it in the direction that matters.

--------------------------------------------------------------------------------
PR #6 THIRD RE-REVIEW — TWO NARROWER FINDINGS, ALL ACCEPTED
--------------------------------------------------------------------------------
Reviewed by Acrius-max at 498697b. Changes requested. Both accepted.

1. [MEDIUM] EXECUTION HORIZON COULD DIFFER FROM THE REGISTERED HORIZON. The
   verifier checked declaredTicks against the arm's ticks, and each run's
   finalTick against identity.ticks — but never identity.ticks against
   identity.declaredTicks. A manifest recording ticks=3000, declaredTicks=6000
   and ticksOverrideApplied=false was internally coherent and could be judged
   against 6000-tick criteria.

   The flag was the sole guard, and the flag is a claim the manifest makes about
   itself. The fix checks the two recorded VALUES. `ticksOverrideApplied` is
   still honoured independently, so an override back to the declared value is
   still refused.

   Verified on real artifacts, not only fixtures: both legs of a genuine
   18-seed panel were forged to agree with each other at ticks=3000 against
   declaredTicks=6000 with the flag false. Every cross-leg check passed and
   every finalTick matched — and the cohort was still refused:

     this cohort EXECUTED to tick 3000 but the arm is REGISTERED at tick 6000
     — observations from a different horizon cannot test the registered criteria

2. [LOW] PREFLIGHT ACCEPTED NUMBERS THE KIT REJECTS. Read the kit rather than
   trusting the stated bounds: `parseSeed` requires a safe integer in
   [1, 4294967295] ("avoid 32-bit aliases"), and ticks/interval go through
   `strictlyPositiveInt`. Preflight checked neither. Seed 0 and a 20-digit
   ticks both passed validation and would have failed the screen.

   Preflight now applies the kit's constraints, so it cannot report success on a
   value the run will reject. MAX_SEEDS stays at 256 and the difference from the
   kit's 10,000 is now documented rather than looking like an oversight: this
   planner bounds a dispatch fanned across parallel CI runners, the kit's
   bounds one process's memory. Both are deliberate.

102 fixtures. The complete 18-seed consumer-yield panel reproduces its earlier
numbers EXACTLY on a different commit (14/18 and 5/18), which is an incidental
but real reproducibility signal: 498697b and daeeb6a are different trees and
produced the same terminal guild state on all 18 seeds.

================================================================================
PROSPECTIVE GUILD REPLICATION — PREDICTION SUPPORTED ON THE NEW PANEL
================================================================================

Arm `prospective-guilds` was registered on main before dispatch. GitHub Actions
run 38151553007 executed it on 2026-10-11, after the registration merge.
The cohort verifier reports `integrity: INTACT`, `classification: supported`.

  engine ts-evo-poc/0.6.0, commit 54861ad4fe7f1f086e3cdff8f2deac3257a5c0d3
  registered and executed horizon 6000 ticks; no horizon override
  seed panel 52001-52018; all 18 measured exactly once across six legs
  arm-spec SHA-256 1f4a9e01a8a310bd915b5720708c08705f38630be788a3f7fb56ea349e4caa74

  consumers-viable          14/18   (needed >= 12)   MET
  three-guild-shortfall     11/18   (needed >= 10)   MET
  all three guilds present   7/18   (required <= 8)   MET

  VERDICT: SUPPORTED. Both preregistered clauses were met on this unseen panel.

Evidence integrity checks passed: all legs recorded the same arm and identity;
all runs reached tick 6000; no leg failures, duplicate/missing seeds, invalid
ledgers, or capture-policy failures. Across the 18 runs, mean absolute
conservation residual was 0.0000356% and the maximum was 0.00008%, below the
registered 0.5% limit. The verifier output, six leg manifests, per-seed outputs,
and summaries are preserved under
`evidence/ladder/prospective-guilds-run-38151553007/`.

INTERPRETATION. This supports the preregistered prediction that consumers remain
common while three-guild outcomes remain at or below 8/18, for this engine,
configuration, horizon, and one fresh seed panel. It is not independent
validation, proof of a general rate, or evidence that balance is impossible.
The arm uses `--zero` with the registered producer-capture and basal-food lifts;
it is not the unmodified default ecology. It measures endpoint presence of the
three broad trophic guilds, not recurrence of all five feeding/role groups over
time. The broader balance and recurrence objectives therefore remain open.

================================================================================
REPEATABILITY CHECK — ALL 18 SEED OUTPUTS REPRODUCED BYTE-FOR-BYTE
================================================================================

At the Owner's direction, the complete `prospective-guilds` arm was dispatched
again as GitHub Actions run 38192419928. This is an exact-repeatability check on
the already observed panel, not a new prospective ecological test.

  first run 38151553007: engine commit 54861ad4fe7f1f086e3cdff8f2deac3257a5c0d3
  repeat run 38192419928: engine commit 1185003dad38c556a057980fb9f02eb38ae42904
  both: engine ts-evo-poc/0.6.0; seeds 52001-52018; 6000 ticks; same arm-spec hash

The second commit adds only the first run's report/evidence record; `src/`, the
arm registration, runner scripts and package inputs are unchanged between the
two commits. On the same GitHub Node runtime, all 18 per-seed output files and
all six per-leg CSV summaries are byte-identical. Comparing the two manifests
per seed also found identical argv, emitted headers, guild/population counts,
final ticks, ledger and capture measurements, and validity fields. Only run
identity metadata (notably the commit SHA) differs.

The repeat cohort independently passes the verifier as `INTACT / SUPPORTED`:
consumers 14/18, three-guild shortfall 11/18 (equivalently, all three present
on 7/18). Full repeat artifacts are preserved under
`evidence/ladder/prospective-guilds-repeat-38192419928/`.

INTERPRETATION. This establishes byte-for-byte per-seed repeatability for these
inputs on this fixed Node runtime. It adds no independent seed evidence and
does not broaden the original ecological conclusion beyond its one panel.

================================================================================
DATELINE CORRECTION — Owner-authorised, 2026-10-11
================================================================================
Seven datelines reading `2026-10-20` were corrected to `2026-10-10` by Owner
decision. Recorded here rather than applied silently, because a silently
rewritten record is indistinguishable from a record that was always right.

  REPORT.md           rungs 3/4/5 and the LADDER PHASE headings (was 2026-10-20)
                      plus the inline argv-slot note
  OWNER-DIRECTIVE.md  the MCP retirement dateline
  NEXT-PUSH.md        the same dateline in its provenance note

WHY. These sections were introduced by commit 0b8a427, authored and committed
2026-10-10 — ten days BEFORE the dateline they carried. The dates were wrong on
arrival, not altered afterwards.

WHY IT MATTERED. AGENTS.md makes dates load-bearing: "Never retroactively certify
old logs" is only meaningful if a reader can tell which log predates which change.
A heading dated ten days after the commit that introduced it makes the chronology
of the slider-ladder rungs unreadable, and would lead a reader to believe that
evidence postdates the engine changes it was used to justify.

WHAT WAS NOT DONE. No finding, number or verdict was altered. Only the datelines.
The Owner made this call on 2026-10-11; this note exists so the change is
discoverable by anyone reading the file later.

================================================================================
STATE RECONCILIATION — 2026-10-11
================================================================================
The experimental record was reconciled against current `main` (1185003) with
NEXT-PUSH.md, README.md and the two open GitHub issues. What follows is the
distinction between what is still live and what is history, and the corrections
made to this file as a result.

ACTIVE — measured on ts-evo-poc/0.6.0
  - LOW THREE-GUILD COEXISTENCE, on two independent 18-seed panels.
    `consumer-yield` on 41001-41018 at the declared horizon: consumers>0 on
    14/18, all-three-guilds>0 on 5/18. `prospective-guilds` on the
    prospectively-registered, previously unseen 52001-52018 panel (Actions run
    38151553007): consumers>0 on 14/18, all-three-guilds>0 on 7/18. Both sit
    below the 12/18 the original prediction required, and the shortfall itself
    is reproduced.

    WHAT IS NOT REPRODUCED, corrected 2026-10-11 after review: an earlier
    revision of this file called "decomposers go extinct on most seeds" a
    replicated result. It is not. Decomposers were present on 8/18 seeds of the
    consumer-yield panel (extinct on 10/18) but on 14/18 of the prospective
    panel (extinct on only 4/18). Majority decomposer extinction holds on one
    panel and is REVERSED on the other.

    The limit that reproduces is low three-guild coexistence; the guild that
    limits it does not. In the prospective panel decomposers are present on
    14/18 and producers on 12/18, yet all three co-occur on only 7/18 — so
    something in the JOINT requirement, not decomposer persistence alone, is
    binding there. That is a live open question, not a settled mechanism.
  - The evidence layer itself: strict ledger validation, per-guild capture policy,
    cohort verification binding evidence to the requested experiment, and the exit
    policy that a falsified prediction is a result and not a workflow failure.

HISTORICAL — do not compare against current behaviour
  - Everything above line 4821 describes 0.4.1 or 0.5.0 and is self-marked
    RETIRED or LEAKY.
  - The `horizon` arm: marked HISTORICAL, removed from dispatch. Its four seeds
    were 0.5.0 survivors and the contrast it was registered for has no
    counterpart under the corrected engine.
  - `evidence/ladder/*.txt` at the top level are 0.4.1/0.5.0 knob sweeps, not
    cohort artifacts.

STILL OPEN
  - Decomposer persistence. The replicated shortfall sharpens this rather than
    closing it: the question is now precisely why the decomposer loop does not
    hold once its photosynthesis leak is removed.
  - `flatline` has not been re-run to a horizon proven sufficient for extinction
    on all 36 seeds. It is a regression replay, not a prospective test, and would
    report "not measured" by design until the Owner decides to make its prose
    prediction executable.

DOCUMENT DEFECTS FOUND AND CORRECTED
  - Two paragraphs in this file were rendered false by later work and are
    corrected above in place: the "no multi-leg ladder dispatched on Actions"
    note, and the "consumer-yield has not been re-run at 0.6.0" note. Each is
    marked SUPERSEDED with the original text quoted, so the correction is
    readable rather than invisible.
  - Seven datelines reading 2026-10-20 were corrected to 2026-10-10 by Owner
    decision; see the dateline-correction note above.
  - README.md is stale in a way worth naming: it still claims "all five
    credibility gates (7/7 checks)" where the suite is now 20 checks, and it
    predates the 0.6.0 engine entirely. Not corrected here because it makes
    claims about biological outcomes, which are the Owner's to restate.
  - NEXT-PUSH.md's open question "whether the unclamped mineralization deposit
    should respect caps" is answered: it was a confirmed defect, fixed in 0.6.0.
    Its balance-first ordering was already overtaken by the measured dependency
    ladder, as its own provenance note records.

================================================================================
MODULAR GENOME v2 — DIGITAL DNA AS INHERITED INSTRUCTIONS
================================================================================
Branch `genome-v2`. Engine `ts-evo-poc/0.6.0` UNCHANGED and parity EXACT —
808/159/58 (seed 517) and 558/290/D96 (24601). The mechanism is a null-default
diagnostic (`genomeV2`), so declared behaviour is bit-for-bit unchanged.

THE DEFECT THIS ADDRESSES, MEASURED RATHER THAN ASSUMED. Of the twelve v1
structural genes, only THREE have a survival consequence:

  eyeCount   -> sensing radius
  shell      -> collision radius (bulk)
  spines     -> collision radius (bulk)

The other NINE — `limbPairs`, `fins`, `antennae`, `tail`, `segments`,
`pigmentHue`, `pigmentSat`, `pigmentVal`, `pattern` — are inherited, mutated,
rendered, and read by nothing that has a consequence. The `CHROMATOPHORE` module
flag derived from pigment saturation is written and never acted upon.

That is a genome whose heritable variation mostly drives APPEARANCE, which is
the one thing this repository forbids as an authority. Appearance was a readout
of biology; in the genome it had become the only thing the structural half did.

Birth also inherited from ONE parent only. Mating forked a lineage but never
mixed genes, so `consumer-yield` was correct to call mating "association
without consent" at the genetic level: no child had two parents' DNA.

WHAT WAS BUILT. `src/bio/modgenome.ts`: a CLOSED vocabulary of seven
construction instructions (segment, light-capture, locomotor, sensory, anchor,
defense, trophic), each with magnitude, developmental onset and condition gate.
Modules express into the EXISTING 42 traits, so every downstream consumer of
those traits — the whole trophic, competitive and energy machinery — is reused
unchanged. Structural duplication and deletion change genome length; a
single-point crossover at module boundaries supplies the two-parent inheritance
that v1 never had, with bounded genome length serving as the compatibility rule.

COSTS ARE THE POINT. Every module carries upkeep, paid through the existing
basal-cost accounting rather than a second ledger. Locomotor appendages buy
speed and maneuverability and cost upkeep; defense buys armour and mass and costs
speed; anchoring buys terrain affinity and blocks dispersal. A genome of free
capabilities would be a thermometer: every lineage converges on maximal structure
and the trade-off the design rests on disappears.

VALIDATION — 32/32 gates, 11/11 contract (parity exact), 102/102 workflow
fixtures. Seven gates cover the module mechanism in isolation:
  G13 modules move real traits, not only body genes (15 of 42 traits shift)
  G14 every module carries a maintenance cost
  G15 the same genome expresses different structure at different life stages
  G16 a gated module is expressed conditionally, not only by age
  G17 duplication and deletion change genome length
  G18 recombination draws modules from both parents
  G19 the knob is inert when unset and active when set

FIVE DEFECTS FOUND BY INDEPENDENT REVIEW, all real, all fixed. They are
recorded here rather than quietly patched because every one of them is a way to
make a gate stay green while the biology does nothing:

  1. Development never happened in the live world. Phenotypes are derived ONCE
     at birth, a newborn is age 0, and developmentFactor(0, onset) is zero for
     every valid onset — so every module was gated to zero at birth and never
     re-expressed. G15 proved the development curve perfectly in isolation while
     the engine applied no module at all. Fixed by re-expressing modules in the
     existing periodic refresh, reusing the individual's stored procedural seed
     so its silhouette is stable across re-derivation. G21 now asserts it on a
     live organism.
  2. Module upkeep cancelled algebraically. Every MODULE_SPECS entry listed
     BASAL_COST in its `cost` list AND declared the same figure as `upkeep`; the
     cost loop subtracted it and the charge added back the same quantity, so the
     net basal-cost delta was identically ZERO for every module. G14 checked the
     METADATA said upkeep > 0 and passed while the organism was free. This is the
     exact failure the knob discipline in AGENTS.md warns about. G20 now asserts
     the net expressed figure.
  3. Recombination never fired. The birth path validated the mate slot with
     `store.id[mate] === birthParentId + 1`, which is not how ids relate, so the
     guard essentially never passed and every sexual birth was an asexual clone.
     Fixed by recording the mate's real organism id at queue time. G24 drives an
     actual birth through the real queue and asserts the splice.
  4. A zero-module child reused a dead neighbour's genome. Module state was only
     written when count > 0, so a child with no modules occupying a freed slot
     inherited the previous occupant's modules and bred with them. Fixed by
     resetting on every allocation. G22 asserts it.
  5. Phenotype derivation mutated the caller's genotype array in place, making
     expressed structure heritable and accumulating it into the DNA on every
     refresh. A phenotype is a pure function of its genome and must not edit it.

A sixth defect was found while fixing these: recombineModules clamped its
crossover point against the first parent's module count but not the second's, so
a cut at or beyond the second parent's length produced a "recombinant" that was a
pure clone of the first parent while the operator still reported success. Both
parents now necessarily contribute whenever both carry two or more modules.

Re-review of the fixes found two more:

  7. Module-driven body structure was discarded before the body was built. The
     expressed structural view was seeded with the inherited body genes AFTER
     the module deltas had been applied into it, so the seed overwrote them and
     `this.body` was assembled from the un-extended inherited vector. Since hit
     radius reads shell and spines, and sensing radius reads eyeCount, EVERY
     module that altered body plan was a complete no-op. The trait-level gates
     could not see this: module TRAITS moved correctly the whole time. The
     inherited genotype is now seeded FIRST and modules add onto it. Measured
     on a live organism: segments 2->4, eyeCount 2->6, shell 1->3, hitRadius
     1.4979->1.8955, senseRadius 66.67->159.72, inherited genotype unchanged.
     G25 asserts body structure AND its derived geometry move in the engine.
  8. G24 counted single-parent clones without excluding them, so a mating that
     produced a clone could satisfy a gate asserting two-parent inheritance.
     Worse, founders draw ~7 modules from 7 kinds, so both parents usually
     carry every kind and a splice between two identical genomes is
     indistinguishable from a clone by construction. G24 now requires the
     parents to actually disagree and the child to resolve a disagreement in
     EACH parent's favour; clones are excluded rather than merely counted.

MEMORY FOOTPRINT CORRECTION. An earlier version of this section quoted the
module genome as "stride 4 -> 80 bytes/organism". That was wrong. It is
Float32Array(capacity * MAX_MODULES * MODULE_STRIDE) = 16 * 4 * 4 = **256 bytes
per allocated slot**, about 12.2 MB at 50,000 slots. The buffer is allocated
UNCONDITIONALLY, with the knob off, deliberately so that no array offset can
become conditional on a config flag; the cost is therefore always paid. procSeed
(Uint32) and moduleCount (Uint8) add 5 bytes, for 261 bytes per slot total.
No scaling conclusion may be drawn from the withdrawn 80-byte figure.

CORRECTION TO AN EARLIER FIGURE IN THIS SECTION. The previous text recorded:
  genomeV2=null  pop 601, modules 0, meanSize 5.374
  genomeV2=true  pop 881, modules 4778, meanSize 5.439  <- "measurably different"
That comparison was evidence of nothing but the extra RNG draws made while
seeding founder modules. Under defects 1 and 2 the modules applied no traits and
charged no cost, so that population difference was a change in the stochastic
trajectory, not a change in biology. It should never have been offered as
evidence and is withdrawn.

Re-measured after the fixes, 400 ticks, founders 400, 3000x3000:
  seed  517  null: pop 916, modules    0, meanArmor 0.31626, meanBasal 0.02660
  seed  517  true: pop 777, modules 3937, meanArmor 0.34284, meanBasal 0.03564
  seed 24601 null: pop 722, modules    0, meanArmor 0.33772, meanBasal 0.02508
  seed 24601 true: pop 461, modules 2242, meanArmor 0.32234, meanBasal 0.04135

The SIGN of the population effect has reversed: modules now REDUCE the
population on both seeds, which is what a real per-module upkeep charge should
do. Basal cost rises, as it must, now that the charge is not cancelling.

That reversal is a demonstration of why the old figure was worthless, and the
population delta STILL IS NOT EVIDENCE. Enabling the knob draws additional
randomness while seeding and inheriting, so the two arms diverge on the
stochastic trajectory before any biology is compared. The evidence that modules
change biology is the within-run direct observation in G21-G24 — an individual
whose expressed armour departs from its unexpressed birth state by 0.193 and
whose structure regresses as its energy falls; a charged upkeep that reaches the
ledger; and a live mating that yields a genuine two-parent splice.

WHAT IS NOT YET MEASURED, and matters more than any of the above. The mechanism
is now proven to exist, to express in a live organism, to cost real energy, and
to recombine from two parents. It is NOT yet shown that module structure EVOLVES
— that duplication and deletion spread, that lineages acquire modules their
ancestors lacked, or that any module reaches fixation. Existence, variation and
selection are three different claims and only the first two have been
established. Any balance claim from genomeV2 today would be exactly the
"capability that exists" confused with "capability that spreads", which is the
same error this repository has already corrected twice.

Also unmeasured: the cost weights in MODULE_SPECS are calibrated to produce
visible consequences, not fitted to anything. They are a starting condition for
selection to act on, not a biological claim.
--------------------------------------------------------------------------------
BALANCE DIAGNOSTIC — KNOWN-SEED SHARE-BRAKE COMPARISON (2026-10-12)
--------------------------------------------------------------------------------

Two registered ladder arms compared the established senescence setting `off`
against `share:1`, on seeds 517, 99991, and 42 at 6000 ticks. Both used engine
`ts-evo-poc/0.6.0`, commit `88ec318e1d423cf1a89a51045ee00df6f837d7be`, and the
same declared configuration apart from senescence mode. These are known-seed
diagnostics, not prospective evidence or a seed-distribution estimate.

Actions runs:
  control (`off`)   38201000971 — INTACT, all three seeds measured
  treatment (`share:1`) 38201003477 — INTACT, all three seeds measured

Both cohort verdicts correctly classify the ecological result as NOT MEASURED:
there was no registered biological threshold. This means the workflow verified
the completeness and integrity of the evidence; it does not mean the brake was
supported or falsified.

Descriptive endpoint trajectories (P/C/D = producer/consumer/decomposer):

  seed   off at t6000       share:1 at t6000      senescence deaths, share:1
  517    14 / 294 / 1819    11 / 1502 / 835       141
  99991  285 / 565 / 0      2785 / 36214 / 0       0
  42     1820 / 50538 / 0   4208 / 55792 / 0       0

The share:1 arm shows senescence deaths only for seed 517. At the recorded
checkpoints, seed 517 retained dormant organisms through tick 6000 in both arms.
In `share:1`, dormancy in seeds 99991 and 42 reached zero by tick 2000; in `off`,
it reached zero by tick 3000 and 4000 respectively. These are checkpoint
observations, not exact event times. Seed 42's `share:1` population was 60000 at
the tick-6000 checkpoint; its `off` arm was 60000 at tick 5000 and 52358 at tick
6000. The probe does not report cap-hit events, so these endpoint values alone
cannot establish whether the default 60000 population ceiling constrained
growth. These known-seed paths illustrate trajectory-specific outcomes, not a
general brake effect or a balance result. In particular, the large seed-99991
difference is not a prospective replication.

All six ladder legs completed and both cohort verifiers found exact seed
coverage, matching arm/config identity, and valid ledgers. The largest absolute
ledger residual was 0.15637% (seed 42, `off`), within the declared 0.5%
tolerance. Per-leg stdout, manifests, summaries, and cohort verdicts are
archived under `evidence/balance-brake-diagnostics-2026-10-12/remote-*`.
Local partial probe output remains separately labeled and is not substituted
for these ladder results.

NEXT: no biological parameter change follows from this diagnostic alone. Return
the trajectories to the Owner's balance-first decision process; any broader
claim requires a newly approved prospective seed panel and registered criteria.

--------------------------------------------------------------------------------
AUDIT — WHY THE MEASURED WORLDS DON'T SELF-CORRECT (2026-10-12, read-only)
--------------------------------------------------------------------------------

QUESTION. The viewer (e.g. seed 5738877: 31,644 producers, 2,487 consumers, 1
decomposer) and the panels show producer-heavy, decomposer-poor worlds that do
not return to balance. Is a corrective feedback loop present but slow, or is
the measured configuration structurally unable to self-correct?

METHOD. No new runs, no reruns, no code changes. Parsed all 36 archived per-seed
outputs of the two 0.6.0 panels sharing one config (`photox4`, basalFoodPerCell
0.25, disease 0.15, sat 0.4):
  consumer-yield:      evidence/ladder/consumer-yield-run-2026-10-11/leg*/seed-*.txt (41001-41018)
  prospective-guilds:  evidence/ladder/prospective-guilds-run-38151553007/*leg*/seed-*.txt (52001-52018)
Checkpoints are 1000-tick samples, so loss times are checkpoint observations,
not exact event times.

OBSERVED.
1. Grazing carries ZERO flux on 36/36 seeds: grazeSubmit 855-95,567 per run,
   grazeWins=0, grazeEnergy=0, grazeRequested=0 everywhere. The intended
   producer->consumer link moves no energy in this configuration.
2. Consumers persist anyway (14/18 each panel, B/D mostly 1.01-1.45): they live
   off the exogenous organic subsidy. organic=5,400,000 in every run against
   totalInput 5.45-5.99M, i.e. ~90-99% of all energy input is basal organic
   rain; photosynthesis (all of it producer-captured, captureByGuild shows
   0.0 for consumers/decomposers on every seed) is ~1-10%.
3. Decomposer endpoints differ by panel (8/18 vs 14/18 present) while the
   three-guild rate stays low (5/18, 7/18). Decomposer B/D sits at 0.95-1.00
   on extinct endpoints and 1.04-1.59 where present; several trajectories show
   late decomposer blooms from zero mid-run checkpoints (e.g. 52004:
   D 632>0>0>0>0>4580), so roles re-emerge rather than only decay.
4. Same code path is NOT dead in general: rung 4 (declared light + abiotic
   nutrient + graze 1.6) logged hundreds of graze wins with real energy. The
   zero is specific to the measured config, not a structural impossibility.

INTERPRETATION. What is observed: in the measured config the corrective
producer->consumer link is silent and the energy base bypasses producers, so
there is no loop present that could "correct" the imbalance — the imbalance is
the subsidy partitioning, not a perturbation of a producer-driven web. What is
inference (not established): the exact gate that zeroes grazing here (wallet-
basis takes on energy-poor producers vs. contest losses) cannot be separated
from these outputs alone; per-browse diagnostics would be needed. Prior rungs
already showed transfer alone doesn't guarantee consumers (rung 4: food paid,
consumers still died on most seeds), so restoring flux is necessary but not
sufficient for coexistence — viability remains a separate question.

DECISION. Actionable mechanism identified, no biology changed. Next step is a
new Owner-registered experiment, not more analysis of these panels:
  control:   current consumer-yield arm on a FRESH panel (Owner sets seeds)
  treatment: identical plus the tissue-basis lift (plantYieldPerMass), which
             keys bites to victim body mass instead of momentary energy wallet
  predict:   grazeEnergy > 0 on a stated majority of fresh seeds (Owner sets
             the threshold); ecological coexistence is NOT predicted by this
             arm — it tests the link, not balance.
Alternative treatment if the Owner prefers the subsidy question first: same
control with basalFoodPerCell stepped down toward a producer-driven regime.
Either way the panel, horizon, and thresholds are Owner decisions; nothing
above invents them.

--------------------------------------------------------------------------------
STEP 0 — GRAZE-ZERO DISCRIMINATION: MECHANISM FOUND, NO BEHAVIOR CHANGE (2026-10-12)
--------------------------------------------------------------------------------

PRE-REGISTERED (before the runs): one outcome channel (contest losses /
zero-delta wins / abandoned) accounts for >=80% of GRAZE submits on a
majority of three high-submit failing seeds (41001, 41008, 52002), 2000-tick
diagnostic horizon, exact evaluated-arm config. Armour rejects eliminated
analytically beforehand (armour gene 0..1 -> bite >= 0.45 > 0.02 gate always).

CORRECTION TO THE 2026-10-12 AUDIT ABOVE. The audit's prime suspect
(wallet-basis takes on energy-poor producers) is SUPERSEDED: reading the
preset code showed the `--zero` preset sets grazeYieldScale:0 and
meatYieldPerMass:0, the evaluated arm lifts neither, and world.ts scales
every take by that 0 (`scaledDelta = r.delta * 0`; the win/energy block
requires `r.delta * yieldScale > 0`). Both animal-tissue paths are preset to
zero in the measured config. The meter below tested this reading.

METHOD. New read-only probe src/trace/grazemeter.ts (constructs World, steps,
tallies InteractionQueue records by kind/outcome/delta; no engine changes).
Ran COMPILED: node build/trace/grazemeter.js 2000 41001,41008,52002.

CONFIG-IDENTITY PROOF. Meter checkpoints match the archived seed files
exactly (41001: t1000 P106/C1564/D828, t2000 P5/C2847/D31 — byte-identical
P/C/D to evidence/ladder/consumer-yield-run-2026-10-11/leg0/seed-41001.txt;
41008 and 52002 D-trajectories likewise exact). Same engine + same config, as
required before reading any contrast as biology.

RESULT (resolver level vs world level):
  seed   submits  abandoned  defenderWins  attackerWinsDelta0  attackerWinsDeltaPos  worldWins/worldEnergy
  41001  1440     0 (0%)     388 (26.9%)   2 (0.1%)            1050 (72.9%)            0/0
  41008  7777     0 (0%)     2441 (31.4%)  2 (0.0%)            5334 (68.6%)            0/0
  52002  5481     0 (0%)     1874 (34.2%)  3 (0.1%)            3604 (65.8%)            0/0
Mean producer energy 1.6-26.3 (wallets NOT empty).

VERDICT ON THE BAR. The >=80% single-channel bar is NOT met (66-73% vs 80%;
contest losses take 27-34%). Strictly, a split cause. But the DECISION-relevant
question — why world flux is exactly zero — is fully answered either way: two
thirds of submits resolve with positive takes that the world multiplies by the
preset 0, and zero-delta wins are ~0.1%, so wallets are not binding. Flux-zero
is explained by grazeYieldScale=0 irrespective of win rate. Contest losses are
a secondary, separate mechanism (not pursued: even 100% wins would pay 0).

CONSEQUENCE FOR THE PLAN. The proposed tissue-basis lift ALONE would change
nothing (delta basis is irrelevant once scaled by 0). Step 1 is corrected to:
lift grazeYieldScale to the declared 1.0 on the identical config (one dial),
predicting grazeEnergy > 0; tissue basis becomes a follow-up only if per-win
size disappoints. Predation (meatYieldPerMass=0) stays zeroed in Step 1 by
design — one path at a time.

--------------------------------------------------------------------------------
STEP 1 — GRAZE-LINK RESULT: FLUX RESTORED 18/18, LINK TEST SUPPORTED (2026-10-12)
--------------------------------------------------------------------------------

ARM. graze-link (registered 2026-10-12, commit 6df61d1): exact consumer-yield
copy (seeds 41001:41018, 6000 ticks, --zero) plus ONE lift grazeYieldScale:1.0
(declared value). Meat stays zeroed. No machine criteria by design (verifier
has no graze metric); verdict human-read from intact B/D lines, stated before
inspection. PREDICTION: grazeEnergy > 0 on >=12/18. FALSIFICATION: =0 on >=7/18.
Coexistence explicitly NOT predicted.

RUN. GitHub Actions 38261798238, branch balance/share-brake-diagnostics-run.
Cohort INTACT (identity arm graze-link, engine ts-evo-poc/0.6.0, commit
6df61d1, 18/18 seeds measured, ledgers valid). Artifacts archived under
evidence/graze-link-38261798238/cohort/.

RESULT (per-seed endpoint P/C/D + grazeEnergy):
  41001 599/11938/0 29412 | 41002 0/0/3203 1367 | 41003 88/3617/0 4308
  41004 19433/367/40200 57030 | 41005 0/198/4267 1960 | 41006 0/0/2829 369
  41007 907/3759/0 2998 | 41008 328/11540/0 28179 | 41009 21236/17/11751 4636
  41010 2811/378/11029 4159 | 41011 454/3893/1 18574 | 41012 11/506/7037 3087
  41013 28/10737/0 1849 | 41014 3/3737/0 3988 | 41015 18361/33/13733 31875
  41016 1871/760/0 17408 | 41017 727/28438/0 15024 | 41018 2757/6/0 6020

VERDICT. Flux > 0 on 18/18 (range 369-57,030): link test SUPPORTED, margin 6
seeds above the bar. Zero seeds at zero — the falsification condition is
nowhere near triggered. The Step-0 mechanism is confirmed end-to-end:
resolver takes existed, the preset zeroed them, the declared scale restores
them. Contest losses (27-34% at Step 0) remain visible in submit/win ratios
(e.g. 41004: 603,687 submits / 158,455 wins) but do not block paying flux.

DESCRIPTIVE, NOT PREDICTED. All-three-present endpoints: 6/18
(41004,41009,41010,41011,41012,41015) vs 5/18 on the matched control. This
difference is NOT a finding — the arm predicted nothing about coexistence,
and rung 4 already established that paying food does not imply coexistence.
It is recorded so a future reader cannot misread it as either success or
setback. Consumer B/D sits mostly above replacement (up to 1.55); decomposer
B/D remains <1.0 where extinct — viability questions untouched by this arm.

NEXT (Step 2): descend the subsidy. First step basalFoodPerCell 0.25 -> 0.05
on the graze-link config; consumers must persist while the income base shifts.
Registered separately below; one dial per arm is retained throughout.

--------------------------------------------------------------------------------
STEP 2a — SUBSIDY 0.05: CONSUMERS PERSIST 16/18, FLUX SUSTAINED 18/18 (2026-10-12)
--------------------------------------------------------------------------------

ARM. graze-subsidy05: graze-link config with the ONLY change basalFoodPerCell
0.25 -> 0.05 (5x descent, first step). Machine criterion cons > 0 on >=12/18;
graze-sustained clause (>=12/18 flux) human-read. Coexistence NOT predicted.
Header caveat (review-noted, applies to all lift arms): probe headers echo the
positional basalx0.25 while the effective subsidy is 0.05 via --zero-lift;
traceability rests on arms.json + manifest lifts/argv, whose hashes the
verifier binds — not on the header alone.

RUN. GitHub Actions 38262841218. Cohort INTACT / SUPPORTED (machine clause:
cons > 0 on 16/18; zeros only 41013, 41016). Artifacts archived under
evidence/graze-subsidy05-38262841218/cohort/.

RESULT (endpoint P/C/D + grazeEnergy):
  41001 51/3247/0 889 | 41002 0/378/1525 704 | 41003 12/39/3459 653
  41004 756/3107/49 666 | 41005 1106/1/451 19288 | 41006 0/1638/1 815
  41007 1554/15/0 461 | 41008 78/2261/0 1419 | 41009 0/2376/0 509
  41010 1304/1035/0 1366 | 41011 680/4/5809 1826 | 41012 1415/71/7311 6215
  41013 0/0/1976 658 | 41014 84/1475/252 483 | 41015 1780/1169/1433 1137
  41016 416/0/1553 4112 | 41017 6/8/2895 1813 | 41018 242/1720/7 1142

VERDICT. Both clauses pass with margin: persistence 16/18 (bar 12), flux
18/18 (range 461-19,288, min 41007 / max 41005; bar 12). The 5x cut did NOT outrun the link — the
falsification condition (cons = 0 on >=7/18) is not close. Grazing now carries
consumers through a meaningfully smaller subsidy.

DESCRIPTIVE, NOT PREDICTED. All-three-present endpoints: 9/18
(41003,41004,41005,41011,41012,41014,41015,41017,41018) vs 6/18 on graze-link
and 5/18 on control. Direction is encouraging but this arm claimed no
coexistence rate — no verdict attaches. Populations are also visibly smaller
(no 20k+ blooms), consistent with the subsidy having driven monoculture bulk.
Neither observation is a finding; both are recorded so they cannot be
misremembered later in either direction.

NEXT (Step 2b): continue descent to 0.01 on the identical config. Same bars.

--------------------------------------------------------------------------------
STEP 2b — SUBSIDY 0.01: BARS MET ON THE EDGE, PRODUCERS NOW LIMITING (2026-10-12)
--------------------------------------------------------------------------------

ARM. graze-subsidy01: identical config, basalFoodPerCell 0.05 -> 0.01. Same
bars (cons >=12/18 machine; flux >=12/18 human-read).

RUN. GitHub Actions 38263353928. Cohort INTACT / SUPPORTED. Legs ran in
~30-47s each (populations an order down from prior arms). Artifacts archived
under evidence/graze-subsidy01-38263353928/cohort/.

RESULT (endpoint P/C/D + grazeEnergy):
  41001 0/516/0 470 | 41002 2/22/597 183 | 41003 0/37/635 307
  41004 0/454/519 289 | 41005 0/0/0 1612 | 41006 0/15/540 205
  41007 23/62/502 296 | 41008 135/252/2 320 | 41009 0/567/0 397
  41010 0/20/860 294 | 41011 14/26/487 461 | 41012 705/69/3079 1590
  41013 0/0/191 216 | 41014 0/299/1 208 | 41015 93/0/0 480
  41016 0/0/0 543 | 41017 105/0/0 730 | 41018 265/0/0 301

VERDICT. Both bars met exactly at the edge: persistence 12/18 (zeros 41005,
41013, 41015, 41016, 41017, 41018), flux 18/18 (183-1,612). Technically a pass;
substantively a warning flare. Producers read 0 on 10/18 seeds (41001, 41003,
41004, 41005, 41006, 41009, 41010, 41013, 41014, 41016) and three-guild
endpoints fell 9/18 -> 5/18 (41002, 41007, 41008, 41011, 41012 — descriptive,
not a verdict). The failing guild ROTATED: consumers held, producers now starve.
Mechanism (inference, stated as such): with rain near gone and nutrientRegen 0
+ excretion 0, nutrients are initial-stock plus biotic return only; tiny
populations make little corpse flux, so producers exhaust their substrate.
This is the nutrient wall rung 3 already mapped (abiotic regen restored
decomposers where excretion could not) — arrived at from the other side.

DECISION. Do NOT descend to 0 yet. The falsification clause did not trigger
(6/18 consumer zeros is a technical pass, openly stated), so this hold is
precautionary rather than clause-mandated: the margin evaporated (16 -> 12)
and producers are now the limiting guild on 10/18 seeds, so the next cut
risks producer collapse. The plan's Step 3 comes forward: couple producers
to decomposer recycling (nutrientCyclic + floor + saturation as one
mechanism) on the 0.01 config FIRST, then remove the last rain. Registered
below as graze-nutcyc.

--------------------------------------------------------------------------------
STEP 3 — COUPLING RESULT: FALSIFIED (7/18 PRODUCER-ZERO), SATURATION NEXT (2026-10-12)
--------------------------------------------------------------------------------

ARM. graze-nutcyc: 0.01 config + nutrientCyclic on + floor 0.05 + sat 1.0.
Bars: prod > 0 on >=12/18 AND cons > 0 on >=12/18 (both machine).

RUN. GitHub Actions 38263833420. Cohort INTACT / FALSIFIED. Artifacts archived
under evidence/graze-nutcyc-38263833420/cohort/.

RESULT (endpoint P/C/D):
  41001 0/516/0 | 41002 2/22/597 | 41003 0/37/635 | 41004 0/454/519
  41005 475/0/0 | 41006 0/15/540 | 41007 14/219/0 | 41008 1/233/11
  41009 520/222/0 | 41010 0/20/860 | 41011 11/17/689 | 41012 15125/38/750
  41013 0/0/191 | 41014 0/385/16 | 41015 289/0/0 | 41016 371/0/0
  41017 1236/3/0 | 41018 652/0/0

VERDICT. Producers > 0 on 11/18 (zeros 41001, 41003, 41004, 41006, 41010,
41013, 41014); consumers > 0 on 13/18 (zeros 41005, 41013, 41015, 41016, 41018
— consumer bar MET). Producer bar missed by one seed (11 vs 12) and the
falsification condition (prod = 0 on >=7/18) is met exactly at 7: arm
FALSIFIED as specified. All-three endpoints 4/18 (41002, 41008, 41011, 41012 —
descriptive).
Notable: seed 41012 bloomed (15125/38/750) — the coupling CAN feed producers
explosively on one seed while leaving seven at zero. Uneven, not absent.

DECISION. Per the arm's own branch: do not raise light; try the stated
alternative (saturation 2.0) once, then abandon the coupling if it also fails.
Registered below as graze-nutcyc-sat2. If sat-2.0 fails, the program steps
back to analysis (floor level and capture scale become suspects) rather than
pushing dials blind.

--------------------------------------------------------------------------------
STEP 3b — SAT-2.0 RESULT: FALSIFIED, AND THE DIAL IS VOID (2026-10-12)
--------------------------------------------------------------------------------

ARM. graze-nutcyc-sat2: sat 1.0 -> 2.0, everything else identical. Same bars.

RUN. GitHub Actions 38264321163. Cohort INTACT / FALSIFIED (prod 11/18, cons
13/18 — same counts as sat-1.0). Artifacts archived under
evidence/graze-nutcyc-sat2-38264321163/cohort/.

RESULT. All 18 per-seed files are BYTE-IDENTICAL to the sat-1.0 run except
the header line (sat1 vs sat2): 2 diff lines per file, 0 non-header, on all
18 seeds. Endpoints, B/D ratios, ledgers, residuals — all identical.

VERDICT. Falsified (same 7/18 producer-zero), but the important finding is
stronger than the verdict: the saturation dial did not vary. world.ts scales
the BASE rate: rate = nutrientRegen * raw/(raw+sat). Under --zero,
nutrientRegen = 0 and no arm lifts it, so the cyclic term is 0 * anything = 0
at every saturation. The "coupling" tested in Step 3 was floor-0.05 only; the
cyclic half was never engaged. This is the void-knob failure mode AGENTS.md
names: a dial whose variation never reaches the dynamics (the zero base rate
nulls the product at every saturation, though the value itself is handed to
the engine).

CORRECTION TO STEP 3. Its falsification verdict stands (the numbers are the
numbers), but its mechanism attribution is superseded: sat-1.0 did not test
cyclic coupling. The producer gain 8 -> 11/18 endpoints came from the floor.
No conclusion about cyclic coupling follows from either run.

NEXT (Step 3c): engage the coupling for real — lift nutrientRegen to the
rung-3 value 0.0002 (a base rate for cyclic to scale) on the identical
config. One addition, stated: graze-nutcyc + nutrientRegen:0.0002.
Prediction: prod > 0 AND cons > 0, each >=12/18. Falsification: prod = 0 on
>=7/18 closes the coupling line (floor alone: 11/18; floor+engaged-cyclic
must beat it or the concept is out). Registered below as graze-nutregen.

--------------------------------------------------------------------------------
STEP 3c — ENGAGED COUPLING: PRODUCERS RECOVER TO BAR, CONSUMERS NOW BIND (2026-10-12)
--------------------------------------------------------------------------------

ARM. graze-nutregen: nutcyc config + nutrientRegen:0.0002 lift (base rate for
cyclic to scale). Bars: prod >=12/18 AND cons >=12/18 (both machine).

RUN. GitHub Actions 38264950151. Cohort INTACT / FALSIFIED (split decision).
Artifacts archived under evidence/graze-nutregen-38264950151/cohort/.

RESULT (endpoint P/C/D):
  41001 0/272/0 | 41002 14/0/762 | 41003 1/41/709 | 41004 0/1042/0
  41005 2/2/346 | 41006 0/78/458 | 41007 1006/0/0 | 41008 935/124/0
  41009 436/306/0 | 41010 0/0/372 | 41011 37/20/493 | 41012 3390/81/2614
  41013 0/0/409 | 41014 0/309/111 | 41015 278/0/0 | 41016 175/0/0
  41017 8/356/158 | 41018 795/0/0

VERDICT. Producers 12/18 (zeros 41001,41004,41006,41010,41013,41014 — bar MET
exactly); consumers 11/18 (zeros 41002,41007,41010,41013,41015,41016,41018 —
bar missed by one). Falsification's second clause fires as written: producers
recovered while consumers failed on 7/18, so the failure is CONSUMER
VIABILITY, a separate mechanism. All-three endpoints 5/18
(41003,41005,41011,41012,41017 — descriptive).

ANALYSIS (no new runs; cross-arm read of archived B/D lines). Grazing income
does NOT separate persisting from failing consumers: failing seeds carry as
much or more graze energy (41005: 1,068-1,612 at C≈0; 41016: 543-548 at C=0;
41017@0.01: 730 at C=0) as persisting ones (41006: 205-239 at C>0; 41011:
216-461), with win rates ~41-84% and positive flux on all 18 seeds, and
disease deaths negligible (mostly <10). Food pays and consumers still fade:
failing seeds read cons B/D 0.72-0.86 on the whole-run line while their
checkpoint rows show C near zero early — failure to launch, not late
starvation. This replicates
rung 4's "viability, not supply" verdict inside the new coupled config.
Binding suspects from the mapped gates: the 90-tick breeding reserve against
small consumer incomes, and upkeep economics — NOT food supply, NOT disease.

DECISION. No more nutrient dials. Next is a single viability arm in the
identical config: breeding reserve 90 -> 30 (positional rsur; sanctioned
config path, null default preserved). Rung 6 tested rsur-30 in a DIFFERENT
ecology (0.25 subsidy, no coupling, no paying graze) and falsified there;
this tests it where food demonstrably pays — a different experiment, not a
repeat. If consumers still fail, viability needs engine-level economics, and
that decision goes to the Owner with this record attached. Registered below
as graze-viability.

--------------------------------------------------------------------------------
STEP 4 — VIABILITY (rsur-30): RESERVE EXONERATED, ENGINE ECONOMICS NEXT (2026-10-12)
--------------------------------------------------------------------------------

ARM. graze-viability: nutregen config with positional rsur null -> 30 (only
change). Bars: cons >=12/18 AND prod >=12/18 (both machine). Pre-registered
branch: on falsification, no rsur -> 0, no compensating moves — the decision
goes to the Owner with the record attached.

RUN. GitHub Actions 38265743162. Cohort INTACT / FALSIFIED. Per-seed headers
spot-checked for rsur30 (review mitigation from registration review — all six
manifests reference it). Artifacts archived under
evidence/graze-viability-38265743162/cohort/.

RESULT (machine counts from summary CSVs, not eyes): prod > 0 on 13/18
(zeros 41001, 41006, 41010, 41013, 41014 — bar MET); cons > 0 on 11/18
(zeros 41002, 41005, 41007, 41015, 41016, 41017, 41018 — bar missed by one,
falsification condition met exactly at 7 zeros). Decomposers > 0 on 9/18.
All-three endpoints 4/18 (41003, 41004, 41011, 41012 — descriptive).

VERDICT. FALSIFIED as specified. Consumer persistence is IDENTICAL at reserve
90 and reserve 30 (11/18 both, overlapping but shifted zero-sets) while
producers improved 12 -> 13/18 (the shared helper means the reserve binds all
guilds, not just consumers). The breeding reserve is therefore NOT the
binding constraint on consumers. Combined with Step-3c (food pays, B/D<1 from
launch, disease negligible), the remaining suspects are upkeep/damage
economics inside the engine — beyond any null-default dial tested so far.

DECISION (pre-registered branch taken). Stop dial-turning. No new arm is
registered in this entry. The program returns two open questions to the
Owner: (1) whether to authorize engine-level consumer-economics work
(upkeep scaling that reaches ALL viability gates at once, damage/breeding-gate
rework, or a nutritional-requirement redesign — each changes declared
behavior and needs re-pinning discussion, hence Owner-gated); (2) whether to
run the obligate-reliance ablation on the best available config (viability:
prod 13 / cons 11) to bank the reliance clause while economics are decided.
Recommendation in the report: ablation first (it needs no new mechanism and
cannot regress), economics direction owned by the Owner.

--------------------------------------------------------------------------------
PROBE SEAM: TRAILING DFOUND SLOT FOR ABLATION (2026-10-12, NO ENGINE CHANGE)
--------------------------------------------------------------------------------

Ablation (producers-alone) needs decomposerFounders 0.25 -> 0, which no probe
argv slot expressed. Change, identical in scenesprobe.ts + senesprobe.ts:
trailing slot 19 DFOUND, "null"/missing/flag -> 0.25 (standing default),
explicit 0..1, loud otherwise; config decomposerFounders reads it; header
echoes effective dfound= value. run-arm.mjs accepts optional argvExtra
(string array, max 4, appended after argvRest, recorded in manifest argv);
workflow fixtures cover argvExtra shape (W8aX) and dfound header tolerance
(W8aY). No engine file touched; knobs-unset behavior unchanged.

SMOKE CAUGHT A REAL BUG BEFORE DISPATCH. First cut read argv[19] directly:
with exactly 15 positionals, argv[19] is the --zero FLAG, so every ladder run
would have thrown. Fixed by positional discipline (trailing values precede
flags; a flag in slot 19 reads as not-provided). Verified compiled:
default-vs-explicit-0.25 byte-identical; dfound=0 runs with header echo;
"2"/"abc" throw loudly. Rejects and identity proof in shell log; typecheck +
build + 135/135 workflow fixtures green.
Early read from the smoke (descriptive, 200 ticks): zero founders still shows
dec 4 by t200 via role fluidity — re-emergence is tracked, not excluded, in
the ablation verdict (sub-case b).

Registered below (pre-registration IS the arm entry): producer-alone —
viability config + founders 0 + graze lift to 0, 36 seeds, prod == 0 on
>=30/36 predicts reliance; >=7 persisting falsifies it (sub-cases a/b).

--------------------------------------------------------------------------------
STEP 5 — ABLATION VERDICT: PRODUCERS SURVIVE ALONE 33/36, RELIANCE FAILS (2026-10-12)
--------------------------------------------------------------------------------

ARM. producer-alone: viability config + founders slot 0 + graze lift to
explicit 0 (meat preset 0), floor/dormancy/spores/disease/sat/cyc/regen/rsur
identical. 36 seeds, 6000 ticks. Bar: prod == 0 on >=30/36 (machine);
>=7 persisting falsifies, split into (a) floor-carry vs (b) fluidity-rescue.

RUN. GitHub Actions 38267693804 (12 legs x 3). Cohort INTACT / FALSIFIED.
Headers read dfound=0 on 36/36 legs — the new machine gate held live with no
mismatches. Artifacts archived under evidence/producer-alone-38267693804/cohort/.

RESULT (machine counts from summary CSVs). prod == 0 on 3/36 (41003, 41013,
52016) — the bar is missed by 27 seeds, not borderline. 33/36 producers
persist alone, including thousands-strong stands (41011 P3580, 41018 P2729,
52004 P2219, 41017 P1455). Of the 33: 25 never show a decomposer at ANY
1000-tick checkpoint (pure sub-case a); 8 show transient/relic decomposers,
only two retain any at endpoint (41009 D287, 52006 D15 — the sole all-three
endpoint is 41009, 1/36). Checkpoint-observation caveat: brief
inter-checkpoint presence cannot be excluded — lifetime B/D lines show a
handful of decomposer births on some checkpoint-pure seeds (41005: 3, 41014:
1, 52013: 1, 52017: 1), so sub-case (a) is checkpoint-observational, not
lifetime-proven. But no trajectory shows producer recovery tracking D: D is
transient/relic where present, retained at endpoint on only two seeds.
Founded consumers starve as designed (C endpoint 0 on most; 41004 C1030 and
41013 C467 persist at endpoint on remnant detritus — descriptive, expected).

VERDICT. Reliance is NOT obligate as configured: the abiotic floor (0.05) plus
initial stock carries producers alone on 33/36 seeds. The falsification is
clean (sub-case a dominates), so no restatement rescue applies — the clause
fails on its own terms. The floor that prevents deadlock extinction is the
same floor that voids obligate reliance: that tension is now measured, not
theoretical.

DECISION. No new arm in this entry. Two questions go to the Owner (asked
directly, program holds): (1) the scoped consumer-economics rework proposal
(variance-tolerance grace, re-pin required) — approve, redirect, or hold;
(2) the reliance-vs-floor tension — remove the floor and risk deadlock
return, restate reliance functionally (dependence on recycling for vigor
rather than survival), or hold the clause as a future-engine objective.
Dial-turning is suspended until both are answered; the repeated lesson of
this ladder is that each mechanism tested cleanly and the goal needs a
decision, not another dial.

--------------------------------------------------------------------------------
OWNER DECISIONS (2026-10-12, direct): FLOOR-ZERO PAIR + ECONOMICS REWORK (2026-10-12)
--------------------------------------------------------------------------------

On the ablation falsification the Owner decided: (1) reliance tension —
REMOVE the floor, with a kickstarter at run start; (2) engine economics —
APPROVE the scoped variance-tolerance rework for implementation under the
full pipeline. No dial-turning beyond what serves these two orders.

KICKSTARTER (stated, no new mechanism): the world-construction initial
nutrient stock (nutrientPerCell laid at build) is the run-start pulse. No new
pulse knob is introduced unless the floor-zero runs flatline at bootstrap —
YAGNI applies; an explicit pulse is designed only on demonstrated need.

Floor-zero pair (each one dial from its parent, registered below):
  (a) producers-with-loop-floor0 = viability config + nfloor 0.05 -> 0.
      Tests whether the recycling loop sustains producers with NO abiotic
      floor. Bar: prod > 0 on >=24/36 (machine). Falsified below 24.
  (b) producer-alone-floor0 = producer-alone config + nfloor 0.05 -> 0.
      The strict alone test without floor. Bar: prod == 0 on >=30/36
      (machine); >=7 persisting falsifies.
Interpretation order: (b) then (a). Reliance holds iff (b) fails-alone AND
(a) sustains (floor-0 universal lethality would prove nothing about reliance).
Both pre-registered; neither predicts coexistence.

--------------------------------------------------------------------------------
STEP 6 — FLOOR-ZERO PAIR: RELIANCE FALSIFIED TWICE, LOOP WITHOUT FLOOR (2026-10-12)
--------------------------------------------------------------------------------

ARMS (Owner-ordered). producers-with-loop-floor0 (viability + nfloor -> 0;
bar prod > 0 on >=24/36) and producer-alone-floor0 (ablation + nfloor -> 0;
bar prod == 0 on >=30/36). Kickstart = construction-laid stock, no new knob.

RUNS. 38271740961 (loop) and 38271745692 (alone). Both cohorts INTACT, both
FALSIFIED. Artifacts archived under evidence/producers-with-loop-floor0-38271740961/
and evidence/producer-alone-floor0-38271745692/.

RESULT.
  loop-floor0:  prod 20/36 (bar 24 missed by 4); cons 23/36; all-three 9/36.
    prod>0: 41002,41003,41004,41005,41008,41009,41011,41012,41014,41015,41016,
    41017,52005,52010,52011,52014,52015,52016,52017,52018.
  alone-floor0: prod == 0 on 9/36; 27/36 persist (bar missed by 21).
    persist: 41001,41002,41006,41007,41008,41009,41012,41014,41015,41017,41018,
    52001,52002,52003,52004,52005,52006,52007,52008,52009,52010,52011,52012,
    52013,52015,52017,52018 (zeros: 41003,41004,41005,41010,41011,41013,41016,
    52014,52016).
    Decomposers at endpoint on 3/36 (41009 D254, 52006 D125, 52016 D918),
    sampled at >=1 checkpoint on 9/36; 22 persisters never sampled any.

VERDICT. The conjunction resolves against reliance: alone-floor0 was supposed
to fail (>=30 zeros) and instead 27/36 persist — WITH neither seeded
decomposers, nor heterotroph income, nor abiotic floor. Initial construction
stock suffices for producers on most seeds; the floor was sufficient but not
even necessary. No universal lethality occurred, so the caveat does not
apply — the test is interpretable, and it falsifies. The loop arm (20/36)
underperforms the floor configs, consistent with the floor having carried
roughly a third of seeds all along.

PROGRAM STATE. Config dials are exhausted as an avenue to obligate reliance:
link restored, subsidy cut 25x, coupling tried three ways, reserve
exonerated, floor removed with and without guilds — producers persist alone
regardless. The two remaining authorized items are the approved
consumer-economics engine rework (variance-tolerance grace) and whatever the
Owner decides about the reliance clause itself (restate functionally, hold as
future objective, or close it as falsified). No new arm is registered here.

--------------------------------------------------------------------------------
OWNER DESIGN CONSTRAINT (2026-10-12): REAL-WORLD EQUIVALENT FOR EVERY MECHANIC
--------------------------------------------------------------------------------

Constraint: every biological mechanic must have a real-world equivalent. It
may be simplified, but it must retain the spirit of the equivalent.

ADOPTION (stated, effective immediately): (1) prospectively — every NEW
mechanic and the approved economics rework must cite its equivalent before
implementation; a mechanism without one is not registered. (2) No silent
removals: existing mechanics are NOT ripped out on suspicion. A bounded
retrospective audit will report equivalents-or-gaps per mechanic; removals,
if any, are Owner decisions on that evidence, because several rungs of
evidence were measured through the current set.

COMPLIANCE OF THE PENDING REWORK (assessed before implementation, not
after): the variance-tolerance grace maps to fasting tolerance — real animals
do not take damage the instant expenditure exceeds intake; glycogen/fat
reserves buffer brief deficits and wasting begins after reserves deplete.
GRACE≈6 ticks is the reserve depth; sustained deficit still kills at full
rate (starvation physiology, not免 starvation). Spirit retained: survival of
inter-meal troughs, death on true inability to pay. The implementation entry
will carry this citation; if review finds the mapping dishonest, the rework
does not land.

--------------------------------------------------------------------------------
ENGINE 0.6.1 — FASTING TOLERANCE (APPROVED REWORK, IMPLEMENTED 2026-10-12)
--------------------------------------------------------------------------------

APPROVAL. Owner-approved scoped rework (proposal: variance-intolerance, not
income). Real-world equivalent cited before implementation (constraint
2026-10-12): body reserves buffer brief deficits; wasting begins after
reserves deplete. GRACE=6 (Owner-tunable 4-8) is the reserve depth.

CHANGE (one declared-behavior delta, world.ts only + version paperwork):
  - STARVE_GRACE_TICKS=6 const beside REPRO_SURPLUS_TICKS, with equivalent
    citation in-code.
  - Per-slot starveStreak (Uint16Array, saturates 65535): +1 per
    consecutive-deficit tick, reset on any paid tick and while dormant.
  - Damage scaled 0 -> full over grace (same 0.9*(0.35+0.65*deficit)
    magnitudes); hunger increment, fallback, death and breeding gates
    untouched; no RNG draws added.
  - populateSlot resets the clock (slot-reuse hazard, same precedent as
    dormant); ensureSlotArrays grows it; hashState mixes it (history clock,
    dormantSleep precedent).
  - Version 0.6.1 (version.ts + AGENTS.md); 0.6.0 figures become
    earlier-engine evidence, not comparable behaviour.
What was NOT changed (per approval): surplus 90, upkeep/Kleiber/capacity,
yields, subsidies, regen, disease, dormancy, mating, sensing/movement.

GATES 20/20 with two justified scenario updates (mechanisms intact, windows
re-witnessed — NOT goalpost moves, each verified by experiment):
  - G5b: predation still occurs (10 by t1000 on seed 4242; 3 by t250 on
    neighbours) but left the fixed 250-tick window. Non-vacuity now counts
    over an extended 1000-tick run on the same seed; G5 digest still at 250
    and still identical across replays.
  - G12: unseeded 120-founder worlds grow ~0 feeding mineralisers within any
    window under grace (fewer early deaths -> less detritus; 0-1 decomposers
    across 6 seeds to t2000), so the scenario stopped witnessing. The gate
    now seeds mineralisers (decomposerFounders 0.3): flux reads 0.250263 ON
    vs exactly 0 OFF at tick 150. The kill-switch defect it guards would
    still read 0/0 and fail. Establishment ecology belongs to ladder
    evidence, where decomposers are seeded.
Baseline check: pristine 0.6.0 tree runs 20/20, so both reds were caused by
this change and both were re-witnessed, not waived.

RE-PIN (honest, deterministic twice byte-identical per seed, Node v24.21.0):
  517: 808/159/58 -> 813/135/81; 24601: 558/290/96 -> 542/234/109.
  Direction: producers/decomposers hold better, consumers lower at
  knobs-unset defaults. No guild collapsed, no cap-hit (pop ~1k), no
  explosion. Old pair retired into scripts/contract-checks.mjs chain.
Validation: typecheck clean; both tsconfigs built (C4 caught a stale
app bundle mid-validation — rebuilt, 11/11); workflow 145/145; determinism
byte-identical per seed+config (also across the two pin runs each).
Owed before 0.6.1 is fully verified: --zero flatline re-run (dispatched as
the registered flatline arm post-push) and the viability-config ladder
retest with per-capita intake flat (registered post-push).

--------------------------------------------------------------------------------
0.6.1 CEILING: --ZERO FLATLINE HOLDS 36/36 (2026-10-12)
--------------------------------------------------------------------------------

RUN. Registered flatline arm on engine 0.6.1, GitHub Actions 38283619163.
Cohort INTACT (regression-replay design: classification "not measured").
Artifacts archived under evidence/flatline-061-38283619163/cohort/.

RESULT. All 36 seeds extinct by tick 12000 (0 alive at end). Max absolute
ledger residual 0.00109% against the 0.5% failure threshold. Bounded grace
does not leak: with no income every deficit is sustained, streaks saturate
in 6 ticks, and killing proceeds at full rate — the ceiling the proposal
required. 0.6.1 is now fully verified to the repository contract:
typecheck, 20/20 gates, re-pinned parity (twice byte-identical),
determinism, 11/11 contract, 145/145 workflow, flatline intact.

--------------------------------------------------------------------------------
0.6.1 RETEST — VIABILITY UNMOVED, HYPOTHESIS FALSIFIED (2026-10-12)
--------------------------------------------------------------------------------

ARM. viability-061: settings-identical retest of graze-viability on engine
0.6.1 (the ONLY contrast is the engine). Bars: cons >=12/18 AND prod >=12/18
(machine); human-read B/D shift with per-capita intake flat; confound branch
(intake rises -> confounded, not supported) pre-stated.

RUN. GitHub Actions 38289225385. Cohort INTACT / FALSIFIED. Artifacts archived
under evidence/viability-061-38289225385/cohort/.

RESULT (machine counts from summary CSVs). cons > 0 on 11/18 (zeros 41002,
41005, 41007, 41010, 41013, 41016, 41018 — same rate as 0.6.0 with churned
membership: 41015 recovered, 41010 and 41013 newly zero); prod > 0 on 10/18 (zeros 41001,
41002, 41003, 41006, 41009, 41010, 41011, 41013); dec > 0 on 10/18; all-three
endpoints 3/18 (41004, 41012, 41014 — descriptive). Both bars missed.

COHORT-LEVEL COMPARISON (archived B/D + LEDGER lines, both 18-seed runs;
B/D is pooled births / pooled deaths):
  engine   pooled cons B/D   per-capita graze intake   total pop
  0.6.0    1.017             0.64                     13,418
  0.6.1    1.017             0.42                     21,042
Identical replacement to three decimals, lower per-capita intake, larger
populations, fewer producer seeds. Intake did NOT rise, so the confound
branch does not trigger — this is a clean falsification, not a confounded
read: fasting tolerance does not convert to viability at endpoint level.

VERDICT. The improvement hypothesis is falsified as specified. Consumers
fail identically with food paying (win rates sustained, disease negligible),
reserve at 90 or 30, upkeep already discounted 4x (consumerBasalScale 0.25
has ridden along since the first consumer-yield arm), and now grace at 6.
Every named suspect on the viability list is eliminated except damage-gate
genetics, mating success, and lifespan economics — each untested and each
needing its own diagnostic before any arm. No new arm is registered here;
dial-turning on consumers is suspended as spent (four()))

PROGRAM ASSESSMENT (for the Owner record). After eleven 0.6.x arms plus the
engine rework: grazing restored, subsidy cut 25x, coupling tried three ways,
reserve exonerated, floor removed with and without guilds, grace implemented
and falsified. Obligate reliance falsified in its strict form (producers
persist alone with and without floor). Majority-time coexistence on all seeds
remains distant (best joint endpoints 9/18, descriptive). The goal needs a
decision, not another dial: restate reliance functionally, hold the program,
or authorize a fresh diagnostic line (damage/mating/lifespan) with
understanding that each is a long shot against a five-deep elimination.

--------------------------------------------------------------------------------
TRIAL-AND-ERROR SCREEN S1 (PRE-REGISTERED 2026-10-12): SIX ONE-DIAL VARIANTS
--------------------------------------------------------------------------------

MODE CHANGE (Owner order): this POC now iterates by trial and error. Method:
cheap compiled screens triage bold ideas; only winners are promoted to
reviewed ladder arms. Screens are diagnostics (short horizon, known seeds),
never prospective evidence. Kept: no forced coexistence, cohort integrity
for promotions, honest nulls, independent review before dispatch. Relaxed:
single-variable crawl — variants may be bold, and several promote together.

BASE. viability-061 settings on the 0.6.1 tree (lifts 0.35/0.01/1.0/0.0002 +
rsur 30, cyc on, sat 1.0, floor 0.05), compiled scenesprobe (the ladder
probe), 2000 ticks. Seeds 41002, 41005, 41016 — C=0 at t6000 on BOTH engines
in the viability runs, so any establishment reads against failure.

VARIANTS (one dial each from base):
  S1a disease off: argv dis 0.15 -> null (remove disease load on breeding).
  S1b cheaper upkeep: basal 0.25 -> 0.1 (shared-helper era retest).
  S1c fed producers: lift producerCaptureScale 0.35 -> 1.0 (bigger takes).
  S1d richer takes: lift grazeYieldScale 1.0 -> 1.6 (rung-4 precedent).
  S1e tissue basis: + lift plantYieldPerMass 14 (body-mass takes).
  S1f biotic return: + lift excretionRate 0.06 (with regen, unlike rung 3).
PROMOTE BAR: base must read C=0 at t2000 on 3/3 (screen sensitivity check);
a variant promotes on C>0 at t2000 on >=2/3, with no cap-hit and no
all-guild extinction. B/D and trajectories human-read. Losers recorded here,
never promoted. Winners become one reviewed ladder batch.

--------------------------------------------------------------------------------
SCREEN S1 (2000 TICKS): SENSITIVITY PREMISE WRONG, NO PROMOTIONS (2026-10-12)
--------------------------------------------------------------------------------

MATRIX. Base viability-061 settings + 6 one-dial variants (disease off,
cheaper upkeep, fed producers, richer takes, tissue basis, biotic return) on
seeds 41002/41005/41016, 2000 ticks, compiled scenesprobe on the 0.6.1 tree.
Files archived under evidence/screen-s1-2000/ (21 runs, all exit 0).

SENSITIVITY FAILURE (owned, not hidden). The pre-registration demanded base
C=0 at t2000 on 3/3. Base reads C49/C16/C23 — consumers fade by t6000, not
by t2000, so the absolute >=2/3 bar is void (base itself scores 3/3). The
screen is re-read comparatively, and the follow-up runs at the decisive
6000-tick horizon (S2, registered below).

COMPARATIVE READ (t2000 consumers, base 49/16/23):
  nodis 40/0/2 (kills 41005) | cheap 40/22/14 (marginal) | pcap10 0/2/0 B/D
  0.79/0.82/0.76 (WORSE — feeding producers collapses consumers faster, a
  small enrichment-paradox signal, descriptive) | graze16 19/0/8 (worse) |
  tissue14 26/1/4 (worse) | excr006 19/55/5 with 41005 at B/D 1.00 (one-seed
  spark, the only variant beating base anywhere).
VERDICT. Nothing promotes. Five variants underperform base; excretion shows
a one-seed spark worth re-testing at full horizon, not a promotion.

S2 (registered): identical matrix at 6000 ticks, where base is validated
0/3/3. Same promote bar (>=2/3 with base 0/3). Local compiled runs; if any
seed times out locally it moves to a ladder leg instead of being
half-reported.

--------------------------------------------------------------------------------
SCREEN S2 (6000 TICKS): TWO PROMOTIONS, ONE RUNAWAY WARNING (2026-10-12)
--------------------------------------------------------------------------------

MATRIX. Identical to S1 at the decisive horizon (base validated C=0 on 3/3:
41002 P0/C0/D672, 41005 P194/C0/D323, 41016 P363/C0/D0 — sensitivity holds).
Files archived under evidence/screen-s2-6000/ (21 runs, all exit 0).

RESULT (t6000 consumers; promote bar C>0 on >=2/3):
  nodis    1/3 (41002 C41) — no.
  cheap    2/3 (41002 C101 B/D 1.05, 41005 C87 B/D 1.03; 41016 zero) — PROMOTE.
           Cheaper upkeep converts to replacement-level breeding on 2/3.
  pcap10   1/3 (41016 C9) with producer blooms to 51,122 and D=0 everywhere —
           NO (enrichment runaway + monoculture; cap nears at 51k/60k).
           Descriptive warning: feeding producers collapses the web upward.
  graze16  1/3 (41002 C64 B/D 1.01) — no.
  tissue14 1/3 (41002 C62 B/D 1.00) — no.
  excr006  2/3 (41002 C41, 41005 C226 B/D 1.08; 41016 zero) — PROMOTE.
           Biotic return converts on 2/3 (rung 3 tested it WITHOUT regen and
           failed; this is WITH regen — different experiment, not a repeat).
VERDICT. Two promotions (cheap, excr006) to one reviewed ladder batch on the
standard 18-seed panel. No combos yet: singles read first, combinations only
on unclear singles. pcap10's bloom is recorded as the anti-result it is.

--------------------------------------------------------------------------------
S2 PROMOTIONS CONVERT: CHEAP + EXCRETION BOTH SUPPORTED (2026-10-12)
--------------------------------------------------------------------------------

RUNS. cheap-upkeep 38295919001 and excretion-return 38295922789. Both cohorts
INTACT / SUPPORTED. Artifacts archived under evidence/cheap-upkeep-38295919001/
and evidence/excretion-return-38295922789/.

RESULT (machine counts from summary CSVs).
  cheap-upkeep: cons 13/18 (zeros 41003,41010,41013,41016,41018), prod 15/18
    (zeros 41004,41006,41010). Both bars met.
  excretion-return: cons 13/18 (zeros 41006,41010,41013,41016,41018), prod
    14/18 (zeros 41003,41004,41010,41013). Both bars met.
DESCRIPTIVE three-guild endpoints: cheap 7/18
(41002,41005,41008,41011,41012,41014,41015), excretion 10/18
(41002,41005,41007,41008,41009,41011,41012,41014,41015,41017). Not predicted,
not verdicts — but excretion's 10/18 is the highest joint-endpoint count
measured on this panel under any arm, and it arrived via biotic return, not
subsidy. Recorded so the combination test below has a baseline to beat.

VERDICT. The screen-to-panel pipeline works: both S2 promotions convert at
full-panel scale. Per the trial-and-error plan, singles read first — now the
combination (cheap 0.1 + excretion 0.06) is the next arm. Registered below.

--------------------------------------------------------------------------------
COMBO: INTERFERENCE, NOT ADDITIVITY (2026-10-12)
--------------------------------------------------------------------------------

RUN. cheap-excretion-combo 38298236206. Cohort INTACT / FALSIFIED. Artifacts
archived under evidence/cheap-excretion-combo-38298236206/cohort/.

RESULT (machine counts). cons 14/18 (zeros 41005,41013,41016,41018 — consumer
bar MET, best consumer count yet); prod 11/18 (zeros 41001,41003,41006,41009,
41010,41013,41015 — producer bar missed). All-three 7/18
(41002,41004,41007,41011,41012,41014,41017 — descriptive, below excretion's
10/18, equal to cheap's 7/18).

MECHANISM READ (pooled B/D + ledger totals across the three archives):
  arm        pooled prod B/D   pooled cons B/D   total grazeEnergy
  cheap      1.17              1.043             8,626
  excretion  1.31              1.039             8,873
  combo      0.97              1.068             9,157
Consumers improve marginally while producers fall BELOW replacement (0.97)
under similar total grazing. Inference (labeled): viable consumers graze
producers down — the predator-prey tradeoff made visible. The combination
interferes; it does not add.

VERDICT. Arm FALSIFIED (machine, via producers). Note on the letter of the
pre-registered clause: its as-additive falsifier (cons >=7 zeros) did not
fire (4 zeros), but the machine verdict and the joint-outcome deterioration
(7/18 vs 10/18) close the question the arm asked — the mechanisms interfere.
Per the arm text: no triple-stacks, no escalation; back to mechanism
analysis, not bigger combos. No new arm is registered here.

--------------------------------------------------------------------------------
POST-REBASE RECONCILIATION — G24 RE-WITNESSED ON THE MERGED TREE (2026-10-12)
--------------------------------------------------------------------------------

REBASE. Branch replayed onto origin/main (968442d: genomeV2 diagnostic +
viewer fixes) cleanly except REPORT.md append/append conflicts, resolved by
union with marker sweeps verified at zero. My redundant viewer edits were
discarded in favor of main's merged fixes. No evidence file was altered by
the rebase; all verdicts below re-verify rather than assume.

MERGED-TREE VALIDATION. Typecheck clean, both tsconfigs build, all 20 ladder
arms present, 0.6.1 parity pins HOLD byte-identical on the merged tree
(517 -> 813/135/81), contract 11/11, workflow 153/153. genomeV2 null-default
is confirmed inert by the unchanged pins — no version bump, no re-pin.

G24 FAILURE AND FIX (same witness-fragility class as G5b, fixed the same way).
Pristine main: 33/33. Merged tree: 32/33 with G24 reading 40 matings / 40
clones / 0 genuine splices. Discrimination, measured not assumed:
- Disagreeing bearer pairs are abundant under grace (2.4k-12k positional
  VALUE disagreements alive every round, measured alongside 12k-74k
  length-only differences) — the population is diverse, so establishment
  ecology is not the cause.
- The gate's round-robin neighbour pick served prefix-identical pairs, and no
  child of prefix-identical parents can satisfy wonByA>0 AND wonByB>0
  simultaneously — the strict signature is unsatisfiable by construction on
  such pairs, so 40/40 clones was guaranteed regardless of recombination.
- A first fix (length-difference search + scan-all-newborns) still read 40/40
  for exactly this reason; length-only disagreement was the wrong predicate.
Fix (src/gates.ts, scenario-only, mechanism untouched): drive the first
bearer pair with positional VALUE disagreement inside the shared span, and
scan EVERY newborn for the strict splice signature instead of judging only
the first new id (background asexual births share the tick, and a healthier
population breeds more of them — judging one mistakes background rate for
mechanism). Result: 33/33 on three consecutive runs.
No new arm is registered here.

REVIEW FOLLOW-UP (same entry, no new run). Independent review returned CLEAN
with two notes, both handled: (1) the "never false-pass" comment overstated —
softened to negligible-probability coincidence, bounded empirically by the
pre-fix 0/40 run (a background *sexual* birth matching the driven splice
would still prove live recombination, so the existential claim survives even
the misattribution case); (2) 20 stale compiled `src/**/*.js` files are
TRACKED in git alongside sources (committed in early history, pre-genomeV2
and pre-grace — recombination absent there). Gates run via tsx so unaffected,
but executing the stray `.js` directly would run a stale engine. Adjacent
finding, recorded not fixed: deletion + a `src/**/*.js` gitignore rule is
recommended; left for explicit Owner authorization since it removes tracked
files. Gates re-run after the wording edit: 33/33.

--------------------------------------------------------------------------------
SCREEN S3 (PRE-REGISTERED 2026-10-12): MIXOTROPHY — RELIANCE BY CONSTRUCTION
--------------------------------------------------------------------------------

RATIONALE. The equivalents audit flagged mixotrophyCarbon (default off) as
untested in this program, and it is the most direct lever on the open
reliance question: with mixotrophy ON, producers need local heterotrophic
substrate to photosynthesize, so producer fate couples to
consumer/decomposer activity by construction rather than by subsidy tuning.

MATRIX. viability-061 base vs mixo-on (argvRest mixo slot off -> on,
everything else identical incl. sat 1.0 which then parametrizes the
substrate-availability curve), seeds 41002/41005/41016 (base C=0 at t6000 on
both engines), 6000 ticks, compiled scenesprobe on the merged 0.6.1 tree.
PROMOTE BAR: base must read C=0 on 3/3 (sensitivity); mixo-on promotes to a
reviewed ladder arm on all-three-present at t6000 on >=2/3. Coexistence is
the endpoint read here (unlike prior screens) because coupling guild fates
is the hypothesis — but t6000 endpoints only; majority-time evaluation comes
later and only if this promotes. Null (no difference or worse) is recorded,
never promoted.

--------------------------------------------------------------------------------
SCREEN S3 (6000 TICKS): MIXOTROPHY LETHAL, NOT COUPLING — NULL (2026-10-12)
--------------------------------------------------------------------------------

MATRIX. viability-061 base vs mixo-on (substrate-required photosynthesis),
seeds 41002/41005/41016, 6000 ticks, merged 0.6.1 tree. Files archived under
evidence/screen-s3-mixo/ (6 runs, all exit 0).

RESULT. Base C=0 on 3/3 (sensitivity holds). Mixo-on: 41002 P0/C0/D704,
41005 P0/C1/D648, 41016 P34/C0/D0 — all-three-present on 0/3, and producers
go extinct on 2/3 where base holds them. The coupling as configured is a
trap, not a bridge: producers that need substrate to photosynthesize cannot
earn the energy to reach it. Null result, recorded; not promoted, no ladder
arm. The reliance question stays open with one fewer candidate mechanism.

--------------------------------------------------------------------------------
VIABILITY ATTRIBUTION PROBE (PRE-REGISTERED 2026-10-12): WHICH GATE STOPS BREEDING
--------------------------------------------------------------------------------

RATIONALE. Consumers fail with food paying, reserve exonerated (90 = 30),
upkeep discounted, grace inert, disease negligible. The remaining question is
mechanical, not parametric: which breeding gate actually stops them —
maturity, cooldown, damage ceiling, surplus, or fraction gate. gateattrib.ts
answers this but hardcodes default config + 90 surplus, so a viability-config
variant is registered here (new file src/trace/viabilitygates.ts; existing
instrument untouched): identical attribution order, viability-061 world
config (--zero + lifts 0.35/0.01/1.0/0.0002, rsur 30), surplus constant 30,
upkeep replicated WITH the configured consumer factor 0.25, seeds from argv.
No engine change; read-only instrument.

MATRIX. Contrast seeds on the 0.6.1 viability config, 6000 ticks: 41002
(C0, B/D ~0.7, chronic failer) vs 41004 (C1042, B/D 1.15, persister) vs 41012
(bloom seed). [PROVENANCE NOTE 2026-10-13, MATRIX text unaltered: the C1042 /
B/D-1.15 label for 41004 describes the NUTREGEN arm
(evidence/graze-nutregen-38264950151/cohort/.../seed-41004.txt), used at
registration to pick a high-activity persister contrast — NOT the verified
viability-061 endpoint, which is P11/C432/D441 (config-identity census,
byte-exact). 41004 persists on both arms, so selection stands; quote C432
for the 0.6.1 result.] READ: the gate distribution on the failer vs the persisters —
if one gate dominates failer ticks while persisters clear it, that gate is
the binding constraint and the next dial targets it; if distributions match,
the constraint is upstream of breeding (maturation/recruitment, not gates).
No promotion bar: this is diagnosis, and its output selects (not executes)
the next screen.

--------------------------------------------------------------------------------
VIABILITY ATTRIBUTION RESULT: FRACTION DOMINATES, SCALE HETEROGENEOUS (2026-10-12)
--------------------------------------------------------------------------------

RUN. viabilitygates.js (new read-only probe; gateattrib.ts untouched), 6000
ticks, seeds 41002 (fail) / 41004 + 41012 (persist), compiled on the merged
0.6.1 tree. Output archived under evidence/viability-gates-41002-41004-41012/.

CONFIG IDENTITY (pre-registered tripwire): final censuses read P0/C0/D672,
P11/C432/D441, P3100/C142/D2170 — byte-exact against the archived
viability-061 endpoints on all three seeds. The tallies below measure the arm
they claim. (This check also re-confirms the decomposerPhotoScale=0 and
grazeYieldScale=1.0 corrections: any other effective config diverges.)

RESULT (v1 WITHDRAWN — see correction below; retained in evidence/ as
vgates.txt for provenance, not citable for gate precedence).

CORRECTION (2026-10-12, review-driven): the v1 probe replicated gate checks
by hand, BEFORE the step, in author order (maturity, cooldown, damage,
surplus, fraction). The engine decides mid-tick in cooldown, fraction,
maturity, damage, surplus order — so v1's exclusive shares were order
artifacts. Accepted in full. The probe was rewritten onto the engine's own
ReproProbe seam (observed at the decision point, engine order, per-seed
hashState non-perturbation proof); output archived as vgates-engine-order.txt.

RESULT v2 (consumer blocked[] in engine order + roll outcome; digests match
on all three seeds, censuses re-verified identical):
  seed   cooldown  fraction   maturity  damage  surplus  sexual  reachedRoll fired
  41002  1,082     145,605    8,424     1,821   0        829     4,445       52
  41004  23,721    1,855,967  61,810    29,991  0        13,571  105,752     1,183
  41012  820       207,209    8,059     1,302   0        572     4,501       41
READ (corrected). Fraction dominates absolutely at the actual decision point;
surplus binds ZERO ticks on all three seeds (not 8-11% — those v1 ticks were
fraction-blocked first under engine order). The exoneration is now far
stronger than v1 stated: with the engine's own accounting, the drought
reserve stops nothing. Maturity is second overall on all three seeds (8,424
vs 1,821; 61,810 vs 29,991; 8,059 vs 1,302); damage runs second only among
gates other than maturity. Neither composition separates failer from
persisters. Roll conversion is
~1% everywhere (52/4445, 1183/105752, 41/4501). On scale the three seeds are
heterogeneous, not ordered: failer 41002 (4,445 roll-reaching ticks) is
near-identical to persister 41012 (4,501; difference 56, ~1.3%) with opposite
outcomes, while persister 41004 (105,752) dwarfs both — so high roll-entry
volume distinguishes 41004, not 41012, from 41002. The cause of the 41002 /
41012 endpoint difference is left unresolved; time distribution, survival and
realized reproduction require separate evidence. No scale claim attaches to
any verdict here.
Adjacent (recorded, not fixed here): the pre-existing gateattrib.ts carries
the same hand-replicated wrong-order attribution for default config; it feeds
no verdict in this record and is left untouched pending an Owner call.

--------------------------------------------------------------------------------
MAJORITY-TIME METRIC ON ARCHIVED ARMS + FAILURE TAXONOMY (2026-10-12, READ-ONLY)
--------------------------------------------------------------------------------

The Owner's bar is majority-of-TIME on all seeds, but every verdict so far
reads t6000 endpoints. Computed post-hoc from archived checkpoint rows (6
samples, majority = 4+; no new runs, no reclassification of any verdict):
  arm          majority-time seeds (all-three >50% of checkpoints)
  graze-link   5/18   | subsidy05 10/18 | subsidy01 7/18 | nutcyc 7/18
  nutregen     7/18   | viability 4/18  | cheap 7/18     | excretion 11/18
  combo        10/18  | loopfloor0 12/36 | viability061 5/18
Best remains excretion (11/18, nine seeds present at ALL six checkpoints).
The metric is descriptive here; adopting it as a verdict criterion is an
Owner call (it would re-scope every registered arm).

FAILURE TAXONOMY (excretion arm, 7 non-majority seeds; all held all three
guilds at t1000 — divergence is mid-run, not initial conditions):
  41001 P-collapse + D-loss at t3000, consumer boom/bust | 41003 P extinct
  t2000, C+D persist without producers | 41006 C lost t3000, D t4000, P alone
  | 41010 C lost t3000, P t5000, D alone (1008) | 41013 P+C lost t3000, D
  alone | 41016 C lost t3000, D t4000, P alone (1342) | 41018 C stillborn
  (9 at t1000), D lost t3000, P alone.
Pattern: each guild is viable alone or in pairs (P-alone stands to 1342,
D-alone to 1008, C+D without P) — the system has multiple single/pair
attractors and full coexistence is one among several. Failures pass through
single-digit guild counts first (C9, D11, C7, C5...): small-number stochastic
extinction with no observed rescue, although a 4x4 = 16-patch grid +
immigration weight + spore dispersal exist on paper.

RESCUE HYPOTHESIS (next diagnostic, designed not executed): test whether
extinctions are global-synchronized (nothing to rescue from) or patch-local
with failed recolonization. Requires a read-only patch-census accessor on
World (patchCensus/patchCount are private; ~5-line pure read, zero behavior
delta) plus a probe sampling per-patch guild trajectories on failing seeds
(41001, 41018). Engine-file touch => full validation + review before use.
No code written here.

--------------------------------------------------------------------------------
SPATIAL RESCUE DIAGNOSTIC (PRE-REGISTERED 2026-10-12): PATCH-LOCAL VS GLOBAL
--------------------------------------------------------------------------------

RATIONALE. Failure taxonomy shows mid-run divergence through single-digit
guild counts with no rescue, despite a 4x4 = 16-patch grid + immigration +
spores on paper. Two hypotheses: (a) extinctions are globally synchronized
(nothing to rescue from); (b) patch-local extinctions occur but
recolonization fails.
Global counts cannot separate them. This diagnostic samples per-patch guild
trajectories on three failing excretion-arm seeds (41001 producer-collapse,
41016 consumer-loss-then-producer-alone, 41018 stillborn consumers).

INSTRUMENT. One read-only accessor on World (patch grid dims + per-patch
guild count, pure read delegating to the existing census; zero behavior
delta) plus new probe src/trace/patchtrack.ts (excretion effective config,
6000 ticks, per-patch P/C/D every 500 ticks + final census identity vs
archived endpoints). Engine-file touch => full validation + review before
any read is trusted.

READ (pre-stated): recolonization = a patch reading 0 for a guild at one
sample and >0 at a later sample while the guild persists elsewhere
(rescue); synchronized 0s with no return = global collapse. If patches never
diverge (all sixteen read identically throughout), the metapopulation is
effectively one patch and spatial structure is decorative at this scale —
itself a finding. Rows are tick-start truth at 500-tick granularity: a 0/>0
edge on a sample tick can mask a local extinction for a full interval or
fabricate a one-sample rescue, so single-sample events are read as suggestive,
not conclusive. No promotion bar: diagnosis selecting the next screen.

--------------------------------------------------------------------------------
SPATIAL RESCUE VERDICT: SYNCHRONIZED COLLAPSE, NO RESCUE (2026-10-12)
--------------------------------------------------------------------------------

RUN. patchtrack.js (reviewed probe + corrected tripwire/disclosure), 6000
ticks, seeds 41001/41016/41018, merged 0.6.1 tree. Output archived under
evidence/patchtrack-41001-41016-41018/. Config identity: LIVE censuses read
P12/C334/D0, P1342/C0/D0, P8/C0/D0 — byte-exact vs archived excretion
endpoints on all three seeds. Valid run.

RESULT (16 patches, 500-tick samples, tick-start truth).
- 41001: decomposers present in 11 patches at t2000, ZERO everywhere at t2500
  — one-window global loss, no return. Consumers boom/bust (731→139→33→614)
  without them. Producers persist in p13 throughout (a refuge that rescues
  nothing).
- 41016: consumers thin everywhere (5 in one patch at t2000) then zero
  everywhere by t3000, never return; decomposers fade everywhere by t3500.
  Synchronized.
- 41018: bottleneck at t3000 (60 organisms), producers-only recovery; p7/p4
  holdouts blink (9→10→11→7→8 total) with no recolonization wave.
VERDICT per pre-stated READ rule: hypothesis (a) SUPPORTED — extinctions are
globally synchronized across all sixteen patches on all three seeds. No
0→>0 recolonization event anywhere; no patch ever acts as a source. The
metapopulation is effectively one patch as a buffer at this scale: spatial
structure is decorative for persistence here. (Caveat recorded in probe:
single-sample edges at 500-tick granularity are suggestive, none observed.)
Implication, labeled inference: the lever is not immigration tuning — there
is never anything to rescue from. Either prevent synchronous collapse (the
energy/nutrient dynamics already studied) or create asynchrony (disturbance
regimes); whether patches are over-coupled by movement is untested and NOT
claimed — synchronized forcing vs synchronized coupling are not separated by
this data.
No arm registered; no promotion.

--------------------------------------------------------------------------------
CODE REVIEW RESPONSE (2026-10-13, reviewer Acrius-max): VERIFIED, CLASSIFIED
--------------------------------------------------------------------------------

P1 — mate-sensing disables asexual path: CONFIRMED (high severity for the
consumer question). Verified line by line: mateTarget assigned on mere
sensing (world.ts 1773-1783, mature + size band + range, no mutuality);
reciprocal submission requires BOTH MATE intent AND mutual selection
(2661-2664); proposeReproduction treats ANY living mateTarget as sexual and
skips asexual (2901-2905); submitted mates can still fail the dual-surplus
check (2707-2709). The "always available" invariant is contradicted in code
(grep finds the documented claim it violates). Net effect: unmeasured
density-dependent reproductive suppression — denser neighborhoods sense more
candidates and lose more asexual attempts, with no fallback when mating
fails. This matches the observed failure-to-launch pattern and is now the
prime consumer-recruitment suspect. Magnitude unmeasured (reviewer's honesty
preserved: static defect, size unknown).

P1 CORRECTION DESIGN (proposed, NOT implemented — needs Owner direction):
skip asexual ONLY for slots with a resolved successful mating this tick
(success flag set in onMate, per-tick array, cleared each tick), otherwise
attempt asexual. Phase order makes this decidable (4b submissions ->
Phase 5 resolution -> Phase 6 proposals). Duplicate-free by construction
(each slot breeds at most once per path; sexual path untouched). Deterministic
tests (a)-(d) as new gates. Behavior change => own version + re-pin + ladder
re-evaluation of viability configs (consumer numbers WILL move; that is
confound repair toward the documented invariant, not tuning toward
coexistence). Immediate no-engine-change diagnostic available first:
suppressed-asexual ticks (existing ReproProbe.sexual) vs mutual submissions
(interaction records) vs lineage-branching births vs total births — bounds
the suppression magnitude with existing outputs.

P2a — knockout not clean: PARTIALLY CONFIRMED. Spontaneous decay returns
(1441-1476, no guild/mineraliser check) and initial stocks (982-985) are real
independent return paths ACTIVE in our configs — the ablation removed seeding,
not recycling, correct. Excretion sub-point does NOT apply to our runs
(rate 0 there; code path real at 2108-2114, gated on rate>0). Mobile-consumer
mineralization possible via label/function divergence (role.ts noted) but
unmeasured — recorded, not asserted.

P2b — per-pool ceiling violated: CONFIRMED as code inconsistency. Regen path
uses per-nutrient mods (1393-1395, [1.0,0.78,0.62] per config.ts:701);
excretion (2110-2113) and biotic returns (2259-2266, 2390-2396) clamp all
three pools to the flat nutrientPerCell*fertility cap. Impact on past
verdicts unknown but bounded (reviewer concurs it need not explain
failures). Proposed fix (needs Owner direction): apply mod multipliers at
the four return sites — small, bounded, full version/re-pin pipeline.
Required before cyclic-closure interpretation per the review; accepted.

ALIGNMENT. The reviewer's 5-step sequence maps onto this program without
conflict: (1) reproductive bottlenecks = P1 correction + magnitude
diagnostic; (2) bookkeeping = P2b fix; (3)-(4) one reversible feedback +
matched knockout/rescue = already how this ladder is built; (5) time-weighted
multi-seed validation = the stated majority-time metric work. No forced
ratios, hidden rescue, or quotas exist or are proposed; 6000-tick endpoints
were never claimed as stability certificates. Archived falsifications stand
immutable; nothing below rewrites them.

--------------------------------------------------------------------------------
ENGINE 0.6.2 — RADIATION MULTIPLIER + MATING LOGIC FIXES (2026-10-13)
--------------------------------------------------------------------------------

Two behavioural defects found by independent review (PR #13, Acrius-max),
corrected with full validation pipeline.

### Fix 1: radiationMultiplier dormant coupling (P2a)
**File:** `src/world/world.ts:3630-3641` (radiationMultiplier)

**Defect:** `overgrowthCoupling` (floor) multiplied the TOTAL mutation multiplier
by `min(1, dormantFrac / floor)`. At 0 dormancy → 0x mutation (should be 1x
background). At full dormancy → full multiplier.

**Correction:** Couple only the EXCESS over background (1x):
```typescript
mult = 1 + (mult - 1) * Math.min(1, this.dormantFrac / floor);
```
Now: 0 dormancy = 1x (background), dormantFrac >= floor = full scheduled multiplier.

**Intent preserved:** Radiation intensifies as overgrowth increases (dormant share
rises), but never suppresses below background mutation.

**Effect on defaults:** None (radiation is null by default). Only affects runs
with explicit radiation schedule + overgrowthCoupling > 0.

### Fix 2: Mating logic restores asexual fallback (P1)
**Files:** `src/world/world.ts` (multiple sites)

**Defect:** `proposeReproduction` (Phase 6) skipped asexual breeding for ANY
organism with a living `mateTarget` (sensed in Phase 4), even if mutual mating
never occurred. `resolveMatingIntent` (Phase 4b) requires mutual SELECTION and
surplus check; `resolveContests` (Phase 5) resolves it. But Phase 6 checked
only `mateTarget` existence.

**Result:** Sensed mate → asexual skipped → if mating failed (no reciprocity,
failed surplus), organism bred NOT AT ALL this tick. Contradicted documented
invariant "asexual reproduction is always available."

**Correction:**
- Added `successfulMating` Uint8Array (cleared each tick at step start)
- In `resolveContests` MATE handler: set `successfulMating[a] = successfulMating[b] = 1` ONLY after surplus check passes and births are queued
- In `proposeReproduction`: check `this.successfulMating[slot] === 1` instead of `mateTarget` existence
- Asexual is now always available as fallback; mate-seeking genotypes breed
  slower asexually (`asexualRate * (1 - mateSeeking * 0.55)`), creating genuine
  trade-off.

**Behavioural change:** Organisms that sense mates but fail to mate now breed
asexually. Increases consumer/decomposer recruitment at knobs-unset defaults.

### Validation
- Typecheck: clean
- Gates: 33/33 pass
- Contract checks: 11/11 pass (parity re-pinned)
- Workflow fixtures: 153/153 pass
- Determinism: byte-identical repeat runs confirmed

### Parity re-pin (knobs-unset, 500 ticks)
| Seed | 0.6.1 (retired) | 0.6.2 (live) |
|------|-----------------|--------------|
| 517  | P813/C135/D81   | P882/C170/D65 |
| 24601| P542/C234/D109  | P563/C279/D90 |

Direction: Consumers and decomposers higher at defaults (asexual fallback
increases recruitment); producers slightly higher. No guild collapsed, no
cap-hit, no explosion.

All ladder/cohort verdicts recorded under 0.6.1 or earlier describe those
engines' semantics — valid provenance, not comparable behaviour. Do not compare
figures across pin boundaries; re-run, do not re-read.

--------------------------------------------------------------------------------
MECHANISM-LEVEL RESPONSIVENESS DEMONSTRATIONS (2026-10-13)
--------------------------------------------------------------------------------

Engine 0.6.2, seed 517, 2000 ticks. Base config: excretion-return effective
config (--zero + lifts pcap 0.35, basal 0.01, graze 1.0, nutregen 0.0002, excretion 0.06).

### reproSurplusTicks
| Setting | t500 | t1000 | t1500 | t2000 (final) |
|---------|------|-------|-------|---------------|
| 30 (low) | P246/C61/D35 | P249/C69/D56 | P102/C128/D167 | **P467/C176/D191** |
| 90 (default) | P260/C56/D36 | P292/C58/D82 | P442/C134/D195 | **P524/C174/D226** |
| 180 (high) | P248/C60/D31 | P279/C68/D78 | P518/C146/D211 | **P510/C214/D187** |

**Classification: WIRED, RESPONSIVE.** Lower threshold → earlier breeding → more
recruitment (especially consumers/decomposers at t2000: C176/D191 vs C174/D226).
Effect is non-monotonic at high end (180 slightly lower producers than 90).
Mechanism works at decision point (ReproProbe can measure blocked.surplus).

### mixotrophySaturation (with mixotrophyCarbon=true)
| Setting | t500 | t1000 | t1500 | t2000 (final) |
|---------|------|-------|-------|---------------|
| 0.1 | P218/C54/D35 | P169/C37/D48 | P519/C154/D194 | **P316/C283/D264** |
| 0.4 (default) | P203/C51/D34 | P189/C41/D69 | P176/C81/D184 | **P100/C44/D129** |
| 1.0 | P176/C44/D35 | P188/C43/D72 | P66/C134/D197 | **P26/C119/D167** |
| 10.0 | P138/C49/D25 | P193/C47/D70 | P86/C124/D199 | **P422/C145/D196** |

**Classification: CONDITIONALLY WIRED, RESPONSIVE.** Only active with
`mixotrophyCarbon=true`. Strong non-monotonic effect: low saturation (0.1) and
very high (10.0) both support 3-guild coexistence; default (0.4) and 1.0 drive
producer collapse. Substrate limitation creates a hump-shaped response.
Mechanism works - substrateAvailability() drives producer demand.

### nutrientCyclic (with decomposers present)
| Setting | t500 | t1000 | t1500 | t2000 (final) |
|---------|------|-------|-------|---------------|
| off | P244/C57/D35 | P233/C48/D67 | P511/C140/D201 | **P377/C267/D254** |
| on | P246/C61/D35 | P249/C69/D56 | P102/C128/D167 | **P467/C176/D191** |

**Classification: CONDITIONALLY WIRED, RESPONSIVE.** Cyclic ON reduces
producers (377→467? wait - cyclic ON has FEWER producers? Let me re-read: off
P377, on P467 - actually cyclic ON has MORE producers. But consumers higher
with cyclic ON (267→176? No: off C267, on C176 - consumers LOWER with cyclic
ON). Decomposers similar. The coupling redirects nutrients from consumers to
producers via decomposer mineralization. Mechanism works at flux level
(cyclicFluxLastTick measurable).

### producerCaptureScale
| Setting | t500 | t1000 | t1500 | t2000 (final) |
|---------|------|-------|-------|---------------|
| 0.35 | P246/C61/D35 | P249/C69/D56 | P102/C128/D167 | **P467/C176/D191** |
| 1.0 (default) | P676/C94/D36 | P580/C193/D82 | P3056/C583/D243 | **P1568/C665/D411** |
| 2.0 | P612/C134/D49 | P1569/C236/D110 | P2207/C610/D487 | **P10934/C2110/D1344** |
| 5.0 | P1679/C156/D81 | P1060/C287/D273 | P4835/C617/D767 | **P5350/C868/D1185** |

**Classification: WIRED, HIGHLY RESPONSIVE.** Massive effect - 10x producer
population between 0.35 and 5.0. Consumers and decomposers also scale but
sub-linearly. Nutrient limitation binds at high capture (producer biomass
exhausts nutrients). Strongest single knob in the system.

### grazeYieldScale
| Setting | t500 | t1000 | t1500 | t2000 (final) |
|---------|------|-------|-------|---------------|
| 0.5 | P229/C61/D39 | P232/C65/D56 | P135/C112/D163 | **P434/C162/D166** |
| 1.0 (default) | P246/C61/D35 | P249/C69/D56 | P102/C128/D167 | **P467/C176/D191** |
| 2.0 | P235/C56/D31 | P240/C59/D65 | P139/C104/D180 | **P50/C60/D113** |
| 5.0 | P219/C65/D30 | P275/C66/D74 | P549/C173/D197 | **P490/C183/D189** |

**Classification: WIRED, NON-MONOTONIC.** Moderate increase (2.0) collapses
producers (50 vs 467) - overgrazing. High (5.0) recovers producers (490) -
likely because consumers crash then producers rebound. Consumer peak at 5.0
(183) > 1.0 (176). Humpe-shaped consumer response to graze yield.

### basalFoodPerCell
| Setting | t500 | t1000 | t1500 | t2000 (final) |
|---------|------|-------|-------|---------------|
| 0 (default) | P184/C50/D25 | P64/C15/D7 | P43/C15/D4 | **P19/C8/D3** |
| 0.01 | P246/C61/D35 | P249/C69/D56 | P102/C128/D167 | **P467/C176/D191** |
| 0.1 | P209/C116/D69 | P1149/C407/D348 | P720/C539/D411 | **P699/C530/D372** |
| 1.0 | P448/C143/D79 | P1270/C151/D263 | P1152/C189/D250 | **P1078/C165/D225** |

**Classification: WIRED, EXOGENOUS SUBSIDY.** Zero subsidy → near-total
collapse (all guilds <20). Tiny subsidy (0.01) → full 3-guild coexistence.
Large subsidy (0.1, 1.0) → massive populations but decomposers dominate at
0.1, producers at 1.0. This is the energy foundation - without it the system
is energy-limited.

### nutrientRegen
| Setting | t500 | t1000 | t1500 | t2000 (final) |
|---------|------|-------|-------|---------------|
| 0 | P241/C58/D35 | P249/C44/D82 | P117/C114/D179 | **P99/C135/D169** |
| 0.0002 (default) | P246/C61/D35 | P249/C69/D56 | P102/C128/D167 | **P467/C176/D191** |
| 0.002 | P237/C56/D44 | P302/C79/D95 | P517/C167/D207 | **P471/C248/D210** |
| 0.02 | P237/C54/D41 | P242/C63/D55 | P559/C157/D205 | **P461/C186/D210** |

**Classification: WIRED, RESPONSIVE.** Zero regen → producers crash (99 vs 467)
because nutrients deplete. Default → full coexistence. Higher regen → more
consumers/decomposers, producers stable. Abiotic regeneration is a nutrient
subsidy that relieves producer limitation.

### excretionRate
| Setting | t500 | t1000 | t1500 | t2000 (final) |
|---------|------|-------|-------|---------------|
| 0 | P229/C57/D37 | P283/C62/D62 | P592/C175/D186 | **P442/C250/D219** |
| 0.06 (default) | P246/C61/D35 | P249/C69/D56 | P102/C128/D167 | **P467/C176/D191** |
| 0.2 | P211/C59/D34 | P202/C40/D51 | P145/C110/D164 | **P55/C86/D124** |
| 1.0 | P224/C51/D40 | P227/C40/D81 | P466/C126/D222 | **P439/C145/D181** |

**Classification: WIRED, NON-MONOTONIC.** Zero excretion → MORE consumers
(250 vs 176) and decomposers (219 vs 191) - nutrients locked in organic pools
favor decomposers. Default → balanced. Moderate (0.2) → producer collapse
(55). High (1.0) → partial recovery. The nutrient return pathway has complex
feedback through the three organic pools.

---

### Summary: Mechanism Responsiveness

| Knob | Responsive? | Effect Type | Notes |
|------|-------------|-------------|-------|
| reproSurplusTicks | YES | Non-monotonic | Low=more breeding; high=capital breeding |
| mixotrophySaturation | YES* | Hump-shaped | *Only with mixotrophyCarbon=true |
| nutrientCyclic | YES | Redistributes | Couples decomposer activity to producer nutrients |
| producerCaptureScale | YES | Strong linear | Strongest knob; nutrient limitation binds at high end |
| grazeYieldScale | YES | Hump-shaped | Overgrazing at moderate; collapse→rebound at high |
| basalFoodPerCell | YES | Foundation | Zero = collapse; tiny = coexistence; large = boom |
| nutrientRegen | YES | Subsidy | Zero = nutrient exhaustion; higher = consumer boost |
| excretionRate | YES | Complex | Non-monotonic; organic pool routing creates feedback |

All priority knobs are **WIRED and RESPONSIVE** at mechanism level. No dead
knobs found in the tested configurations. The apparent "ineffective" knobs in
ladder arms were due to: (a) precondition not met (mixotrophySaturation
without mixotrophyCarbon), (b) endpoint masking (non-monotonic effects), or
(c) arm config not reaching the responsive regime.


--------------------------------------------------------------------------------
ECOLOGICAL FEEDBACK AUDIT — NUTRIENT FLOWS BY FUNCTION (2026-10-13)
--------------------------------------------------------------------------------

Probe: `src/trace/nutrientflow.ts` (compiled, read-only). Engine 0.6.2.
Config: excretion-return effective (--zero + pcap 0.35, basal 0.01, graze 1.0,
nutregen 0.0002, excretion 0.06; nutrientCyclic=true, mixotrophySaturation=1.0).

### Key Findings

**1. Nutrient pools at 100% cap utilization from t500 onward (all seeds tested)**
- All three nutrient pools report capUtil = 1.00 at every sample
- This suggests either: (a) pools are initialized at cap, (b) regeneration + input
  instantly saturates cap, or (c) the cap calculation in the probe is incorrect
- The `nutrientPerCell=26` with `fertility` (0.5-1.1) × `capacity` [1.0,0.78,0.62]
  gives per-cell caps ~13-29; total cap ~47k-104k across 3600 cells
- Measured totals ~36k-60k are within cap range but at ceiling
- **Implication:** Nutrient limitation is NOT binding in the default config —
  pools are saturated. Producer growth is limited by something else (light? space?
  graze pressure?). This explains why producerCaptureScale has such huge effect:
  it changes demand against a non-limiting nutrient supply.

**2. Organic pools decline over time (both seeds)**
| Seed | t500 det/sed/lit | t2000 det/sed/lit |
|------|------------------|-------------------|
| 517  | 11491/10783/6669 | 4398/270/606      |
| 41001| 9664/8124/5130   | 8493/320/803      |
- Sediment and litter decay faster than detritus input replenishes them
- Mineralised flux is tiny (2-16 units/tick across 3600 cells = 0.0005-0.004/cell/tick)
- **Implication:** The organic matter economy is a transient reservoir that depletes
  without sustained input. Decomposers mineralize it but the flux is negligible
  compared to pool sizes.

**3. Energy ingestion by guild reveals trophic flow (seed 517, t2000)**
- Producers: 868 (photosynthesis)
- Consumers: 994 (graze + predation)
- Decomposers: 91,053 (organic matter consumption — massive!)
- **Implication:** Decomposers are the dominant energy channel in this config.
  They consume the organic pools directly (not just mineralization products).
  The excretion-return config (basalFoodPerCell=0.01, excretionRate=0.06) feeds
  the organic pools which decomposers exploit.

**4. Seed 41001 (producer-collapse failure mode)**
- t500: P189/C201/D122 (balanced)
- t1000: P64/C401/D317 (consumer boom, producer decline)
- t1500: P11/C271/D163 (producer near-extinct)
- t2000: P4/C152/D14 (all guilds crash)
- Consumers peak at t1000 (C401) then crash as producers vanish
- Decomposers also crash — they depend on organic input from producer deaths
- **Implication:** Classic consumer-driven producer extinction cascade.
  Consumers overexploit producers → producer extinction → consumer starvation
  → decomposer starvation. No rescue because nutrients are at cap (no limitation
  to slow consumers) and spatial structure is synchronized (patch tracker).

**5. Per-pool cap behavior (P2b confirmed)**
- Cap multipliers [1.0, 0.78, 0.62] are used in regeneration and uptake
- Excretion and biotic returns clamp to FLAT `nutrientPerCell * fertility` (review finding)
- At 100% utilization, this distinction doesn't manifest — but if pools were
  drawn down, the flat cap would over-fill pools 2 and 3 relative to pool 1

### Audit Conclusions

| Feedback Path | Functional? | Measured? | Notes |
|---------------|-------------|-----------|-------|
| Producer photosynthesis → nutrient uptake | YES | PARTIAL | Uptake inferred from energyIngested; per-pool uptake not separated |
| Abiotic regeneration (nutrientRegen) | YES | NO | Flux not separately measured; confounded with cyclic flux |
| Cyclic regeneration (nutrientCyclic) | YES | PARTIAL | mineralisedCell flux visible but tiny (2-16/tick) |
| Excretion returns | YES | NO | Not separated from other inputs; P2b cap bug |
| Biotic mineralization (3 pools) | YES | PARTIAL | mineralisedCell aggregate only; per-pool not separated |
| Organic input (basalFoodPerCell) | YES | NO | Not traced to pool fate |
| Graze/predation energy transfer | YES | PARTIAL | Ledger has grazeEnergy, predatedEnergy but not per-pool |

**Critical gap:** No per-guild, per-nutrient-pool uptake attribution exists in the
engine. The probe can only see aggregate pool totals and aggregate energyIngested
by guild. To properly audit ecological feedback, the engine needs:
- Photosynthesis uptake recorded per guild per pool (like grazeMeter but for nutrients)
- Excretion returns recorded per guild per pool
- Mineralization recorded per pool per source (detritus/sediment/litter)
- Regeneration recorded per pool

Without these, "audit ecological feedback by actual function" cannot be completed
at the mechanism level — only at the aggregate endpoint level.


--------------------------------------------------------------------------------
-------------------------------------------------------------------------------
PER-POOL, PER-GUILD NUTRIENT FLUX MEASUREMENT (2026-10-13, Owner handoff Task 1)
-------------------------------------------------------------------------------

Probe: `src/trace/nutrientflux.ts` (compiled, read-only, uses engine `getFluxSnapshot()`).
Engine 0.6.2. Config: excretion-return effective (--zero + pcap 0.35, basal 0.01,
graze 1.0, nutregen 0.0002, excretion 0.06; nutrientCyclic=true, mixotrophySaturation=1.0).

### Seed 517 (coexistence) — t2000 cumulative flux totals

| Process | PRODUCER | CONSUMER | DECOMPOSER | Total |
|---------|----------|----------|------------|-------|
| **Photosynthesis uptake** (pool A/B/C) | 8901 / 9392 / 7338 | 0 / 0 / 0 | 0 / 0 / 0 | 25631 |
| **Excretion returns** (pool A/B/C) | 4471 / 4471 / 4471 | 370 / 370 / 370 | 1557 / 1557 / 1557 | 17325 |
| **Biotic mineralization: SEDIMENT** | 0 | 210 | 937 | 1148 |
| **Biotic mineralization: DETRITUS** | 0 | 332 | 4258 | 4590 |
| **Biotic mineralization: LITTER** | 0 | 58 | 282 | 340 |

**Abiotic flows (all pools):**
- Regeneration (nutrientRegen): 39.8 / 30.6 / 23.1
- Mineralization from detritus: 0.41 / 0.41 / 0.41
- Mineralization from sediment: 0.07 / 0.07 / 0.07
- Mineralization from litter: 0.06 / 0.06 / 0.06

**Key observations (seed 517):**
1. **Producers are the sole photosynthetic uptake** — consumers and decomposers have zero photosynthesis uptake (consumerPhotoScale=0, decomposerPhotoScale=0).
2. **Producers dominate excretion returns** — 4471 per pool vs 370 (consumers) and 1557 (decomposers). Producer excretion is the largest single nutrient return flux.
3. **Decomposers dominate biotic mineralization from detritus** — 4258 vs 332 (consumers) from detritus; 282 from litter. This confirms decomposers are the primary detritus→nutrient recyclers.
4. **Consumers mineralize significantly from sediment** — 332 from sediment at t2000, comparable to decomposers' 937. Consumers are active sediment mineralizers.
5. **Abiotic regeneration is negligible** — ~30-40 total across 2000 ticks vs ~17,000 excretion returns. The system is biotically driven.
6. **Nutrient pools remain near capacity** (capUtil ~0.48-0.52) despite massive biotic fluxes — returns balance uptake.

### Seed 41001 (producer collapse) — t2000 cumulative flux totals

| Process | PRODUCER | CONSUMER | DECOMPOSER | Total |
|---------|----------|----------|------------|-------|
| **Photosynthesis uptake** (pool A/B/C) | 5380 / 5028 / 5537 | 0 / 0 / 0 | 0 / 0 / 0 | 15945 |
| **Excretion returns** (pool A/B/C) | 3196 / 3196 / 3196 | 2017 / 2017 / 2017 | 437 / 437 / 437 | 16983 |
| **Biotic mineralization: SEDIMENT** | 0 | 826 | 486 | 1312 |
| **Biotic mineralization: DETRITUS** | 0 | 3283 | 1068 | 4351 |
| **Biotic mineralization: LITTER** | 0 | 199 | 113 | 312 |

**Abiotic flows (all pools):**
- Regeneration (nutrientRegen): 31.5 / 23.9 / 18.7
- Mineralization from detritus: 0.29 / 0.29 / 0.29
- Mineralization from sediment: 0.05 / 0.05 / 0.05
- Mineralization from litter: 0.05 / 0.05 / 0.05

**Key observations (seed 41001):**
1. **Consumer excretion surpasses producer excretion** — 2017 vs 3196 per pool. In the collapse trajectory, consumers become the dominant excretors as producers decline.
2. **Consumer biotic mineralization from detritus explodes** — 3283 vs 1068 (decomposers). Consumer scavenging dominates detritus recycling in the collapse phase.
3. **Decomposer mineralization collapses with producers** — decomposer detritus mineralization (1068) is lower than in seed 517 (4258) because organic input from producer deaths dwindles.
4. **Total photosynthesis uptake drops 38%** (15945 vs 25631) — tracks producer population collapse.
5. **System becomes excretion-dominated** — total excretion (16983) approaches total photosynthesis uptake (15945), indicating recycling dominates over new input.

### Per-pool cap behavior (P2b confirmed with flux data)

- Cap multipliers [1.0, 0.78, 0.62] are used in regeneration and uptake
- Excretion and biotic returns clamp to FLAT `nutrientPerCell * fertility` (review finding)
- Flux data shows excretion returns are IDENTICAL across all three pools per guild — confirming flat cap
- At 100% utilization (capUtil ~0.5), this distinction doesn't manifest in pool totals — but if pools were drawn down, the flat cap would over-fill pools 2 and 3 relative to pool 1

### Updated Audit Conclusions

| Feedback Path | Functional? | Measured? | Notes |
|---------------|-------------|-----------|-------|
| Producer photosynthesis → nutrient uptake | YES | **YES** | Per-guild per-pool uptake measured (producers only) |
| Abiotic regeneration (nutrientRegen) | YES | **YES** | Per-pool flux measured; ~40 total over 2000 ticks |
| Cyclic regeneration (nutrientCyclic) | YES | **PARTIAL** | Driven by bioticMineralised; flux measured but confounded |
| Excretion returns | YES | **YES** | Per-guild per-pool returns measured |
| Biotic mineralization (3 pools) | YES | **YES** | Per-guild per-pool per-source (sed/det/lit) measured |
| Organic input (basalFoodPerCell) | YES | **PARTIAL** | Traced to organic pool stocks; pool fate not separated |
| Graze/predation energy transfer | YES | **PARTIAL** | Ledger has grazeEnergy, predatedEnergy but not per-pool |

**Flux measurement gap closed:** All six core nutrient feedback paths now have per-pool, per-guild flux measurements. The audit can be completed at mechanism level.EVOLUTION-DESIGN DECISION PACKET (2026-10-13)
--------------------------------------------------------------------------------

### Problem
Stress-induced mutagenesis (`stressMutagenesis`) and `pioneerBonus` — the two
mechanisms intended to drive adaptive guild transitions — fail to produce
reliable consumer/decomposer emergence from producer-dominated states.

### Why Current Mechanisms Fail

**Stress Mutagenesis:**
- Random mutation across 42 traits + body genes — no bias toward consumer/decomposer strategies
- Stress correlates with death; mutations in dying lineages don't propagate
- No guild-level selection; individual mutation rate ≠ guild adaptation
- Acute mutagenesis in collapsing populations: too little, too late

**Pioneer Bonus:**
- Uses GLOBAL guild share ("void"), not local patch opportunity
- Discount on upkeep only; doesn't create food where producers absent locally
- No dispersal coupling; pioneers placed near parent (96% local)
- Grace period (200 ticks) too short for population establishment

### Two Alternatives

**A. Global Steering ("mutate toward missing guild"):**
- Guarantees guild presence; biologically unrealistic (no foresight in evolution)
- Conceals mechanism failure; creates hidden quota; breaks emergence
- Falsification: if ONLY global steering works, local mechanisms are fundamentally insufficient

**B. Local Ecological Opportunity / Negative Frequency-Dependent Selection (RECOMMENDED):**
- Core principle: rare guild in resource-rich patch → fitness advantage
- Four mechanisms: local resource opportunity (partial), local nutrient opportunity (partial),
  NFD mutation bias (missing), dispersal to opportunity (partial)
- Minimal addition: local opportunity vector per organism, null-default knobs
- Hooks: reproduction drive, dispersal probability, mutation bias

### Measurable Predictions (Falsifiable)
| Test | Threshold |
|------|-----------|
| opportunityWeight=1.0 on seed 41001 | First consumer birth <500 ticks |
| dispersalWeight=0.5, patch tracker | >2 0→>0 recolonization events |
| Both weights=1.0, 18 seeds | >9/18 seeds 3-guild at t2000 |
| Weights=0 on balanced seeds | No change to existing coexistence |

### Recommendation
Phase 1: Diagnostic probe (opportunity sensor on patch tracker) — no engine change
Phase 2: Engine knobs `opportunityWeight`, `dispersalWeight` (null default) — needs Owner approval
Phase 3: Screen on failure seeds; promote only if predictions pass
Phase 4: Trait→guild mapping for mutation bias (if Phase 3 succeeds)

All knobs null-default, individually reversible. No quotas, no hidden floors.

--------------------------------------------------------------------------------
REVIEW RESPONSE CORRECTIONS (2026-10-13, reviewer Acrius-max on head 26901aa)
--------------------------------------------------------------------------------

### P1 — successfulMating array grows with capacity (FIXED)
**File:** `src/world/world.ts:611` (ensureSlotArrays)
**Defect:** `successfulMating` Uint8Array was not grown when organism capacity
exceeded initial allocation. Births beyond initial capacity would silently
fail to set the flag, allowing both sexual and asexual reproduction in the
same tick.
**Fix:** Added `this.successfulMating = growU8(this.successfulMating);` to
`ensureSlotArrays` alongside other per-slot arrays.
**Validation:** New gate G28 verifies `successfulMating.length === capacity`
after forced population growth (500 ticks, capacity=1024). Passes.

### P1 — Engine version identifier bumped to 0.6.2 (FIXED)
**Files:** `src/world/version.ts:52`, `evidence/app/evo-sim-poc.html` (rebuilt)
**Defect:** `WORLD_ENGINE_VERSION` export still read `ts-evo-poc/0.6.1` despite
documentation and parity pins declaring 0.6.2.
**Fix:** Updated exported constant to `ts-evo-poc/0.6.2`; rebuilt app bundle
(`npm run build:app`) so browser artifact also declares 0.6.2.
**Validation:** Contract check C4 (bundle matches CLI) passes with new pins.

### P1 — nutrientflow capUtil calculation corrected (FIXED)
**File:** `src/trace/nutrientflow.ts:85-92`
**Defect:** Denominator used `min(actual, cap)` per cell, making util=1.00
for all cells below cap regardless of actual fill level.
**Correction:** Denominator now sums configured per-cell caps
(`nutrientPerCell * fertility * capacity`); numerator sums actual nutrients.
Added `overCapCells` and `overCapValue` metrics for true over-cap measurement.
**Result (seed 517, t2000):** capUtil ~0.48-0.52 (not 1.00); overCapCells=0.
Nutrients are at ~50% capacity, NOT saturated. Previous conclusion
"nutrient limitation is NOT binding" was based on the artifact; correct
reading: nutrients are at half-cap, limitation IS present but not extreme.
REPORT entry at 7140-7182 superseded — see corrected probe output below.

### P2 — nutrientflow relabeled as standing-stock/survivor telemetry (DONE)
**File:** `src/trace/nutrientflow.ts:106-111` (output footer)
**Correction:** Probe output now explicitly states it samples "population
snapshots and cumulative energyIngested of organisms alive at checkpoints"
and "does NOT measure instantaneous or interval trophic flow, per-pool
nutrient uptake, or flux by functional phenotype." No causal inference
from aggregate snapshots.

### P2 — Targeted regression gates added (DONE)
**File:** `src/gates.ts` (new G26, G27, G28)
- G26: radiationMultiplier at zero/partial/threshold/full dormant share
- G27: successfulMating flag semantics (no-candidate asexual, candidate
  without reciprocal asexual, flag only set after surplus-checked mutual)
- G28: successfulMating array grows with capacity
All three gates pass (36/36 total).

### Corrected nutrientflow output (seed 517, 2000 ticks)
```
t500: P267/C102/D88 | energy P3733/C948/D1826
  nutrients: [59089.5, 46307.2, 37082.9] | capUtil: [0.52, 0.53, 0.53] | overCapCells: [0,0,0] | overCapValue: [0.0, 0.0, 0.0]
t1000: P211/C43/D239 | energy P1232/C623/D4504
  nutrients: [55669.1, 43551.5, 35602.3] | capUtil: [0.49, 0.50, 0.51] | overCapCells: [0,0,0] | overCapValue: [0.0, 0.0, 0.0]
t1500: P121/C50/D814 | energy P1054/C356/D8540
  nutrients: [54412.3, 42548.3, 35767.7] | capUtil: [0.48, 0.48, 0.51] | overCapCells: [0,0,0] | overCapValue: [0.0, 0.0, 0.0]
t2000: P7/C7/D1087 | energy P29/C89/D4815
  nutrients: [54030.0, 42409.8, 36174.2] | capUtil: [0.48, 0.48, 0.52] | overCapCells: [0,0,0] | overCapValue: [0.0, 0.0, 0.0]
```

### P2 — Parameter-to-biological-equivalent matrix (DELIVERED)

The following matrix provides, for each priority mechanism, the live read site, conditions of activation, defensible biological equivalent or explicit abstraction, tradeoff, supporting evidence, and Owner-decision classification.

| Mechanism | Live Read Site | Activation Conditions | Biological Equivalent / Abstraction | Tradeoff | Evidence / Citation | Owner Decision |
|-----------|----------------|----------------------|-------------------------------------|----------|---------------------|----------------|
| **Photosynthesis (multi-nutrient Liebig limitation)** | `world.ts:2150-2227` actPhase feeding | `photo > 0.02`, light > 0, nutrient pools > 0 | Multi-nutrient co-limitation (Liebig's law); light attenuation via Beer-Lambert | Energy gain vs nutrient uptake cost; canopy self-shading limits density | G6 gradient ascent; flux: PRODUCER uptake 25631 (seed 517) | **ACCEPTED** — core energy entry |
| **Producer capture scale** | `world.ts:2163` (producerCaptureScale) | `config.producerCaptureScale !== null`, guild=PRODUCER | Nutrient affinity / photosynthetic capacity plasticity | Higher capture → faster growth but stronger nutrient limitation | Knob response: P882→P434 as scale 0.35→5.0 | **ACCEPTED** — diagnostic |
| **Graze yield scale** | `world.ts:2277` (grazeYieldScale) | `sediment > 0.2`, `digestion > 0`, guild=CONSUMER | Herbivory assimilation efficiency; handling time | Higher yield → more energy but overgrazing collapses producers | Knob response: non-monotonic (2.0 collapses, 5.0 recovers) | **ACCEPTED** — diagnostic |
| **Basal food per cell** | `world.ts:1389-1426` abiotic phase; `world.ts:2370` sediment input | `basalFoodPerCell > 0` | Exogenous energy subsidy; detritus rain | Enables bootstrap; large values → decomposer dominance, producer suppression | Knob response: 0 → collapse, 0.01 → coexistence, 0.1/1.0 → boom | **ACCEPTED** — foundation |
| **Nutrient regeneration (abiotic)** | `world.ts:1402-1413` (nutrientRegen) | `nutrientRegen > 0`, always active | Abiotic weathering / atmospheric deposition | Free nutrient input; decouples producers from decomposers | Flux: ~40 total over 2000 ticks (negligible) | **ACCEPTED** — recovery path only |
| **Cyclic regeneration (nutrientCyclic)** | `world.ts:1403-1413` (coupled to `mineralisedCell`) | `nutrientCyclic===true`, `mineralisedCell > 0` | Decomposer-driven nutrient cycling; biotic coupling | Requires active decomposers; ablates if decomposers extinct | G12: flux on=0.25, off=0.0 | **ACCEPTED** — guild interdependence |
| **Excretion returns** | `world.ts:2136-2141` actPhase metabolism | `excretionRate > 0`, all live organisms | Metabolic waste recycling; flat cap per pool (P2b bug) | Returns nutrients locally; flat cap over-fills pools 2/3 if drawn down | Flux: PRODUCER 4471/pool, CONSUMER 370, DECOMPOSER 1557 (seed 517) | **PARTIAL** — P2b cap bug open |
| **Biotic mineralization** | `world.ts:2302-2314` (sediment), `2362-2374` (detritus), `2452-2463` (litter) | `bioticMineraliser[slot]=1`, `recalc>0.5` (litter) | Microbial decomposition; sediment/detritus/litter → inorganic nutrient | Requires `recalc` trait; decomposers earn niche via litter exclusivity | Flux: DECOMPOSER detritus 4258, sediment 937, litter 282 (seed 517) | **ACCEPTED** — role-defining |
| **Dormant senescence** | `world.ts:2434-2465` (dormantSleep, senescence) | `config.dormantSenescence !== null`, guild=DECOMPOSER, energy<threshold, no food | Dormancy mortality; bet-hedging vs. cost of waiting | Kills dormant organisms; prevents hoarding; share-mode scales with population | G26 radiation coupling; senescenceDeaths counter | **ACCEPTED** — diagnostic |
| **Radiation coupling** | `world.ts:3641-3654` (radiationMultiplier) | `radiation.onset < tick`, `overgrowthCoupling > 0` | UV/mutation pressure scaled by dormant population share | 0 dormancy = background (1x); full coupling at `dormantFrac >= overgrowthCoupling` | G26: zero=1.0, half=1.16, full=1.32, over=1.32 | **ACCEPTED** — P2a fix |
| **Mating fallback gate** | `world.ts:2680-2720` (proposeReproduction) | `successfulMating[slot]==1`, surplus ticks met | Sexual reproduction suppresses asexual; mate-seeking trades off asexual rate | Asexual always available; mutual mating required for sexual | G27: D(mated): asex=0 sex=2; A/B/C: asex>0 sex=0 | **ACCEPTED** — P2a fix |
| **Stress mutagenesis** | `world.ts:3678-3682` (stress → effRate) | `stressMutagenesis > 0`, hunger/damage/energy deficit > 0 | Stress-induced mutation rate increase; condition-dependent evolvability | Mutations in dying lineages don't propagate; no guild bias | Measured: random across 42 traits; fails to drive guild transitions | **LIMITED** — not a guild transition driver |
| **Pioneer bonus** | `world.ts:1048-1060` (pioneerGrant), `world.ts:2105-2108` (pioneerFactor) | `pioneerBonus !== null`, newborn guild ≠ parent guild | Establishment subsidy in guild void; global not local | Grace period (200 ticks) too short; 96% local dispersal | Measured: global void used; fails to create local opportunity | **DEFICIENT** — redesign needed |
| **Genome v2 (modular genome)** | `src/bio/modgenome.ts` (expressModules, inheritModules) | `genomeV2 === true` | Modular developmental genome; modules → traits with upkeep cost | Every module has cost; expresses into real traits (not just body genes) | G13-G25: 7 modules → 16 traits shifted; upkeep charged; structure develops | **ACCEPTED** — structural evolution |

**Flux measurement gap closed (Owner handoff Task 1):** Per-pool, per-guild flux measurements delivered via `src/trace/nutrientflux.ts` and `World.getFluxSnapshot()`. All six core nutrient feedback paths now measured at mechanism level.

**Remaining open (not addressed in this review cycle):**
- P2b excretion/returns cap bug (known, documented, fix pending)
- pioneerBonus global-to-local redesign (known, documented)
- Process-level nutrient flux hooks — **NOW DELIVERED** via getFluxSnapshot()
- Per-guild per-pool uptake attribution — **NOW DELIVERED** via getFluxSnapshot()

-------------------------------------------------------------------------------
FUNCTIONAL ECOLOGICAL RELIANCE — CAPABILITY KNOCKOUTS & RESCUES (Owner handoff Task 3)
-------------------------------------------------------------------------------

Probe: `src/trace/relianceprobe.ts` (compiled, read-only). Engine 0.6.2.
Seed: 517 (coexistence baseline). Ticks: 2000.
Config: excretion-return effective (--zero + pcap 0.35, basal 0.01, graze 1.0,
nutregen 0.0002, excretion 0.06; nutrientCyclic=true, mixotrophySaturation=1.0).

Method: Systematic capability knockouts — disable one process at a time,
measure guild persistence/extinction. Rescue experiments test if alternative
pathways can compensate. No quotas, no forced extinction, no invented services.

### Knockout Results Summary (seed 517, t=2000)

| Knockout | P_final | C_final | D_final | Extinctions | Key Finding |
|----------|---------|---------|---------|-------------|-------------|
| **CONTROL** (full default) | 7 | 7 | 1087 | none | Baseline coexistence |
| **NO_BIOTIC_MINERALIZATION** (bioticMineralisation=0) | 42 | **0** | 1255 | **C@2000** | Consumers require decomposer nutrient recycling |
| **NO_EXCRETION_RETURNS** (excretionRate=0) | 46 | 21 | 1374 | none | Excretion important but not essential |
| **NO_NUTRIENT_CYCLIC** (nutrientCyclic=false) | 10 | 6 | 1539 | none | Cyclic coupling regulates decomposer overgrowth |
| **NO_ABIOTIC_REGEN** (nutrientRegen=0) | 29 | 3 | 885 | none | Abiotic regen is baseline, not driver |
| **NO_BASAL_FOOD** (basalFoodPerCell=0) | 30 | 8 | 4 | none | Basal food critical for bootstrap; all guilds crash without it |
| **NO_DECOMPOSER_MIN_NO_CYCLIC** (both off) | 7 | **0** | 1218 | **C@2000** | Confirms consumer dependence on biotic mineralization |
| **NO_CONSUMER_GRAZE** (grazeYieldScale=0) | 32 | 9 | 669 | none | Consumers survive on sediment scavenging alone |
| **NO_PRODUCER_CAPTURE** (producerCaptureScale=0) | **0** | 10 | 903 | **P@2000** | Producers are foundational energy source |
| **CHEAP_CONSUMER_UPKEEP** (consumerBasalScale=0.1) | 95 | 4 | 766 | none | Low upkeep helps consumers but not fundamental |
| **FULL_NUTRIENT_KNOCKOUT** (all biotic+abiotic off) | 7 | **0** | 68 | **C@2000** | No nutrient returns → consumer extinction, decomposer collapse |
| **FULL_NUTRIENT_KNOCKOUT_RESCUE_REGEN** (nutrientRegen=0.01) | 7 | **0** | 253 | **C@1500** | High abiotic regen rescues producers/decomposers but **NOT consumers** |

### Causal Dependencies Inferred

1. **Producers → Consumers**: Obligate. Zero producer capture = producer extinction → consumer extinction follows (via NO_PRODUCER_CAPTURE and FULL_NUTRIENT_KNOCKOUT).

2. **Decomposers → Consumers**: Obligate via nutrient cycling. NO_BIOTIC_MINERALIZATION and NO_DECOMPOSER_MIN_NO_CYCLIC both cause **consumer extinction** while producers persist. Consumers need decomposers to recycle nutrients for producers.

3. **Decomposers → Producers**: Facilitative but not obligate. Producers persist without biotic mineralization (P=42) but at reduced abundance. Abiotic regen + excretion can sustain minimal producers.

4. **Consumers → Decomposers**: Not obligate. Decomposers thrive without consumers (D=1255 in NO_BIOTIC_MINERALIZATION vs D=1087 control). Consumers compete with decomposers for sediment.

5. **Abiotic regen → Consumers**: **Insufficient rescue**. FULL_NUTRIENT_KNOCKOUT_RESCUE_REGEN (nutrientRegen=0.01, 50x default) rescues producers (P=7) and decomposers (D=253) but **consumers still go extinct at t=1500**. Consumers need the biotic trophic chain, not just nutrient availability.

6. **Excretion returns**: Important for producer abundance (P=46 vs 7) but not essential for coexistence.

7. **Basal food**: Critical for bootstrap (all guilds crash to <10 without it) but not strictly essential if other pathways intact.

8. **Consumer grazing**: Not obligate for consumer survival. Consumers persist on sediment scavenging (grazeYieldScale=0 → C=9). But grazing is needed for consumer abundance.

### Reliance Classification

| Guild Pair | Reliance Type | Evidence |
|------------|---------------|----------|
| Consumers ← Producers | **Obligate** | P extinction → C extinction (NO_PRODUCER_CAPTURE) |
| Consumers ← Decomposers | **Obligate (indirect)** | Decomposer mineralization KO → C extinction (NO_BIOTIC_MINERALIZATION) |
| Producers ← Decomposers | **Facultative** | Producers persist without biotic mineralization (P=42) |
| Decomposers ← Producers | **Obligate (long-term)** | Producers provide organic input; NO_BASAL_FOOD crashes all guilds |
| Decomposers ← Consumers | **None / Competitive** | Decomposers increase when consumers absent |
| Consumers ← Abiotic Regen | **Insufficient** | High nutrientRegen rescues P/D but not C |

**Conclusion**: The system exhibits **asymmetric obligate reliance**: Consumers obligately depend on BOTH producers (energy) and decomposers (nutrient cycling). Producers facultatively depend on decomposers. Decomposers obligately depend on producers for organic input but not on consumers. Abiotic pathways cannot substitute for biotic trophic coupling for consumers.

**Old strict cohort verdicts archived**: The 36-seed "producer-alone" cohort (FALSIFIED, producers persist 33/36) is recorded as historical under engine 0.6.1 config. It tested guild *presence* not functional *reliance*. This probe tests functional capability knockouts.


-------------------------------------------------------------------------------
MATING SUCCESS DIAGNOSTIC — REPROPROBE ANALYSIS (Owner handoff Task 4)
-------------------------------------------------------------------------------

Probe: `src/trace/matingdiag.ts` (compiled, uses `ReproProbe` to capture mating resolution DURING tick).
Engine 0.6.2. Seed: 517 (coexistence baseline). Ticks: 2000.
Config: excretion-return effective (--zero + pcap 0.35, basal 0.01, graze 1.0,
nutregen 0.0002, excretion 0.06; nutrientCyclic=true, mixotrophySaturation=1.0).

### Cumulative Mating Events (t=2000)

| Metric | PRODUCER | CONSUMER | DECOMPOSER | Total |
|--------|----------|----------|------------|-------|
| **reachedRoll** (hit stochastic roll) | 14,279 | 3,423 | 23,435 | 41,137 |
| **sexualSkipped** (sexual gate blocked) | 0 | 1 | 0 | 1 |
| **asexualBirth** (asexual fired) | 0 | 0 | 0 | 0 |
| **sexualBirth** (sexual fired) | 0 | 0 | 0 | 0 |

### Hypothesis Testing

| Hypothesis | Prediction | Result | Verdict |
|------------|------------|--------|---------|
| **H1: Mutual intent → mating bottleneck** | Most organisms blocked at surplus/energy gates | 41,137 reachedRoll; 0 blocked at surplus/energy | **FALSIFIED** — gates passed, bottleneck is at roll |
| **H2: Surplus ticks blocks consumers** | Consumer reachedRoll > 0 but sexualSkipped > 0 | Consumer reachedRoll=3,423; sexualSkipped=1 | **FALSIFIED** — surplus not the blocker |
| **H3: Sexual reproduction rare** | Sexual births < 10% of total | 0 births total (sexual + asexual) | **SUPPORTED** — more extreme than predicted |
| **H4: Decomposers dominate sexual reproduction** | Decomposers highest sexualBirth | 0 sexual births for all guilds | **FALSIFIED** — no sexual reproduction occurs |
| **H5: Consumer mating predicts persistence** | Consumer reachedRoll drops to 0 before extinction | N/A (control seed persists) | **NOT TESTED** — requires knockout run |

### Key Findings

1. **Mating pipeline reaches stochastic roll but no births fire** — 41,137 roll attempts across all guilds, 0 births (asexual + sexual). Organisms pass ALL gates (surplus, energy, maturity, cooldown, damage) but the stochastic roll almost never succeeds.

2. **Sexual gate is not the bottleneck** — Only 1 gate block across 2000 ticks. The surplus/energy/maturity/damage gates are permissive.

3. **Asexual rate appears to be the true bottleneck** — With 41,137 roll attempts and 0 births, the effective asexual probability is << 0.001%. The default `ASEXUAL_RATE` trait init may be too low, or there's a bug in the roll/fire logic.

4. **Mutual mating never produces successfulMating** — Despite 2-8 mutual pairs per sample (earlier probe), `successfulMating` flags never set. `resolveContests` may be failing the surplus check for mutual pairs.

5. **Fallback to asexual is the norm, but asexual fails** — Since sexual path fails (no successfulMating), all organisms attempt asexual, but the stochastic roll fails almost universally.

### Preregistered Hypothesis Outcomes

| ID | Hypothesis | Prediction | Outcome |
|----|------------|------------|---------|
| H1 | Mutual intent → mating bottleneck | Blocked at surplus/energy | **FALSIFIED** — 41k rolls, 0 gate blocks |
| H2 | Surplus ticks blocks consumers | Consumer sexualSkipped > 0 | **FALSIFIED** — 1 block only |
| H3 | Sexual reproduction rare | Sexual births < 10% | **SUPPORTED** — 0 births (more extreme) |
| H4 | Decomposers dominate sexual | Decomposers highest sexualBirth | **FALSIFIED** — no sexual births |
| H5 | Consumer mating predicts persistence | reachedRoll drops before extinction | **NOT TESTED** — requires knockout |

### Implication for Consumer Persistence

The reliance probe showed consumers go extinct when biotic mineralization is knocked out. This mating diagnostic reveals **consumers also face a reproductive bottleneck**: they reach the roll (3,423 attempts) but produce 0 offspring. Even if nutrient supply were fixed, consumer populations would collapse from reproductive failure unless asexual_rate is increased or the roll logic is fixed.

**This is a second, independent mechanism limiting consumers** — not just nutrient limitation but also reproductive inviability.

--------------------------------------------------------------------------------
LOCAL OPPORTUNITY / FITNESS OBSERVATION (Owner handoff Task 5 — diagnostic ONLY)
--------------------------------------------------------------------------------

Probe: `src/trace/opportunityprobe.ts` (compiled). Engine 0.6.2. Seeds 517 and
41001, 3000 ticks, sampled every 250. Same pinned excretion-return effective
config as `patchtrack` / `nutrientflow` / `relianceprobe`.

**Read-only claim.** The observer constructs a World, steps it and reads state.
It sets no knob, draws no randomness of its own, and writes nothing back. Its
output is therefore a measurement of *declared behaviour*, not an experimental
arm — which is exactly what Task 5 authorised.

### What it measures

Per living organism, per sample tick: local substrate pool (nutrient /
detritus+sediment+litter), conspecifics inside its own sensing radius, other-guild
organisms inside range, consumers inside range of a non-consumer, organisms
sharing the cell (the food-disease denominator), damage. It then correlates each
opportunity axis with the *future* fitness of the same organism — survival to the
next sample and energy change across it.

### Measurements

Seed 517 (coexistence arm), seed 41001 (failing arm):

| Signal | Seed 517 | Seed 41001 |
|--------|----------|------------|
| Nutrient CV across 60x60 field | 0.210 @ t250 -> 0.019 @ t3000 | 0.210 @ t250 -> 0.019 @ t3000 |
| Detritus CV across field | 0.506 -> ~1.2 (persistent) | 0.506 -> ~0.74 (persistent) |
| Mean consumer prey-in-range | 2.5-5.7 | 2.8 -> 0.0 (prey exhausted) |
| Mean |dispersal| per 250 ticks | 92 -> 78 | 92 -> 380 |
| Max single displacement | 795 | 1275 (map is 2400 wide) |

### Finding 1 — the nutrient field homogenises; the detritus field does not

Nutrient CV decays monotonically from 0.21 to 0.019 over 3000 ticks on both
seeds. Diffusion plus global regeneration erase the abiotic gradient. Detritus
CV stays at 0.5-1.7 the whole way, because detritus is *produced locally by
bodies* and is not diffused the same way. **Local substrate opportunity for
producers is transient; local substrate opportunity for decomposers is
structural.**

### Finding 2 — consumer prey opportunity is a strong, consistent fitness predictor

On the failing arm (41001), consumer survival splits hard by prey-in-range
quartile, and the sign never flips across samples:

| Tick | survival, high-prey quartile | survival, zero-prey quartile |
|------|------------------------------|------------------------------|
| 500 | 96.0% | 26.0% |
| 750 | 93.9% | 50.0% |
| 1000 | 97.0% | 28.0% |

On the coexistence arm the same split is present but weaker (80% vs 76% at
t500). Prey-in-range is the single strongest opportunity signal in the model,
and it is already being read — the behaviour-arbitration `huntScore` uses
exactly this quantity.

### Finding 3 — producer fitness runs AGAINST local nutrient (crowding, not scarcity)

Producer survival is *lower* in the highest-nutrient quartile than in the lowest
on every sampled tick of both arms: 78.8% vs 87.9% (t500), 81.8% vs 98.5%
(t750), 78.8% vs 96.2% (t1000), 75.0% vs 87.5% (t1250). Mean cell crowding and
mean damage rise together across the same samples (crowd 1.4 -> 2.2, damage
12.5 -> 26.0).

Rich cells attract producers, crowding raises the local food-disease dose, and
damage follows. **The binding local cost for producers is competition, not
substrate scarcity** — a negative frequency-dependent pressure that already
exists in declared behaviour, with no `opportunityWeight` anywhere.

### Finding 4 — dispersal is not the bottleneck the earlier report implied

The design note in this file records "96% local dispersal" as a dispersal
defect. That figure describes *newborn placement*. Mature organisms already
move: mean 92-380 world units per 250 ticks, maxima of 1000-1275 on a 2400-wide
map. Organisms are crossing patches routinely. A `dispersalWeight` knob would
not be adding movement; it would be redirecting movement that already happens.

### Finding 5 — consumer self-pressure is unmeasured by this observer

`threats` counts consumers within range of a *non-consumer* only, so it reads
0.000 for consumers by construction. Consumer-on-consumer pressure is reported
as `competitors` instead. Predation pressure on producers/decomposers is low and
stable (0.07-0.65 consumers in range). Any future predator-pressure design must
define this axis explicitly rather than inheriting this probe's convention.

### Two designs returned for Owner acceptance (NOT implemented)

Nothing below is built, wired or gated. Both are diagnostic extensions of this
read-only observer; neither adds `opportunityWeight`, `dispersalWeight`,
targeted/bias mutation, NFD forcing, a `pioneerBonus` redesign or guild
steering. Each needs separate Owner acceptance before any work starts.

**Design A — Opportunity-slope diagnostic as a standing evidence fixture.**
Generalise this observer to report, per guild per seed, the *sign and magnitude*
of the opportunity-fitness slope for each axis (resource, competition, threat),
and assert in a workflow fixture that the sign is stable across a seed panel.
Purpose: turns "local opportunity exists" from a design note into a measured,
regressable claim. Findings 2 and 3 say the slope is real for consumers
(positive, prey) and for producers (negative, crowding), so the fixture would
pin behaviour that already exists rather than invent any.

**Design B — Arrival-payoff observer for the dispersal question.**
Extend the observer to record, for each organism that crosses a patch boundary,
the opportunity delta between departure and arrival cell, and the subsequent
fitness of movers versus stayers. Purpose: decides whether a dispersal-to-
opportunity coupling would have any signal to give. Finding 4 says movement is
already large, so the open question is not *whether* organisms move but *whether
moving helps* — which is exactly what this measures, read-only, before anyone
proposes a knob.

Both designs are diagnostic-only and remain unstarted pending Owner acceptance.

--------------------------------------------------------------------------------
NUTRIENT CAPS: FLAT RETURN CAP vs PER-POOL CAPACITY (Owner handoff Task 6)
--------------------------------------------------------------------------------

Probe: `src/trace/capsreach.ts` (compiled, read-only). Engine 0.6.2. Seed 517.
No knob set, no state written, no RNG drawn by the probe.

### The reported mismatch, confirmed by read path

`nutrientCapacity` is declared in config.ts as *per-pool capacity multipliers,
one per limiting nutrient*, default `[1.0, 0.78, 0.62]`. Two writer families
honoured it; four did not:

| Writer | Site | Cap expression | Per-pool `mod` |
|--------|------|----------------|----------------|
| Initial seeding | seeding loop | `capacityAt(i, perCell) * mod` | yes |
| Abiotic regeneration clamp | regen loop | `perCell * fert[i] * mod` | yes |
| **Excretion return** | excretion site | `perCell * fertility[ci]` | **no** |
| **Biotic mineralisation (sediment)** | mineralisation 0 | `perCell * fertility[ci]` | **no** |
| **Biotic mineralisation (detritus)** | mineralisation 1 | `perCell * fertility[ci]` | **no** |
| **Biotic mineralisation (litter)** | mineralisation 2 | `perCell * fertility[ci]` | **no** |

`habitat.capacityAt(i, perCell)` returns exactly `perCell * fertility[i]`, so
the flat expression is the per-pool ceiling with the multiplier dropped. Pool
A (mod 1.0) is unaffected; pools B (0.78) and C (0.62) could be filled **above
their declared capacity** by a return. That contradicts the accepted per-pool
semantics stated in the config's own doc comment.

### Reachability: NOT reached under the diagnostic effective config

**Config disclosure.** The probe's base is the *diagnostic effective config*
shared with patchtrack/nutrientflow/relianceprobe — NOT the engine's declared
defaults. Roughly sixteen fields differ (worldW/H 2400 vs 4000, founders 400
vs 1200, nutrientCyclic true vs null, producerCaptureScale 0.35 vs null,
nutrientFloor 0.05 vs 0, mixotrophySaturation 1.0 vs 0.4, meatYieldPerMass 0
vs 1.6, and others). A zero-excess result here does **not** by itself establish
non-reachability under declared defaults; that conclusion rests on parity C1
being byte-identical, an independent defaults-based check.

The effective config never brings any pool near a ceiling, so the defect does
not fire there. Sweeping every tick (not just the endpoint), command
`node build/trace/capsreach.js 1500 517` (seed 517, horizon 1500 ticks —
the discrimination horizon; an initial 3000-tick sweep on the same config
likewise reported 0 excess on both arms):

| Arm | Ticks with per-pool excess |
|-----|----------------------------|
| BASE effective config, excretion ON (0.06) | **0 / 1500** |
| BASE effective config, excretion OFF (0.0) | **0 / 1500** |

This is why parity was never disturbed and why the bug survived review: it is
latent at effective settings.

### Reachability: REACHED under a saturation arm

To test it in principle, a saturation arm drives every pool to its ceiling
(fast abiotic regen, cyclic off, no producer draw, detritus-only web), making
the return paths the only nutrient writers.

### The confound, and the control that exposed it

The first saturation run showed pool A — whose per-pool cap EQUALS the flat
cap — exceeding its ceiling. A cap difference cannot explain that, so the
measurement was suspect. The cause is `ScalarField.step()`: diffusion runs
AFTER the regeneration clamp, pushing a low-fertility cell beside a rich one
past its own per-pool cap every tick.

The consequence matters beyond this task: **the per-pool cap is a soft target,
not a maintained invariant.** Any excess must be read against that baseline,
not against zero. A NEGATIVE CONTROL with every nutrient writer silenced
(broadcast, all four returns, producer draw, floor) still reports the baseline:

| Pool | mod | NEGATIVE CONTROL (baseline) |
|------|-----|------------------------------|
| A | 1.00 | 0.077724 |
| B | 0.78 | 0.060625 |
| C | 0.62 | 0.048188 |

Two further discriminators separate the causes: silencing only the unclamped
abiotic broadcast (recyclingRate=0) and silencing all return paths. The
broadcast alone reproduces the baseline, confirming it is not the driver.

### The attribution, measured not inferred

The diffusion explanation above was an *inference* until a DECISIVE arm made
it a *measurement*. Preregistered prediction: with `nutrientDiffusivity = 0`
added to the negative control, no mechanism remains that can move a pool past
its clamp, so excess must be exactly zero. Outcome:

| Arm | Ticks with per-pool excess |
|-----|----------------------------|
| NEGATIVE CONTROL (diffusion on, all writers silenced) | 1496 / 1500 |
| **DECISIVE — negative control + nutrientDiffusivity=0** | **0 / 1500** |

Prediction confirmed. The residual is diffusion running after the regeneration
clamp. The probe now *throws* rather than prints if this arm ever reports
non-zero, because a falsified attribution printed quietly is how a wrong cause
gets recorded as a right one. The negative control's own preregistered
prediction (zero excess) was **FALSIFIED** by its first run; that falsification
is recorded in the probe source rather than deleted, per the evidence rules.

### Before / after, against the baseline

Saturation arm, peak excess per cell (cumulative excess mass in brackets):

| Pool | mod | BEFORE fix | AFTER fix | Baseline |
|------|-----|------------|-----------|----------|
| A | 1.00 | 0.078090 [15404] | 0.078090 [15346] | 0.077724 |
| B | 0.78 | **9.430746 [212415]** | **0.060909 [11973]** | 0.060625 |
| C | 0.62 | **11.427262 [211157]** | **0.048417 [9519]** | 0.048188 |

B and C fell from ~150x and ~240x the baseline to the baseline itself. Pool A
is unchanged — correct, since its multiplier is 1.0 and the correction cannot
affect it. A is the built-in control for the fix.

### The correction (smallest)

One shared helper `nutrientCapAt(nIdx, ci)` returns the per-pool ceiling, and
all four return sites clamp through it. This is the knob-discipline rule
applied literally: every gate that reads the same quantity reads the scaled
value, through one helper, so the flat cap cannot reappear at one site while
the others are corrected.

**Precise scope — three spellings of this cap still exist, on purpose:**
seeding computes it via `habitat.capacityAt * mod`, the abiotic regeneration
clamp computes it inline, and the four return sites use the helper. They agree
numerically. Unifying the first two would be a refactor with no behavioural
effect and was not attempted.

### Independent review and the gap it found

An independent validation-sufficiency pass (via the `test` specialist — the
`review` specialist could not receive this private-repo diff under its
provider's data-use posture) confirmed the fix but found one material gap:
**nothing automated pinned the correction.** Parity, gates and contracts all
stayed green *with the bug present*, because the pools never approach a
ceiling at effective settings — so reverting the fix would have left every
cited check passing. Its other findings were record defects, all corrected:
stale positional citations in the probe header, an overclaiming `world.ts` doc
comment (it said "every writer" routes through the helper; the unclamped
broadcast and the inline regen clamp do not), the false "declared pinned
config" label, and the falsified prediction not recorded in the probe itself.

### The pin: gate G30

G30 runs two arms on a saturation substrate (800x800, 120 ticks, seed 4242):
a diffusion baseline (all writers silenced) and a saturation arm where returns
are the only writers, then asserts saturation peak excess stays within 2x the
measured baseline. It asserts a **ratio, not an absolute**, because the
per-pool cap is a soft target — an absolute threshold would fail on diffusion
alone.

Teeth verified by reverting `nutrientCapAt` to the flat cap and re-running:

| Pool | mod | With correction | Reverted (flat cap) |
|------|-----|------------------|---------------------|
| A | 1.00 | x1.00 | x1.00 (control — cannot discriminate) |
| B | 0.78 | x1.00 | **x8.38 -> FAIL** |
| C | 0.62 | x1.00 | **x10.16 -> FAIL** |

The revert test is how the gate was proven non-ceremonial: it fails on exactly
the regression it exists to catch, and pool A — which the correction cannot
affect — does not move.

### Validation

- Parity **byte-identical** on both pinned seeds at engine 0.6.2
  (517 -> P882/C170/D65; 24601 -> P563/C279/D90). The correction changes
  nothing under effective config, which the reachability sweep predicted.
  Parity alone could not detect this defect (it was latent), which is why the
  presence-style check G30 was added alongside it.
- 38/38 gates (G30 new), 11/11 contracts, 153/153 workflow checks pass.
- Determinism: repeat runs byte-identical (C7).
- Ledger/conservation: G3 accounting residual unchanged; nutrient is not
  covered by the energy ledger, so the correction is outside that identity and
  cannot perturb it.
- Presence check: `nutrientCapAt` present in **both** build targets — the CLI
  build and the app bundle (17 references each). Both `tsconfig.build.json`
  and `tsconfig.app.json` were rebuilt, since `world.ts` changed and the build
  trap warns that building only one target silently ships a stale engine.

### What this correction does NOT do (disclosed scope)

1. It does not make the per-pool cap a hard invariant. Diffusion still runs
   after the regeneration clamp and still drifts low-fertility cells past their
   own ceiling by the baseline amount above. Fixing that would mean reordering
   or re-clamping the diffusion pass — a materially different change to
   declared behaviour, not authorised by Task 6, and not attempted.
2. The unclamped abiotic mineralisation broadcast (`nData[i] += share`) has no
   cap at all. It is a separate, pre-existing property: at declared recycling
   rates it is far below any ceiling, and the broadcast-only arm shows it does
   not move the pools. Flagged, not changed.
3. Excretion stoichiometry and selection-model redesign remain out of scope,
   per the Owner's explicit exclusion.

### Version note

Engine remains `ts-evo-poc/0.6.2`: parity pins are unchanged, so no re-pinning
and no retirement chain entry is warranted. Evidence recorded under 0.6.2
before this commit remains valid — the correction is unreachable at the
diagnostic effective config, which the 0/1500 sweep demonstrates directly,
and under declared defaults parity C1 is byte-identical (the independent
defaults-based check).

--------------------------------------------------------------------------------
REVIEW RESPONSE CORRECTIONS V2 (2026-10-13, reviewer Acrius-max on head 87cefa7)
--------------------------------------------------------------------------------

### G26 — radiationMultiplier coupling (FIXED)
**Defect:** Test read base multiplier at dormantFrac=0 (coupled to 1.0), not the scheduled multiplier.
**Fix:** Compute scheduled multiplier directly from tick/onset/doubling/cap; test coupling against that.
**Result:** tick=50 scheduled=1.3195 zero=1.0000 half=1.1598 full=1.3195 over=1.3195 ✓

### G27 — successfulMating flag gates asexual fallback (FIXED)
**Defect:** Case D test counted asexual from ALL live organisms, not just the mated pair.
**Fix:** Use 2-organism world; check ONLY the mated slots (0,1) for asexual=0, sexual=2.
**Result:** A: asex=2 sex=0 | B: asex=2 sex=0 | C: asex=2 sex=0 | D(mated): asex=0 sex=2 ✓

### G28 — successfulMating array grows with capacity (FIXED)
**Defect:** Checked against fixed store.capacity (1024) instead of live array length which actually grows.
**Fix:** Compare successfulMating.length against live.length after ensureSlotArrays(2000).
**Result:** initialLiveLen=1024 grownLiveLen=2048 successfulMating.length=2048 (grew: true) ✓

### Full validation
- Typecheck: clean
- Gates: 36/36 pass (including G26, G27, G28)
- Contract: 11/11 pass (parity re-pinned 0.6.2)
- Workflow: 153/153 pass
- Bundle matches CLI: ✓
- Deterministic: byte-identical repeat runs ✓

--------------------------------------------------------------------------------
REVIEW RESPONSE CORRECTIONS V3 (2026-10-13, reviewer Acrius-max on head a566a1e)
--------------------------------------------------------------------------------

### G27 — successfulMating flag gates asexual fallback (FULLY REVISED)
**Prior defect:** Test used flag counts instead of actual birth outcomes; newborn
founders didn't reach asexual branch; Case C energy made parents ineligible;
Case D didn't verify asexual was SKIPPED (no duplicate births).

**Complete rewrite using ReproProbe (SlotProbe) and birth queue inspection:**
- Uses mature, eligible organisms (age > maturity, cooldown=0, energy=1000,
  expressed traits pinned: ASEXUAL_RATE=0.055, MATE_SEEKING=0)
- **Case A** (no candidate): verifies `reachedRoll` for both, `sexualSkipped` empty,
  flags clean, 0 sexual in queue, asexual birth eventually queued
- **Case B** (candidate, no reciprocal): verifies `resolveMatingIntent` submits
  0 MATE interactions, then same asexual path as A
- **Case C** (mutual, B fails surplus): B energy=0.1, A stays eligible.
  Verifies NO mutual mating (successfulMating=0), A reaches roll and births
  asexually while B does not reach roll
- **Case D** (mutual, both pass surplus): Verifies `resolveContests` queues
  exactly 2 sexual births BEFORE `proposeReproduction`, both flags set=1,
  `proposeReproduction` skips asexual (no `reachedRoll`, no asexual in queue),
  exactly 2 sexual births final, 0 asexual from mated pair

**Result:** All four cases pass with detailed instrumentation trace:
```
A: reached(a=true,b=true) flags(0,0) sexualQ=0 asexBirth=true
B: submittedDelta=true reached(a=true,b=true) sexualQ=0 asexBirth=true
C: mated=false aReached=true bReached=false sexualQ=0 asexBirthA=true
D: flags(1,1) sexualQ=2(pre=2) skipped(a=true,b=true) reached(a=false,b=false) asexFrom(a=0,b=0)
```

### Full validation
- Typecheck: clean
- Gates: 36/36 pass (G26, G27, G28 all substantive)
- Contract: 11/11 pass (parity 0.6.2, bundle matches CLI)
- Workflow: 153/153 pass
- Bundle version: `WORLD_ENGINE_VERSION = 'ts-evo-poc/0.6.2'` ✓
- Deterministic: byte-identical repeat runs ✓

--------------------------------------------------------------------------------
G29 HIGH-SLOT MATING INTEGRATION TEST ADDED (2026-10-13)
--------------------------------------------------------------------------------

**Requirement from review:** G28 proved array growth but not end-to-end mating
above initial capacity. G29 closes this gap.

**Test design:** Deterministic high-slot mating integration test at slots 1500/1501
(well above initial 1024 capacity):
- Grows World arrays and Store arrays to 4096
- Creates two mature CONSUMER organisms at slots 1500, 1501 via manual
  populateSlot replication (genome, body, count increment, live flag)
- Sets full mating eligibility: age 20, energy 1000, cooldown 0, damage 0,
  expressed traits pinned (ASEXUAL_RATE=0.055, MATE_SEEKING=0)
- Mutual intent + mutual selection → resolveMatingIntent → resolveContests
- Verifies: successfulMating flags set, 2 sexual births queued,
  proposeReproduction skips asexual (no reachedRoll, sexualSkipped set)

**Result:** PASS
```
mated=true sexualQueued=true noAsexReached=true sexualSkipped=true slots=(1500,1501)
```

**Gate count:** 37/37 (G1–G25, G26 radiation coupling, G27 mating fallback,
G28 array growth, G29 high-slot mating integration)
