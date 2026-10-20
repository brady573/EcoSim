# Scaled contested-transfer spill: 0.6.14

Same fix/post-feeding-starvation branch, main06be7da plus the already requested
current-energy and world-state/2 hash fixes. This increment adds ONLY the
missing suspended-detritus deposit at prey coordinates before recordSpill.
Spill uses actual removed minus retained, never scaled request minus retained.
The separate unpaid-basal excretion correction is not folded into this branch.

## Red/green regression

G41 drives the real resolveContests application with controlled resolver
records. Prescaled delta8, multiplier4, prey32, attacker headroom8:
old source removes32, retains approximately8, deposits0; fixed source
deposits24. Both grazing and predation exercised. Prey5/headroom1 deposits4
instead of request32-minus1; repeated ordered transfers with prey64/headroom8
deposit56 exactly once across two records. Ordinary multiplier1 is a control.
Eight cases assert real substrate, location at prey not attacker, spill book
agreement, conservation and no invented input/dissipation, tolerance1e-4 for
Float32 writes. Source transfer request/ordering/RNG remains unchanged.

## Checks actually run

- Typecheck clean; all47 compiled gates pass, including G38/G39/G40.
- Fresh app compilation/bundle/assembly; all11 contracts pass.
- Workflow fixtures154/154 pass; final diff whitespace check clean.
- Corrected500tick C1 pins reobserved:517 P840/C173/D81;
  24601 P606/C241/D63. Earlier isolated0.6.12–0.6.13 pins remain in the
  retirement chain, not silently overwritten history.
- Explicit500tick default-config World twins:
  517 world-state/2:ad36474e;24601 world-state/2:c9b9d644.

Small roundoff can remain: gain observed7.99999976 rather than8. No claim of
ecological balance or downstream efficacy. Old scaled-yield experiment logs
describe the leaky engine and cannot be reinterpreted as corrected results.
Independent focused review found no material defect in conservation, prey
locality or G41. Reviewer did not execute the suites; executable results above
were observed by the primary agent. Clarification: this branch's red baseline
deposited NOTHING (not attacker-local spill); the separate exploratory branch
had the earlier attacker-local implementation. G41 stubs record generation,
so it proves the World application/writer, not the contest resolver algorithm.
This verification record predates PR delivery. No merge or server switch is
part of delivery; current commit/push/PR status is recorded on the PR.
