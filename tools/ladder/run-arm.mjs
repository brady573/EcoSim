/**
 * Ladder arm runner. Dependency-free (node builtins only).
 *
 * The job here is not to compute a result. It is to make it IMPOSSIBLE to
 * report a number from an arm that is not the one that was declared.
 *
 * The probe prints its own resolved config as the first line of stdout. This
 * runner reconstructs that line from the declared arm and compares it to what
 * the probe actually printed. If they differ, the arm was not applied as
 * declared and the run FAILS rather than producing data.
 *
 * That check exists because the 0.4.1 ladder was launched ad hoc with no
 * recorded argv and no lift set, so those arms cannot be verified after the
 * fact. Positional argv mistakes have produced plausible-but-wrong data in
 * this project more than once; a header that disagrees is the only cheap way
 * to catch a repeat.
 *
 * Usage: node tools/ladder/run-arm.mjs <arms.json> <armName> <outDir> [shardIndex] [shardCount]
 *
 * Sharding: when shardCount > 1, only seeds where (position % shardCount) ===
 * shardIndex are run. Every leg runs the SAME declared arm and writes its own
 * directory. Legs are deliberately NOT merged: merging hand-written rows into
 * one combined measurement fabricates a result nobody ran. Each leg's manifest
 * records which seeds it covered.
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const probe = join(root, 'build', 'trace', 'scenesprobe.js');

const [armsPath, armName, outDir, shardIndexRaw, shardCountRaw, ticksRaw] = process.argv.slice(2);
if (!armsPath || !armName || !outDir) {
  console.error('usage: run-arm.mjs <arms.json> <armName> <outDir> [shardIndex] [shardCount] [ticksOverride]');
  process.exit(2);
}

/**
 * Horizon override. The dispatch workflow exposes a ticks box; before this
 * existed that box was DEAD — it parsed, it appeared in the UI, and it was
 * never handed to the runner, which read ticks straight from arms.json. A
 * control that parses and prints but never reaches the engine is the dead-knob
 * class this repository forbids explicitly.
 *
 * An override is recorded in the manifest as an override, so a run at a
 * different horizon still describes itself honestly and never masquerades as
 * the pre-registered one.
 */
const ticksOverride = ticksRaw !== undefined && ticksRaw !== '' ? Number(ticksRaw) : null;
if (ticksOverride !== null && (!Number.isInteger(ticksOverride) || ticksOverride <= 0)) {
  console.error(`bad ticks override: ${ticksRaw}`);
  process.exit(2);
}

const shardIndex = Number(shardIndexRaw ?? 0);
const shardCount = Number(shardCountRaw ?? 1);
if (!Number.isInteger(shardIndex) || !Number.isInteger(shardCount)
    || shardCount < 1 || shardIndex < 0 || shardIndex >= shardCount) {
  console.error(`bad shard ${shardIndex}/${shardCount}`);
  process.exit(2);
}

const spec = JSON.parse(readFileSync(armsPath, 'utf8'));
const arm = spec.arms[armName];
if (!arm) {
  console.error(`::error::unknown arm '${armName}'. Declared: ${Object.keys(spec.arms).join(', ')}`);
  process.exit(2);
}

/** Expand "41001:41018,31001:31018" or "41001:41018" into a seed list. */
function parseSeeds(spec_) {
  const out = [];
  for (const part of String(spec_).split(',')) {
    const m = /^(\d+):(\d+)$/.exec(part.trim());
    if (m) {
      const [lo, hi] = [Number(m[1]), Number(m[2])];
      if (hi < lo) throw new Error(`bad seed range ${part}`);
      for (let s = lo; s <= hi; s++) out.push(s);
    } else if (/^\d+$/.test(part.trim())) {
      out.push(Number(part.trim()));
    } else {
      throw new Error(`unparseable seed spec '${part}' (want "n" or "lo:hi")`);
    }
  }
  return out;
}

const declaredTicks = Number(arm.ticks);
const ticks = ticksOverride ?? declaredTicks;

