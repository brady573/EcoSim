/** Streaming provenance/measurement guard for the fixed rapid trial archive. */
import assert from 'node:assert/strict';
import { readFileSync, createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function checkReactionEvidence(root) {
  const dir = join(root, 'evidence/rxomit-rapid-20261016');
  const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
  const protocol = read('protocol.json');
  const complete = read('complete.json');
  const summary = read('summary.json');
  const reachability = read('reachability.json');
  const doc = readFileSync(join(root, 'RXOMIT-RAPID-RESULTS.md'), 'utf8');
  const prior = readFileSync(join(root, 'evidence/chem078-final-20261015/runs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(complete.uniqueRuns, 8);
  assert.equal(complete.executions, 16); // primary full-horizon plain/traced pairs; prefix references separate
  assert.equal(complete.observerParity, true);
  assert.equal(complete.unreadLoss, 0);
  assert.equal(summary.length, 8);
  assert.equal(new Set(summary.map((r) => `${r.seed}:${r.omission}`)).size, 8);
  assert.equal(reachability.length, 6);
  for (const seed of protocol.seeds) {
    const controlConfig = read(`control-${seed}-config.json`);
    for (const omission of protocol.arms) {
      const name = omission === null ? 'control' : omission.replaceAll(' ', '-');
      const result = read(`${name}-${seed}-result.json`);
      assert.deepEqual(result, summary.find((r) => r.seed === seed && r.omission === omission));
      assert.equal(result.tick, protocol.ticks);
      assert.ok(result.population > 0 && result.population < protocol.founders, 'quoted terminal outcome must match archived population range');
      assert.ok(doc.includes(`| ${seed} | ${omission ?? 'control'} | ${result.population} | ${result.births} | ${result.uptake[3].toFixed(3)} | ${result.uptake[6].toFixed(6)} |`), 'trial figure must match raw measured record');
      assert.equal(result.identity, 'ts-evo-poc/0.8.0+chem/0.7.8' + (omission === null ? '' : `+rxomit/1/${name}`));
      assert.deepEqual(read(`${name}-${seed}-config.json`), { ...controlConfig, chemistryReactionOmit: omission });
      if (omission === null) {
        const old = prior.find((r) => r.seed === seed && r.arm === 'advanced');
        assert.equal(result.finalHash, old.finalHash);
        assert.equal(result.population, old.population);
        assert.equal(result.births, old.births);
        assert.equal(result.deaths, old.deaths);
        assert.equal(result.chemicalIncome, old.chemistry.income);
        assert.equal(result.carbonBuilt, old.chemistry.carbonBuilt);
      } else {
        const id = protocol.reactions.indexOf(omission);
        assert.ok(id >= 0);
        assert.equal(result.extents[id], 0);
        const baseline = summary.find((r) => r.seed === seed && r.omission === null);
        assert.deepEqual(reachability.find((r) => r.seed === seed && r.target === omission), {
          seed, target: omission, controlExtent: baseline.extents[id],
          status: baseline.extents[id] > 0 ? 'measured' : 'vacuous: target absent, no effect interpretation',
        });
      }
      const gunzip = createGunzip();
      const pumped = pipeline(createReadStream(join(dir, `${name}-${seed}-events.jsonl.gz`)), gunzip);
      pumped.catch(() => {});
      const lines = createInterface({ input: gunzip, crlfDelay: Infinity });
      const counts = {};
      const seenTicks = new Set(), chemicalTicks = new Set();
      const sampledExtents = protocol.reactions.map(() => 0);
      let decisions = 0, ticks = 0, requested = 0, admitted = 0, rejected = 0, divergences = 0;
      for await (const line of lines) {
        const row = JSON.parse(line);
        if (row.kind === 'reproduction') {
          assert.ok(Number.isSafeInteger(row.tick) && row.tick >= 1 && row.tick <= protocol.ticks && !seenTicks.has(row.tick));
          seenTicks.add(row.tick);
          ticks++;
          for (const e of row.events) {
            assert.equal(e.tick, row.tick);
            assert.equal(e.kind, 'reproduction');
            assert.ok(typeof e.stage === 'string' && typeof e.outcome === 'string');
            const key = `${e.stage}/${e.outcome}/${e.pathway ?? 'proposal'}`;
            counts[key] = (counts[key] ?? 0) + 1; decisions++;
            if (e.stage.startsWith('matter:')) assert.ok(e.passedGates.includes('energyFraction') && e.passedGates.includes('cooldown'));
            if (['damage', 'surplus', 'drive', 'lottery'].includes(e.stage)) assert.ok(e.passedGates.includes('maturity'));
            if (e.stage === 'lottery') assert.ok(e.passedGates.includes('surplus') && e.passedGates.includes('drive'));
            if (e.stage === 'queue') requested += e.requestedChildren;
            if (e.stage === 'placement' && e.outcome === 'placed') admitted++;
            if (e.stage.startsWith('admission')) rejected++;
          }
        } else if (row.kind === 'firstDivergence') {
          divergences++;
          assert.equal(row.tick, result.firstDivergence.tick);
          assert.notEqual(row.controlAfter, row.omittedAfter);
          assert.match(row.before.projectedBroad, /^[0-9a-f]{64}$/);
          const target = protocol.reactions.indexOf(omission);
          assert.ok(target >= 0 && row.controlChemistry.some((e) => e.reactionExtents[target] > 0));
          const original = new Map(row.controlChemistry.map((e) => [e.id, e]));
          assert.ok(row.omittedChemistry.length > 0);
          for (const e of row.omittedChemistry) {
            assert.equal(e.reactionExtents[target], 0);
            assert.equal(e.capMask, original.get(e.id)?.capMask, 'initial intervention preserves expressed capabilities');
            assert.equal(e.cell, original.get(e.id)?.cell, 'initial intervention does not reposition organisms');
          }
        } else {
          assert.equal(row.kind, 'chemistrySample');
          assert.ok(protocol.sampledChemicalTicks.includes(row.tick) && !chemicalTicks.has(row.tick));
          chemicalTicks.add(row.tick);
          for (const e of row.events) {
            assert.equal(e.tick, row.tick);
            for (let r = 0; r < protocol.reactions.length; r++) sampledExtents[r] += e.reactionExtents[r];
            for (let p = 0; p < protocol.pools.length; p++) {
              const gross = e.reactionGross.reduce((s, rx) => s + rx[p], 0);
              assert.ok(Math.abs(gross - (e.remainingBefore[p] - e.remainingAfterReactions[p])) <= 1e-10 * Math.max(1, gross));
            }
            if (omission !== null) assert.equal(e.reactionExtents[protocol.reactions.indexOf(omission)], 0);
          }
        }
      }
      await pumped;
      assert.equal(ticks, protocol.ticks);
      assert.equal(chemicalTicks.size, protocol.sampledChemicalTicks.length);
      for (let r = 0; r < protocol.reactions.length; r++) assert.ok(result.extents[r] + 1e-12 >= sampledExtents[r], 'sampled reaction activity cannot exceed cumulative activity');
      assert.deepEqual(counts, result.gateCounts);
      assert.equal(decisions, result.consumed.reproduction);
      assert.equal(requested, admitted + rejected, 'every queued child has an admission outcome');
      assert.equal(admitted, result.births);
      assert.equal(divergences, result.firstDivergence === null ? 0 : 1);
    }
  }
  console.log('Rapid reaction evidence: 8 runs, retained reached decisions and sampled gross books verified.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await checkReactionEvidence(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
}
