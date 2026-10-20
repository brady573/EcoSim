# Idempotent slot release — inspector branch

Owner requested this public-storage-API fix on the inspector branch. Baseline
main dd3440e. No claim that the old failure was reachable from normal
World.deathPhase, which already checks liveness before release.

OrganismStore now tracks free membership in a Uint8Array (one byte/capacity
slot, included in byteEstimate). release validates an allocated integer index;
invalid values throw RangeError. A duplicate release while free returns without
clearing/pushing again. Reuse resets membership; growth preserves flags.
Constant-time operations, no scan of a potentially large free stack.

Regression G43: release-release-allocate-allocate, distinct slots and preserved
first occupant, count/population, release after reuse, growth, invalid values,
and membership sensitivity in the allocation hash. Old code failed (at
capacity1 the duplicate push exceeded the typed stack and allocation returned
undefined); fixed code reuses0 then allocates1, with correct population2.

Idempotent means until reallocation, NOT immunity to stale numeric handles:
after reuse, a release of that number releases the new occupant. This API has
no generation token. No broader handle redesign was requested.

The new membership flag affects future allocation, so it is hashed, not hidden.
Digest format is world-state/3; old format2 strings remain historical.
Engine0.6.16, suite0.16.0. Valid-world biology and live population pins remain
0.6.14's values; no pin replacement or ecology tuning. Inspector UI and
unpaid-basal0.6.15 work remain distinct from this source change.

Typecheck,48 compiled gates, inspector core and shipped-shell interaction
tests passed. Fresh app build,11/11 contracts (original population pins
unchanged),154/154 workflow fixtures and historical hash negative checks pass.
Explicit500tick twins match:517 world-state/3:ba600113;
24601 world-state/3:649d5d4d. Independent review and focused follow-up found
no functional defect. G43 now also verifies exact digest restoration and a
nonzero free marker across direct growth-helper expansion (automatic allocation
cannot grow while a free slot exists). Pre-existing byteEstimate omissions
and non-atomic allocation-failure growth remain explicitly deferred, not fixed
or claimed safe by this change. Current delivery status is on the draft PR.
