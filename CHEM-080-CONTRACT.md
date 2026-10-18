# Multielement C/H/O contract — chemistry `chem/0.8.0`

> **Identity:** `ts-evo-poc/0.8.0+chem/0.8.0`, gate suite `gates/0.8.3`.
> Replaces the retired `ts-evo-poc/0.8.0+chem/0.7.8` for chemistry-enabled runs.
> Chemistry-unset base parity is unchanged (`517 → 503/126/69`,
> `24601 → 337/119/95` at 500 ticks). Every `chem/0.7.8` figure is historical
> provenance; nothing was relabelled and no old strict-audit failure was
> reclassified.

Authority: the Owner's resolution on PR #14 (comment `6252645667`). That
resolution supersedes the alternatives sketched in
`CHO-REPAIR-DECISION-PACKET.md`; the packet is retained as context only. The
design resolution is not implementation completion — this document records the
implementation, its named corrections, and the evidence that checks it.

---

## 1. The contract

One explicit element vector per pool, `[C, H, O, N, P, S, Fe]`, authoritative
for every transfer the chemistry subsystem performs: pool inventories,
reaction substrates and products, biological acquisition, tissue construction,
birth, death, decomposition, burial, transport, sediment, weathering, and the
declared water/atmosphere boundaries. `POOL_COMPOSITION` in
`src/world/chemistry.ts` is that table; `elementTotal()` reads it directly, and
`POOL_ELEMENT_RT` remains only the PRIMARY-element map used by ablations and
diagnostics (a pool that carries several elements still names the one an
ablation removes).

| Pool | Per unit | Declaration |
|---|---|---|
| O2 | 2 O | molecular oxygen |
| DIC | 1 C | **declared POC abstraction**, not molecular CO2 — inorganic carbon is tracked as the element; its oxygen is represented through the O2/H2O couple the reactions carry explicitly |
| NH4, NO2, NO3 | 1 N | nitrogen carriers |
| PO4 | 1 P | phosphorus carrier |
| SO4 | 1 S | sulfur carrier (not the full SO4²⁻ formula — see limits) |
| H2S | 1 S + 2 H | sulfide carries its own hydrogen |
| Fe2 | 1 Fe | ferrous iron carrier |
| Fe3 | 1 Fe + 1.5 O | ferric oxide mineral sink (Fe₂O₃ per Fe) |
| OC, LC, SC | 1 C + 1.8 H + 0.5 O | bulk organic carbon units, tissue C:H:O ratio |
| ON, LN, SN | 1 N | separately tracked organic nitrogen |
| OP, LP, SP | 1 P | separately tracked organic phosphorus |
| OS, LS, SS | 1 S | separately tracked organic sulfur |
| OFe, SFe | 1 Fe | separately tracked organic/sediment iron |
| H2O | 2 H + 1 O | molecular water, buffered reservoir |

**No double counting.** Bulk organic carbon carries H and O chemically bound
in its unit; N/P/S/Fe are *not* folded into the C unit, because the engine
tracks them as separate pools with their own transfers. The 1.8:0.5 ratio is
the declared organic stoichiometry, not a claim about any particular molecule.

**Two conventions, stated rather than implied:**
- `H2O = 2 H + 1 O` and `O2 = 2 O` are MOLECULAR. The reaction network's
  coefficients were already derived from molecular forms (photosynthesis is
  `1 DIC + 0.9 H2O → 1 OC + 0.2 O2`, which balances only under them). The
  retired inventory counted water 1:1 and O2 as one oxygen; that mismatch is
  what made the H and O books disagree with the reactions.
- `DIC = C only` is a declared ABSTRACTION. The rejected alternative —
  DIC = CO2, forcing the O through — would have changed the photosynthesis O2
  yield from 0.2 to 1.2 per extent, roughly a six-fold behavioural shock
  through every oxygenated pathway, to fix an accounting convention. Recorded
  in `CHEM-078-CORRECTIONS.md` provenance and the repair packet.

## 2. Burial reserves its source (the carbon fix)

