/**
 * Doc/evidence figure consistency guard.
 *
 * A verdict document quoting a number from a RETIRED evidence panel is the
 * failure this repository has made repeatedly (0.5.0, 0.6.0, chem/0.7.2). The
 * only reliable defence is to state, per figure, which raw file it came from,
 * and to check that the figure is actually present in that file.
 *
 * Figures are declared as {label, expected, mustContain} against a named raw
 * file. A missing figure fails loudly rather than drifting.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { checkReactionEvidence, checkDescendantEvidence } from './check-rxomit-evidence.mjs';
import { reactionEvidenceFixtures } from './rxomit-evidence-fixtures.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raw = {
  cohort: read(join(root, 'evidence', 'chem-cohort-1000-077-20261013.txt')),
  matrix: read(join(root, 'evidence', 'chem-matrix-91011-077-20261013.txt')),
  knob: read(join(root, 'evidence', 'chem-predation-knob-10seed-077-20261013.txt')),
};
// The raw panels must themselves carry the CURRENT composite identity, so a
// version bump with stale evidence fails rather than silently passing.
const versionSrc = read(join(root, 'src', 'world', 'version.ts'));
const worldV = /WORLD_ENGINE_VERSION = '([^']+)'/.exec(versionSrc)?.[1] ?? '';
const chemV = /CHEMISTRY_ENGINE_VERSION = '([^']+)'/.exec(versionSrc)?.[1] ?? '';
const expectedIdentity = `${worldV}+${chemV}`;
// Live qualification is separate from the archived chemistry panels below.
{
  const doc = read(join(root, 'CHEM-078-CORRECTIONS.md'));
  const rows = read(join(root, 'evidence/chem078-final-targeted-20261015.jsonl')).trim().split('\n').map(JSON.parse);
  assert.equal(rows[0].identity, expectedIdentity);
  assert.ok(doc.includes(expectedIdentity));
  assert.equal(rows.filter((r) => r.decision === 'D1').length, 20);
  assert.equal(rows.filter((r) => r.decision === 'D2').length, 45);
  const live = rows.find((r) => r.decision === 'D1-live');
  assert.ok(live?.positiveGrowth > 0 && live.perElementPostconditions);
  assert.equal(live.flux, live.ledger);
  for (const kind of ['half-P', 'half-Fe', 'absent-Fe', 'abundant', 'energy-limited']) {
    const r = rows.find((r) => r.decision === 'D1' && r.kind === kind && r.requestedCarbon === 0.012);
    assert.ok(r);
    const quoted = `| ${kind} | 0.012 | ${Number(r.builtCarbon.toPrecision(12))} |`;
    assert.ok(doc.includes(quoted), `missing D1 measured figure: ${quoted}`);
  }
  for (const scale of [0.5, 1, 2]) for (const element of [0, 3, 4, 5, 6]) {
    for (const boundary of ['below', 'exact', 'above']) {
      const r = rows.find((r) => r.decision === 'D2' && r.scale === scale && r.element === element && r.boundary === boundary);
      assert.equal(r?.ok, boundary !== 'below');
    }
  }
  const dir = join(root, 'evidence/chem078-final-20261015');
  const protocol = JSON.parse(read(join(dir, 'protocol.json')));
  const complete = JSON.parse(read(join(dir, 'complete.json')));
  const current = read(join(dir, 'runs.jsonl')).trim().split('\n').map(JSON.parse);
  const pairs = read(join(dir, 'comparisons.jsonl')).trim().split('\n').map(JSON.parse);
  assert.equal(protocol.identity, expectedIdentity);
  assert.equal(complete.uniqueRuns, 4);
  assert.equal(complete.executions, 8);
  assert.equal(complete.repeatsExact, 4);
  assert.equal(complete.legacyControlsMatched, 2);
  assert.equal(current.length, 4);
  assert.equal(pairs.length, 4);
  assert.equal(new Set(pairs.map((r) => `${r.arm}:${r.seed}`)).size, 4);
  for (const pair of pairs) {
    const { trajectory, ...record } = current.find((r) => r.seed === pair.seed && r.arm === pair.arm) ?? {};
    assert.deepEqual(record, pair.after);
    assert.equal(record.tick, protocol.ticks);
    if (pair.arm === 'legacy') assert.deepEqual(pair.after, pair.before);
    else {
      assert.equal(pair.before.identity, 'ts-evo-poc/0.8.0+chem/0.7.7');
      assert.equal(pair.after.identity, expectedIdentity);
      for (const when of ['before', 'after']) for (const element of ['C', 'H', 'O']) {
        assert.equal(pair[when].chemistry.elementalResiduals.find((r) => r.element === element)?.ok, false,
          'quoted inherited strict-audit limitation must remain visible in raw evidence');
      }
    }
    assert.ok(doc.includes(`| ${pair.seed} | ${pair.arm} | ${pair.before.population} | ${pair.after.population} | ${pair.before.births} | ${pair.after.births} |`));
  }
}
// Fixed identity of the reconciled investigation panels. A live chemistry bump
// does not relabel archived cohorts or make their numbers current again.
const reconciledIdentity = 'ts-evo-poc/0.8.0+chem/0.7.7';
// These cases intentionally protect the retained historical 0.7.0 panel.
// Current 0.8.0 measurements are checked separately below, never relabelled.
const historicalIdentity = 'ts-evo-poc/0.7.0+chem/0.7.7';
const RAW_FILES = [
  'evidence/chem-cohort-1000-077-20261013.txt',
  'evidence/chem-matrix-91011-077-20261013.txt',
  'evidence/chem-predation-knob-10seed-077-20261013.txt',
];
for (const rel of RAW_FILES) {
  const head = read(join(root, rel)).split('\n')[0];
  if (!head.includes(historicalIdentity)) {
    console.error(`[FAIL] historical raw identity: ${rel} does not carry ${historicalIdentity}`);
    console.error(`       first line: ${head}`);
    process.exitCode = 1;
  }
}
const docs = {
  prereg: read(join(root, 'PREREGISTRATION-070-RESULTS.md')),
  matrixDoc: read(join(root, 'PREDECLARATION-H9H10-077-RESULTS.md')),
  inventory: read(join(root, 'EVIDENCE-INVENTORY.md')),
  predation: read(join(root, 'CHEM-PREDATION-KNOB-DIAGNOSTICS.md')),
};
const currentDoc = read(join(root, 'RECONCILIATION-080-RESULTS.md'));
// Reconstruct selected-family timing from raw compressed events, not merely
// the runner's summary. This remains a descriptive, outcome-selected witness.
{
  const dir = join(root, 'evidence/chem-firstbirth-41001-20261015');
  const protocol = JSON.parse(read(join(dir, 'protocol.json')));
  const complete = JSON.parse(read(join(dir, 'complete.json')));
  const summaries = JSON.parse(read(join(dir, 'life-summaries.json')));
  const raw = gunzipSync(readFileSync(join(dir, 'families.jsonl.gz'))).toString('utf8');
  const doc = read(join(root, 'CHEM-FIRSTBIRTH-RESULTS.md'));
  assert.equal(protocol.identity, reconciledIdentity);
  assert.ok(doc.includes(reconciledIdentity));
  const lives = new Map();
  let births = 0;
  for (const line of raw.trim().split('\n')) {
    const e = JSON.parse(line);
    if (e.kind === 'birthTransfer') {
      assert.ok(!lives.has(e.id));
      lives.set(e.id, { id: e.id, parentId: e.parentId, birthTick: e.tick,
        firstMatterAffordableTick: null, firstMatureMatterAffordableTick: null,
        firstActualOffspringTick: null, deathTick: null, gateObservations: 0 });
      if (e.parentId >= 0) {
        births++;
        assert.ok(lives.has(e.parentId));
        lives.get(e.parentId).firstActualOffspringTick ??= e.tick;
        assert.deepEqual(e.parentStoresBefore, e.parentStoresAfter);
        assert.ok(e.childStoresAtBirth.every((v) => v === 0));
        for (let k = 0; k < 7; k++) assert.ok(Math.abs(e.parentBiomassBefore[k]
          - e.parentBiomassAfter[k] - e.childBiomassAtBirth[k]) < 1e-12);
      }
    } else {
      const life = lives.get(e.id);
      assert.ok(life);
      if (e.kind === 'death') life.deathTick = e.tick;
      else {
        assert.equal(e.kind, 'offspringGate');
        life.gateObservations++;
        if (e.lacking === 'none') {
          life.firstMatterAffordableTick ??= e.tick;
          if (e.age >= e.maturityAge) life.firstMatureMatterAffordableTick ??= e.tick;
        }
      }
    }
  }
  const rows = [...lives.values()].sort((a, b) => a.id - b.id);
  assert.deepEqual(rows, summaries);
  assert.equal(births, complete.births);
  assert.equal(rows.length, complete.selectedFamiliesIndividuals);
  for (const r of rows) assert.equal(r.gateObservations, (r.deathTick ?? protocol.ticks) - r.birthTick);
  for (const [cohort, test] of [['founders', (r) => r.parentId < 0], ['offspring', (r) => r.parentId >= 0]]) {
    const selected = rows.filter(test);
    const count = (key) => selected.filter((r) => r[key] !== null).length;
    const quoted = `| ${cohort} | ${selected.length} | ${count('firstMatterAffordableTick')} | ${count('firstMatureMatterAffordableTick')} | ${count('firstActualOffspringTick')} | ${count('deathTick')} |`;
    assert.ok(doc.includes(quoted), `firstbirth figure missing: ${quoted}`);
  }
  const firstTicks = rows.filter((r) => r.parentId < 0).map((r) => r.firstActualOffspringTick).sort((a, b) => a - b);
  assert.ok(doc.includes(`**${firstTicks.join(', ')}**`));
}
// The mechanism panel is descriptive, but its quoted figures still owe the
// record raw-data checks. Recompute them rather than trusting summary.json.
{
  const directory = join(root, 'evidence/mechanism-four-arm-20261015');
  const protocol = JSON.parse(read(join(directory, 'protocol.json')));
  const complete = JSON.parse(read(join(directory, 'complete.json')));
  const records = read(join(directory, 'runs.jsonl')).trim().split('\n').map(JSON.parse);
  const doc = read(join(root, 'MECHANISM-FOUR-ARM-RESULTS.md'));
  if (records.length !== 72 || complete.runs !== 72 || complete.historicalControlsMatched !== 36
    || new Set(records.map((r) => `${r.arm}:${r.seed}`)).size !== 72) throw new Error('incomplete mechanism panel');
  if (protocol.identity !== reconciledIdentity || !doc.includes(reconciledIdentity)) throw new Error('historical mechanism identity mismatch');
  for (const arm of protocol.arms) {
    const rows = records.filter((r) => r.arm === arm.name);
    if (rows.length !== 18 || new Set(rows.map((r) => r.seed)).size !== 18
      || rows.some((r) => !protocol.seeds.includes(r.seed) || r.tick !== 1000
        || !Number.isFinite(r.population) || !Number.isFinite(r.births))) throw new Error('bad mechanism arm');
    const pops = rows.map((r) => r.population).sort((a, b) => a - b);
    const mean = pops.reduce((a, b) => a + b, 0) / 18;
    const median = (pops[8] + pops[9]) / 2;
    const births = rows.reduce((s, r) => s + r.births, 0);
    const zero = rows.filter((r) => r.population === 0).length;
    const quoted = `| ${arm.name} | ${mean.toFixed(2)} | ${median} | ${births} | ${zero}/18 |`;
    if (!doc.includes(quoted)) throw new Error(`mechanism doc mismatch: ${quoted}`);
  }
}
// Pin the live plumbing claim to retained records, not to the helper fixture
// or a model of what the source should have measured.
{
  const directory = join(root, 'evidence/chem-boundary-live-20261015-v2');
  const protocol = JSON.parse(read(join(directory, 'protocol.json')));
  const complete = JSON.parse(read(join(directory, 'complete.json')));
  const records = read(join(directory, 'checkpoints.jsonl')).trim().split('\n').map(JSON.parse);
  if (complete.arms !== 4 || complete.checkpointsPerArm !== 6 || !complete.broadParity
    || records.length !== 24 || new Set(records.map((r) => `${r.arm}:${r.tick}`)).size !== 24) {
    throw new Error('incomplete corrected live witness');
  }
  const events = records.filter((r) => r.arm === 'advanced').flatMap((r) => r.trace.events)
    .filter((e) => e.kind === 'chemistry');
  for (const [name, pool, element] of [['nitrification', 2, 3], ['iron oxidation', 8, 6], ['iron uptake', 8, 6]]) {
    const id = protocol.reactions.indexOf(name);
    if (id < 0 || !events.some((e) => e.reactionExtents[id] > 0 && e.remainingBefore[pool] > 0
      && e.remainingAfterReactions[pool] === 0 && e.uptake[element] === 0)) {
      throw new Error(`missing live reaction/reservation/zero-uptake witness: ${name}`);
    }
  }
}
if (!currentDoc.includes(reconciledIdentity)) throw new Error('historical reconciliation identity mismatch');
const currentPredation = read(join(root, 'evidence/chem-predation-knob-10seed-080-20261014.txt'));
const sexualTotals = ['base', 'predationMatter'].map((arm) => {
  const block = currentPredation.split(`--- ${arm} ---`)[1].split(`${arm}:`)[0];
  const values = [...block.matchAll(/\(sex (\d+)\)/g)].map((m) => Number(m[1]));
  if (values.length !== 10) throw new Error('incomplete sexual-birth panel');
  return values.reduce((a, b) => a + b, 0);
});
if (!currentDoc.includes(`Sexual births total ${sexualTotals.join('→')}`)) {
  throw new Error('current sexual-birth totals mismatch');
}
for (const [rel, rawFigure, docFigure] of [
  ['evidence/chem-cohort-1000-080-20261014.txt', 'ratio med 1705.0', 'ratio median 1705.0'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'segregates on 5/10 seeds', 'segregation 5/10'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'median terminal population 9', 'terminal population median 9'],
  ['evidence/chem-matrix-91011-080-20261014.txt', 'legacyDetritus med     585', '297→585'],
  ['evidence/chem-predation-knob-10seed-080-20261014.txt', 'matterC med 8.2015', 'median carbon transferred 8.2015'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'nutrients present : births min 3 med 9.5 max 42', 'reproduction nonzero 10/10 with nutrients'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'nutrients removed : births min 0 med 0 max 0', 'zero 10/10 without'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'hypoxic fraction  nonzero on 0/10 seeds', 'hypoxic fraction all zero'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'iron oxidation       nonzero on 10/10 seeds  median 49.11', 'median 49.11'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'chemOff        pop med   598  [326..1337]', '598 (326–1337)'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'base           pop med     9  [3..35]', '9 (3–35)'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'base     producer births on 9/10 | consumer 4/10 | DECOMPOSER 0/10', '| chemistry on | 9/10 | 4/10 | 0/10 |'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'asexual births total 147 | sexual births total 6 | max gd 1 | mean gd 0.029', '| 147 | 6 | 1 | 0.029 |'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'chemOff  producer births on 10/10 | consumer 10/10 | DECOMPOSER 1/10', '| chemistry off | 10/10 | 10/10 | 1/10 |'],
  ['evidence/chem-cohort-1000-080-20261014.txt', 'asexual births total 2997 | sexual births total 70 | max gd 1 | mean gd 0.047', '| 2997 | 70 | 1 | 0.047 |'],
  ['evidence/chem-matrix-91011-080-20261014.txt', 'base               pop med     7 [3..35]  births med     9  OC med    1587  DIC med     23152', 'DIC 23152→661131, OC 1587→1592'],
  ['evidence/chem-matrix-91011-080-20261014.txt', 'OC med    1592  DIC med    661131', 'organic-carbon supply did not vary'],
  ['evidence/chem-matrix-91011-080-20261014.txt', 'H10 bridge         pop med     7', 'population median unchanged at 7'],
  ['evidence/chem-matrix-91011-080-20261014.txt', 'H11 both           pop med     6', 'combined population 6, versus single arms 6 and 7'],
  ['evidence/chem-matrix-91011-080-20261014.txt', 'ref freeNutrients  pop med    25 [17..178]  births med    56', 'median 25 (17–178)'],
  ['evidence/chem-matrix-91011-080-20261014.txt', 'births med    56', 'births median 56'],
  ['evidence/chem-predation-knob-10seed-080-20261014.txt', 'predationMatter: pop med 8 [3..33] | births med 10', 'population median 9→8'],
  ['evidence/chem-predation-knob-10seed-080-20261014.txt', 'C residual med 0.0002%', 'Carbon residual median 0.0002%'],
  ['evidence/reconciliation-080-gates-20261014.txt', '= 9.646%', 'Current G33 chemical-income share is 9.646%'],
  ['evidence/reconciliation-080-gates-20261014.txt', 'income 2478.74', 'income 2478.74'],
  ['evidence/reconciliation-080-gates-20261014.txt', 'spend 147.60', 'spend 147.60'],
  ['evidence/reconciliation-080-gates-20261014.txt', 'base residual 0.00011%', 'energy residual 0.00011%'],
]) {
  if (!read(join(root, rel)).includes(rawFigure) || !currentDoc.includes(docFigure)) {
    throw new Error(`current figure mismatch: ${docFigure}`);
  }
}
for (const rel of [
  'evidence/chem-cohort-1000-080-20261014.txt',
  'evidence/chem-matrix-91011-080-20261014.txt',
  'evidence/chem-predation-knob-10seed-080-20261014.txt',
]) {
  if (!read(join(root, rel)).split('\n')[0].includes(reconciledIdentity)) {
    throw new Error(`historical raw identity mismatch: ${rel}`);
  }
}
for (const doc of [docs.prereg, docs.matrixDoc, docs.predation]) {
  if (!doc.includes('HISTORICAL after main reconciliation')) {
    throw new Error('retained panel is not explicitly historical');
  }
}

// [docKey, rawKey, label, exactStringInRaw, exactStringInDoc]
const CASES = [
  ['prereg', 'cohort', 'H1 median ratio', 'ratio med 1593.4', '1593.4:1'],
  ['prereg', 'cohort', 'H5 segregation', 'segregates on 6/10 seeds', 'only 6/10 seeds'],
  ['prereg', 'cohort', 'H4 iron median', 'iron oxidation       nonzero on 10/10 seeds  median 49.34', 'median 49.34 extent'],
  ['prereg', 'cohort', 'H7 terminal median', 'median terminal population 8', 'median terminal pop 8'],
  ['prereg', 'cohort', 'cohort base pop', 'base           pop med     8  [2..36]  births med     9', 'median 8 (range 2–36)'],
  ['prereg', 'cohort', 'chemOff pop', 'pop med   640  [391..1520]', 'median 640 (range 391–1520)'],

  ['matrixDoc', 'matrix', 'H9 DIC 29x', 'DIC med    661130', '23,133 →\n661,130'],
  ['matrixDoc', 'matrix', 'H9 OC flat', 'OC med    1598  DIC med    661130', '1,597 → 1,598'],
  ['matrixDoc', 'matrix', 'H10 detritus', 'H10 bridge         pop med     5 [4..42]  births med     8  OC med    1600  DIC med     23142  legacyDetritus med     572', '286 → 572'],
  ['matrixDoc', 'matrix', 'H10 base row', 'base               pop med     5 [3..36]  births med     8  OC med    1597  DIC med     23133  legacyDetritus med     286', '| base | 5 | 3–36 | 8 | 1597 | 23133 | 286 |'],
  ['matrixDoc', 'matrix', 'H11 combined', 'H11 both           pop med     5 [3..48]  births med     9  OC med    1602  DIC med    661139  legacyDetritus med     559', 'The combination (5) is no better than either single arm (5 and 5)'],
  ['matrixDoc', 'matrix', 'freeNutrients arm', 'ref freeNutrients  pop med    26 [9..182]  births med    62', 'median 26 (9–182)'],

  ['inventory', 'matrix', 'H10 row', 'legacyDetritus med     572', 'detritus 286→572, pop 5→5'],
  ['inventory', 'matrix', 'H11 row', 'H11 both           pop med     5 [3..48]', '5 vs 5 and 5'],
  ['inventory', 'cohort', 'H7 row', 'median terminal population 8', 'median terminal pop 8'],

  ['predation', 'knob', 'predation median pop', 'predationMatter: pop med 9', '| predationMatter | 9 | 3–40 | 9 | 5.9226 mol'],
  ['predation', 'knob', 'predation matter carbon', 'matterC med 5.9226', '5.9226 mol'],
  ['predation', 'knob', 'sexual births base', '8080: pop 33 births 36 (sex 4)', 'base: 4 sexual births (seeds 8080)'],
  ['predation', 'knob', 'sexual births matter', 'predationMatter: pop med 9 [3..40] | births med 9 (sex med 0) | matterC med 5.9226', 'predationMatter: 6 sexual births (seeds 517, 8080)'],
  ['predation', 'knob', 'predation per-seed 8080', '8080: pop 19 births 20 (sex 4)', '| 8080 | 33 | 19 | -14 | 36 | 20 | -16 | 15.8937 |'],

  // Three-guild coexistence and generation depth: previously quoted from a
  // retired panel with no current measurement behind them.
  ['inventory', 'cohort', 'decomposer chem-on', 'base     producer births on 8/10 | consumer 4/10 | DECOMPOSER 0/10', '| chemistry ON (`base`) | 8/10 | 4/10 | **0/10** |'],
  ['inventory', 'cohort', 'decomposer chem-off', 'chemOff  producer births on 10/10 | consumer 10/10 | DECOMPOSER 2/10', '| chemistry OFF | 10/10 | 10/10 | **2/10** |'],
  ['inventory', 'cohort', 'pathway totals', 'base     asexual births total 166 | sexual births total 4 | max gd 1 | mean gd 0.012', '| chemistry ON | 166 | 4 | 1 | 0.012 |'],
  ['inventory', 'cohort', 'pathway totals off', 'chemOff  asexual births total 2787 | sexual births total 52 | max gd 3 | mean gd 0.033', '| chemistry OFF | 2787 | 52 | 3 | 0.033 |'],
];

let failed = 0;
for (const [docKey, rawKey, label, inRaw, inDoc] of CASES) {
  const rawOk = raw[rawKey].includes(inRaw);
  const docOk = docs[docKey].includes(inDoc);
  if (!rawOk || !docOk) {
    failed++;
    console.error(`[FAIL] ${label}: rawHit=${rawOk} docHit=${docOk}`
      + `  expected raw=${JSON.stringify(inRaw)} doc=${JSON.stringify(inDoc)}`);
  }
}

console.log(`\n${CASES.length - failed}/${CASES.length} doc figures match their current raw evidence`);
console.log(`historical figures preserved at ${reconciledIdentity}; live identity ${expectedIdentity} checked separately`);
checkDescendantEvidence(root, await checkReactionEvidence(root));
await reactionEvidenceFixtures(root);
process.exit(failed > 0 || process.exitCode ? 1 : 0);

function read(p) {
  if (!existsSync(p)) { console.error(`missing file: ${p}`); process.exit(1); }
  return readFileSync(p, 'utf8');
}
function resolve(...parts) { return join(...parts); }
