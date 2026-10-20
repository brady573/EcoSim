# Inspector-branch draft delivery

Baseline: merged main dd3440e, not PR20. Engine0.6.16 / world-state3.

Included: read-only cell inspection helpers and legacy-shell UI, idempotent
slot release with hashed membership, exact-byte archive of the old standalone
HTML, build/contract/CI/diagnostic path migration, automated inspector checks.

**Incomplete active-viewer feature:** inspector UI remains in src/app/shell.html
and build/legacy-viewer.html. Active src/view/index.html is served unchanged;
the UI is not ported there. Real-browser screenshots, physical touch/mobile
download checks and final active-viewer integration remain open. DOM-adapter
checks are not browser visual evidence. This PR must remain a draft, not be
described as completed SliceA acceptance.

Slot-safety regression was red on original code, then green. Follow-up checks
cover marker preservation through helper growth and exact digest restoration.
Independent code reviews support inspector read-only semantics, the storage
fix and workflow path migration; reviewer-side command restrictions are not
presented as runtime verification. Primary-agent checks are recorded here.

Pre-existing deferred issues: byteEstimate omits modular-genome arrays, and
grow() is non-atomic on allocation failure. These are not solved by idempotent
release. Numeric stale handles after reallocation have no generation safety.

No paid-basal fix, PR20 integration, new biological candidate, chemistry or
merge authorization is included. The original0.6.14 population pins must hold.

Receipts: typecheck.txt, gates.txt, inspection-core.txt, inspection-ui.txt,
contracts.txt, workflow.txt.gz, hash-negative-controls.txt, twins.txt,
archive-staging.txt and source-files.sha256. Workflow output is losslessly
compressed; archive bytes are separately verified by snapshot.sha256.
