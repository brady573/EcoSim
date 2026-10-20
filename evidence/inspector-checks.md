# Browser Ecology Inspector — implementation checkpoint

**Draft limitation:** this UI is implemented in the legacy src/app shell,
now archived under evidence/archive/legacy-viewer/. It has NOT been ported
to the active src/view/index.html. The reusable read-only inspection module
and tests are present, but this is not a completed active-viewer feature.

Later slot-release safety changes use engine0.6.16/world-state3 on this same
branch; see slot-release-fix.md. The reconciliation results below record the
earlier main0.6.14 baseline, not a relabelling of its digest outputs.

Reconciled branch fast-forwarded to main dd3440e (engine0.6.14); originally
started from06be7da. No PR20 dependency. Read-only
cell mapping/readout lives in src/app/inspection.ts. Existing nutrientCapAt
is public for exact engine capacity rules, with no arithmetic change.

UI: inspect checkbox, pointer/touch selection, arrow-key canvas navigation,
numeric row/column alternative, pool A/B/C heatmap and scale legend,
selected-cell marker, live committed tick/readout, source-qualified JSON
download with manual-copy fallback. All-eligible current living guild counts
and expressed capability classes remain distinct. No event observer in this
baseline: event-time limitation is explicitly not observed, never zero.

Inspector aggregation and heatmap buffer refresh at most every 250ms during
simulation commits; explicit selection, pause and step refresh immediately.
Interpolated organism drawing is preserved. Field ratios above capacity are
shown numerically without clipping; only heatmap colour saturates.

Executed checks: typecheck clean; scripts/inspection-checks.mjs passes
boundaries/caps/empty/no-observer/trait-vs-guild/read-only hash/RNG/export
snapshot/pause-step tests. scripts/inspection-ui-checks.mjs executes the
actual shipped bundle and shell with a DOM/canvas adapter: pointer handler,
arrow navigation, numeric selection, pool switch, export, paused tick and
+100 refresh pass. After reconciliation: gates47/47, contracts11/11 and
workflows154/154 pass on this
main-derived branch. The browser bundle was freshly generated, not hand-edited.

Manual browser reproduction (real-browser evidence still required):
1. Run `npm run build:app`, then open `build/legacy-viewer.html` directly via
   file://; run seed517. For archive fidelity only, use the immutable snapshot
   `evidence/archive/legacy-viewer/evo-sim-poc-0.6.16.html` (not the latest UI).
2. Pause; enable Inspect cell; tap an edge/corner cell. Verify coordinates,
   per-pool amount/capacity and honest no-observer text.
3. Focus canvas; use arrows. Alternatively enter column/row and Select cell.
4. Switch heatmap A/B/C; compare selected numerical ratios and legend.
5. Export cell JSON. Verify seed/config/engine/tick/cell/evidence classes.
6. Repeated reads while paused hold tick; +100 advances tick exactly100.
7. Resume; interpolation and controls remain usable; no per-frame field scan.

Limit: no browser binary/automation integration is available in this device
session. DOM-adapter smoke is not a real screenshot or physical touch test.
No real-browser visual validation or mobile download compatibility is claimed.
Do not call this a complete review-ready feature until that evidence exists.
