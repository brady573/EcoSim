# PR22 inspector review follow-up (local)

Published base db0bfe4. Addresses all three external review findings without
changing slot safety, engine biology, digest format or the archived snapshot.

1. refreshInspection returns immediately when neither selection nor heatmap
   is active. It checks elapsed time before an O(1) readRunTick accessor;
   readRun's population scans are no longer part of inspection polling.
2. Playback inspection redraw preserves the last rendered interpolation alpha.
   Only paused rendering deliberately uses alpha1. Frame rendering records its
   alpha; restarting a run initializes it. Inspection never steps the world.
3. Manual steps now build/open build/legacy-viewer.html; the immutable archive
   is identified separately for archival fidelity, not current UI validation.

The augmented bundled-shell test reproduced census/alpha failures against
the old shell before the fix. The final test executes advancing RAF callbacks:
inactive inspection, selected-cell and heatmap throttling, refresh after250ms,
one HUD census per committed frame, alpha0 and a genuine fractional alpha
between0 and1, unchanged state hashes on redraw, and pause alpha1.
The fractional case simulates one expensive batch in the wall clock only;
actual simulation stepping remains the real API.

Local typecheck, inspector core/bundled-shell tests,11/11 contracts and154/154
workflow fixtures pass. Existing CI already invokes this test, but remote CI
has not run these unpushed changes. DOM-adapter coverage is not physical
browser/visual validation; active index.html inspector integration stays open.
Independent focused follow-up review found no substantive defect. Its cosmetic
fixture-message nits were clarified; the separate fractional-alpha case
explicitly tests preservation between0 and1. Reviewer could not execute commands;
runtime receipts are primary-agent observations. Real-browser behavior and
adjacent key-repeat force-scan cost remain unverified/unchanged. No commit/push/merge yet.
