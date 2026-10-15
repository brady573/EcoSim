/** Small matched live witness, not an ecological cohort or intervention. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../build/world/world.js';
import { runIdentity } from '../build/world/version.js';
import { REACTIONS } from '../build/bio/metabolism.js';
import { POOL_NAMES } from '../build/world/chemistry.js';
import { ELEMENT_NAMES } from '../build/bio/elements.js';
import { boundaryStateDigest } from './boundary-state-digest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node scripts/chem-boundary-panel.mjs --out NEW_DIRECTORY');
assert.equal(args[0], '--out');
const out = resolve(args[1]);
assert.ok(!existsSync(out), 'Refusing existing output');
const panel = join(root, 'evidence/mechanism-four-arm-20261015');
assert.ok(!out.startsWith(panel + '/'), 'Do not write inside factorial panel');
const protocol = JSON.parse(readFileSync(join(panel, 'protocol.json'), 'utf8'));
assert.equal(runIdentity(true), protocol.identity, 'Historical boundary replay requires its matching engine (8fddb08)');
const seed = protocol.seeds[0]; // first already authorized seed, no seed search
const checkpoints = [1, 32, 120, 300, 600, protocol.ticks];
const prior = readFileSync(join(panel, 'runs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
assert.equal(JSON.parse(readFileSync(join(panel, 'complete.json'), 'utf8')).runs, 72);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'protocol.json'), JSON.stringify({ seed, ticks: protocol.ticks,
  checkpoints, capacityPerKind: 64, pools: POOL_NAMES, elements: ELEMENT_NAMES,
  reactions: REACTIONS.map((r) => r.name), source: 'evidence/mechanism-four-arm-20261015',
  command: `node scripts/chem-boundary-panel.mjs --out ${args[1]}`,
  limitation: 'Bounded last-64 per-kind at checkpoints; not complete histories or causal isolation. No biological intervention.',
  deathCause: 'Existing trace proximate age/starve/damage classification; parentId identifies founder versus offspring, not full generation.',
  gate: 'Potential chemical affordability recorded before cooldown/energy/maturity rejection. Inspect all fields; not a count of mature breeders exclusively blocked by matter.',
}, null, 2));
for (const arm of protocol.arms) {
  const config = JSON.parse(readFileSync(join(panel, `${arm.name}-${seed}-config.json`), 'utf8'));
  const control = new World({ config });
  const observed = new World({ config, chemBoundary: { capacity: 64 } });
  assert.equal(boundaryStateDigest(control), boundaryStateDigest(observed));
  for (let tick = 1; tick <= protocol.ticks; tick++) {
    control.step(); observed.step();
    assert.equal(control.hashState(), observed.hashState());
    if (checkpoints.includes(tick)) {
      const digest = boundaryStateDigest(observed);
      assert.equal(boundaryStateDigest(control), digest);
      const trace = observed.chemistryBoundaryTrace();
      appendFileSync(join(out, 'checkpoints.jsonl'), JSON.stringify({ arm: arm.name, seed, tick,
        hash: observed.hashState(), broadDigest: digest, population: observed.store.population, trace }) + '\n');
    }
  }
  const expected = prior.find((r) => r.seed === seed && r.arm === arm.name);
  assert.ok(expected);
  assert.equal(observed.hashState(), expected.finalHash);
  assert.equal(observed.totalBirths, expected.births);
  console.log(`${arm.name}/${seed}: trace ON/OFF exact; matches factorial final hash`);
}
writeFileSync(join(out, 'complete.json'), JSON.stringify({ arms: 4, checkpointsPerArm: checkpoints.length, broadParity: true }));
