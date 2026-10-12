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
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import {
  parseLedgerStrict, classifyLedgerStatus, residualWithinTolerance,
  evaluateCapturePolicy, parseCheckpoints, permittedGuilds,
  parseSenescenceHeader, senescenceHeaderMismatches,
} from './evidence.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const probe = join(root, 'build', 'trace', 'scenesprobe.js');

// Parse NAMED FLAGS first, then positionals.
//
// Destructuring positionals directly meant a trailing `--historical-spec` landed
// in shardIndexRaw and failed as `bad shard NaN/1`. Shards are optional, so the
// natural short invocation must work without them.
const KNOWN_FLAGS = new Set(['--historical-spec']);
const argvAll = process.argv.slice(2);
const flags = new Set(argvAll.filter((a) => a.startsWith('--')));
for (const f of flags) {
  if (!KNOWN_FLAGS.has(f)) {
    console.error(`::error::unknown flag '${f}'. Known: ${[...KNOWN_FLAGS].join(', ')}`);
    process.exit(2);
  }
}
const positional = argvAll.filter((a) => !a.startsWith('--'));

const [armsPath, armName, outDir, shardIndexRaw, shardCountRaw, ticksRaw] = positional;
if (!armsPath || !armName || !outDir) {
  console.error(
    'usage: run-arm.mjs <arms.json> <armName> <outDir> [shardIndex] [shardCount] [ticksOverride]\n' +
    '       [--historical-spec]',
  );
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

// A HISTORICAL arm is retained as provenance, not as a live experiment. Marking
// it in arms.json is not enough: the label has to be enforced, or a dispatch
// still produces a green run whose result LOOKS current even though the
// hypothesis it was registered for no longer applies to this engine.
//
// Refusing by default is the safe direction. Re-running history is legitimate
// and sometimes necessary to reproduce a published figure, so it is permitted
// with an explicit flag that is recorded in the manifest — it just cannot
// happen by accident.
const HISTORICAL = typeof arm.status === 'string' && arm.status.startsWith('HISTORICAL');
const allowHistoricalSpec = flags.has('--historical-spec');
if (HISTORICAL && !allowHistoricalSpec) {
  console.error(`::error::arm '${armName}' is HISTORICAL: ${arm.status}`);
  console.error(`  Its registered hypothesis was for an earlier engine and is not a current claim.`);
  console.error(`  Pass --historical-spec to run the arm's SETTINGS on the CURRENT engine.`);
  console.error(`  That is a sensitivity replay, NOT a reproduction of its historical figure.`);
  process.exit(2);
}

// THE ENGINE BELOW IS ALWAYS THE CURRENT CHECKOUT.
//
// This flag was originally `--historical-replay`, which promised to reproduce a
// published historical result. It cannot: the probe is always
// build/trace/scenesprobe.js from the working tree, so the historical arm's
// SETTINGS are applied to whatever engine is checked out now. Pinning to the
// 0.5.0 build would mean checking out old sources and rebuilding them.
//
// So the flag is named for what it does and the manifest states plainly that
// no historical figure was reproduced. Anyone needing the original number must
// check out the engine commit it was measured on.


/** Best-effort engine version from the built engine, or 'unknown'. */
function readEngineVersion() {
  try {
    const m = /WORLD_ENGINE_VERSION\s*=\s*'([^']+)'/.exec(
      readFileSync(join(root, 'build', 'world', 'version.js'), 'utf8'),
    );
    return m ? m[1] : 'unknown';
  } catch { return 'unknown'; }
}

/** Best-effort git commit of the checkout, or 'unknown'. Never throws. */
function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch { return 'unknown'; }
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
 * Guild state is read from the probe's checkpoint rows — "tick pop prod cons
 * decomp | dormant ..." — by parseCheckpoints in ./evidence.mjs, which also
 * records per-guild presence across the whole run for the capture non-vacuity
 * check. It was extracted so CI can test the parsing without a simulation.
 *
 * The probe's trailing JSON line is deliberately minimal
 * ({seed,ticks,setting}) — it does NOT carry guild counts. Parsing the JSON
 * instead yields a clean CSV of nulls that LOOKS like a measured result and
 * measures nothing.
 */

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


/**
 * RESOLVED IDENTITY (issue #5 item 6).
 *
 * The manifest used to record what was DECLARED — arm, seeds, horizon, lifts —
 * and nothing about what actually RAN. Two arms could differ in engine version,
 * commit, or resolved config and produce indistinguishable manifests, so a
 * cohort assembled from them was not checkable after the fact.
 *
 * The engine identity is read from the COMPILED build, not from the workflow or
 * from arms.json, because arms.json can be stale relative to the code it claims
 * to describe. If the build is missing this cannot be checked, and the field
 * records the reason rather than guessing.
 */
