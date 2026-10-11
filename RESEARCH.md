# Literature cross-check of POC findings

**Purpose.** Independent search for prior work that shares, contradicts, or
refines the findings in `REPORT.md`. The intent was falsification, not
confirmation, so the most useful results are the ones that change the design.

**Scope note.** These are *analogous and theoretical* sources, not validation of
this POC. None of them examined this code. Where I cite them as confirming a
finding, that means the finding is a known phenomenon with an established
literature — not that the POC is correct.

---

## 1. The subsidy finding is a named, textbook phenomenon

**Paradox of enrichment** (Rosenzweig 1971; May 1972; Gilpin & Rosenzweig 1972).

> "if the food supply of a prey such as a rabbit is overabundant, its population
> will grow unbounded and cause the predator population (such as a lynx) to grow
> unsustainably large" — Wikipedia, *Paradox of enrichment*

> "Enrichment leads to destabilization of the equilibrium of the Rosenzweig and
> many other models; huge amplitudes occur that frequently drive population
> densities to very low values and this may result in extinction. The word
> 'paradox' is used because enrichment leads to extinction."
> — <https://pmc.ncbi.nlm.nih.gov/articles/PMC7127129/>

**Match.** The POC's original subsidy (`basalFoodPerCell = 0.06`, exogenous
organic matter added to every cell every tick) is *exactly* an enrichment
parameter. The observed sequence — exponential expansion, then overshoot, then
collapse — is the canonical signature. So is the fact that my own instinct was to
tune the subsidy until the population curve looked calm.

**Consequence.** This is not a bug to be fixed by calibration. It is the
expected behaviour of an enriched system, and the literature's own conclusion is
that enrichment is not the way to get a well-behaved ecosystem. The POC finding
is therefore *reproduced correctly*, and the response is to remove the enrichment
rather than to reduce it until it stops exploding.

Caveat raised by the literature: destabilisation is not always observed in nature
(Abrams 1996), and it depends on the assumed functional response. Ratio-dependent
functional responses (Arditi–Ginzburg) do **not** show destabilisation. So
"enrichment always destabilises" is too strong; the honest statement is that
enrichment destabilises *these* response types.

---

## 2. The decisive constraint: my design cannot support a stable food web as built

**Gause's competitive exclusion principle**; chemostat theory.

> "The competitive exclusion principle ... postulates that species competing for
> the same limiting resource in one homogeneous habitat cannot coexist."
> — <https://arxiv.org/pdf/1211.1869>

> "in the chemostat model, it turns out that coexistence of p species is not
> possible if the number of nutrients is strictly smaller than p."
> — <https://comptes-rendus.academie-sciences.fr/biologies/articles/10.1016/j.crvi.2005.10.004>

> "two microbial populations in competition for a single substrate cannot
> coexist: the slower-growing species in the given operating conditions will be
> washed out" — <https://www.mdpi.com/2227-9717/4/4/51>

**This is the most important result of this search, and it invalidates a design
premise.** The POC has **one** limiting abiotic resource (nutrient), plus detritus
as a derived pool. By the chemostat result, coexistence of *p* trophic species is
impossible when the number of limiting nutrients is below *p*. A stable
multi-species food web is therefore **mathematically forbidden** in the POC as
constructed — regardless of tuning.

This explains an observation I had been treating as an unexplained failure:
grazers, predators and scavengers all went to **zero** while producers persisted.
That is consistent with competitive exclusion, observed. It is not a bug in
the behaviour arbitration, and no amount of tuning subsidy or regen will fix
it.

