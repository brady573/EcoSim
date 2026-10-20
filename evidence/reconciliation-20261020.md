# Remaining work reconciled with merged PR21

Historical reconciliation checkpoint before the slot-safety and viewer-archive
changes. See the draft inspector-branch PR and slot-release-fix.md for current
delivery status; the no-push/no-commit statements below describe this checkpoint.

Authoritative main: dd3440ebc12ae97da3d0e287f2ea3e4af6f3e09d, engine0.6.14.
PR21 is merged. Its current-energy, authoritative digest and prey-local spill
fixes must not be reapplied or replaced with old pins or attacker-local spill.

## Inspector (priority A)

Worktree /tmp/opencode/ecosim-inspector, branch
issue15/browser-ecology-inspector. Fast-forwarded to newmain, preserving the
uncommitted UI/helper/tests. Git autostash reapplied successfully; a pre-merge
tracked patch backup also exists at /tmp/opencode/inspector-before-main.patch.
Bundle rebuilt with0.6.14. Typecheck, helper+bundled-shell interaction checks,
47 gates,11 contracts and154 workflow fixtures passed. Prior independent
feature review findings were fixed; no feature logic changes in reconciliation.

Remaining: real-browser visual/mobile interaction/download evidence and final
feature delivery/PR. No browser screenshot claim from the DOM adapter.

## Paid-basal excretion (accounting remainder)

Original /tmp/opencode/ecosim-accounting branch issue15/dual-accounting-fix
is preserved, including original committed red fixtures21caad1 and pending
source changes. It is historical working context, NOT the active baseline.

Fresh worktree /tmp/opencode/ecosim-paid-basal, branch
issue15/paid-basal-excretion starts at dd3440e. Original fixtures copied without
rewriting old history. Reconciled test disables regeneration to isolate the
primary basal expenditure from newmain's post-feeding-starvation repair cost.
On newmain, all8 spill cases and fully paid basal pass; zero/partial paid
excretion fail. The only new biological diff now is actual paid-basal return
and a positive-paid guard skipping zero offers. Spill/hash/headroom/starvation
implementations are inherited verbatim from main, not replayed as new fixes.

Local engine0.6.15 baseline measured/repeated:517 P842/C170/D71;
24601 P597/C225/D110. Old0.6.14 pins retained in provenance. All11 targeted
regressions, typecheck,47 gates,11 fresh-bundle contracts,154 workflows and
500tick twins pass. Independent focused review requested; pending receipt is
not treated as approval.

Remaining: final CI wiring for regression script, fixed historical
before/after comparison (same517/41001/configs), consolidated source-qualified
evidence and correction PR; no new experimental candidate or auto-merge.

## Measurement history and opportunity diagnostic (priority B)

PR20 remains OPEN/DRAFT at b9a4f91, accepted historical0.6.8 measurement source.
Neither branch nor old L1/L2 archives are rewritten or merged by this task.
Future source integration needs a new identity and explicit reconciliation
with main's world-state/2 contract: the opt-in photoObserver config is
diagnostic and must not break observer-on/off hash parity when ported.
Do NOT carry old version/pin declarations into main. Reuse old results only
as historical observations; corrected biology needs its own evidence.

SliceB's source→uptake event-local opportunity join remains unimplemented.
Its code may stack on the observer if needed, but no new ecological campaign
or causal-reliance claim is authorized by engineering reconciliation.

## Preserved / excluded

Old exploratory /root/EcoSim-o3 tree and its uncommitted experiments preserved.
It includes superseded attacker-local spill/old pins; do not promote them.
Existing viewer server was not switched as part of reconciliation.
PR16 docs and PR14 chemistry untouched. No new remote push, PR edit, commit,
history rewrite or merge. Main remains exactly the Owner-authorized PR21 merge.
