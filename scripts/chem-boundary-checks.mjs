/** Nonperturbation and bounded-copy checks; imports only compiled engine. */
import assert from 'node:assert/strict';
import { boundaryStateDigest } from './boundary-state-digest.mjs';
import { World } from '../build/world/world.js';
import { REACTIONS } from '../build/bio/metabolism.js';
import { ChemBoundaryLog } from '../build/trace/chem-boundary.js';

for (const capacity of [0, -1, 1.5, NaN, Infinity]) {
  assert.throws(() => new World({ chemBoundary: { capacity } }), /positive safe integer/);
}
const ring = new ChemBoundaryLog(2);
for (let id = 0; id < 5; id++) ring.record({ kind: 'death', id, tick: id, parentId: -1, age: id, guild: 0, maturityAge: 1 });
assert.deepEqual(ring.snapshot().events.map((e) => e.id), [3, 4]);
assert.equal(ring.snapshot().dropped, 3);
assert.equal(ring.snapshot('death', 0).unreadLost, 3);
assert.deepEqual(ring.snapshot('death', 4).events.map((e) => e.id), [4]);
assert.equal(ring.snapshot('death', 5).returned, 0);
assert.throws(() => ring.snapshot('death', 6), /sinceCount/);

for (const seed of [517, 24601]) for (const chemistry of [null, true]) for (const genomeV2 of [null, true]) {
  const config = { seed, founders: 400, chemistry, genomeV2 };
  const plain = new World({ config });
  const traced = new World({ config, chemBoundary: { capacity: 128 } });
  const repeat = new World({ config, chemBoundary: { capacity: 128 }, trace: { enabled: true, capacity: 64 } });
  assert.equal(plain.chemistryBoundaryTrace(), null);
  const horizon = chemistry ? 600 : 120;
  for (let tick = 0; tick <= horizon; tick++) {
    assert.equal(plain.hashState(), traced.hashState(), `run digest parity tick ${tick}`);
    assert.equal(traced.hashState(), repeat.hashState());
    if ([0, 32, 120, 600].includes(tick)) {
      assert.equal(boundaryStateDigest(plain), boundaryStateDigest(traced), `broad byte parity tick ${tick}`);
      assert.equal(boundaryStateDigest(traced), boundaryStateDigest(repeat));
    }
    if (tick < horizon) { plain.step(); traced.step(); repeat.step(); }
  }
  const log = traced.chemistryBoundaryTrace();
  assert.deepEqual(log, repeat.chemistryBoundaryTrace(), 'repeat trace byte-equivalent values');
  assert.ok(log.events.length <= 5 * 128);
  assert.equal(log.total - log.events.length, log.dropped);
  if (chemistry) {
    assert.ok(log.counts.chemistry > 0 && log.counts.offspringGate > 0);
    assert.ok(log.counts.birthTransfer >= 400, 'founder endowment recorded');
    if (seed === 517 && genomeV2) assert.ok(log.events.some((e) => e.kind === 'birthTransfer' && e.parentId >= 0),
      'live parent-child transfer witness is required, not just founders');
    for (const event of log.events.filter((e) => e.kind === 'birthTransfer' && e.parentId >= 0)) {
      assert.deepEqual(event.parentStoresBefore, event.parentStoresAfter, 'tissue transfer does not give away stores');
      assert.ok(event.childStoresAtBirth.every((v) => v === 0), 'offspring starts without transferred nutrient stores');
      for (let e = 0; e < 7; e++) {
        const loss = event.parentBiomassBefore[e] - event.parentBiomassAfter[e];
        assert.ok(Math.abs(loss - event.childBiomassAtBirth[e]) < 1e-12, 'per-element parent-child transfer closes');
      }
    }
    assert.ok(log.events.some((e) => e.kind === 'death' && e.biomassAtDeath?.[0] > 0),
      'death witness must retain actual pre-release carbon, not cleared zeros');
    for (const event of log.events.filter((e) => e.kind === 'offspringGate')) {
      assert.equal(event.storesAfter.length, 7);
      assert.equal(event.biomassAfter.length, 7);
      for (const field of ['maturityAge', 'age', 'cooldown', 'energyFraction', 'threshold', 'damage']) {
        assert.ok(Number.isFinite(event[field]), `gate ${field} must be measured`);
      }
      assert.ok(['none', 'nutrient', 'carbon'].includes(event.lacking));
    }
    for (const event of log.events.filter((e) => e.kind === 'chemistry')) {
      assert.equal(event.uptake.length, 7);
      assert.equal(event.reactionGross.length, REACTIONS.length);
      for (let pool = 0; pool < event.remainingBefore.length; pool++) {
        const gross = event.reactionGross.reduce((s, rx) => s + rx[pool], 0);
        const observed = event.remainingBefore[pool] - event.remainingAfterReactions[pool];
        assert.ok(Math.abs(gross - observed) <= 1e-10 * Math.max(1, gross), 'gross extent matches observed reservation');
      }
    }
  }
  const before = boundaryStateDigest(traced);
  const birthsOnly = traced.chemistryBoundaryTrace('birthTransfer');
  assert.ok(birthsOnly.events.every((e) => e.kind === 'birthTransfer'));
  assert.deepEqual(birthsOnly.counts, log.counts);
  assert.equal(birthsOnly.dropped, log.dropped, 'filtering does not count unrequested kinds as dropped');
  if (log.events.length) {
    log.events[0].id = -999;
    assert.notEqual(traced.chemistryBoundaryTrace().events[0].id, -999);
  }
  assert.equal(boundaryStateDigest(traced), before, 'editing detached trace cannot mutate biology');
  console.log(JSON.stringify({ seed, chemistry, genomeV2, horizon,
    counts: log.counts, dropped: log.dropped, hash: traced.hashState(),
    broadDigest: before, parity: 'exact', repeatedTrace: true }));
}
