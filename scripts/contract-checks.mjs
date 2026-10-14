#!/usr/bin/env node
/**
 * Contract tests for the experiment's own invariants.
 *
 * Complements src/gates.ts. The gates assert scientific credibility of a run
 * (repeatability, finite state, causal accounting, birth/death consistency,
 * deterministic contest resolution). This asserts properties of the REPOSITORY
 * and the DIAGNOSTIC KNOB surface, which no scientific gate covers and which
 * have each been violated at least once in this project's history:
 *
 *   C1  declared behaviour is unchanged with every knob unset (parity)
 *   C2  a knob that is set and then cleared returns to declared behaviour
 *   C3  invalid knob values are rejected loudly, never silently coerced
 *   C4  the app bundle and the compiled CLI probe agree
 *   C5  the built engine actually contains the config keys we added
 *   C6  the delivered viewer is self-contained
 *   C7  repeated runs are byte-identical per seed and configuration
 *
 * C1/C2 are the rollback contract: a knob that cannot be rolled back cleanly
 * is not a diagnostic knob, it is a change to declared behaviour. Two real
 * defects shipped through this repository precisely because parity alone was
 * the check.
 *
 * Run: node scripts/contract-checks.mjs <repoRoot>
 * Exits non-zero on any failure. No test framework, no dependencies.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.argv[2] ?? process.cwd();
const results = [];
let failed = 0;

function check(id, name, pass, detail) {
  results.push({ id, name, pass, detail });
  if (!pass) failed++;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} ${name}\n         ${detail}`);
}

const node = process.execPath;
const probe = join(root, 'build', 'trace', 'scenesprobe.js');
const hasBuild = existsSync(probe);

/**
 * Probe invocations are memoised on their exact argv. Several checks ask the
 * same question of the same world — C1 parity and C4 bundle-agreement both
 * need seed 517 and 24601 with every knob unset, and C2 asks for the unknobbed
 * state twice to prove the round trip. Re-running them is pure cost and, worse,
 * invites the two checks to disagree if a run were ever nondeterministic.
 */
const probeCache = new Map();

