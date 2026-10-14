# PR #13 corrected measurements

Engine `ts-evo-poc/0.6.3`, Node v24.21.0. Each probe prints its seed,
horizon and resolved configuration. `source-sha256.txt` identifies the measured
engine/probe/gate source. These are bounded diagnostics, not a new ecology cohort.

Commands (repository root, after compiling both TypeScript targets):

```sh
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.build.json
npx tsc -p tsconfig.app.json
node scripts/bundle-app.mjs
node scripts/assemble-app.mjs
node build/gates.js
node scripts/contract-checks.mjs
node scripts/workflow-checks.mjs
node build/trace/matingdiag.js 2000 517
node build/trace/opportunityprobe.js 3000 517 41001
node build/trace/nutrientflux.js 2000 517
```

The three diagnostic commands were each repeated after this final build;
`cmp` against the archived output succeeded byte-for-byte for each. This is
repeatability evidence, not additional independent seeds. Gates: 40/40;
contracts: 11/11; workflow fixtures: 153/153. Fixture stderr rejects deliberately
invalid input and corrupt manifests; this is expected, not a failed simulation.

Presence checks: flux output contains accepted/attempted/capLoss/eviction and
the partition-audit marker; mating output includes actual queued and placed
offspring; opportunity output includes quartile and survivor-energy sample sizes.
The rebuilt HTML includes 0.6.3 and four-book snapshot fields.

See REPORT.md's final correction section for interpretation and withdrawal of
the broken-recorder verdicts. Historical logs were not rewritten or certified.
