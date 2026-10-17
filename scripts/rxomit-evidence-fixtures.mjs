/** Cheap corrupt-archive fixtures; hardlinks are unlinked before replacement. */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdirSync, mkdtempSync, linkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { checkReactionEvidence, checkDescendantEvidence } from './check-rxomit-evidence.mjs';
import { DescendantReadout, validateTrialDemographics } from './rxomit-descendant-readout.mjs';

export async function reactionEvidenceFixtures(root) {
  mkdirSync(join(root, 'build'), { recursive: true });
  validateTrialDemographics({ population: 0, births: 0, deaths: 400 }, 400);
  validateTrialDemographics({ population: 425, births: 25, deaths: 0 }, 400);
  for (const bad of [
    { population: -1, births: 0, deaths: 401 },
    { population: 1.5, births: 0, deaths: 0 },
    { population: NaN, births: 0, deaths: 0 },
    { population: 425, births: 25, deaths: 1 },
  ]) assert.throws(() => validateTrialDemographics(bad, 400));
  const lineage = new DescendantReadout();
  const birth = (id, parentId, childId, tick) => ({ stage: 'placement', outcome: 'placed', id, parentId, childId, age: tick, tick });
  lineage.observe(birth(10, -1, 11, 1));
  lineage.observe(birth(11, 10, 12, 2));
  lineage.observe(birth(12, 11, 13, 3));
  lineage.observe({ id: 10, parentId: -1, age: 1, tick: 1, stage: 'energyFraction', outcome: 'blocked', passedGates: ['dormancy', 'cooldown'] });
  lineage.observe({ id: 11, parentId: 10, age: 2, tick: 3, stage: 'lottery', outcome: 'blocked', passedGates: ['dormancy', 'cooldown', 'energyFraction', 'matter', 'maturity', 'damage', 'surplus', 'drive'] });
  lineage.observe({ id: 11, parentId: 10, age: 2, tick: 3, stage: 'matePairIntent', outcome: 'pairRejected', passedGates: [] });
  const family = lineage.finish(3);
  assert.equal(family.founderProducedChildren, 1);
  assert.equal(family.offspringProducedChildren, 2);
  assert.equal(family.exactGrandchildren, 1);
  assert.equal(family.laterDescendantBirths, 1);
  assert.equal(family.uniqueReproducingNonfounders, 2);
  assert.equal(family.firstGrandchildOrLaterTick, 2);
  assert.deepEqual(family.firstFailedProposalGates.founders, { energyFraction: 1 });
  assert.deepEqual(family.firstFailedProposalGates.offspring, { lottery: 1 });
  assert.equal(family.reachedProposalGates.offspring.maturity, 1);
  const missing = new DescendantReadout();
  missing.observe(birth(11, 10, 12, 2));
  const gap = missing.finish(1);
  assert.equal(gap.status, 'INCOMPLETE');
  assert.equal(gap.offspringProducedChildren, null, 'missing ancestry is not a measured zero');
  const duplicate = new DescendantReadout();
  duplicate.observe(birth(10, -1, 11, 1));
  assert.throws(() => duplicate.observe(birth(12, -1, 11, 2)), /exactly one recorded birth/);
  const inconsistent = new DescendantReadout();
  inconsistent.observe(birth(10, -1, 11, 1));
  assert.throws(() => inconsistent.observe(birth(11, 9, 12, 2)), /parent identity/);
  assert.throws(() => lineage.finish(99), /reconcile to all births/);
  const unknown = new DescendantReadout();
  unknown.observe({ id: -1, parentId: -1, age: -1, tick: 1, stage: 'energyFraction', outcome: 'blocked', passedGates: [] });
  unknown.observe(birth(-1, -1, 20, 2));
  unknown.observe(birth(-1, -1, 21, 3));
  assert.equal(unknown.finish(2).status, 'INCOMPLETE');
  assert.equal(unknown.finish(2).offspringProducedChildren, null);
  assert.equal(unknown.parentOf.size, 0, 'unknown producers must not enter the ancestry graph');
  const published = join(root, 'evidence/rxomit-descendants-20261016');
  const rows = JSON.parse(readFileSync(join(published, 'scoreboard.json'), 'utf8'));
  for (const kind of ['wrong-derived-count', 'wrong-doc-figure']) {
    const fixture = mkdtempSync(join(root, 'build/rxomit-derived-fixture-'));
    const dir = join(fixture, 'evidence/rxomit-descendants-20261016');
    mkdirSync(dir, { recursive: true });
    for (const file of ['scoreboard.json', 'complete.json', 'provenance.json']) linkSync(join(published, file), join(dir, file));
    const doc = readFileSync(join(root, 'RXOMIT-DESCENDANT-SCOREBOARD.md'), 'utf8');
    writeFileSync(join(fixture, 'RXOMIT-DESCENDANT-SCOREBOARD.md'), kind === 'wrong-doc-figure' ? doc.replace('| 41001 | control | 27 |', '| 41001 | control | 28 |') : doc);
    if (kind === 'wrong-derived-count') {
      const changed = structuredClone(rows);
      changed[0].founderProducedChildren++;
      unlinkSync(join(dir, 'scoreboard.json'));
      writeFileSync(join(dir, 'scoreboard.json'), JSON.stringify(changed));
    }
    assert.throws(() => checkDescendantEvidence(fixture, rows), { code: 'ERR_ASSERTION' });
  }
  console.log('Derived evidence fixtures: altered counts/doc figures rejected; unknown ancestry remains incomplete.');
  console.log('Demography fixtures: extinction/growth accepted, corrupt counters rejected; ancestry and missing-data semantics passed.');
  const source = join(root, 'evidence/rxomit-rapid-20261016');
  const results = [];
  for (const kind of ['missing-completion', 'wrong-selector', 'corrupt-gzip', 'missing-gates']) {
    const fixture = mkdtempSync(join(root, 'build/rxomit-fixture-'));
    const dir = join(fixture, 'evidence/rxomit-rapid-20261016');
    mkdirSync(dir, { recursive: true });
    for (const file of readdirSync(source)) linkSync(join(source, file), join(dir, file));
    const baseline = join(fixture, 'evidence/chem078-final-20261015');
    mkdirSync(baseline, { recursive: true });
    linkSync(join(root, 'evidence/chem078-final-20261015/runs.jsonl'), join(baseline, 'runs.jsonl'));
    linkSync(join(root, 'RXOMIT-RAPID-RESULTS.md'), join(fixture, 'RXOMIT-RAPID-RESULTS.md'));
    const replace = (file, bytes) => { unlinkSync(join(dir, file)); writeFileSync(join(dir, file), bytes); };
    if (kind === 'missing-completion') unlinkSync(join(dir, 'complete.json'));
    if (kind === 'wrong-selector') replace('control-41001-config.json', JSON.stringify({
      ...JSON.parse(readFileSync(join(source, 'control-41001-config.json'), 'utf8')), chemistryReactionOmit: 'nitrification',
    }));
    if (kind === 'corrupt-gzip') replace('control-41001-events.jsonl.gz', 'not gzip');
    if (kind === 'missing-gates') replace('control-41001-events.jsonl.gz', gzipSync(''));
    let error;
    try { await checkReactionEvidence(fixture); } catch (e) { error = e; }
    assert.ok(error, `${kind} must fail loudly`);
    if (kind === 'missing-completion') assert.equal(error.code, 'ENOENT');
    else if (kind === 'corrupt-gzip') assert.equal(error.code, 'Z_DATA_ERROR');
    else if (kind === 'missing-gates') { assert.equal(error.actual, 0); assert.equal(error.expected, 1000); }
    else assert.equal(error.code, 'ERR_ASSERTION');
    results.push({ kind, rejected: true, error: error.code });
  }
  console.log(`Reaction evidence negative fixtures: ${results.length}/${results.length} corrupt/missing archives rejected.`);
  return results;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await reactionEvidenceFixtures(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
}
