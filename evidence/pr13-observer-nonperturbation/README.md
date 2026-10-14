# Direct opportunity-recorder on/off comparison

Review request: PR #13 review 5523267409, Owner D5.

Measured on Node v24.21.0, engine `ts-evo-poc/0.6.3`. Source digests are in
`source-sha256.txt`; each arm prints the complete resolved configuration.

```sh
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.build.json
node scripts/opportunity-check.mjs
```

The checker invokes the compiled opportunity probe separately for each of
seeds 517 and 41001, both at 3000 ticks (the existing observer seeds/horizon):

```sh
node build/trace/opportunityprobe.js 3000 517
node build/trace/opportunityprobe.js 3000 517 --observer-off
node build/trace/opportunityprobe.js 3000 41001
node build/trace/opportunityprobe.js 3000 41001 --observer-off
```

Off skips the recorder's census, spatial reads, joins, summaries and carried
sample data. It does not change the World configuration. On executes all
recorder work; its digest is captured **after** that work. Both arms step the
same World configuration, seeded trajectory and tick horizon, and both call
`World.hashState()` at tick 0 and every 250 ticks through 3000.

Result: **13/13 identical sampled digests per seed**, with byte-identical
engine/resolved-config headers. On-only recorder execution is asserted from
its patch-heterogeneity output. Deliberately corrupted digests, mismatched
configuration and missing frames are rejected by the comparison checks.
Duplicate frames are also rejected. W9-observer runs the checker fixtures in
`scripts/workflow-checks.mjs` without running a simulation; the full bounded
comparison is available via `npm run opportunity:check` after compiling CLI probes.
`check.txt` records the checks; all four raw arm outputs are archived here.

This is direct bounded nonperturbation evidence for the actual observer's
effective configuration, not C1's unset-default parity. It establishes equality
of the state covered by `hashState()` at this cadence, not a collision-free
comparison of every byte/state field at every tick, arbitrary configurations,
calibrated ecological equivalence or functional guild reliance. No balancing
sweep, biological changes or new seed selection was performed.
