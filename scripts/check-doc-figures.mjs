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
if (!currentDoc.includes(expectedIdentity)) throw new Error('current results identity mismatch');
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
  if (!read(join(root, rel)).split('\n')[0].includes(expectedIdentity)) {
    throw new Error(`current raw identity mismatch: ${rel}`);
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
console.log(`historical figures preserved; current raw identity ${expectedIdentity} checked separately`);
process.exit(failed > 0 || process.exitCode ? 1 : 0);

function read(p) {
  if (!existsSync(p)) { console.error(`missing file: ${p}`); process.exit(1); }
  return readFileSync(p, 'utf8');
}
function resolve(...parts) { return join(...parts); }