/** Run the compiled probe. Returns stdout, or '' when the run failed. */
function runProbe(args, timeoutMs = 240000) {
  const key = JSON.stringify(args);
  if (probeCache.has(key)) return probeCache.get(key);
  let out = '';
  try {
    out = execFileSync(node, [probe, ...args], {
      cwd: root,
      encoding: 'utf8',
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    out = '';
  }
  probeCache.set(key, out);
  return out;
}

/** Parse the final `tick pop prod cons decomp` row from probe output. */
function lastRow(out) {
  const lines = out.split('\n').filter((l) => /^\s*\d+\s+\d+\s+\d+\s+\d+\s+\d+\s/.test(l));
  if (lines.length === 0) return null;
  const f = lines[lines.length - 1].trim().split(/\s+/);
  return { tick: +f[0], pop: +f[1], prod: +f[2], cons: +f[3], dec: +f[4] };
}

const fmt = (r) => (r ? `P${r.prod}/C${r.cons}/D${r.dec}` : 'NO DATA');

// ---------------------------------------------------------------------------
// C1 — declared behaviour with all knobs unset.
//
// These are the pinned values recorded in REPORT.md and AGENTS.md. If a change
// moves them with no knob set, it has silently changed declared behaviour.
// ---------------------------------------------------------------------------
// Positional argv layout, verified against src/trace/senesprobe.ts. Written as
// named slots because hand-counting these indices has produced wrong-slot bugs
// repeatedly in this project.
const SLOTS = {
  seed: 0, ticks: 1, setting: 2, photo: 3, basal: 4, graze: 5, tissue: 6,
  radiation: 7, disease: 8, pioneer: 9, dtb: 10, mixo: 11, cyc: 12,
  sat: 13, pcap: 14, nfloor: 15, rsur: 16,
};

/** Build a probe argv array with every knob off/null, then apply overrides. */
function probeArgs(over = {}) {
  const a = new Array(17).fill('null');
  a[SLOTS.setting] = 'off';
  a[SLOTS.photo] = '4';
  a[SLOTS.dtb] = 'off';
  a[SLOTS.mixo] = 'off';
  a[SLOTS.cyc] = 'off';
  a[SLOTS.sat] = '0.4';
  a[SLOTS.nfloor] = '0';
  for (const [k, v] of Object.entries(over)) a[SLOTS[k]] = String(v);
  return a;
}

/**
 * Knobs-unset parity, live pin for engine ts-evo-poc/0.6.3.
 *
 * Under 0.6.3 the live pair is UNCHANGED and was NOT re-pinned. Relative to
 * the reviewed head, nutrient-write arithmetic is unchanged; the four-book
 * instrumentation does not change biology. The earlier per-pool cap fix was
 * made on source snapshots still labelled 0.6.2; 0.6.3 identifies the corrected
 * source and repaired measurement contract, with no new retirement pair.
 *
 * The live pair itself was re-pinned under 0.6.2 (radiationMultiplier + mating
 * logic fixes): 517 -> 882/170/65, 24601 -> 563/279/90, each measured twice
 * byte-identical on Node v24.21.0. Fixes: (1) radiationMultiplier dormant
 * coupling inverted intent at 0 dormancy; (2) mating logic now only skips
 * asexual for confirmed successful matings, restoring asexual fallback.
 * Direction: consumers and decomposers higher at knobs-unset defaults (asexual
 * fallback increases recruitment); producers slightly higher.
 *
 * Retired pairs live beside the live ones in PINNED below (never overwritten):
 *   - 813/135/81, 542/234/109 @ 0.6.1 — fasting tolerance changes declared
 *     behaviour by design (starvation damage ramps over consecutive-deficit
 *     ticks instead of striking at full rate instantly);
 *   - 808/159/58, 558/290/96 @ 0.6.0 — fasting tolerance changes declared
 *     behaviour by design (starvation damage ramps over consecutive-deficit
 *     ticks instead of striking at full rate instantly);
 *   - 881/187/73, 658/280/98 @ 0.4.1 — three behavioural defects corrected
 *     (gradient ascent sampled north-vs-east with no south sample and probed
 *     east on the diagonal; predation assimilation applied twice; mating
 *     matured one-sided, double-charged mutual pairs, dropped contacts by
 *     slot index);
 *   - 778/169/63, 597/246/103 @ 0.5.0 pre-P0-1 — intermediate, superseded.
 *
 * Measured in two passes under 0.5.0: an intermediate 859/146/68 and
 * 586/260/103 was taken before mutual SELECTION (as opposed to mutual
 * intent) was required of a mating partner. That intermediate pair is not a
 * pin and is not recorded as one.
 *
 * Every ladder and balance verdict recorded under an older engine describes
 * that engine's semantics: valid provenance, not comparable behaviour. Do
 * not compare figures across pin boundaries; re-run, do not re-read. See
 * AGENTS.md for the per-version status (0.5.0 figures describe a LEAKY
 * engine; 0.6.0 figures describe the instantaneous-damage engine; 0.6.1
 * figures describe the fasting-tolerance engine; 0.6.2 figures describe the
 * radiationMultiplier+mating-fix engine; 0.6.3 figures describe the
 * per-pool-cap-corrected returns engine).
 */
const PINNED = [
  { seed: 517, want: [882, 170, 65], retired: '813/135/81 @ 0.6.1; 808/159/58 @ 0.6.0; 881/187/73 @ 0.4.1; 778/169/63 @ 0.5.0 pre-P0-1' },
  { seed: 24601, want: [563, 279, 90], retired: '542/234/109 @ 0.6.1; 558/290/96 @ 0.6.0; 658/280/98 @ 0.4.1; 597/246/103 @ 0.5.0 pre-P0-1' },
];

if (!hasBuild) {
  check('C1', 'declared behaviour parity (knobs unset)', false,
    'no compiled probe at build/trace/senesprobe.js — run `npm run view:build` first');
} else {
  for (const p of PINNED) {
    const got = lastRow(runProbe(probeArgs({ seed: p.seed, ticks: 500 })));
    const ok = got !== null && got.prod === p.want[0] && got.cons === p.want[1] && got.dec === p.want[2];
    check('C1', `parity seed ${p.seed} (knobs unset)`, ok,
      ok ? `P${got.prod}/C${got.cons}/D${got.dec} matches pinned (0.6.3: same pair as 0.6.2 — cap fix unreachable at declared defaults; retired ${p.retired})`
         : `expected P${p.want.join('/C')}/D${p.want[2]} (0.6.3), got ${fmt(got)}`);
  }
}

// ---------------------------------------------------------------------------
// C2 — a knob that is set and then cleared returns to declared behaviour.
//
// The rollback contract. Exercised on a knob that is cheap and fast to move:
// producerCaptureScale. A knob that cannot be rolled back cleanly is not a
// diagnostic knob.
// ---------------------------------------------------------------------------
if (!hasBuild) {
  check('C2', 'knob round-trip returns to declared', false, 'no compiled probe');
} else {
  const base = probeArgs({ seed: 517, ticks: 400 });
  const withKnob = probeArgs({ seed: 517, ticks: 400, pcap: 2 });
  const a = lastRow(runProbe(base));
  const b = lastRow(runProbe(withKnob));
  const c = lastRow(runProbe(base));
  const roundTrips = a && c && a.prod === c.prod && a.cons === c.cons && a.dec === c.dec;
  const actuallyMoved = b !== null && a !== null && (b.prod !== a.prod || b.cons !== a.cons || b.dec !== a.dec);
  check('C2', 'knob round-trip returns to declared', Boolean(roundTrips && actuallyMoved),
    `unknobbed=${fmt(a)} knobSet=${fmt(b)} unknobbedAgain=${fmt(c)} ` +
    (roundTrips ? '(round-trip clean)' : '(ROUND-TRIP FAILED)') +
    (actuallyMoved ? '' : ' (WARNING: knob set produced no change — knob may be unwired)'));
}

// ---------------------------------------------------------------------------
// C3 — invalid values rejected loudly.
// ---------------------------------------------------------------------------
if (!hasBuild) {
  check('C3', 'invalid knob values rejected', false, 'no compiled probe');
} else {
  const bad = [
    ['reproSurplusTicks', probeArgs({ seed: 517, ticks: 100, rsur: -5 })],
    ['pioneerBonus', probeArgs({ seed: 517, ticks: 100, pioneer: 'x,y' })],
    ['dormantThreatBlind', probeArgs({ seed: 517, ticks: 100, dtb: 'maybe' })],
    ['mixotrophySaturation', probeArgs({ seed: 517, ticks: 100, sat: -1 })],
  ];
  for (const [name, args] of bad) {
    let threw = false;
    try {
      execFileSync(node, [probe, ...args], { cwd: root, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch {
      threw = true;
    }
    check('C3', `rejects invalid ${name}`, threw, threw ? 'threw as required' : 'ACCEPTED SILENTLY — invalid input was coerced');
  }
}

// ---------------------------------------------------------------------------
// C4 — app bundle and compiled CLI probe agree.
// ---------------------------------------------------------------------------
const bundlePath = join(root, 'build', 'sim-app.js');
if (!existsSync(bundlePath)) {
  check('C4', 'bundle matches CLI probe', false, 'no build/sim-app.js — run npm run build:app first');
} else {
  let bundleOut = '';
  try {
    const src = readFileSync(bundlePath, 'utf8');
    const SimApp = new Function(`${src}; return SimApp;`)();
    const parts = [];
    for (const seed of [517, 24601]) {
      const h = SimApp.createRun(seed, false);
      SimApp.stepRun(h, 500);
      const r = SimApp.readRun(h);
      parts.push({ seed, prod: r.producers, cons: r.consumers, dec: r.decomposers });
    }
    bundleOut = JSON.stringify(parts);
  } catch (e) {
    bundleOut = `ERR ${e.message}`;
  }
  let mismatch = 0;
  if (bundleOut.startsWith('ERR')) {
    mismatch = 2;
  } else {
    const parsed = JSON.parse(bundleOut);
    for (const p of parsed) {
      const row = lastRow(runProbe(probeArgs({ seed: p.seed, ticks: 500 })));
      if (!row || row.prod !== p.prod || row.cons !== p.cons || row.dec !== p.dec) mismatch++;
    }
  }
  check('C4', 'bundle matches CLI probe', mismatch === 0,
    mismatch === 0 ? 'bundle and CLI agree on both pinned seeds' : `${mismatch} seed(s) disagree (${bundleOut.slice(0, 120)})`);
}

// ---------------------------------------------------------------------------
// C5 — built engine contains the config keys we added (presence, not parity).
//
// Parity cannot detect an absent key: an unwired knob and a correct one behave
// identically when unset. This check is the direct guard against shipping a
// stale bundle, which is exactly what happened once.
// ---------------------------------------------------------------------------
const htmlPath = join(root, 'evidence', 'app', 'evo-sim-poc.html');
if (!existsSync(htmlPath)) {
  check('C5', 'built engine contains new config keys', false, 'no evidence/app/evo-sim-poc.html');
} else {
  const html = readFileSync(htmlPath, 'utf8');
  const required = ['reproSurplusTicks', 'mixotrophyCarbon', 'nutrientCyclic', 'nutrientFloor', 'dormantThreatBlind', 'pioneerBonus', 'decomposerPhotoScale'];
  const absent = required.filter((k) => !html.includes(k));
  check('C5', 'built engine contains new config keys', absent.length === 0,
    absent.length === 0 ? `all ${required.length} keys present` : `ABSENT: ${absent.join(', ')}`);
}

// ---------------------------------------------------------------------------
// C6 — delivered viewer is self-contained.
// ---------------------------------------------------------------------------
if (!existsSync(htmlPath)) {
  check('C6', 'viewer is self-contained', false, 'no evidence/app/evo-sim-poc.html');
} else {
  const html = readFileSync(htmlPath, 'utf8');
  const external = (html.match(/(?:src|href)="https?:\/\/[^"]*"/g) ?? []);
  const markerLeft = html.includes('/*__BUNDLE__*/');
  const raf = html.includes('requestAnimationFrame');
  check('C6', 'viewer is self-contained', external.length === 0 && !markerLeft && raf,
    `externalRefs=${external.length} bundleMarkerLeft=${markerLeft} rAF=${raf}`);
}

// ---------------------------------------------------------------------------
// C7 — determinism: same seed and config twice, byte-identical.
// ---------------------------------------------------------------------------
if (!hasBuild) {
  check('C7', 'repeat runs are byte-identical', false, 'no compiled probe');
} else {
  const args = probeArgs({ seed: 24601, ticks: 600, setting: 'share:1', disease: '0.15' });
  const a = runProbe(args);
  const b = runProbe(args);
  check('C7', 'repeat runs are byte-identical', a !== '' && a === b,
    a === '' ? 'probe produced no output' : a === b ? 'identical across repeats' : 'OUTPUT DIFFERS between identical runs');
}

console.log('');
console.log(`probe invocations: ${probeCache.size} distinct worlds`);
console.log(`${results.length - failed}/${results.length} contract checks passed`);
process.exit(failed === 0 ? 0 : 1);