function resolveIdentity() {
  let engine = null;
  let gateSuite = null;
  let engineError = null;
  try {
    const src = readFileSync(join(root, 'build', 'world', 'version.js'), 'utf8');
    engine = /WORLD_ENGINE_VERSION\s*=\s*'([^']+)'/.exec(src)?.[1] ?? null;
    gateSuite = /GATE_SUITE_VERSION\s*=\s*'([^']+)'/.exec(src)?.[1] ?? null;
    if (!engine) engineError = 'compiled engine reports no WORLD_ENGINE_VERSION';
  } catch (err) {
    engineError = `compiled build/world/version.js not readable (${String(err.message).slice(0, 120)})`;
  }

  let commit = process.env.GITHUB_SHA ?? null;
  if (!commit) commit = currentCommit() === 'unknown' ? null : currentCommit();

  return {
    engine, gateSuite, engineError,
    commit,
    ref: process.env.GITHUB_REF ?? null,
    runtime: process.version,
    // Fingerprint the arm declaration itself, so a cohort verifier can prove
    // every leg was driven by the same text rather than by a same-named but
    // edited file.
    armSpecHash: createHash('sha256').update(readFileSync(armsPath, 'utf8')).digest('hex'),
    armSpecPath: armsPath,
  };
}

const identity = resolveIdentity();

const manifest = {
  arm: armName,
  title: arm.title,
  preregistered: arm.preregistered,
  /**
   * Resolved from the COMPILED build and the checkout, so it describes what
   * actually RAN rather than what the declaration asked for.
   *
   * ONE identity block, deliberately. PR #4 introduced a second `engineIdentity`
   * carrying the same engine version and commit; two fields answering one
   * question is how a reader ends up quoting whichever one says what they
   * expected. The historical-replay caveat now lives here, with the values it
   * qualifies.
   */
  identity: {
    ...identity,
    note: 'The probe always ran from the current checkout. A historical arm spec '
      + 'applied here is a settings replay, not a reproduction of its original figure.',
  },
  /** Capture policy implied by the declaration, stated up front so a reader
   *  can see what the leg was permitted to earn before seeing what it earned. */
  capturePolicy: {
    zero: !!arm.zero,
    permitted: permittedGuilds(!!arm.zero, arm.lifts ?? {}).permitted,
  },
  seedCount: seeds.length,
  /** The shard's exact assigned seeds. Written so the cohort verifier can tell
   *  "this leg never ran seed X" from "this leg was never assigned seed X" —
   *  without it, `seedCount` alone cannot support that distinction. */
  seeds,
  declaredSeedCount: allSeeds.length,
  shard: { index: shardIndex, count: shardCount },
  historicalSpec: HISTORICAL && allowHistoricalSpec,
  historicalEngineReproduced: false,
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
    criteria: arm.criteria ?? null,
  },
  runs: [],
  headerMismatches: [],
  failures: [],
  warnings: [],
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
    cfg = parseSenescenceHeader(header);
  } catch (err) {
    manifest.failures.push({ seed, error: `header: ${err.message}` });
    continue;
  }

  // --- The arm must be the arm we declared. --------------------------------
  // The senescence setting, seed and ticks are directly echoed and checked.
  // Other knobs are not all echoed, so this remains a partial declaration check.
  manifest.headerMismatches.push(...senescenceHeaderMismatches(cfg, {
    seed, ticks, setting: arm.argvRest[0],
  }).map((mismatch) => ({ seed, ...mismatch })));
  const zeroEchoed = /ZERO-BASELINE/.test(header) === !!arm.zero;
  if (!zeroEchoed) {
    manifest.headerMismatches.push({ seed, want: { zero: !!arm.zero }, got: header.slice(0, 200) });
  }


  let final;
  let checkpoints;
  try {
    checkpoints = parseCheckpoints(lines);
    final = checkpoints.final;
    if (!final) throw new Error('no checkpoint row found in probe output');
  } catch (err) {
    manifest.failures.push({ seed, error: `checkpoint rows: ${err.message}` });
    continue;
  }

  const row = {
    seed,
    argv,
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

  // --- Conservation, MEASURED and STRICTLY validated. ------------------------
  //
  // This used to be `if (residualPct !== null && abs(residualPct) > 0.5)`, which
  // meant an absent, truncated or NaN residual skipped the check entirely and
  // the seed still reported a number. parseLedgerStrict never returns a usable
  // ledger from an unusable line, so "not measured" can no longer read as
  // "measured and fine".
  const parsed = parseLedgerStrict(lines);
  row.ledgerStatus = parsed.status;
  row.ledgerClass = classifyLedgerStatus(parsed.status);
  if (parsed.status !== 'ok') {
    manifest.failures.push({
      seed,
      error: `${row.ledgerClass}: ${parsed.problems.join('; ')}`,
      evidenceClass: row.ledgerClass,
    });
  } else {
    const l = parsed.ledger;
    row.totalInput = l.totalInput;
    row.residualPct = l.residualPct;
    row.capture = l.capture;
    row.captureByGuild = l.captureByGuild;

    const tol = residualWithinTolerance(l);
    row.residualOk = tol.pass;
    if (!tol.pass) {
      manifest.failures.push({ seed, error: tol.detail, evidenceClass: 'accounting-violation' });
    }

    // --- The declared capture policy. ---------------------------------------
    // Accounting can balance perfectly while a FORBIDDEN energy input is booked
    // as capture, which is exactly how the decomposer leak survived a
    // zero-residual run. This is asserted per guild, against the declared lifts.
    const cap = evaluateCapturePolicy({
      ledger: l, zero: !!arm.zero, lifts: arm.lifts ?? {}, finalRow: checkpoints,
    });
    row.capturePolicyOk = cap.pass;
    if (!cap.pass) {
      manifest.failures.push({ seed, error: cap.detail, evidenceClass: 'capture-policy-violation' });
    }
    // Vacuity is recorded as a limitation of the MEASUREMENT, not a violation
    // of it. A forbidden guild that never existed cannot have captured, so it is
    // not a leak — but "its capture was zero" also carries no information, and
    // the manifest has to say which of those two things happened.
    if (cap.vacuous && cap.vacuous.length > 0) {
      row.captureVacuous = cap.vacuous;
      manifest.warnings.push({
        seed,
        warning: cap.vacuous.join('; '),
        evidenceClass: 'capture-vacuous',
      });
    }
  }

  manifest.runs.push(row);
  writeFileSync(join(outDir, `seed-${seed}.txt`), stdout);
}

