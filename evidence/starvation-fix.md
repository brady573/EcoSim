# Current-energy corrections: starvation and photosynthetic storage

Isolated branch `fix/post-feeding-starvation`, baseline merged main06be7da.
The in-progress inspector, PR20 observer and dual-accounting branches are
NOT included. No unrelated working tree changes were overwritten.

Cause: actPhase cached `energy` during arbitration, before upkeep and feeding,
then used it again for the starvation condition AND deficit magnitude.
Fix: read store.energy[slot] at the starvation site and use that same current
value for both quantities. Earlier decision/capture arithmetic is untouched.

G38 calls the real actPhase writer on controlled founder state. Initially
empty reserves plus available sediment must yield actual ingested energy,
no starvation damage and a reset streak. Empty reserves without food still
accrue starvation damage; depleted-current-reserve case also remains covered.
Regeneration is disabled so it cannot hide the damage assertion.

Observed before fix: fed end energy 3.9886727, starvation damage0.6,
streak4. After fix: fed end energy3.9886727, damage0, streak0. Unfed after
fix: energy0, damage0.6, streak4. Food is actually consumed by the engine;
the test does not replace feeding with a hard-coded successful response.

Validation actually run:
- tsc --noEmit clean; compiled gate suite44/44 incl G38.
- contracts11/11 with freshly rebuilt browser app and source-key checks.
- workflow fixtures154/154.
- two independent World instances per seed repeated500ticks: hash equality
  517=681f4688, 24601=e5707ccf (explicit founders400, world2400x2400).
- contract C1 default500tick pins independently reobserved: 517 P833/C178/D76;
  24601 P563/C353/D117. Intentional default biological change, version0.6.11;
  retired0.6.6 pairs remain in provenance. No census target tuning.
- final diff checked for whitespace errors.

Old engine experiments remain version-specific evidence, not retroactively
validated for this change. These pins identify main plus starvation fix only;
combining the unmerged dual-accounting correction will need new validation.
This intermediate record predates PR delivery; current delivery status is on the PR.

## Follow-up on the same branch: photosynthetic headroom (0.6.12)

Photosynthesis now computes room from capacity minus CURRENT store.energy,
not arbitration's cached pre-cost energy. G39 first failed on the old photo
writer: upkeep/sensing cost1.027049, capture0.180538, retained0.027049 and
unnecessary detritus0.153489. After the one-line correction, retained0.180538,
overflow0. A high-capture control retains only1.027049 and deposits17.026752,
confirming true overflow is neither lost nor retained beyond storage capacity.

The preceding0.6.11 values are historical starvation-only observations.
Current0.6.12 includes BOTH fixes; live repeated C1 pins are now
517 P796/C167/D67 and24601 P576/C295/D75. Explicit500tick World twins match:
517 dec02d8f;24601 9a5f61f3. Final checks: typecheck clean,45/45 gates,
11/11 contracts on freshly rebuilt0.6.12 browser bundle,154/154 workflows.
Independent review found no source/test defect. Its stale bundle and pin
findings reflected the intermediate state and were resolved by the subsequent
app rebuild, new C1 pins/retirement entries and successful final contracts.
