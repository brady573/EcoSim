/** Post-hoc archive readout requested by review 5551158310. No World import. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReactionEvidence } from './check-rxomit-evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert.equal(args.length, 2, 'Usage: node scripts/rxomit-descendant-scoreboard.mjs --out NEW_DIRECTORY');
assert.equal(args[0], '--out');
const out = resolve(args[1]);
assert.ok(!existsSync(out), 'Refusing existing output');
const source = join(root, 'evidence/rxomit-rapid-20261016');
assert.ok(!out.startsWith(source + '/'), 'Do not modify original archives');
const sha = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const sourceDigests = {};
for (const name of readdirSync(source)) sourceDigests[name] = sha(join(source, name));
const analysisDigests = {};
for (const name of ['check-rxomit-evidence.mjs', 'rxomit-descendant-readout.mjs', 'rxomit-descendant-scoreboard.mjs']) {
  analysisDigests[`scripts/${name}`] = sha(join(root, 'scripts', name));
}
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'provenance.json'), JSON.stringify({
  review: 5551158310, sourceArchive: 'evidence/rxomit-rapid-20261016', sourceCommit: '77a82f4',
  analysisBaseSHA: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceDigests, analysisDigests, runtime: process.version,
  command: `node scripts/rxomit-descendant-scoreboard.mjs --out ${args[1]}`,
  scope: 'Post-hoc retained-evidence readout, no simulations. Uses placement id/parentId/childId producing/primary-parent edges, not generationDepth. Nonfounder-parent births include grandchildren and later descendants. Secondary genetic parents are not reconstructed.',
  gateScope: 'Counts of subject-tick actual proposal decisions, not unique individuals or exclusive physiological blockers. Pair/queue/admission events excluded from proposal-gate rankings.',
}, null, 2));
const rows = await checkReactionEvidence(root);
writeFileSync(join(out, 'scoreboard.json'), JSON.stringify(rows, null, 2));
const lines = ['| Seed | Omission | Founder children | Offspring-parent children | Exact grandchildren | Later descendants | Reproducing nonfounders | First grandchild tick |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |'];
for (const r of rows) {
  const value = (key) => r[key] === null ? 'not measured' : r[key];
  const first = r.status !== 'COMPLETE' ? 'not measured' : r.firstGrandchildOrLaterTick ?? 'not observed';
  lines.push(`| ${r.seed} | ${r.omission ?? 'control'} | ${value('founderProducedChildren')} | ${value('offspringProducedChildren')} | ${value('exactGrandchildren')} | ${value('laterDescendantBirths')} | ${value('uniqueReproducingNonfounders')} | ${first} |`);
}
writeFileSync(join(out, 'scoreboard.md'), lines.join('\n') + '\n');
const gates = ['| Seed | Omission | Cohort | Leading first failures (decision counts) | Reached maturity |',
  '| --- | --- | --- | --- | ---: |'];
for (const r of rows) for (const cohort of ['founders', 'offspring']) {
  const top = Object.entries(r.firstFailedProposalGates[cohort])
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, 3).map(([gate, count]) => `${gate} (${count})`).join('; ') || 'none observed';
  gates.push(`| ${r.seed} | ${r.omission ?? 'control'} | ${cohort} | ${top} | ${r.reachedProposalGates[cohort].maturity ?? 0} |`);
}
writeFileSync(join(out, 'proposal-gates.md'), gates.join('\n') + '\n');
if (rows.some((r) => r.status !== 'COMPLETE')) {
  console.error('INCOMPLETE descendant measurement: see exact dataGaps; no zero substituted.');
  process.exitCode = 1;
} else {
  writeFileSync(join(out, 'complete.json'), JSON.stringify({ runs: rows.length, primaryLineageComplete: true, totalBirthsReconciled: true, simulationRuns: 0 }));
  console.log('Complete descendant scoreboard from eight retained archives; zero simulation runs.');
}
