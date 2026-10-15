# Passive chemistry boundary witness

## Scope and authority

`WorldOptions.chemBoundary` is an opt-in numeric log, disabled when absent.
Only the engine writes it. No observer callback receives a World, chemistry
object or mutable organism arrays. `chemistryBoundaryTrace()` returns detached
copies. It is not a biological knob, reaction intervention or new physiology.
The ordinary run hash and engine identity have not changed.

The log retains a bounded ring **per event kind**. Snapshots group by kind,
not global time; use tick/id to interpret them. Counts include overwritten
events and `dropped` reports retention loss. Tail records are not random
samples, full life histories, population rates or representative cohorts.

## Fields and timing

- `chemistry`: cell pools and remaining gross budget before the organism's
  reactions; remaining budget afterward; realized reaction extents and gross
  substrate draws reconstructed from those extents; actual store credits from
  assimilation; before/after stores and post-growth tissue. Credits include
  diagnostic subsidy when `uptakeIncludesSubsidy` is true; current witnesses
  leave that diagnostic unset. Reconstructed gross draws are cross-checked
  against observed reservation changes, not inferred from net field deltas.
- `offspringGate`: chemical affordability for each live, non-dormant candidate
  before cooldown/energy/matter/maturity rejection. Age and maturity threshold,
  cooldown, energy fraction/threshold and damage are recorded separately.
  `lacking=nutrient` does NOT mean a mature, otherwise viable prospective
  breeder was exclusively blocked by nutrients: later surplus and other
  conditions are not established by this record.
- `death`: proximate age/starve/damage classification matching the existing
  event trace, age, maturity threshold, parent id and holdings captured BEFORE
  chemical release. `storesAtDeath`/`biomassAtDeath` are absent when chemistry
  is unset. Parent id identifies founders versus offspring, not full lineage
  depth. No claim of a single underlying ecological cause follows from a
  proximate death label.
- `birthTransfer` (added after the original boundary witness): parent chemical
  stores/tissue before and after transfer and newborn chemical endowment after
  identity/role initialization. Founder endowments have no parent fields.
  Legacy energy provisioning occurs later and is not measured by this record.
  Kind-filtered snapshots report `returned` separately from global ring
  `retained`/`dropped` totals; filtering does not itself imply lost records.

## Evidence and reproducibility

`evidence/chem-boundary-live-20261015-v2/` is the corrected live witness.
Its protocol and checkpoints refer to exact resolved configurations in
`evidence/mechanism-four-arm-20261015/`; use those configurations rather than
a viewer preset. Trace ON/OFF hashes match at every tick; broad state/RNG
digests match at recorded checkpoints, and final hashes match the factorial
panel. The command is `node scripts/chem-boundary-panel.mjs --out NEW_DIRECTORY`
after compiling the engine. Existing output is refused.

The witness shows realized nitrification and iron reactions followed by
exhausted cell budgets and zero corresponding organism uptake in retained
advanced-arm records. Thus this sequence occurs in a live world, not just the
helper fixtures. It does NOT measure how much population loss those events
cause or establish that eliminating a reaction would rescue reproduction.

The first `evidence/chem-boundary-live-20261015/` panel is explicitly
**SUPERSEDED**: its death holdings were measured after release and are invalid
for that purpose. It is retained with a warning, not silently patched.

`scripts/chem-boundary-checks.mjs` validates trace repeatability, ring overflow,
invalid capacity rejection, detached-copy isolation, event presence, non-zero
pre-release death tissue and offspring-gate fields. It compares ordinary
hashes each tick and a separate exact-byte digest at checkpoints. That broad
digest includes own RNG/module buffers, unused slots, chemical reservations,
fields, histories and ledgers, omitting diagnostic logs and wall-clock timing.
It is a diagnostic algorithm, not a replacement for the versioned run hash.

## Still outstanding

The original tail-ring witness is insufficient for full life histories. A
separate losslessly drained, selected-family witness is now documented in
`CHEM-FIRSTBIRTH-RESULTS.md`; it does not retroactively add missing fields to
the old boundary panels. Selective, preregistered reaction interventions and
broader demographic attribution remain outstanding. Biological choices and
the proposed dimensional/dial corrections are in `MECHANISM-OWNER-DECISIONS.md`.