const allSeeds = parseSeeds(arm.seeds);
// Round-robin rather than contiguous blocks: contiguous blocks would put every
// short-horizon seed in one leg and unbalance the wall clock.
const seeds = allSeeds.filter((_, i) => i % shardCount === shardIndex);

/** The declared 17-slot argv, tail slots 2..16, exactly as passed to the probe. */
function buildArgv(seed) {
  const rest = arm.argvRest.slice();
  if (rest.length !== 15) {
    throw new Error(`argvRest must hold slots 2..16 (15 entries), got ${rest.length}`);
  }
  const argv = [String(seed), String(ticks), ...rest];
  if (arm.zero) argv.push('--zero');
  for (const [dial, value] of Object.entries(arm.lifts ?? {})) {
    argv.push(`--zero-lift=${dial}:${value}`);
  }
  return argv;
}

/**
 * Parse the probe's emitted header into a comparable map.
 * Format: SENESCENCE seed=.. ticks=.. setting=.. photox4 basalx.. ... (probe config)
 */
function parseHeader(line) {
  if (!line.startsWith('SENESCENCE ')) throw new Error(`unexpected header: ${line.slice(0, 80)}`);
  const body = line.slice('SENESCENCE '.length);
  const cfg = {};
  // setting may contain ':' (e.g. "share:1"), so split on the first '=' only.
  for (const tok of body.split(/\s+(?=[a-z]+[x=])/)) {
    const eq = tok.indexOf('=');
    if (eq > 0) cfg[tok.slice(0, eq)] = tok.slice(eq + 1);
  }
  return cfg;
}

/**
 * Read the FINAL guild state from the probe's tabular output.
 *
 * The probe's trailing JSON line is deliberately minimal
 * ({seed,ticks,setting}) — it does NOT carry guild counts. Guild state lives in
 * the checkpoint rows: "tick pop prod cons decomp | dormant ...". Parsing the
 * JSON instead yields a clean CSV of nulls that LOOKS like a measured result
 * and measures nothing, so this reads the last checkpoint row instead.
 */
function parseFinalRow(lines) {
  let last = null;
  for (const line of lines) {
    // Anchored on the leading tick + the '|' separator so the trailing summary
    // lines, which also contain digits and slashes, cannot match.
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\|/.exec(line);
    if (m) {
      last = {
        tick: Number(m[1]), pop: Number(m[2]),
        prod: Number(m[3]), cons: Number(m[4]), dec: Number(m[5]),
      };
    }
  }
  if (!last) throw new Error('no checkpoint row found in probe output');
  return last;
}

/**
 * WHAT THE HEADER CHECK CAN AND CANNOT CATCH.
 *
 * It catches: the probe not honouring the declared argv; a parse failure; a
 * final checkpoint that is not the declared horizon.
 *
 * It does NOT catch: the DECLARATION being wrong. This runner builds argv FROM
 * arms.json, so for seed, ticks and the --zero flag the check is close to
 * tautological — probe and declaration agree by construction. The check earns
 * its keep on the knobs it can cross-read, and as a tripwire for probe changes.
 *
 * A wrong arm declaration — the slot mistake this project has made repeatedly
 * — is guarded by arms.json being version controlled and reviewed alongside
 * its pre-registration, NOT by this script. Do not read a green run as proof
 * the arm was the arm you intended.
 */

/** No reported guild count may be null/NaN; a clean CSV of nulls is a failure. */
function assertMeasured(manifest) {
  for (const r of manifest.runs) {
    for (const k of ['prod', 'cons', 'dec', 'pop']) {
      if (r[k] === null || !Number.isFinite(r[k])) {
        manifest.failures.push({ seed: r.seed, error: `guild count '${k}' is not a measured number: ${r[k]}` });
      }
    }
  }
}

mkdirSync(outDir, { recursive: true });