> **Scope correction (issue #2, P2-7).** The original text said a single
> limiting nutrient makes ANY stable multi-trophic food web mathematically
> impossible. That is an overstatement. Gause's principle applies to species
> competing for ONE limiting resource under assumptions this simulation does
> not satisfy — it concerns pairwise competition for a shared limiting
> resource, not guilds with different resource bases and behaviours. Multiple
> nutrients remain a useful niche mechanism and a defensible design; they are
> not a proved prerequisite for coexistence, and this simulation has not
> demonstrated coexistence either way.

**Required design change:** multiple genuinely limiting resources, partitioned
across traits, in the spirit of real C / N / P limitation. This is an
architecture change to the substrate model, not a parameter change.

**Escape hatches the literature offers**, in order of fidelity:
- **Resource partitioning / multiple niches** — the classic resolution of
  competitive exclusion.
- **Spatial heterogeneity** — the arXiv mechanistic verification proposes
  "presence of free resource gaps" as a basis for coexistence, via soliton-like
  population waves. This *supports* the POC's habitat map (fertility/shade
  gradients) as a genuinely relevant mechanism rather than decoration, and
  suggests heterogeneity is a route to coexistence even without adding nutrients.
- **Nonlinear functional responses** — Koch (1974) found coexistence of two
  predators on a single prey is possible when the predator's functional response
  is nonlinear, and that such coexistence occurs along a **periodic orbit**.

---

## 3. I was probably looking for the wrong attractor

Koch's result above, via the Free Dictionary:

> coexistence ... occurred along what appeared to be a **periodic orbit** in the
> positive octant rather than at an equilibrium.

And the paradox-of-enrichment literature treats limit cycles as the *normal*
stable outcome of a coupled consumer–resource system, not as pathology.

**Match / mismatch.** My `longrun.ts` classifier treats anything that is not a
low-fluctuation equilibrium as "expansion" or failure. But limit-cycle dynamics
are a legitimate stable attractor for these systems. The POC's classification
scheme is biased toward equilibria and would score a healthy oscillation as a
defect.

**Correction needed:** the outcome classifier should distinguish (a) bounded
limit cycle, (b) unbounded expansion, (c) monotone collapse, (d) fixed point —
and treat (a) as a success mode.

This also reframes the requirement that the POC "permit ecological succession,
competitive displacement, collapse, and restoration as possible results": under
Rosenzweig-type dynamics, overshoot-then-collapse is a *regime*, not a bug.

---

## 4. The consumer-bootstrap finding matches real detrital food web structure

> "detritus-based food webs are associated with **benthic** (sedimentary
> seafloor) ecosystems, with the source of energy emanating from rooted vascular
> plants ... This distinguishes the detrital food web from pelagic systems wherein
> the main source of food at the base of the food web is ..."
> — <https://www.eopugetsound.org/articles/nearshore-food-web-detritus>

**Match.** The POC's measured bootstrap deadlock was that consumers could not
survive on detritus diluted ~100× below their upkeep across a uniform field.
Real detritus-based food webs work precisely because detritus is **concentrated in
a sediment compartment** where deposit feeders encounter it at usable
concentration.

**Required design change:** the POC needs a benthic/sediment layer that
*concentrates* detritus, rather than spreading it uniformly over the field. This
is a real structural gap, independently corroborated.

---

## 5. Density dependence must come from resource competition, not a cap

Standard ecology:

> "Competition for resources can occur both within a species and between
> different species. Intraspecific competition, though, tends to be more intense,
> as individuals of the same species have similar resource requirements. This
> mechanism helps regulate density-dependent growth, preventing populations from
> exceeding the carrying capacity of their environment"
> — <https://www.biologyonline.com/dictionary/density-dependent-limiting-factor>

**Match.** The POC now derives density dependence from deficit-proportional
starvation and from sessile producers depleting the cell they root in. That is the
correct mechanism and matches the literature's emphasis on *intraspecific*
competition — which is what the POC has (many lineages competing for one
substrate pool). The literature also lists predation, disease, territoriality and
migration as density-dependent mechanisms; the POC has competition and predation
only.

---

## 6. Collapse and recovery: hysteresis is the expected behaviour

**Alternative stable states**, Scheffer et al. 2007 (shallow lakes, >1000
citations); Kuiper et al. 2015 — food-web stability signals critical transitions.

