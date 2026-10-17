import { chemicalGrowthCases, chemicalReproductionCases, chemicalLiveGrowthCases } from '../build/chem-correctness.js';
import { runIdentity } from '../build/world/version.js';
console.log(JSON.stringify({ kind: 'provenance', identity: runIdentity(true),
  command: 'node scripts/chem-correctness-checks.mjs', scope: 'D1/D2 separate helper postconditions plus live tissue, store and energy-ledger witness' }));
for (const record of chemicalGrowthCases()) console.log(JSON.stringify({ decision: 'D1', ...record }));
for (const record of chemicalReproductionCases()) console.log(JSON.stringify({ decision: 'D2', ...record }));
for (const record of chemicalLiveGrowthCases()) console.log(JSON.stringify({ decision: 'D1-live', ...record }));