Defect: the boundary burial moved `bury` OC → SC with a bare
`react(OC, cell, -bury)`, which writes the tick's field delta but not its
reservation. Every other claimant that tick — organism uptake, a reaction —
read the same pre-tick inventory, so burial's carbon could be drawn twice;
`settle()` floored the overshoot and the audit booked the unmaterialised
remainder as matter created by clamping. The attribution demonstration
(recorded in `evidence/cho-attribution-20261017/one-cell-controls.json`,
re-verified by the frozen 0.7.8 convention in
`scripts/chem-attribution-078.mjs`) shows the exact mechanism at 1e-4 scale.

Fix, exactly as resolved: burial now calls `chem.claim(POOL.OC, cell, bury)`
before `chem.react(POOL.SC, cell, bury)`; no second debit, no rate change, no
borrowing from pending products, no reordering of the boundary. The source is
reserved against the same finite pre-tick local budget as every other claim.

Rejected alternatives, for the record:
- **capping burial to available stock** — rejected by the Owner; a silently
  capped fraction is a different experiment wearing the configured value's name;
- **unreserved draw with a follow-up correction** — the defect itself.

Configuration: `chemistryBurial` (`null` = declared behaviour) is
DOMAIN-CHECKED, never clamped. One fraction feeds both the boundary sink and
the death-litter split (`×22`), so the accepted domain is
`[0, MAX_BURIAL_FRACTION = 1/22]`; anything else throws at construction (G52-F
covers negative, above-max, NaN and Infinity). This is the packet's "validate
the configured burial fraction within its accepted domain" requirement.

## 3. Reaction corrections

Under the retired flat map, reaction stoichiometry and the inventory used two
different conventions. The corrections below are the smallest defensible
changes that make each reaction close under the contract. Every one is
derived, not fitted; none adds a residual-compensation term, external matter,
or energy.

| Reaction | Correction | Derivation |
|---|---|---|
| fermentation | `+0.25 H2O, +0.4 H2` gas | OC carries 1.8 H / 0.5 O; DIC is C-only; the 0.5 OC returned carries only 0.9 H/0.25 O; the remainder leaves as water (0.25 = 0.5 H + 0.25 O) and as declared H2 export (0.2 = 0.4 H) |
| aerobic decomposition | `+0.14 O2, +0.63 H2O` | 0.3 refractory OC carries 0.54 H/0.15 O of the original 1.8/0.5; remainder leaves as water; the extra O comes from O2: H 1.8 = 0.54 + 1.26, O 0.5 + 0.28 = 0.15 + 0.63 |
| anaerobic decomposition | `+0.275 H2O, +0.428 H2` gas | same balance with a 0.45 refractory remainder and H2 export |
| sulfate reduction | `+2.5 OC` substrate, `+2.5 DIC`, `+1.25 H2O` | sulfide carries 2 H and the reduction must come from a donor: 2.5 OC supplies C 2.5→2.5, H 4.5 = 2 + 2.5, O 1.25 = 1.25. The earlier form reduced sulfate and manufactured the two H from nothing |
| sulfur oxidation | O2 draw `1.1 → 0.416`, `+0.622 H2O`; DIC becomes a substrate (0.42) | 0.42 C fixed carries 0.756 H/0.21 O; sulfide brings 2 H; remainder leaves as water (0.622); O2 follows: 2 = 0.756 + 1.244, 2·b = 0.21 + 0.622 |
| iron oxidation | O2 draw `0.35 → 0.682`, `+0.306 H2O` substrate; DIC substrate (0.34) | Fe3 is Fe2O3 (1.5 O per Fe); Fe2 brings no H, so the fixed carbon's H comes from water; O balance then fixes the draw: 0.306 + 2·b = 1.5 + 0.17 |
| ligninolysis | `+0.225 H2O, +0.36 H2` gas | 0.55 refractory LC carries 0.99 H/0.275 O of 1.8/0.5; remainder leaves as water and H2 |
| denitrification | N2 export moved from a hard-coded booking into a declared `gas` field | 2 NO3 → 0.6 NH4 + 1.4 N2: the atmospheric export is real and must be booked; declaring it as a reaction vent makes the closure equation and the world's gas loop read the same quantity |
| photosynthesis, aerobic respiration, iron uptake, sediment release | unchanged | already balanced under the contract |

### 3.1 Nitrification — a NAMED correction

