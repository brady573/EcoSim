# D3/D4 selective controls — preregistration for review

Status: **ACCEPTED FOR EXPERIMENT-ONLY IMPLEMENTATION** by PR #14 review
5540863270, followed by the Owner's request for rapid trials. Permanent
physiology and combined arms are NOT authorized by this acceptance. Original
predeclaration is retained at source `939575c`; the predictions below are
unchanged. Current implementation/evidence is tracked separately in
`REACTION-OMISSION-TRIALS.md`. This is not an O3/O1/O2 promotion or merge gate.

## Fixed baseline and scope

Use the qualified `ts-evo-poc/0.8.0+chem/0.7.8` source, not the retired
`chem/0.7.7` family/factorial panels as control data. Proposed bounded panel:
first two existing registered seeds 41001/41002, their exact advanced-arm
resolved configurations, 400 founders, 1000 ticks. Publish exact source SHA,
source digests, runtime, resolved flags, commands and observation cadence
before stepping any experimental run. No seed/parameter search or broad
cohort extension is proposed. Current founder repertoire and endowment stay
unchanged so their later correction cannot contaminate these contrasts.

## Named arms — no capability knockout

| Arm | Only omitted process | Preserved |
| --- | --- | --- |
| control | none | all current processes |
| N-only | `nitrification` reaction | N_ASSIM, denitrification, all uptake and unrelated reactions |
| Fe-oxidation-only | `iron oxidation` reaction | FE_UPTAKE, environmental OFE transfer and all unrelated processes |
| Fe-OFE-only | environmental `iron uptake` reaction | actual organism FE_UPTAKE assimilation, oxidation and all unrelated processes |

Proposed research selector semantics: null/off is exactly the declared baseline;
one allowed reaction omission per non-null arm; invalid identifiers throw.
Keep every organism, inherited module, expressed strength, upkeep, feeding and
ordinary random stream mechanism. Do not clear capability masks, redirect
substrate, give stores, invent recovery from Fe3/OFE, or alter growth/reproduction
rules. No switch exists yet. If approved for implementation, give the research
surface explicit reproducibility/version treatment and independently review
its actual diff and off/on evidence before interpreting a panel.

Omitting a reaction omits BOTH its matter movement and its existing energy
income. Products must not appear and substrate must not be reserved. There is
no replacement energy or unbooked subsidy. This is a process-level contrast,
not a claim that nutrient availability alone is the intervention. An income-only
control or new energetic/cofactor coefficient would be a separately reviewed
extension, not silently added here.

## Predictions and falsifiers, registered before measurement

- N-only: when the control actually nitrifies a scarce NH4 budget while
  organism N uptake capability is expressed, removing that reservation can
  increase NH4 available to uptake. Measure whether it increases credited N,
  later stores, valid growth and reached reproduction gates. If freed NH4 does
  not increase uptake in otherwise matched reachable events, the proposed
  local self-competition explanation is not supported for those events.
- Fe-oxidation-only: omission preserves Fe2 otherwise sent to Fe3. Measure
  whether the still-present OFE reaction takes it instead of organism uptake.
  No organism Fe gain despite preserved Fe2 is a meaningful result, not a
  failed experiment; it can distinguish the competing sink.
- Fe-OFE-only: omit only extracellular sequestration while keeping actual
  Fe uptake. If realized OFE transfer is removed but no extra Fe enters stores,
  the alleged organism-uptake benefit is not supported for the tested state.
- Demography: record energy, growth, births and persistence without assigning
  an ecological success threshold. No improvement, reduced reproduction or
  an uninterpretable contrast is an allowed outcome. Birth differences alone
  do not prove a nutrient-mediated causal chain.

An absent target extent or absent expressed uptake capability is **not measured /
vacuous**, not confirmation or falsification. Declare these eligibility conditions
before inspecting outcomes; do not select seeds afterward. Report all runs.

## Measurements and timing

Record per-cell NH4/NO3/Fe2/Fe3/OFE, shared remaining gross budget before/after
each targeted process, realized per-reaction extent/gross draw, actual element
uptake, stores, tissue and energy. Distinguish substrate reservation from net
field delta and products from available pre-tick budget. Reconcile cost/income
to the causal ledger, and preserve all elemental residual/clamp fields.
Inherited C/H/O strict-audit failures are not silently reclassified as passes.

Extend passive reproductive diagnostics to report ACTUAL first failing gate
and admission outcome in existing order: dormancy/cooldown, energy fraction,
matter, maturity, damage, viable surplus, relevant mating/proposal/queue and
birth-admission checks. A gate never reached is `notReached`, not passed or
failed. Do not reorder biological predicates or claim exclusive matter blocking
from the present pre-check `offspringGate` event. Retain age/cohort, tissue and
store trajectories and actual births, not just the recombinant-depth counter.

Paired worlds share initial inputs, but omissions can change later births and
RNG consumption. Record first divergence and its preceding state; only directly
matched pre-divergence states support local allocation contrasts. Do not align
later organism ids/cells blindly or present same-seed trajectories as controlled
identical environments. Downstream demographic effects include natural energy,
substrate and stochastic feedback; report these confounds explicitly.

## Integrity and promotion gate

Before any cohort: compiled one-cell reaction/uptake discriminating controls;
retained uptake-capability assertions; non-vacuous process suppression; correct
off/null parity against pinned defaults and current matched controls; broad
state/RNG observer nonperturbation; exact repeats; resolved-selector presence;
bad-input rejection; ledger/element/clamp reporting; full reached-gate records.
No unread ring loss may masquerade as complete histories. Missing/non-finite
evidence is an integrity failure, distinct from a negative scientific result.

Return the reviewed source/head and predeclared protocol for review before
implementation/interpretation proceeds. Do not combine omissions until isolated
results have been reviewed. Permanent nitrate uptake/reduction, iron physiology,
allocation priorities, founder frequencies and offspring provisioning fractions
still require their respective design/parameter decisions. Issue #15's
O3 → Gate 1 → O1 → Gate 2 → O2 authorization is separate and unaffected.
