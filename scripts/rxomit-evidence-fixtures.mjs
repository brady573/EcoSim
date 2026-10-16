/** Cheap corrupt-archive fixtures; hardlinks are unlinked before replacement. */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, mkdirSync, mkdtempSync, linkSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { checkReactionEvidence } from './check-rxomit-evidence.mjs';

export async function reactionEvidenceFixtures(root) {
  const source = join(root, 'evidence/rxomit-rapid-20261016');
  mkdirSync(join(root, 'build'), { recursive: true });
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