Nitrification is the one reaction whose O2 is a **habitat gate, not a booked
substrate**. Under the contract NH4 and NO3 are nitrogen carriers: no product
of this reaction can receive oxygen, and a 1.8 O2 draw cannot balance. The two
alternatives were considered and rejected because each breaks a live
mechanism:

- **NO3 = N + 3 O** forces denitrification — its only consumer — to shed that
  oxygen through organic carbon at ~15 C per 2 NO3: an absurd donor demand
  created by an accounting choice;
- **NH4 = N + 4 H** makes hydrogen appear from nowhere in every reaction that
  produces NH4 without a hydrogen source — sediment release above all —
  manufacturing H at every step.

The correction keeps oxygen a requirement (`minO2` window; `CAP.NITRIFY` is
only expressed where O2 is present) and stops booking it as matter this
reaction consumes, because in this vocabulary no product can receive it. The
attribution measured the uncorrectable draw directly: it was the single
largest oxygen defect in the network (3.6 O per unit extent, recorded in
`CHO-ATTRIBUTION-ASSESSMENT.md`).

## 4. Other contract touchpoints

- **Organism acquisition.** Uptake of an element credits its store; carbon
  uptake additionally credits the organic unit's bound H and O to the
  organism's H/O stores. The earlier separate 1:1 water-uptake path is
  removed: water enters only through the buffered reservoir and the reactions
  that use it.
- **Death.** Tissue and stores release through the single declared mappings;
  the labile stream receives the carbon (including stores C) and the H/O
  residue is booked SIGNED to `reservoirSink`, so a cohort that dies with the
  declared tissue ratio contributes ≈0 and any deviation is visible in the
  books rather than hidden.
- **Boundary inputs.** `waterInput` is booked as 2 H + 1 O per unit, matching
  molecular water; `freeNutrients` was narrowed to N/P/S/Fe — subsidising H/O
  would break the tissue ratio the death residue depends on (asserted at zero
  for C/H/O by G38).
- **Gas vents.** `gasExport` is a declared field on the reaction, not a name
  check: the audit books the same quantity the field sees leaving (G26 signs
  it on the product side of closure; G53 observes the live field drop).

## 5. Validation

- **G26** all 13 reactions close across all seven elements, no exemptions.
- **G27** elemental conservation holds in a running 300-tick world, H and O
  included (0.0000% residual).
- **G38/G39** subsidy scope and the OC-carried H/O with a water-untouched
  control.
- **G52** burial reservation: pure-burial exact split, no-burial control,
  tight multi-organism world with zero clamp and nonzero built carbon, roomy
  world, mutation control that reproduces the defect, domain rejection.
- **G53** every reaction executed through the live `reactionExtent` machinery
  with non-zero extent, no element residual, plus a corruption control.
- `scripts/cho-attribution-checks.mjs` — one-cell controls (nine cases,
  including the reserve-vs-unreserved burial pair).
- Preregistered re-measurement: `CHO-080-RESULTS.md` and its raw archive.

## 6. Declared limits (limits, not claims)

- **Not molecular speciation.** These are declared element carriers in pools,
  not a chemical equilibrium model. Sulfate is tracked as sulfur; DIC as
  carbon; Fe3 as an Fe₂O₃-like sink. Any appeal to a specific molecular
  formula beyond the declared ratios is outside the contract.
- **Sulfate reduction's donor demand (2.5 OC per S)** reflects the acceptor
  being tracked as sulfur alone; it is an accounting consequence, not a
  kinetic claim about real sulfate reducers.
- **Predation remains energy-only**; `chemistryPredationMatter` is a
  diagnostic, not declared default behaviour. No full food web is claimed.
- **Death reaches the two economies by different paths** (legacy detritus from
  energy; chemistry pools from tissue); `chemistryToLegacyDetritus` remains a
  diagnostic subsidy, not a conserved transfer.
- **One gross per-cell substrate budget per tick** still governs reaction and
  uptake reservations (G37); fixed `REACTIONS` order is the declared priority
  rule.
- **A habitat gate is not a substrate.** Nitrification consumes oxygen in
  reality; this contract does not book that oxygen, and does not pretend to.
  The blocked booking is stated, with both alternatives, above.
- This remains an experimental, non-production repository. No merge authority
  is implied by anything in this document.