**Match.** The POC found a subsidy-driven world that overshoots and collapses.
Under shallow-lake theory, collapse followed by *failure to recover* at the same
external conditions is the signature of **hysteresis** — two alternative stable
states separated by a tipping point, not a transient.

**Consequence:** the POC's matched-control disturbance comparison (§E3) found *no*
measurable difference between disturbed and control arms. Given the arms only
differenced by one small drought event, that is the expected null result; it should
not be read as evidence that disturbances never matter. Testing tipping behaviour
requires crossing a threshold, not perturbing within a regime.

---

## 7. Closest prior art for the whole approach

- **Ofria & Cooper 2003**, "Evolution of stable ecosystems in populations of
  digital organisms," *Artificial Life VIII* — indexed in
  <https://www.frontiersin.org/journals/ecology-and-evolution/articles/10.3389/fevo.2021.750779/full>
  (Digital Evolution for Ecology Research: A Review). This is the nearest
  published precedent for the POC's goal and should be read as a baseline.
- **Adami 2002**, "Ab initio modeling of ecosystems with artificial life."
- **Koch 1974** — coexistence of two predators on one prey via nonlinear
  functional response, on a periodic orbit. Directly relevant to the POC's
  contested-interaction resolver, whose current power comparison is effectively a
  Type-I/linear response.

---

## Summary: what survived, what changed, what was refuted

| POC finding | Status from literature |
| --- | --- |
| Subsidy → unbounded growth → overshoot collapse | **Confirmed and named** (paradox of enrichment). Response is removal, not tuning. |
| Consumers excluded; producers persist | **Consistent with** competitive exclusion for a shared limiting resource. A one-resource design makes guild separation hard, not food webs formally impossible. See the scope correction above. |
| Consumers cannot bootstrap on dilute detritus | **Confirmed**; real detrital webs are benthic, i.e. concentrated. |
| Density dependence needed from competition | **Confirmed** as the correct mechanism. |
| "No stable equilibrium = failure" | **Refuted as a framing.** Limit cycles are a legitimate stable attractor. |
| Single-disturbance matched control showed no effect | **Explained** as expected; tipping needs threshold crossing, not perturbation. |
| Habitat heterogeneity as coexistence route | **Supported** ("free resource gaps", spatial waves). |
| Body-plan/lineage seams | No comparable literature found; this is genuinely novel territory in this POC. |

**Highest-value next design change:** multiple limiting resources (§2), then a
concentrating benthic detritus compartment (§4), then fix the outcome classifier
to reward limit cycles (§3). In that order — the first two are prerequisites for
a food web existing at all, and no parameter tuning substitutes for them.
---

## 8. Dormant-stage density-dependent mortality (share-mode senescence)

**Janzen–Connell hypothesis** (Janzen 1970; Connell 1971; reviewed Comita
2014): host-specific seed predators, herbivores and pathogens reduce survival
in a density- and distance-dependent manner, preventing any one species'
dormant hoard from converting to dominance — the mechanism credited with
maintaining tropical tree diversity.

**Zooplankton resting-egg banks** (reviewed García-Roger; Schröder 2005):
dormant stages accumulate in sediment as banks that store diversity across
bad times, but banks suffer steady losses (burial, damage, failed hatching).
Banks explain coexistence precisely because they are *leaky*, not permanent.

**Match.** Share-mode senescence (dormant death pressure proportional to the
dormant fraction) is the same functional form: the denser the waiting room,
the faster it empties. Our overgrowth runs were a Janzen–Connell violation —
a hoard with no enemies — and the brake restores the missing term.

**Honest differences.** Nature mediates through enemies, pathogens and
burial; the sim applies a direct rate (explicit abstraction). Janzen–Connell
is about conspecific density preserving multi-species diversity; ours acts
within one guild's hoard. Analogous mechanism, not an identical claim — kept
as a consistency note per the directive, not a validity proof.
