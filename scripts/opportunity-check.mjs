#!/usr/bin/env node
/** Bounded same-config recorder on/off proof; compiled probes only. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'evidence', 'pr13-observer-nonperturbation');
const ticks = 3000;
const seeds = [517, 41001]; // Existing observer cohort, not a seed search.
const expectedTicks = Array.from({ length: ticks / 250 + 1 }, (_, i) => i * 250);

function parse(text) {
  const config = text.split('\n').find((line) => line.startsWith('engine='));
  assert.ok(config?.includes('resolvedConfig='), 'missing resolved config');
  const frames = [...text.matchAll(/^TRAJECTORY tick=(\d+) digest=(\S+)$/gm)]
    .map((m) => ({ tick: Number(m[1]), digest: m[2] }));
  assert.deepEqual(frames.map((f) => f.tick), expectedTicks, 'missing/duplicate trajectory sample');
  assert.ok(text.includes('complete. Observer='), 'truncated run');
  return { config, frames };
}

function compare(on, off) {
  assert.equal(on.config, off.config, 'resolved engine/config mismatch');
  assert.deepEqual(on.frames, off.frames, 'recorder changed sampled trajectory');
}

function negativeControls(on, off) {
  const changed = structuredClone(off.parsed);
  changed.frames[1].digest += '-corrupt';
  assert.throws(() => compare(on.parsed, changed), /recorder changed sampled trajectory/);
  const mismatched = structuredClone(off.parsed);
  mismatched.config += '-different-config';
  assert.throws(() => compare(on.parsed, mismatched), /resolved engine\/config mismatch/);
  assert.throws(() => parse(off.text.replace(/^TRAJECTORY tick=250 .*\n/m, '')), /missing\/duplicate trajectory sample/);
  assert.throws(() => parse(off.text.replace(/^(TRAJECTORY tick=250 .*\n)/m, '$1$1')), /missing\/duplicate trajectory sample/);
}

if (process.argv.includes('--self-test')) {
  // Synthetic evidence only: no World created, no ecological measurements.
  const text = 'engine=test resolvedConfig={}\n' + expectedTicks
    .map((tick) => `TRAJECTORY tick=${tick} digest=fixture-${tick}\n`).join('')
    + 'complete. Observer=fixture\n';
  const arm = { text, parsed: parse(text) };
  compare(arm.parsed, parse(text));
  negativeControls(arm, arm);
  console.log('PASS: opportunity evidence fixtures (valid/config/digest/missing/duplicate)');
} else {
const sources = ['src/trace/opportunityprobe.ts', 'scripts/opportunity-check.mjs',
  'scripts/workflow-checks.mjs', 'src/world/world.ts', 'src/world/config.ts', 'src/world/version.ts'];
const inventory = () => sources.map((file) =>
  `${createHash('sha256').update(readFileSync(join(root, file))).digest('hex')}  ${file}\n`).join('');
const sourceSnapshot = inventory();
const captures = new Map();
const summary = [];
for (const seed of seeds) {
  const run = (mode) => {
    const args = [join(root, 'build', 'trace', 'opportunityprobe.js'), String(ticks), String(seed)];
    if (mode === 'off') args.push('--observer-off');
    const text = execFileSync(process.execPath, args, {
      cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    });
    if (mode === 'on') assert.ok(text.includes('patch heterogeneity:'), 'recorder never ran');
    else assert.ok(!text.includes('patch heterogeneity:'), 'off arm still recorded');
    const parsed = parse(text);
    captures.set(`${seed}-${mode}.txt`, text);
    return { text, parsed };
  };
  const on = run('on');
  const off = run('off');
  compare(on.parsed, off.parsed);
  // Negative controls exercise the checker, not biology: corrupted evidence
  // must never turn into a pass. These do not count as extra ecological arms.
  negativeControls(on, off);
  summary.push(`PASS seed=${seed} ticks=${ticks}: ${expectedTicks.length} identical on/off digests; exact resolved config; recorder active only in on arm; digest/config/missing/duplicate controls rejected`);
}
assert.equal(inventory(), sourceSnapshot, 'source changed during comparison');
summary.push('PASS: bounded observer nonperturbation at 0.6.3 cadence (not an ecology or full-state-equivalence verdict)');
captures.set('check.txt', summary.join('\n') + '\n');
captures.set('source-sha256.txt', sourceSnapshot);
// Validate everything before touching the published archive. Stage the complete
// new record, including hashes and verdict; retain older ancillary documentation.
mkdirSync(dirname(out), { recursive: true });
const stage = mkdtempSync(join(dirname(out), '.observer-stage-'));
const backup = stage + '-previous';
try {
  if (existsSync(out)) cpSync(out, stage, { recursive: true });
  for (const [name, text] of captures) writeFileSync(join(stage, name), text);
  if (existsSync(out)) renameSync(out, backup);
  try { renameSync(stage, out); }
  catch (error) {
    if (existsSync(backup)) renameSync(backup, out);
    throw error;
  }
  rmSync(backup, { recursive: true, force: true });
} finally {
  rmSync(stage, { recursive: true, force: true });
}
console.log(summary.join('\n'));
}
