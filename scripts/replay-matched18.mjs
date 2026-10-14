/** Portable replay of the recorded panel; never overwrites original evidence. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../build/world/world.js';
import { runIdentity } from '../build/world/version.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const original = join(root, 'evidence/matched-18-1000-080-20261014');
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node scripts/replay-matched18.mjs --out NEW_DIRECTORY');
assert.equal(args[0], '--out', 'Output directory must be explicit');
const out = resolve(args[1]);
assert.ok(!existsSync(out), 'Output directory already exists; refusing to overwrite evidence');
const protocol = JSON.parse(readFileSync(join(original, 'protocol.json'), 'utf8'));
const records = readFileSync(join(original, 'runs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
assert.equal(records.length, 36);
assert.equal(new Set(records.map((r) => `${r.arm}:${r.seed}`)).size, 36);
const prepared = records.map((expected) => {
  const config = JSON.parse(readFileSync(join(original, `${expected.arm}-${expected.seed}-config.json`), 'utf8'));
  assert.equal(runIdentity(config.chemistry === true), expected.identity, 'Wrong engine version for historical replay');
  assert.ok(protocol.seeds.includes(config.seed));
  assert.equal(config.seed, expected.seed);
  assert.equal(config.founders, protocol.founders);
  return { expected, config };
});
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'protocol.json'), JSON.stringify({ ...protocol,
  replayCommand: `node scripts/replay-matched18.mjs --out ${args[1]}`,
  sourceEvidence: 'evidence/matched-18-1000-080-20261014',
  comparison: 'Same-runtime exact configuration, initial/final digest and recorded deterministic measurements; timings excluded.',
}, null, 2));

for (const { expected, config } of prepared) {
  const w = new World({ config });
  assert.deepEqual(JSON.parse(JSON.stringify(w.config)), config, 'Resolved config must match the stored config exactly');
  assert.equal(w.hashState(), expected.initialHash, 'Opening state mismatch');
  const start = performance.now();
  for (let i = 0; i < protocol.ticks; i++) w.step();
  const elapsedMs = performance.now() - start;
  const guildCounts = [0, 0, 0];
  let maxLiveGenerationDepth = 0;
  for (let slot = 0; slot < w.store.count; slot++) if (w.aliveAt(slot)) {
    guildCounts[w.roleOf(slot).trophic]++;
    maxLiveGenerationDepth = Math.max(maxLiveGenerationDepth, w.store.generationDepth[slot]);
  }
  const actual = {
    seed: config.seed, arm: expected.arm, identity: runIdentity(config.chemistry === true),
    tick: w.tick, initialHash: expected.initialHash, finalHash: w.hashState(),
    population: w.store.population, guildCounts, births: w.totalBirths, deaths: w.totalDeaths,
    birthsByGuildPath: w.demographics().births, maxLiveGenerationDepth,
    energyResidualFraction: w.accountingResidualFraction(),
    chemistry: w.chemistry ? {
      income: w.chemistry.flux.chemEnergyIncome, spent: w.chemistry.flux.chemEnergySpent,
      carbonBuilt: w.chemistry.flux.chemCarbonBuilt, clampedTotal: w.chemistry.totalClamped(),
      elementalResiduals: w.chemAudit.residual,
    } : null,
  };
  appendFileSync(join(out, 'runs.jsonl'), JSON.stringify({ ...actual, elapsedMs,
    ticksPerSecond: protocol.ticks * 1000 / elapsedMs }) + '\n');
  const { elapsedMs: ignoredMs, ticksPerSecond: ignoredRate, ...deterministic } = expected;
  assert.deepEqual(actual, deterministic, `${expected.arm}/${expected.seed} replay mismatch`);
  console.log(`MATCH ${expected.arm}/${expected.seed} tick=${w.tick} population=${actual.population}`);
}
writeFileSync(join(out, 'complete.json'), JSON.stringify({ runs: 36, ticks: protocol.ticks, exactMatches: 36 }));
console.log('36/36 exact replay matches; original evidence unchanged.');