// A run whose engine cannot be identified cannot be compared with any other
// run, including its own re-run, and a cohort verifier cannot prove its legs
// share an engine. That makes the artifacts unreplayable, so it fails the leg
// rather than emitting a number nobody can trace back to a simulation.
//
// Declared AFTER `manifest` exists: this used to sit above the declaration and
// threw a TDZ ReferenceError on exactly the path that matters most — a missing
// or stale compiled build — destroying the one diagnostic that would have
// explained the failure.
if (!identity.engine) {
  manifest.failures.push({
    seed: null,
    error: identity.engineError
      ?? 'engine version could not be resolved from the compiled build — the artifacts would carry no replayable identity',
    evidenceClass: 'identity-mismatch',
  });
}

/**
 * A declared engine that disagrees with the engine that actually ran means the
 * pre-registration describes a different simulation than the one measured. That
 * is rejected BEFORE the run is allowed to look valid — a number produced by the
 * wrong engine is worse than no number, because it will be compared with one.
 */
if (arm.expectEngine && arm.expectEngine !== identity.engine) {
  manifest.failures.push({
    seed: null,
    error: `arm declares engine '${arm.expectEngine}' but the compiled build reports ` +
      `'${identity.engine ?? 'unknown'}' — the artifacts and the declaration describe different simulations`,
    evidenceClass: 'identity-mismatch',
  });
}

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

assertMeasured(manifest);
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// Per-seed outputs stay separate. They are deliberately NOT merged: merging
// hand-written rows into one combined measurement would fabricate a result
// nobody ran.
//
// The ledger status is a column, not a footnote. A blank or missing measurement
// must be visible in the CSV a human actually reads, not only in the manifest.
const csv = ['seed,prod,cons,dec,pop,totalInput,residualPct,ledgerStatus,capturePolicyOk'];
for (const r of manifest.runs) {
  csv.push([
    r.seed, r.prod, r.cons, r.dec, r.pop,
    r.totalInput ?? '', r.residualPct ?? '',
    r.ledgerStatus ?? 'unmeasured',
    r.capturePolicyOk ?? '',
  ].join(','));
}
writeFileSync(join(outDir, 'summary.csv'), csv.join('\n') + '\n');

const ok = manifest.runs.length === seeds.length
  && manifest.headerMismatches.length === 0
  && manifest.failures.length === 0;
console.log(`arm=${armName} shard=${shardIndex}/${shardCount} seeds=${seeds.length}/${allSeeds.length} ` +
  `ran=${manifest.runs.length} mismatches=${manifest.headerMismatches.length} failures=${manifest.failures.length} ` +
  `engine=${identity.engine ?? 'UNKNOWN'} commit=${(identity.commit ?? 'unknown').slice(0, 8)}`);
if (!ok) {
  console.error('::error::arm did not complete as declared — see manifest.json');
  for (const m of manifest.headerMismatches.slice(0, 5)) console.error('  mismatch', JSON.stringify(m));
  for (const f of manifest.failures.slice(0, 5)) console.error(`  failure [${f.evidenceClass ?? 'general'}]`, JSON.stringify(f));
  process.exit(1);
}
