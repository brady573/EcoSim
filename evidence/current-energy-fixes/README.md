# Four bounded fixes on main06be7da

Engine0.6.14, gates0.14.0, digest world-state/2. This is the combined source
for the PR, not the source of earlier exploratory ecology figures.

|Fix|Regression|Before|After|
|---|---|---|---|
|Post-feeding starvation|G38, real actPhase|Fed energy3.98867 still incurred damage0.6|No starvation damage; streak clears; unfed still damages|
|Photosynthetic storage|G39, real actPhase|Small capture0.180538 retained only0.027049 after costs|Full small capture retained; large capture genuinely capped/spilled|
|Authoritative hash|G40 + historical method reproduction|Five reported omissions falsely alias under old method|27 mutations detected/restored, Float64 sensitivity; scratch/diagnostics excluded|
|Scaled contested overflow|G41, real World writer|32 removed,8 retained,0 environmental deposit|24 enters prey-local detritus; underfunded/repeated transfers conserved|

G41 uses deterministic resolver-record fixtures; it does not independently
test record generation. Existing contest gates remain. Hashing is tick-boundary
authority, not a mid-phase checkpoint or cryptographic equality proof.

Typecheck, compiled gates, negative controls, contracts, workflow and explicit
twins receipts are recorded here. Browser app is rebuilt from both app tsc
output and the bundler/assembler before contract checks. Live population pins
are based on repeated measured source runs, not tuned outcomes:
517 P840/C173/D81;24601 P606/C241/D63 at500ticks.

Independent focused source/test reviews support all four fixes, with a
follow-up cache audit for hashing. Primary-agent executable validation is
distinct from reviewers' static inspection. Intermediate evidence files
starvation-fix.md and hash-state-audit.md record earlier source states;
the receipts here describe final combined0.6.14.

Not included: unmerged PR20, inspector UI, unpaid-basal excretion fix, new
ecological campaigns, parameter tuning or merge authorization. Old ecology
logs remain version-specific; no balance/reliance inference is made.

Commands (repository root):
```
tsc -p tsconfig.json --noEmit --pretty false
tsc -p tsconfig.build.json --pretty false
node build/gates.js
node scripts/hash-negative-checks.mjs
tsc -p tsconfig.app.json --pretty false
node scripts/bundle-app.mjs
node scripts/assemble-app.mjs
node scripts/contract-checks.mjs .
node scripts/workflow-checks.mjs
```
