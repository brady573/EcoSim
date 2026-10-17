/** Descriptive factorial panel; no reaction intervention or causal verdict. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../build/world/world.js';
import { runIdentity } from '../build/world/version.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'evidence/matched-18-1000-080-20261014');
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node scripts/mechanism-four-arm.mjs --out NEW_DIRECTORY');
assert.equal(args[0], '--out');
const out = resolve(args[1]);
assert.ok(!existsSync(out), 'Refusing existing output');
assert.ok(!out.startsWith(source + '/'), 'Do not write inside historical panel');
const original = JSON.parse(readFileSync(join(source, 'protocol.json'), 'utf8'));
assert.equal(runIdentity(true), 'ts-evo-poc/0.8.0+chem/0.7.7', 'Historical panel replay requires its matching engine (8fddb08)');
const historical = readFileSync(join(source, 'runs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
assert.equal(historical.length, 36);
assert.equal(new Set(historical.map((r) => `${r.arm}:${r.seed}`)).size, 36);
assert.ok(historical.every((r) => ['legacy', 'advanced'].includes(r.arm)));
const arms = [
  { name: 'legacy', chemistry: null, genomeV2: null },
  { name: 'genome-only', chemistry: null, genomeV2: true },
  { name: 'chemistry-only', chemistry: true, genomeV2: null },
  { name: 'advanced', chemistry: true, genomeV2: true },
];
// Resolve and validate every input BEFORE executing any panel run.
const prepared = original.seeds.flatMap((seed) => {
  const base = JSON.parse(readFileSync(join(source, `legacy-${seed}-config.json`), 'utf8'));
  assert.equal(base.seed, seed);
  assert.equal(base.founders, original.founders);
  const advanced = JSON.parse(readFileSync(join(source, `advanced-${seed}-config.json`), 'utf8'));
  assert.deepEqual(advanced, { ...base, chemistry: true, genomeV2: true }, 'Historical configs must differ only in the two factors');
  return arms.map((arm) => ({ arm, config: { ...base, chemistry: arm.chemistry, genomeV2: arm.genomeV2 } }));
});
assert.equal(prepared.length, 72);
assert.equal(new Set(prepared.map(({ arm, config }) => `${arm.name}:${config.seed}`)).size, 72);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'protocol.json'), JSON.stringify({
  identity: runIdentity(true), runtime: process.version, seeds: original.seeds,
  founders: original.founders, ticks: original.ticks, arms,
  source: 'evidence/matched-18-1000-080-20261014',
  command: `node scripts/mechanism-four-arm.mjs --out ${args[1]}`,
  method: 'All resolved settings matched except chemistry/genomeV2. Fixed seed-first arm order.',
  outcome: 'Descriptive terminal population, births/deaths, guilds, chemistry budgets and hashes; no ecological success threshold.',
  limitation: 'Knobs alter RNG consumption. Factorial differences do not identify nutrient/reaction causal pathways. No intervention or changed biology.',
  integrity: '72 unique complete runs; existing legacy/advanced deterministic measurements must exactly replay on this runtime. No completion marker on mismatch.',
}, null, 2));
let historicalControlsMatched = 0;
for (const { arm, config } of prepared) {
  const w = new World({ config });
  assert.deepEqual(JSON.parse(JSON.stringify(w.config)), config);
  writeFileSync(join(out, `${arm.name}-${config.seed}-config.json`), JSON.stringify(w.config, null, 2));
  const initialHash = w.hashState();
  const prior = historical.find((r) => r.seed === config.seed && r.arm === arm.name);
  if (arm.name === 'legacy' || arm.name === 'advanced') {
    assert.ok(prior, 'Missing historical control');
    assert.equal(initialHash, prior.initialHash);
    assert.equal(runIdentity(config.chemistry === true), prior.identity);
  }
  for (let i = 0; i < original.ticks; i++) w.step();
  const guildCounts = [0, 0, 0];
  let maxLiveGenerationDepth = 0;
  for (let slot = 0; slot < w.store.count; slot++) if (w.aliveAt(slot)) {
    guildCounts[w.roleOf(slot).trophic]++;
    maxLiveGenerationDepth = Math.max(maxLiveGenerationDepth, w.store.generationDepth[slot]);
  }
  const record = {
    seed: config.seed, arm: arm.name, identity: runIdentity(config.chemistry === true),
    tick: w.tick, initialHash, finalHash: w.hashState(), population: w.store.population,
    guildCounts, births: w.totalBirths, deaths: w.totalDeaths,
    birthsByGuildPath: w.demographics().births, maxLiveGenerationDepth,
    energyResidualFraction: w.accountingResidualFraction(),
    chemistry: w.chemistry ? { income: w.chemistry.flux.chemEnergyIncome,
      spent: w.chemistry.flux.chemEnergySpent, carbonBuilt: w.chemistry.flux.chemCarbonBuilt,
      clampedTotal: w.chemistry.totalClamped(), elementalResiduals: w.chemAudit.residual } : null,
  };
  if (arm.name === 'legacy' || arm.name === 'advanced') {
    assert.ok(prior, 'Missing historical control');
    const { elapsedMs, ticksPerSecond, ...expected } = prior;
    assert.deepEqual(record, expected, 'Historical control mismatch; stop rather than reinterpret');
    historicalControlsMatched++;
  }
  assert.equal(record.tick, original.ticks);
  appendFileSync(join(out, 'runs.jsonl'), JSON.stringify(record) + '\n');
  console.log(`${arm.name}/${config.seed} tick=${w.tick} pop=${record.population} births=${record.births}`);
}
const rows = readFileSync(join(out, 'runs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
assert.equal(rows.length, 72);
assert.equal(new Set(rows.map((r) => `${r.arm}:${r.seed}`)).size, 72);
const median = (xs) => {
  const a = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
};
const summary = arms.map(({ name }) => {
  const runs = rows.filter((r) => r.arm === name);
  assert.equal(runs.length, 18);
  return { arm: name, runs: runs.length,
    populationMean: runs.reduce((s, r) => s + r.population, 0) / runs.length,
    populationMedian: median(runs.map((r) => r.population)),
    totalBirths: runs.reduce((s, r) => s + r.births, 0),
    extinctSeeds: runs.filter((r) => r.population === 0).map((r) => r.seed),
  };
});
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
assert.equal(historicalControlsMatched, 36);
writeFileSync(join(out, 'complete.json'), JSON.stringify({ runs: rows.length, historicalControlsMatched }));
console.log('COMPLETE 72 runs; 36 historical controls exactly matched.');
