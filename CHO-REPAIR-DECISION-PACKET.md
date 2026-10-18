# C/H/O repair decision packet — ready for Design review

Basis: exploratory submission `149a108`, `CHO-ATTRIBUTION-ASSESSMENT.md`,
original protocol and raw records. The trial protocol records pre-submission
base `3346e5c` plus measured working-tree source digests; `149a108` is the
commit delivering that evidence, not its recorded pre-run base. This packet
proposes next implementation scope. It does **not** implement a biological
repair, accept a new pool meaning, start more seeds or authorize merge.
The eight additional matched pairs are complete; no remaining run allowance
is inferred from a request to continue working.

## Recommended sequence

1. Accept the diagnostic guard correction described below.
2. Approve the narrowly specified burial-reservation repair independently of
   H/O, with a new chemistry identity and a fresh corrected baseline.
3. Keep H/O strict audits failing honestly until one consistent pool/transfer
   contract is accepted and qualified. Do not use the accounting decomposition
   as external income/output or proof of conservation.
4. Complete H/O design and qualification before conservation-valid held-out
   confirmation. Do not silently reuse old effect sizes after either repair.

## A. Concrete carbon repair proposal

**Recommended semantics:** boundary burial retains its existing priority,
fraction, source pool and sediment destination, but reserves its source in the
same pre-tick OC budget that reactions and assimilation read. It must not debit
the field twice or count its draw as reaction extent.

Implementation location: `World.chemistryBoundaries()` in `src/world/world.ts`.
Replace its source `chem.react(OC, cell, -bury)` operation with
`chem.claim(OC, cell, bury)`, retaining the one matching positive SC delta.
`claim()` already writes both the negative delta and the reservation. Do not
also call `react(-bury)` or `claimGross()` on that source. Settlement, transport,
weathering, tissue demand, energy and the omission selector remain unchanged.
Validate that the configured burial fraction is within its accepted domain;
do not silently cap an invalid fraction as a new biological rule.

Products/death releases arriving in the pending delta buffer do not refill
that tick's pre-snapshot budget. Keeping that rule avoids introducing an
unreviewed extra within-tick recycling path. Burial stays before the organism
sweep; moving it after uptake would be a different allocation priority, not an
equivalent fix. No consumer/guild exceptions, energy compensation or population
targets are part of this proposal.

### Required repair evidence

- **Production call-site gate:** a running world must execute boundary burial
  and organism uptake/reactions against the same constrained OC cell. Assert
  actual remaining budget, material credits and no clamp-created carbon.
  This is new work: the attribution counterexample copies the boundary
  operation and cannot by itself prove the production call was repaired.
- Tight and roomy controls, including more than one organism, must distinguish
  shared reservation from exclusive ownership or disabled burial. Require
  nonzero sediment transfer and nonzero eligible organism activity where stock
  permits both. Compare against the old failing snapshot, not a later snapshot.
- Assert net OC debit equals sediment credit plus actual other net draws,
  accounting separately for true products and boundary inputs. A reported claim
  counter alone is not a mass balance. Detect double-debit and unreserved-draw
  negative controls in the test harness, not injected into a measured world.
- No-burial and nonbinding controls must preserve their declared meaning.
  H/O audit failures must not be masked by a passing C test. Per-element and
  per-pool books remain separate from the causal energy ledger.
- Repeatability, observer state/RNG parity, null/default chemistry-unset pins,
  artifact presence, invalid-input rejection, typecheck, gates, contracts and
  workflow checks are required. Rebuild CLI and app separately. Introduce a
  new chemistry identity; never repin chemistry-unset parity to accommodate
  this chemistry-on repair.

## B. H/O alternatives and recommendation

The current hybrid cannot be fixed just by multiplying O2 inventory by two,
adding implicit organic H/O to the report, or booking residual-derived exports.
Assimilation currently moves organic C alone into the C store while H/O arrive
separately from water; death routes tissue H/O to a declared reservoir sink.
Changing environmental inventory without matching these transfers would
introduce new double counting or missing matter.

