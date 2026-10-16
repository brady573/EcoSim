/** Complete gate observations for one fixed seed's actual birth families.
 * Discovery is used only to choose which histories to retain, not to alter
 * either world. Families with no births are not represented by this selection.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, createWriteStream, existsSync } from 'node:fs';
import { createGzip } from 'node:zlib';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../build/world/world.js';
import { runIdentity } from '../build/world/version.js';
import { boundaryStateDigest } from './boundary-state-digest.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const panel = join(root, 'evidence/mechanism-four-arm-20261015');
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node scripts/chem-firstbirth-panel.mjs --out NEW_DIRECTORY');
assert.equal(args[0], '--out');
const out = resolve(args[1]);
assert.ok(!existsSync(out), 'Refusing existing output');
assert.ok(!out.startsWith(panel + '/'), 'Do not write inside source panel');
const protocol = JSON.parse(readFileSync(join(panel, 'protocol.json'), 'utf8'));
const seed = protocol.seeds[0];
const config = JSON.parse(readFileSync(join(panel, `advanced-${seed}-config.json`), 'utf8'));
const prior = readFileSync(join(panel, 'runs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)
  .find((r) => r.seed === seed && r.arm === 'advanced');
assert.ok(prior);
assert.equal(runIdentity(true), prior.identity, 'Historical family replay requires its matching engine (8fddb08)');
assert.equal(config.decomposerDormancy, null, 'complete per-tick gate coverage requires no dormant skip');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'protocol.json'), JSON.stringify({ seed, ticks: protocol.ticks,
  identity: prior.identity, source: 'evidence/mechanism-four-arm-20261015', config,
  command: `node scripts/chem-firstbirth-panel.mjs --out ${args[1]}`,
  selection: 'Fixed first seed, advanced arm only. Discover all actual offspring and their parents; retain all their pre-check gate records, birth transfers and deaths from tick zero to horizon.',
  limitation: 'Outcome-selected birth families, not representative population. Matter/maturity readiness does not establish energy fraction, cooldown, surplus, damage, mating availability, population-cap admission or future viability. Endowment measures chemical tissue/stores, not legacy energy provisioning. No counterfactual intervention or first-birth time after horizon.',
  integrity: 'Discovery and traced final hashes match factorial; per-step ordinary digests and selected broad checkpoints match. Per-kind unconsumed event counts must fit the ring; otherwise fail.',
}, null, 2));

const broadTicks = new Set([0, 1, 32, 120, 300, 600, protocol.ticks]);
const plain = new World({ config });
const hashes = [plain.hashState()];
const broad = new Map([[0, boundaryStateDigest(plain)]]);
const selected = new Set();
let discoveredBirths = 0;
for (let tick = 1; tick <= protocol.ticks; tick++) {
  plain.step(); hashes.push(plain.hashState());
  if (broadTicks.has(tick)) broad.set(tick, boundaryStateDigest(plain));
  for (let slot = 0; slot < plain.store.count; slot++) if (plain.aliveAt(slot)
    && plain.store.bornTick[slot] === tick && plain.store.parentId[slot] >= 0) {
    selected.add(plain.store.id[slot]); selected.add(plain.store.parentId[slot]); discoveredBirths++;
  }
}
assert.equal(discoveredBirths, prior.births, 'discovery must account for every actual offspring');
assert.equal(plain.hashState(), prior.finalHash);
assert.ok(selected.size > 0, 'first-birth family witness must not be vacuous');
writeFileSync(join(out, 'selected-ids.json'), JSON.stringify([...selected].sort((a, b) => a - b)));

const capacity = config.founders + prior.births + 1;
const w = new World({ config, chemBoundary: { capacity } });
const consumed = { birthTransfer: 0, offspringGate: 0, death: 0 };
const lives = new Map();
const gzip = createGzip();
const file = createWriteStream(join(out, 'families.jsonl.gz'), { flags: 'wx' });
// Pipeline rejects and destroys both streams on I/O failure.
const streamDone = pipeline(gzip, file);
streamDone.catch(() => {});
async function write(record) {
  if (!gzip.write(JSON.stringify(record) + '\n')) await Promise.race([
    once(gzip, 'drain'),
    streamDone.then(() => { throw new Error('output stream ended before records completed'); }),
  ]);
}
for (let tick = 0; tick <= protocol.ticks; tick++) {
  if (tick > 0) w.step();
  assert.equal(w.hashState(), hashes[tick], `trace parity tick ${tick}`);
  if (broadTicks.has(tick)) assert.equal(boundaryStateDigest(w), broad.get(tick));
  for (const kind of Object.keys(consumed)) {
    const log = w.chemistryBoundaryTrace(kind);
    const count = log.counts[kind] - consumed[kind];
    assert.ok(count >= 0 && count <= log.events.length, `unread ${kind} lost at tick ${tick}`);
    const fresh = count === 0 ? [] : log.events.slice(-count);
    consumed[kind] = log.counts[kind];
    for (const event of fresh) {
      if (!selected.has(event.id)) continue;
      await write(event);
      if (kind === 'birthTransfer') {
        assert.ok(!lives.has(event.id));
        lives.set(event.id, { id: event.id, parentId: event.parentId, birthTick: event.tick,
          firstMatterAffordableTick: null, firstMatureMatterAffordableTick: null,
          firstActualOffspringTick: null, deathTick: null, gateObservations: 0 });
        if (event.parentId >= 0) {
          const parent = lives.get(event.parentId);
          assert.ok(parent, 'parent must have its complete earlier observation history');
          parent.firstActualOffspringTick ??= event.tick;
          assert.deepEqual(event.parentStoresBefore, event.parentStoresAfter);
          assert.ok(event.childStoresAtBirth.every((v) => v === 0));
          for (let e = 0; e < 7; e++) assert.ok(Math.abs(event.parentBiomassBefore[e]
            - event.parentBiomassAfter[e] - event.childBiomassAtBirth[e]) < 1e-12);
        }
      } else {
        const life = lives.get(event.id);
        assert.ok(life, 'every selected record must follow the observed birth/endowment');
        if (kind === 'death') life.deathTick = event.tick;
        else {
          life.gateObservations++;
          if (event.lacking === 'none') {
            life.firstMatterAffordableTick ??= event.tick;
            if (event.age >= event.maturityAge) life.firstMatureMatterAffordableTick ??= event.tick;
          }
        }
      }
    }
  }
}
assert.equal(w.hashState(), prior.finalHash);
assert.equal(w.totalBirths, prior.births);
for (const life of lives.values()) {
  const last = life.deathTick ?? protocol.ticks;
  assert.equal(life.gateObservations, last - life.birthTick, 'all post-birth pre-death/horizon gate observations present');
}
gzip.end();
await streamDone;
const summary = [...lives.values()].sort((a, b) => a.id - b.id);
writeFileSync(join(out, 'life-summaries.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(out, 'complete.json'), JSON.stringify({ seed, births: w.totalBirths,
  selectedFamiliesIndividuals: summary.length, counts: consumed, finalHash: w.hashState(),
  allKindCounts: w.chemistryBoundaryTrace('birthTransfer').counts,
  retention: 'birthTransfer/offspringGate/death drained losslessly each tick; other kinds intentionally undrained and not part of these family histories',
  parity: 'exact ordinary every tick, broad at protocol checkpoints' }));
console.log(`COMPLETE seed=${seed} births=${w.totalBirths} selectedIndividuals=${summary.length}`);
