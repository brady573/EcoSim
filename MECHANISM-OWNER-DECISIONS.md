# Mechanism audit — Owner decision packet

Status: investigation only; no biological repair has been applied. This is
not a merge request or a claim to have identified the cause of population loss.
The accepted browser work remains separate. See `MECHANISM-AUDIT-STATUS.md`,
helper raw evidence and `MECHANISM-FOUR-ARM-RESULTS.md` for completed scope.

## Confirmed implementation defects — proposed corrections

### D1. Growth's partial-deficit limiter

`grow()` compares `have / biomassDemand(requestedCarbon)[e]` (a fraction)
directly with `matterCarbon` (carbon moles). The half-P fixture demonstrates
malformed tissue despite element conservation. The missing-Fe control shows
that this is not a universal absence bypass.

Recommended: convert each fraction to a carbon quantity before taking the
minimum, then assemble every element at the resulting carbon's stoichiometry.
Require full per-element postconditions for partial P, partial Fe, absent Fe,
abundant matter, energy-limited growth and differently sized requests. Reported
carbon and charged energy must match the assembled valid tissue.

Consequence: this changes chemistry semantics even though it repairs a clear
dimensional error. Bump the chemistry identity, retain old evidence under its
old identity, rerun targeted chemistry/accounting and matched panels. Do not
relabel the current results or interpret a changed population as improvement.
Legacy unset parity must remain exact. **Owner acceptance requested before edit.**

### D2. Reproduction demand dial

Macronutrient thresholds currently scale with the square of the dial; tissue
carbon and trace reserve scale linearly. The default is unaffected by the
double multiplication, but other recorded dial values carry that meaning.

Recommended: remove the extra macronutrient multiplication so the documented
dial is linear. Add below/at-threshold tests for both macros at each tested
scale, plus trace/carbon tests. Carry the chemistry identity transition and
historical caveat with D1. **Owner acceptance requested before edit.**

## Biological meanings — do not silently choose a repair

### D3. Nitrogen access and allocation

The declared model runs nitrification before organism NH4 assimilation against
one shared gross pre-tick budget. NO3 production does not supply organism N
stores through the inspected uptake path. Keeping that priority is a coherent
possible rule, but it makes self-competition real when both capabilities express.

Choices requiring Owner direction: retain NH4-only uptake and present this as
an ecological cost; change allocation priority; or add explicit nitrate
assimilation/reduction with defined substrate, energy and capability costs.
These are different biology. Do not equate a broad `noNitrogenCycle` run with
nitrification-only suppression. A research-only selective reaction suppression
must retain N_ASSIM, have null-default parity and be explicitly declared.

### D4. What does iron uptake mean?

The named reaction sends Fe2 to environmental OFE; the separate organism-side
uptake uses Fe2 and the same FE_UPTAKE capability. Oxidation sends Fe2 to Fe3.
Deleting FE_UPTAKE disables both the disputed reaction and intracellular uptake,
so it is not a valid isolated control.

Owner choices: retain extracellular sequestration but name/account for it
honestly; replace it with intracellular acquisition and define cofactor
handling; or add explicit recovery from OFE/Fe3. Establish intended units and
costs first. An isolated research suppression of the environmental reaction
must retain actual Fe assimilation. FE_CHEMO suppression is a distinct arm.
Do not pick a path just because it increases births.

### D5. Founder repertoire and offspring endowment

Current `seedFounderModules()` deliberately seeds every vocabulary kind into
every founder (its source comments explicitly describe the coverage rationale).
This is evidence of implementation intent, not proof the Owner accepted a
universal metabolic repertoire. Confirm whether the intended diversity is
between founders or only in their expression strengths/onsets and descendants.
Do not substitute target guild quotas or forced adaptive mutation.

Current offspring transfer moves a fraction of parent tissue, not nutrient
stores. Combined with standing-store reproduction thresholds, a child must
refill its stores independently. Decide whether this endowment is intentional
only after tracing parent/child holdings and first-birth eligibility. No reserve
gift, free nutrient rescue or threshold tuning is proposed without that decision.
The later selected-family witness in `CHEM-FIRSTBIRTH-RESULTS.md` records real
endowment and timing without changing them. It does not isolate their causal
effect and does not turn the proposed choices into accepted physiology.

## Remaining causal work — not satisfied by the current panel

The four-arm comparison separates knob settings, not nutrient pathways or RNG
trajectories. Passive boundary traces are a measurement instrument, not an
intervention. Next intervention protocol must preregister a falsifiable
prediction, opposite result, confounds and measurements before running:
nitrification-only suppression with N_ASSIM preserved; FE_CHEMO-only
suppression; environmental iron-uptake-reaction-only suppression preserving
actual organism Fe uptake; then combinations if justified by isolated results.

Keep evidence integrity distinct from the ecological outcome; a negative or
inconclusive result is publishable. No new success threshold is assigned here.
No claim of full trophic integration, literal universal extinction, or complete
asexual lineage depth is justified by the existing panels.