| Alternative | Meaning and consequences | Recommendation |
| --- | --- | --- |
| Retain element-only organic pools and explicit buffered H/O reservoirs | Specify all reaction H/O sources, products and sinks in the same units; organic C transfers carry C only. Any new boundary exchange must have a physical declared process and fixed forward rule, not be inferred from an imbalance. Existing molecular reaction comments no longer define that system. May require new H/O product pools or changed reactions. | Viable abstract model only after explicit design; not a bookkeeping-only patch. |
| Adopt a consistent multielement pool inventory | Define an element vector for every pool, then use it in reactions, uptake, stores, growth, burial, death, weathering and reservoir exchange. Re-derive reaction transfers against that same matrix. Changes H/O resource demands and can change viability and ecology. | Preferred long-term direction if seven-element conservation is the goal, but requires a complete bounded contract before coding. |
| Narrow the conservation claim | Continue reporting strict H/O failure, limit successful closure claims to the elements actually demonstrated, and defer conservation-valid confirmation. No new resources or physiology. | Safe interim posture, not a repair or completion of H/O integration. |

**Recommended decision:** do not adopt a guessed H/O chemistry during the
carbon fix. Require a single explicit pool-composition and transfer-contract
table as the next H/O design artifact. The table must cover every current
pool/reaction plus organism uptake, growth, birth, death and the reservoir
boundary; an enzyme-by-enzyme or molecular model is not required. Recommend
the multielement direction if the Owner retains the seven-element objective.
It is larger than a coefficient correction and must be scoped as such.

The author of that contract must show which existing reaction families cannot
balance without an additional declared substrate/product or changed rate/
transfer meaning. Preserve such failures as design findings, rather than
silently inventing compensating inputs. No new physiology or subsidies become
authorized merely by selecting this direction.

## C. Versioned qualification and stop rules

The current chemistry identity and raw panels remain immutable discovery
records. An accepted state-affecting repair gets its own identity and a new
resolved-config/source/runtime/command manifest. First qualify small
nonvacuous controls and a corrected matched discovery replay; do not begin a
large held-out panel until the completed confirmation registration is accepted.
Old demographic differences are hypotheses to retest, not calibration targets.

For H/O, each reaction must conserve the accepted element vector or identify
an explicitly modeled boundary transfer. Test isolated reactions and a live
organism-to-environment cycle with actual transfers; add corruption controls
that fail when a transfer is omitted, doubled or sent to a same-element wrong
pool. Require no-residual-hiding, observer parity and the existing strict audit
criterion. Balanced books alone do not prove trophic matter transfer or a fully
integrated ecosystem: the legacy energy-only predation limit remains separate.

If the carbon repair changes a non-chemistry default, stop rather than repin it.
If H/O still cannot be attributed or its units remain ambiguous, do not claim
conservation-valid demography. Neither increased births nor a green CI grants
permission to add combined treatments, permanent D3/D4 physiology, D5 parameter
choices, merge or maintained-product integration.

## D. Completed self-audit correction in this submission

The attribution verifier previously converted `null` boundary entries to zero
and did not independently reconstruct stored strict-audit flags. Both were
reproduced against the retained evidence without new simulations. The guard
now requires complete finite numeric vectors, recomputes held inventory from
biomass + stores + environment, recreates the exact strict reports from boundary
books, and rejects mismatching element labels, figures or flags before
attribution. It also checks audit ticks and the unexplained remainder.

Negative fixtures cover missing/null/string/non-finite fields, false-green
flags, wrong books/reports/labels, absent compartments, malformed attribution
and an internally consistent but genuinely unbooked carbon increment. This is
an evidence-integrity correction, not a new source of data or a change to audit
tolerance. All original measurements remain unchanged. No new pairs ran.

Qualification: typecheck, 59/59 gates, 11/11 contracts and 157/157 workflow
checks passed; all 14 negative fixtures rejected the intended corrupt records
while accepting the original. W10 also reconstructed all retained tick books
with the stricter guard. Receipts: `evidence/cho-guard-followup-20261018/`.
The configured review model remained unavailable; independent test-specialist
inspection of the actual change found no blocker. Execution results above
come from the primary agent, not an independent rerun by that specialist.

## Review request

One consolidated review: assess this carbon implementation contract, the H/O
direction/tradeoffs and the completed diagnostic guard correction. Accept or
amend the carbon repair and the preferred H/O design direction separately.
No scientific success threshold or held-out seed decision is requested here;
those belong to the later completed confirmation registration.