const manifest = {
  arm: armName,
  title: arm.title,
  preregistered: arm.preregistered,
  seedCount: seeds.length,
  declaredSeedCount: allSeeds.length,
  shard: { index: shardIndex, count: shardCount },
  ticks,
  declaredTicks,
  ticksOverrideApplied: ticksOverride !== null,
  zero: !!arm.zero,
  lifts: arm.lifts ?? {},
  preregistration: {
    hypothesis: arm.hypothesis,
    prediction: arm.prediction,
    falsification: arm.falsification,
    notPredicted: arm.notPredicted ?? null,
    confoundsControlled: arm.confoundsControlled ?? [],
  },
  runs: [],
  headerMismatches: [],
  failures: [],
};

for (const seed of seeds) {
  const argv = buildArgv(seed);
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [probe, ...argv], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      // Scale with horizon. A flat 15-minute cap killed seed 31014 at 24000
      // ticks with ETIMEDOUT — the run was fine, the budget was not. Cost is
      // roughly linear in ticks x population, so scale off the horizon.
      timeout: Math.max(15 * 60 * 1000, Number(ticks) * 2500),
    });
  } catch (err) {
    manifest.failures.push({ seed, error: String(err.message).slice(0, 300) });
    continue;
  }

  const lines = stdout.trim().split('\n');
  const header = lines[0];
  let cfg;
  try {
    cfg = parseHeader(header);
  } catch (err) {
    manifest.failures.push({ seed, error: `header: ${err.message}` });
    continue;
  }

  // --- The arm must be the arm we declared. --------------------------------
  // seed and ticks are the only two we can check against the header directly;
  // the remaining knobs are zeroed or lifted by the preset and are not all
  // echoed, so the check is partial BY CONSTRUCTION and is documented as such.
  const expectSeed = String(seed);
  const expectTicks = String(ticks);
  if (cfg.seed !== expectSeed || cfg.ticks !== expectTicks) {
    manifest.headerMismatches.push({ seed, want: { seed: expectSeed, ticks: expectTicks }, got: cfg });
  }
  const zeroEchoed = /ZERO-BASELINE/.test(header) === !!arm.zero;
  if (!zeroEchoed) {
    manifest.headerMismatches.push({ seed, want: { zero: !!arm.zero }, got: header.slice(0, 200) });
  }


  let final;
  try {
    final = parseFinalRow(lines);
  } catch (err) {
    manifest.failures.push({ seed, error: `checkpoint rows: ${err.message}` });
    continue;
  }

  const row = {
    seed,
    header,
    prod: final.prod,
    cons: final.cons,
    dec: final.dec,
    pop: final.pop,
    finalTick: final.tick,
  };
  // The final checkpoint must actually BE the final tick, otherwise the
  // reported guild state is from an earlier horizon than the one declared.
  if (final.tick !== ticks) {
    manifest.headerMismatches.push({
      seed, want: { finalTick: ticks }, got: { finalTick: final.tick },
    });
  }
  manifest.runs.push(row);
  writeFileSync(join(outDir, `seed-${seed}.txt`), stdout);
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

assertMeasured(manifest);
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Per-seed outputs stay separate. They are deliberately NOT merged: merging
// hand-written rows into one combined measurement would fabricate a result
// nobody ran.
const csv = ['seed,prod,cons,dec,pop'];
for (const r of manifest.runs) csv.push(`${r.seed},${r.prod},${r.cons},${r.dec},${r.pop}`);
writeFileSync(join(outDir, 'summary.csv'), csv.join('\n') + '\n');

const ok = manifest.runs.length === seeds.length
  && manifest.headerMismatches.length === 0
  && manifest.failures.length === 0;
console.log(`arm=${armName} shard=${shardIndex}/${shardCount} seeds=${seeds.length}/${allSeeds.length} ` +
  `ran=${manifest.runs.length} mismatches=${manifest.headerMismatches.length} failures=${manifest.failures.length}`);
if (!ok) {
  console.error('::error::arm did not complete as declared — see manifest.json');
  for (const m of manifest.headerMismatches.slice(0, 5)) console.error('  mismatch', JSON.stringify(m));
  for (const f of manifest.failures.slice(0, 5)) console.error('  failure', JSON.stringify(f));
  process.exit(1);
}