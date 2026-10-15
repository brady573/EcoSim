# Primary viewer handoff — implementation and validation

The primary PixiJS UI (`src/view/index.html`, `src/view/viewer.ts`) selects
legacy or chemistry independently of Genome V2. Every mode change constructs
a new authoritative World at the displayed seed/founder count. No presentation
path writes biological state. The served constructor is shared with the CI
check in `src/view/experiment.ts`; it is not a second simulation engine.

Examples: seed 517, 400 founders, chemistry + Genome V2 enables reaction
income and tissue growth; chemistry without Genome V2 exposes tissue/accounting
without module-enabled reaction income. Legacy + either genome setting uses
the base run identity. The stats panel shows resolved mode identity, seed,
founders, Genome V2, tick, chemical income/spend, built carbon, reaction count,
element residuals and cumulative clamp. Inspector tissue/stores are measured
element vectors; the capability mask reflects expressed state.

Portable Canvas HTML remains legacy-only in both presets and discloses this.
It does not clone the primary investigation UI or advertise advanced readouts.
Both renderers retain the same engine and null-default config semantics.

## Automated evidence

`node scripts/viewer-checks.mjs` (after CLI build) exercises all four modes,
matched config/seed/tick engine replay, restart determinism, chemical activity,
global and organism readout non-mutation, invalid inputs, failed construction
preservation, and served HTML/compiled JS control presence. CI runs this
required step after the CLI build. These checks do **not** execute the DOM or
PixiJS renderer and are not browser smoke evidence.

2026-10-14 results: typecheck and both builds clean; all four mode checks
passed; 55/55 behavioral gates, 11/11 contracts, 157/157 workflow fixtures.
Raw mode evidence: `evidence/primary-viewer-headless-20261014.txt`.
Independent review inspected the implementation diff and confirmed the
restart/input/readout/presence fixes. HTTP delivery checks returned 200 for
the primary HTML and compiled experiment module; both new control IDs were
present in the served page. HTTP delivery is not browser execution.

## Browser evidence and remaining acceptance

Real Chromium CI at `fd4d2fcd00340e37033dff9298719bd9e57fb5db`
([run 38668724930](https://github.com/brady573/EcoSim/actions/runs/38668724930))
completed all four chemistry × Genome V2 modes on desktop and simulated mobile:
identity/readouts, organism picking, invalid-seed preservation, deterministic
restart, corner/dock layout, wheel/mouse pan and two-contact touch pinch.
The overall suite **FAILED** during portable export parsing: clipboard status
was prefixed to JSON. Portable preset/canvas acceptance did not finish.

The repair at `d85bfa0cedde8afefe74a35b1f0b1dd83355f57d` passed the entire
browser suite in [run 38671856365](https://github.com/brady573/EcoSim/actions/runs/38671856365).
Both CI jobs succeeded. This run completed all four primary modes on desktop
and simulated mobile, one-contact touch panning (camera movement, unchanged
biological hash and selection), two-contact pinch, and offline portable
baseline/balanced presets with nonblank Canvas pixels. Export remained pure
JSON in both presets across clipboard success, unavailable and rejected
branches; successful copy bytes matched the textarea exactly. The normal job
also passed typecheck, gates, viewer checks, contracts and workflow fixtures.
Compact-landscape touch coverage is not claimed.

No browser executable, Playwright/Puppeteer installation or browser tool is
available on the local device. No browser install or capacity-denied command
was attempted. CI is browser execution, not physical-device validation.
Physical-phone gestures, visual quality and clipboard integration remain
unverified; clipboard branch tests use controlled browser API substitutes.
Automated Chromium browser acceptance now passes. Physical-device acceptance
remains separate and unverified.

Browser checklist for the intended server (`npm run view`, localhost:5178):
1. Exercise all four mode combinations; check identity and chemical readouts.
2. Change seed/restart; tick resets and displayed seed matches the input.
3. Reject seed 0/fractional/out-of-range; old live run remains intact.
4. Select an organism, inspect chemistry, then pan/zoom/pinch on a phone.
5. Open portable HTML offline: presets work and advanced modes are not offered.

PR #14 remains draft/unmerged; this is implementation, not merge approval.
