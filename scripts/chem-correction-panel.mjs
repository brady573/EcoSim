/** Two already-registered seeds, matched legacy/advanced qualification only. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { World } from '../build/world/world.js';
import { runIdentity } from '../build/world/version.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node scripts/chem-correction-panel.mjs --out NEW_DIRECTORY');
assert.equal(args[0], '--out');
const out = resolve(args[1]);
assert.ok(!existsSync(out), 'Refusing existing output');
const source = join(root, 'evidence/mechanism-four-arm-20261015');
assert.ok(!out.startsWith(source + '/'), 'Do not write into historical evidence');
assert.equal(runIdentity(true), 'ts-evo-poc/0.8.0+chem/0.7.8');
const registered = JSON.parse(readFileSync(join(source, 'protocol.json'), 'utf8'));
const old = readFileSync(join(source, 'runs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const seeds = registered.seeds.slice(0, 2);
assert.equal(new Set(seeds).size, 2);
const sourceDigests = {};
for (const rel of [...readdirSync(join(root, 'src'), { recursive: true })
  .filter((p) => p.endsWith('.ts')).map((p) => `src/${p}`),
  'tsconfig.build.json', 'package-lock.json', 'scripts/chem-correction-panel.mjs']) {
  sourceDigests[rel] = createHash('sha256').update(readFileSync(join(root, rel))).digest('hex');
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'protocol.json'), JSON.stringify({
  identity: runIdentity(true), baseSourceSHA: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceState: 'working tree supported; exact sourceDigests identify measured implementation',
  sourceDigests, runtime: process.version, seeds, ticks: registered.ticks,
  founders: registered.founders, arms: ['legacy', 'advanced'], repeats: 2,
  command: `node scripts/chem-correction-panel.mjs --out ${args[1]}`,
  purpose: 'Targeted D1/D2 qualification, not an ecological cohort verdict. No seed search, tuning or success threshold.',
  comparison: 'Same resolved configs as the first two registered factorial seeds; D2 default=1; legacy deterministic record must match exactly, advanced is a different chemistry identity and is not parity-pinned.',
  cadence: [0, 1, 32, 120, 300, 600, registered.ticks],
}, null, 2));
const samples = new Set([0, 1, 32, 120, 300, 600, registered.ticks]);
for (const seed of seeds) for (const arm of ['legacy', 'advanced']) {
  const config = { ...JSON.parse(readFileSync(join(source, `${arm}-${seed}-config.json`), 'utf8')), chemistryReactionOmit: null };
  const prior = old.find((r) => r.seed === seed && r.arm === arm);
  assert.ok(prior);
  assert.equal(config.chemistryReproNutrientDemand, null);
  let first;
  for (let repeat = 0; repeat < 2; repeat++) {
    const w = new World({ config });
    assert.deepEqual(JSON.parse(JSON.stringify(w.config)), config);
    const initialHash = w.hashState();
    const trajectory = [];
    for (let tick = 0; tick <= registered.ticks; tick++) {
      if (samples.has(tick)) trajectory.push({ tick, population: w.store.population,
        births: w.totalBirths, deaths: w.totalDeaths,
        carbonBuilt: w.chemistry?.flux.chemCarbonBuilt ?? null,
        growthSpent: w.chemistry?.flux.chemEnergySpent ?? null, hash: w.hashState() });
      if (tick < registered.ticks) w.step();
    }
    const guildCounts = [0, 0, 0];
    let maxLiveGenerationDepth = 0;
    for (let slot = 0; slot < w.store.count; slot++) if (w.aliveAt(slot)) {
      guildCounts[w.roleOf(slot).trophic]++;
      maxLiveGenerationDepth = Math.max(maxLiveGenerationDepth, w.store.generationDepth[slot]);
    }
    const record = { seed, arm, identity: runIdentity(config.chemistry === true), tick: w.tick,
      initialHash, finalHash: w.hashState(), population: w.store.population, guildCounts,
      births: w.totalBirths, deaths: w.totalDeaths, birthsByGuildPath: w.demographics().births,
      maxLiveGenerationDepth, energyResidualFraction: w.accountingResidualFraction(),
      chemistry: w.chemistry ? { income: w.chemistry.flux.chemEnergyIncome,
        spent: w.chemistry.flux.chemEnergySpent, carbonBuilt: w.chemistry.flux.chemCarbonBuilt,
        clampedTotal: w.chemistry.totalClamped(), elementalResiduals: w.chemAudit.residual } : null };
    if (arm === 'legacy') assert.deepEqual(record, prior, 'chemistry-unset behavior must not change');
    if (repeat === 0) first = { record, trajectory };
    else assert.deepEqual({ record, trajectory }, first, 'repeat must be byte-equivalent deterministic data');
  }
  writeFileSync(join(out, `${arm}-${seed}-config.json`), JSON.stringify(config, null, 2));
  appendFileSync(join(out, 'runs.jsonl'), JSON.stringify({ ...first.record, trajectory: first.trajectory }) + '\n');
  appendFileSync(join(out, 'comparisons.jsonl'), JSON.stringify({ seed, arm, before: prior, after: first.record }) + '\n');
  console.log(`${arm}/${seed}: pop=${first.record.population} births=${first.record.births} repeat exact`);
}
writeFileSync(join(out, 'complete.json'), JSON.stringify({ uniqueRuns: 4, executions: 8, repeatsExact: 4, legacyControlsMatched: 2 }));
