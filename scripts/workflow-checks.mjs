#!/usr/bin/env node
/**
 * Fast regression fixtures for the experiment WORKFLOW layer.
 *
 * Scope: the runner, planner, summariser and workflow plumbing that produce and
 * report evidence. NOT the engine. These are the failure paths that cannot be
 * reached by a successful run, which is why they exist as fixtures: every one of
 * them describes a way this repository could previously have produced a clean
 * green run that measured nothing, or a number that was never earned.
 *
 * They run in well under a second and execute NO simulation. Anything that
 * needed a real 36-seed run to test is not a fixture and does not belong here —
 * per AGENTS.md, long horizons are opt-in evidence, never a per-push gate.
 *
 * Run: node scripts/workflow-checks.mjs
 * Exits non-zero on any failure. No test framework, no dependencies.
 */
import { readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseLedgerStrict, classifyLedgerStatus, residualWithinTolerance,
  evaluateCapturePolicy, permittedGuilds, parseCheckpoints,
  CAPTURE_ZERO_TOLERANCE, RESIDUAL_TOLERANCE_PCT, GUILD_NAMES,
  parseSenescenceHeader, senescenceHeaderMismatches, dfoundMismatch,
} from '../tools/ladder/evidence.mjs';
import { expandSeeds, allocateShards, parseLegs } from '../tools/diagnostics/plan-seeds.mjs';
import { summariseManifest } from '../tools/diagnostics/summarise.mjs';
import { evaluateCohort } from '../tools/ladder/cohort-verify.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const results = [];
let failed = 0;

function check(id, name, pass, detail) {
  results.push({ id, name, pass, detail });
  if (!pass) failed++;
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} ${name}\n         ${detail}`);
}

{
  const arms = JSON.parse(readFileSync(join(root, 'tools/ladder/arms.json'), 'utf8')).arms;
  for (const [name, arm] of Object.entries(arms)) {
    check(`W8a-${name}`, `${name} declares exactly 15 positional probe settings`,
      Array.isArray(arm.argvRest) && arm.argvRest.length === 15,
      `argvRest length=${arm.argvRest?.length}`);
    check(`W8aX-${name}`, `${name} trailing argvExtra, if any, is a short string array`,
      arm.argvExtra === undefined ||
      (Array.isArray(arm.argvExtra) && arm.argvExtra.length <= 4 &&
        arm.argvExtra.every((s) => typeof s === 'string')),
      `argvExtra=${JSON.stringify(arm.argvExtra ?? null)}`);
  }
}

// Trailing probe slots (e.g. dfound=) must not disturb header identity parsing.
// Note: the last header token absorbs the " (probe config)" trailer (rsur does
// today), so dfound is asserted by prefix, not equality.
{
  const line = 'SENESCENCE seed=517 ticks=6000 setting=share:1 photox4 basalxnull dfound=0 (probe config)';
  const cfg = parseSenescenceHeader(line);
  const declared = { seed: 517, ticks: 6000, setting: 'share:1' };
  check('W8aY', 'a header carrying a trailing dfound= token still parses identity',
    senescenceHeaderMismatches(cfg, declared).length === 0 && String(cfg.dfound ?? '').startsWith('0'),
    `dfound=${cfg.dfound ?? 'missing'}`);
}

// The founders echo is machine-compared to the declaration: a stale probe or
// a dropped slot must fail as a mismatch, never as a verdict on the wrong config.
{
  const noExtra = {};
  const zeroExtra = { argvExtra: ['0'] };
  const nullExtra = { argvExtra: ['null'] };
  check('W8aZ-match', 'echoed dfound=0 satisfies a founders-0 declaration',
    dfoundMismatch({ dfound: '0 (probe config)' }, zeroExtra).length === 0,
    `mismatches=${dfoundMismatch({ dfound: '0 (probe config)' }, zeroExtra).length}`);
  check('W8aZ-stale', 'a missing echo fails closed (stale probe cannot pass)',
    dfoundMismatch({ setting: 'off' }, noExtra).length === 1,
    `absent echo must mismatch, got ${dfoundMismatch({ setting: 'off' }, noExtra).length}`);
  check('W8aZ-mismatch', 'echoed default trips a founders-0 declaration',
    dfoundMismatch({ dfound: '0.25 (probe config)' }, zeroExtra).length === 1,
    `mismatches=${dfoundMismatch({ dfound: '0.25 (probe config)' }, zeroExtra).length}`);
  check('W8aZ-null', 'explicit null extra resolves to the 0.25 default',
    dfoundMismatch({ dfound: '0.25 (probe config)' }, nullExtra).length === 0,
    `mismatches=${dfoundMismatch({ dfound: '0.25 (probe config)' }, nullExtra).length}`);
  check('W8aZ-default-ok', 'echoed default satisfies an arm with no founders slot',
    dfoundMismatch({ dfound: '0.25 (probe config)' }, noExtra).length === 0,
    `mismatches=${dfoundMismatch({ dfound: '0.25 (probe config)' }, noExtra).length}`);
  check('W8aZ-empty-closed', 'a missing echo fails a founders-0 declaration (empty is not zero)',
    dfoundMismatch({}, zeroExtra).length === 1,
    `mismatches=${dfoundMismatch({}, zeroExtra).length}`);
}

// Senescence is the single contrast in the balance diagnostic pair. Verify
// the colon-bearing header value parses intact and a wrong/missing value fails.
{
  const line = 'SENESCENCE seed=517 ticks=6000 setting=share:1 photox4 basalxnull (probe config)';
  const cfg = parseSenescenceHeader(line);
  const declared = { seed: 517, ticks: 6000, setting: 'share:1' };
  check('W8s', 'a matching senescence setting passes the emitted-header check',
    senescenceHeaderMismatches(cfg, declared).length === 0,
    `setting=${cfg.setting}`);
  check('W8t', 'a different senescence setting is a header mismatch',
    senescenceHeaderMismatches(cfg, { ...declared, setting: 'off' }).length === 1,
    `declared=off emitted=${cfg.setting}`);
  const missing = parseSenescenceHeader(line.replace(' setting=share:1', ''));
  check('W8u', 'a missing senescence setting is not accepted as a match',
    senescenceHeaderMismatches(missing, declared).length === 1,
    `setting=${missing.setting ?? 'missing'}`);
  check('W8v', 'a colon-bearing senescence setting remains intact when parsed',
    cfg.setting === 'share:1', `parsed=${cfg.setting}`);
}

/**
 * Build a ledger line that is internally consistent, so each fixture can break
 * exactly ONE thing and be certain the failure is the thing under test.
 *
 * Defaults: 100 founding + 200 capture = 300 input; 100 biomass + 200
 * dissipated = 300 accounted. captureByGuild sums to capture.
 */
function ledgerLine(o = {}) {
  const v = {
    totalInput: 300, founding: 100, capture: 200, organic: 0,
    captureByGuild: [200, 0, 0],
    biomass: 100, detritus: 0, dissipated: 200, accounted: 300,
    residualPct: 0.01, ...o,
  };
  return 'LEDGER ' + [
    `totalInput=${v.totalInput}`, `founding=${v.founding}`, `capture=${v.capture}`,
    `organic=${v.organic}`, `captureByGuild=${v.captureByGuild.join('/')}`,
    `biomass=${v.biomass}`, `detritus=${v.detritus}`, `dissipated=${v.dissipated}`,
    `accounted=${v.accounted}`, `residualPct=${v.residualPct}`,
  ].join(' ');
}

/** A probe transcript whose last checkpoint has all three guilds present. */
function probeLines(extra = {}) {
  const rows = ['  tick      pop   prod  cons  decomp | dormant  senescDeaths'];
  for (const t of (extra.ticks ?? [1, 2, 3])) {
    rows.push(`  ${t}     ${extra.pop ?? 30}   ${extra.prod ?? 10}   ${extra.cons ?? 10}    ${extra.dec ?? 10}     | 0       0`);
  }
  rows.push(ledgerLine(extra.ledger));
  rows.push(JSON.stringify({ seed: 1, ticks: 3, setting: '200' }));
  return rows;
}

const cp = (o = {}) => parseCheckpoints(probeLines(o));
const ALL_GUILDS_PRESENT = { everNonZero: { producer: true, consumer: true, decomposer: true } };

/**
 * A ledger with NO guild capture at all: every unit came from the founding
 * endowment. This is the only shape a no-lift `--zero` arm is allowed to
 * produce, so it is what the clean policy fixtures must use.
 */
const NO_CAPTURE = {
  founding: 300, capture: 0, organic: 0, totalInput: 300,
  captureByGuild: [0, 0, 0], biomass: 100, dissipated: 200, accounted: 300,
};

// ===========================================================================
// W1 — conservation evidence: missing / invalid / valid are distinct outcomes
// ===========================================================================
// The defect: the runner only failed when `residualPct !== null && ...`, so a
// missing, malformed or NaN residual skipped the tolerance check entirely and
// the leg still reported a number. Absent evidence must never read as a pass.

{
  const r = parseLedgerStrict(['no ledger here at all']);
  check('W1a', 'missing LEDGER line is reported as MISSING, not as a pass',
    r.status === 'missing' && classifyLedgerStatus(r.status) === 'measurement-missing',
    `status=${r.status} class=${classifyLedgerStatus(r.status)} — ${r.problems[0]}`);
}

{
  // A line that parses as numbers everywhere except the field under test.
  const line = ledgerLine().replace(/residualPct=[\d.]+/, '');
  const r = parseLedgerStrict([line]);
  check('W1b', 'LEDGER line with no residual is INVALID, not silently accepted',
    r.status === 'malformed' && r.ledger === null,
    `status=${r.status} ledger=${r.ledger} — ${r.problems[0]}`);
}

{
  const line = ledgerLine().replace(/residualPct=[\d.]+/, 'residualPct=NaN');
  const r = parseLedgerStrict([line]);
  check('W1c', 'residualPct=NaN is rejected as NONFINITE',
    r.status === 'nonfinite' && classifyLedgerStatus(r.status) === 'measurement-invalid',
    `status=${r.status} — ${r.problems[0]}`);
}

{
  const line = ledgerLine().replace(/residualPct=[\d.]+/, 'residualPct=abc');
  const r = parseLedgerStrict([line]);
  check('W1d', 'residualPct with an invalid token is rejected as MALFORMED',
    r.status === 'malformed' && r.ledger === null,
    `status=${r.status} — ${r.problems[0]}`);
}

{
  const line = ledgerLine().replace(/totalInput=300/, 'totalInput=Infinity');
  const r = parseLedgerStrict([line]);
  check('W1e', 'non-finite totalInput is rejected',
    r.status === 'nonfinite' && r.ledger === null,
    `status=${r.status} — ${r.problems[0]}`);
}

{
  const line = ledgerLine().replace(/dissipated=200/, 'dissipated=200.5.6');
  const r = parseLedgerStrict([line]);
  check('W1f', 'a numerically-shaped but unparseable value is rejected',
    r.status === 'malformed' && r.ledger === null,
    `status=${r.status} — ${r.problems[0]}`);
}

{
  const r = parseLedgerStrict([ledgerLine({ residualPct: 0.01 })]);
  const tol = residualWithinTolerance(r.ledger);
  check('W1g', 'a valid in-tolerance residual is VALID and passes',
    r.status === 'ok' && tol.pass && classifyLedgerStatus(r.status) === 'valid',
    `status=${r.status} ${tol.detail}`);
}

{
  // The genuine accounting violation: parses fine, fails the tolerance.
  const r = parseLedgerStrict([ledgerLine({ residualPct: 0.9 })]);
  const tol = residualWithinTolerance(r.ledger);
  check('W1h', `a finite residual over ${RESIDUAL_TOLERANCE_PCT}% is an ACCOUNTING VIOLATION`,
    r.status === 'ok' && !tol.pass && classifyLedgerStatus(r.status) === 'valid',
    `parse=${r.status} (the value IS a measurement) tolerance=${tol.pass} — ${tol.detail}`);
}

{
  // A system can mint energy, book it as capture, and still reconcile its books.
  // Only the identities expose that, which is why they are asserted.
  const r = parseLedgerStrict([ledgerLine({ captureByGuild: [150, 0, 0] })]);
  check('W1i', 'capture disagreeing with the per-guild breakdown is CONTRADICTORY',
    r.status === 'contradictory' && classifyLedgerStatus(r.status) === 'accounting-violation',
    `status=${r.status} — ${r.problems.join(' | ')}`);
}

{
  const r = parseLedgerStrict([ledgerLine({ founding: 50 })]);
  check('W1j', 'totalInput != founding+capture+organic is CONTRADICTORY',
    r.status === 'contradictory',
    `status=${r.status} — ${r.problems.join(' | ')}`);
}

{
  const r = parseLedgerStrict([ledgerLine({ biomass: -1 })]);
  check('W1k', 'a negative biomass is CONTRADICTORY, not a measurement',
    r.status === 'contradictory',
    `status=${r.status} — ${r.problems.join(' | ')}`);
}

{
  // sediment and litter are omitted from the printed `detritus`, so accounted
  // sits BELOW totalInput legitimately. Exceeding it never happens.
  const r = parseLedgerStrict([ledgerLine({ biomass: 100, dissipated: 400, accounted: 500 })]);
  check('W1l', 'printed sinks exceeding totalInput is CONTRADICTORY',
    r.status === 'contradictory',
    `status=${r.status} — ${r.problems.join(' | ')}`);
}

{
  const r = parseLedgerStrict([ledgerLine({ captureByGuild: [200] })]);
  check('W1m', 'captureByGuild with the wrong arity is rejected',
    r.status === 'malformed',
    `status=${r.status} — ${r.problems[0]}`);
}

// ===========================================================================
// W2 — a --zero arm may not silently capture energy
// ===========================================================================
// The defect: the runner checked residual and the ZERO-BASELINE header marker,
// but never the capture the probe was already reporting. Perfectly balanced
// books were compatible with a forbidden energy input booked as capture.

{
  // The clean, legitimate no-lift zero arm: every unit came from the founding
  // endowment and no guild earned anything.
  const r = parseLedgerStrict([ledgerLine({
    founding: 300, capture: 0, organic: 0, totalInput: 300,
    captureByGuild: [0, 0, 0], biomass: 100, dissipated: 200, accounted: 300,
    residualPct: 0,
  })]);
  const v = evaluateCapturePolicy({
    ledger: r.ledger, zero: true, lifts: {},
    finalRow: ALL_GUILDS_PRESENT,
  });
  check('W2a', 'a clean no-lift zero arm PASSES the capture policy',
    r.status === 'ok' && v.applicable && v.pass,
    `ledger=${r.status}, capture policy pass=${v.pass} — ${v.detail}`);
}

{
  // Decomposer capture with a ZERO residual: accounting is perfect and the run
  // is still forbidden. This is the case the old runner passed.
  const r = parseLedgerStrict([ledgerLine({
    residualPct: 0, capture: 200, captureByGuild: [150, 0, 50],
  })]);
  const v = evaluateCapturePolicy({
    ledger: r.ledger, zero: true, lifts: {},
    finalRow: { everNonZero: { producer: true, consumer: true, decomposer: true } },
  });
  check('W2b', 'positive decomposer capture fails a zero arm EVEN AT ZERO RESIDUAL',
    r.status === 'ok' && !v.pass && v.detail.includes('decomposer'),
    `ledger=${r.status} residual=0 — capture policy pass=${v.pass} — ${v.detail}`);
}

{
  // The sanctioned case: producer capture deliberately lifted.
  const r = parseLedgerStrict([ledgerLine({ capture: 200, captureByGuild: [200, 0, 0] })]);
  const v = evaluateCapturePolicy({
    ledger: r.ledger, zero: true, lifts: { producerCaptureScale: 0.35 },
    finalRow: ALL_GUILDS_PRESENT,
  });
  check('W2c', 'a lifted producer capture scale permits producer capture',
    v.pass && v.detail.includes('producerCaptureScale'),
    `pass=${v.pass} — ${v.detail}`);
}

{
  // ...and it permits ONLY that guild. A lift is not a blank cheque.
  const r = parseLedgerStrict([ledgerLine({ capture: 200, captureByGuild: [150, 0, 50] })]);
  const v = evaluateCapturePolicy({
    ledger: r.ledger, zero: true, lifts: { producerCaptureScale: 0.35 },
    finalRow: ALL_GUILDS_PRESENT,
  });
  check('W2d', 'a producer lift does NOT permit decomposer capture',
    !v.pass && v.detail.includes('decomposer'),
    `pass=${v.pass} — ${v.detail}`);
}

{
  // basalFoodPerCell books as `organic`, not as guild capture. Lifting it must
  // not be misread as permission to photosynthesise, so it grants NO guild.
  const { permitted } = permittedGuilds(true, { basalFoodPerCell: 0.25 });
  const r = parseLedgerStrict([ledgerLine({
    ...NO_CAPTURE, organic: 50, totalInput: 350, residualPct: 0,
  })]);
  const v = evaluateCapturePolicy({
    ledger: r.ledger, zero: true, lifts: { basalFoodPerCell: 0.25 },
    finalRow: ALL_GUILDS_PRESENT,
  });
  check('W2e', 'a basalFoodPerCell lift books organic and does NOT sanction capture',
    permitted.every((p) => !p) && v.pass,
    `permitted=${JSON.stringify(permitted)} — organic=${r.ledger.organic} and no guild is licensed: ${v.detail}`);
}

{
  // Non-vacuity: "zero capture" is only EVIDENCE if the guild existed. But a
  // guild that never existed is legitimate biology, not a leak — so this is
  // reported as a limitation and does not fail the leg. Hard-failing here made
  // a --zero arm with a never-founded guild unpassable by construction.
  const r = parseLedgerStrict([ledgerLine({ ...NO_CAPTURE, residualPct: 0 })]);
  const v = evaluateCapturePolicy({
    ledger: r.ledger, zero: true, lifts: {},
    finalRow: { everNonZero: { producer: true, consumer: false, decomposer: true } },
  });
  check('W2f', 'zero capture by a guild that never existed is recorded as VACUOUS, not failed',
    v.pass && v.vacuous.length === 1 && v.vacuous[0].includes('consumer was empty'),
    `pass=${v.pass} vacuous=${JSON.stringify(v.vacuous)}`);
}

{
  // ...but it is still surfaced, and a vacuous guild alongside a REAL violation
  // must still fail. The limitation does not mask the breach.
  const r = parseLedgerStrict([ledgerLine({ capture: 200, captureByGuild: [100, 0, 100] })]);
  const v = evaluateCapturePolicy({
    ledger: r.ledger, zero: true, lifts: {},
    finalRow: { everNonZero: { producer: true, consumer: false, decomposer: true } },
  });
  check('W2j', 'a vacuous guild does not MASK a real capture violation',
    !v.pass && v.vacuous.length === 1,
    `pass=${v.pass} vacuous=${v.vacuous.length} — ${v.detail}`);
}

{
  // A zero-valued lift lifts nothing; presence alone must not grant permission.
  const { permitted } = permittedGuilds(true, { producerCaptureScale: 0 });
  const r = parseLedgerStrict([ledgerLine({ ...NO_CAPTURE, residualPct: 0 })]);
  const v = evaluateCapturePolicy({
    ledger: r.ledger, zero: true, lifts: { producerCaptureScale: 0 },
    finalRow: ALL_GUILDS_PRESENT,
  });
  check('W2k', 'a ZERO-valued lift grants no capture permission',
    !permitted[0] && v.pass,
    `permitted=${JSON.stringify(permitted)} — a lift of 0 lifts nothing, so no guild is licensed: ${v.detail}`);
}

{
  const v = evaluateCapturePolicy({ ledger: null, zero: true, lifts: {} });
  check('W2g', 'capture policy refuses to pass without a validated ledger',
    v.applicable && !v.pass,
    `pass=${v.pass} — ${v.detail}`);
}

{
  // A non-zero arm never declared the prohibition; inventing one would fail an
  // honest arm for a rule it was never under.
  const v = evaluateCapturePolicy({ ledger: null, zero: false, lifts: {} });
  check('W2h', 'a non-zero arm is not subject to the capture prohibition',
    v.pass && !v.applicable,
    `pass=${v.pass} applicable=${v.applicable} — ${v.detail}`);
}

{
  const c = parseCheckpoints(probeLines({ ticks: [1, 2, 3], dec: 4 }));
  check('W2i', 'per-guild presence is detected across checkpoints, not just the last row',
    c.final.dec === 4 && c.everNonZero.decomposer && c.rows === 3,
    `rows=${c.rows} final.decomp=${c.final.dec} everNonZero=${JSON.stringify(c.everNonZero)}`);
}

// ===========================================================================
// W3 — dispatch input is DATA, never shell source
// ===========================================================================
// GitHub expands `${{ }}` before the shell parses anything, so a value
// containing $(id) executes during expansion, ahead of any validation the
// runner performs. Every workflow that accepts free text must pass it through
// the environment and validate it as an argument.

for (const [wfPath, label] of [
  ['.github/workflows/diagnostics.yml', 'diagnostics'],
  ['.github/workflows/ladder.yml', 'ladder'],
]) {
  const text = readFileSync(join(root, wfPath), 'utf8');
  const offenders = scanWorkflowForInputInterpolation(text);
  check(`W3-${label}`, `no dispatch input is interpolated into a ${label} run: body`,
    offenders.length === 0,
    offenders.length === 0
      ? `no inputs.* interpolation appears in any run: body (block or inline form)`
      : `FOUND ${offenders.length}: ${[...new Set(offenders.map((o) => o.tok))].join(', ')} at lines ` +
        `${offenders.map((o) => o.line).join(',')} — these expand before the shell parses and can execute command substitution`);
}

/**
 * Line-based scan for `${{ inputs.* }}` appearing inside a `run:` body.
 *
 * Deliberately line-based rather than regex-block-extraction. The previous
 * version only recognised a bare `run: |` line, so an inline `run: echo ...`
 * step was never scanned at all, and its block-end pattern required two or more
 * spaces before `name:` while real steps use `- name:` — so blocks ran past
 * their own boundaries. A guard that cannot see the thing it guards is worse
 * than no guard, because it reports green.
 *
 * Two forms must both be caught, and both are checked against synthetic
 * fixtures below so the scanner cannot silently become blind again.
 */
/**
 * Return every `${{ ... }}` in a line that REFERENCES `inputs.`.
 *
 * Matching the whole expression and testing its body for `inputs.` is stricter
 * than matching a `${{ inputs.` prefix: `${{ fromJSON(inputs.matrix) }}` reads
 * dispatch input and expands just as eagerly as the simple form, so a prefix
 * pattern would wave it through the one guard that exists for it.
 */
function inputExpressionsIn(line) {
  const out = [];
  for (const m of line.matchAll(/\$\{\{(.*?)\}\}/g)) {
    if (/\binputs\./.test(m[1])) out.push(m[0]);
  }
  return out;
}

function scanWorkflowForInputInterpolation(text) {
  const lines = text.split('\n');
  const offenders = [];
  let runIndent = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const runMatch = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(line);
    if (runMatch) {
      const indent = runMatch[1].length;
      const rest = runMatch[2].trim();
      if (rest === '|' || rest === '>' || rest === '|-' || rest === '>-') {
        runIndent = indent + 1; // block scalar: body is more-indented
        continue;
      }
      // Inline `run: <command>` — the whole line IS the body.
      for (const tok of inputExpressionsIn(rest)) offenders.push({ line: i + 1, tok });
      runIndent = null;
      continue;
    }
    if (runIndent !== null) {
      const indent = line.length - line.trimStart().length;
      const isBlank = line.trim() === '';
      // A dedent, or a new list item at the step level, ends the block body.
      if (!isBlank && (indent < runIndent || /^\s*-\s/.test(line))) runIndent = null;
    }
    if (runIndent === null) continue;
    for (const tok of inputExpressionsIn(line)) offenders.push({ line: i + 1, tok });
  }
  return offenders;
}

// Negative fixtures: prove the scanner still detects both forms, so a green
// W3 on the real workflows means "scanned" rather than "blind".
{
  const inline = scanWorkflowForInputInterpolation(
    "jobs:\n  a:\n    steps:\n      - run: echo ${{ inputs.seeds }}\n",
  );
  check('W3-self-inline', 'the scanner DETECTS an inline `run:` interpolation',
    inline.length === 1 && inline[0].tok.startsWith('${{ inputs.seeds'),
    `found ${inline.length}: ${JSON.stringify(inline)}`);
}

{
  const scoped = scanWorkflowForInputInterpolation(
    'jobs:\n  a:\n    steps:\n' +
    '      - name: ok\n        run: |\n          echo "$SAFE"\n' +
    '      - name: bad\n        run: |\n          echo ${{ inputs.ticks }}\n' +
    '      - name: after\n        run: |\n          echo "$ALSO_SAFE"\n',
  );
  check('W3-self-scope', 'the scanner scopes a block body to its own step',
    scoped.length === 1 && scoped[0].tok.startsWith('${{ inputs.ticks'),
    `found ${scoped.length} offender(s): ${JSON.stringify(scoped.map((o) => o.tok))} ` +
    '(1 = the block body only, neither the env nor the following step)');
}

{
  const envOk = scanWorkflowForInputInterpolation(
    'jobs:\n  a:\n    steps:\n      - name: ok\n        env:\n          X: ${{ inputs.seeds }}\n        run: |\n          echo "$X"\n',
  );
  check('W3-self-env', 'an `env:` binding of dispatch input is the ALLOWED pattern',
    envOk.length === 0,
    `found ${envOk.length} offender(s) — env: is exactly how input should reach the shell`);
}

{
  // Compound/filtered expressions expand just as eagerly as the simple form, so
  // the scanner must match the PREFIX, not the whole expression. Matching the
  // full `${{ inputs.x }}` shape would let `${{ inputs.ticks || '6000' }}`
  // through the one guard that exists for it.
  const compound = scanWorkflowForInputInterpolation(
    "jobs:\n  a:\n    steps:\n      - run: echo ${{ inputs.ticks || '6000' }}\n"
    + "      - run: echo ${{ fromJSON(inputs.matrix) }}\n",
  );
  check('W3-self-compound', 'the scanner DETECTS compound/filtered input expressions',
    compound.length === 2,
    `found ${compound.length} of 2 expected: ${JSON.stringify(compound.map((o) => o.tok))}`);
}

// ===========================================================================
// W4 — seed ranges expand once, then shard; every seed lands exactly once
// ===========================================================================
// The defect: `1:10` is valid to the kit but the shell shard planner splits
// only on comma/space, so it saw ONE token, ran ONE leg, and handed the whole
// range to it. Requested parallelism silently vanished.

{
  const expanded = expandSeeds('1:10');
  check('W4a', 'a range expands to its members',
    expanded.length === 10 && expanded[0] === 1 && expanded[9] === 10,
    `"1:10" -> ${expanded.length} seeds [${expanded.join(',')}]`);
}

{
  const shards = allocateShards(expandSeeds('1:10'), 4);
  const flat = shards.flat();
  const all = expandSeeds('1:10');
  const covers = flat.length === all.length
    && new Set(flat).size === all.length
    && all.every((s) => flat.includes(s));
  check('W4b', '"1:10" across 4 legs covers seeds 1-10 exactly once',
    covers && shards.length === 4 && shards.every((s) => s.length > 0),
    `${shards.length} nonempty shards: ${shards.map((s) => `[${s.join(',')}]`).join(' ')}`);
}

{
  const a = allocateShards(expandSeeds('1:10'), 4);
  const b = allocateShards(expandSeeds('1,2,3,4,5,6,7,8,9,10'), 4);
  check('W4c', 'an equivalent comma list yields the identical allocation',
    JSON.stringify(a) === JSON.stringify(b),
    `range  -> ${JSON.stringify(a)}\n         commas -> ${JSON.stringify(b)}`);
}

{
  const shards = allocateShards(expandSeeds('41001:41018,31001:31018'), 6);
  const flat = shards.flat();
  check('W4d', 'a mixed range/list panel of 36 seeds shards without loss',
    flat.length === 36 && new Set(flat).size === 36,
    `${shards.length} shards, ${flat.length} seeds, ${new Set(flat).size} distinct`);
}

{
  let threw = null;
  try { expandSeeds('10:1'); } catch (e) { threw = e.message; }
  check('W4e', 'a reversed range is rejected',
    threw !== null, `expandSeeds('10:1') -> ${threw ?? 'NO ERROR (accepted a reversed range)'}`);
}

{
  let threw = null;
  try { expandSeeds('$(id)'); } catch (e) { threw = e.message; }
  check('W4f', 'an adversarial dispatch string is rejected as DATA, never evaluated',
    threw !== null, `expandSeeds('$(id)') -> ${threw ?? 'NO ERROR'}`);
}

{
  let threw = null;
  try { expandSeeds('1:100000'); } catch (e) { threw = e.message; }
  check('W4g', 'an oversized panel is rejected rather than launched',
    threw !== null, `expandSeeds('1:100000') -> ${threw ?? 'NO ERROR'}`);
}

{
  let threw = null;
  try { parseLegs('4; rm -rf /'); } catch (e) { threw = e.message; }
  check('W4h', 'a non-integer leg count is rejected',
    threw !== null, `parseLegs('4; rm -rf /') -> ${threw ?? 'NO ERROR'}`);
}

{
  // LEGS is passed through to /bin/sh unchanged, and dash reads a leading zero
  // as an invalid octal digit. Accepting "08" here and dying later inside
  // `$(( ))` is a validation pass followed by an unrelated runtime failure.
  let threw = null;
  try { parseLegs('08'); } catch (e) { threw = e.message; }
  check('W4i', "a leading-zero leg count is rejected before it reaches shell arithmetic",
    threw !== null && /leading zero/.test(threw),
    `parseLegs('08') -> ${threw ?? 'NO ERROR (accepted; dash would reject it in $(( )))'}`);
}

{
  // The plain forms must still work — the leading-zero guard must not reject
  // legitimate counts, and 0 must still be rejected as out of range.
  let zeroThrew = false;
  try { parseLegs('0'); } catch { zeroThrew = true; }
  check('W4j', 'plain leg counts are unaffected by the leading-zero guard',
    parseLegs('1') === 1 && parseLegs('10') === 10 && zeroThrew,
    `parseLegs('1')=1, parseLegs('10')=10, parseLegs('0') rejected=${zeroThrew}`);
}

// ===========================================================================
// W5 — every diagnostics suite summarises without a schema error
// ===========================================================================
// The defect: the summary step read `m.targets.length` unconditionally, but the
// factorial-core manifest carries `switches` and no `targets`. A fully
// successful factorial screen therefore threw during `if: always()` and
// reported a failed workflow.

{
  const factorial = {
    design: 'full 2^4 factorial',
    switches: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
    runCount: 16, seeds: [1, 2], elapsedMs: 5,
  };
  const s = summariseManifest(factorial, 'leg0');
  check('W5a', 'a factorial-core manifest summarises via switches.length',
    s.ok && s.units === 4,
    `ok=${s.ok} units=${s.units} — "${s.line}"`);
}

{
  const screen = {
    targets: [{ name: 'nutrientRegen' }, { name: 'litterDecay' }],
    runCount: 7, seeds: [1], skippedTargets: [{ name: 'x', reason: 'unsweepable' }],
    elapsedMs: 5,
  };
  const s = summariseManifest(screen, 'leg1');
  check('W5b', 'a target/config manifest summarises via targets.length',
    s.ok && s.units === 2 && s.skipped === 1,
    `ok=${s.ok} units=${s.units} skipped=${s.skipped} — "${s.line}"`);
}

{
  const s = summariseManifest({ runCount: 3, seeds: [1] }, 'leg2');
  check('W5c', 'a manifest with neither field degrades instead of throwing',
    !s.ok && typeof s.line === 'string' && s.line.length > 0,
    `ok=${s.ok} — "${s.line}"`);
}

{
  let threw = null;
  try { summariseManifest(null, 'leg3'); } catch (e) { threw = e.message; }
  check('W5d', 'an unreadable manifest is reported, not thrown from the summariser',
    threw === null, threw === null ? 'returned a result object' : `THREW: ${threw}`);
}

// ===========================================================================
// W6 — cohort completeness is checked independently of leg success
// ===========================================================================
// Each leg verifying its own outputs is not evidence the PANEL was measured.
// A leg that never ran, ran a seed twice, or ran a different engine leaves a
// set of successful jobs and a scientifically meaningless number.

/**
 * Build a leg manifest in the SHAPE run-arm.mjs actually writes — identity
 * nested under `identity`, plus the `failures` / `headerMismatches` /
 * `warnings` arrays. The previous fixture used a flat shape production never
 * emits, which let the cohort verifier's identity comparison pass while being
 * dead code: it read `leg.engine`, found undefined, filtered it out, and
 * compared nothing.
 */
function manifestFor(seeds, over = {}) {
  return {
    arm: 'flatline',
    identity: { engine: 'ts-evo-poc/0.6.0', commit: 'abc123', armSpecHash: 'h1', ticks: 12000 },
    // Recorded because the verifier requires every leg to name it: a cohort
    // assembled from legs with different declared horizons is not one experiment.
    declaredTicks: 12000,
    seedCount: seeds.length,
    seeds,
    runs: [],
    failures: [],
    headerMismatches: [],
    warnings: [],
    ...over,
  };
}
const okRun = (seed) => ({
  seed, prod: 0, cons: 0, dec: 0, pop: 0, finalTick: 12000,
  totalInput: 300, residualPct: 0.01, ledgerStatus: 'ok', capturePolicyOk: true,
});

{
  const expected = Array.from({ length: 4 }, (_, i) => i + 1);
  const legs = [
    manifestFor([1, 2], { runs: [okRun(1), okRun(2)] }),
    manifestFor([3, 4], { runs: [okRun(3), okRun(4)] }),
  ];
  const criteria = [{ id: 'populated', metric: 'pop', op: '>=', value: 0, required: 4, statement: 'pop >= 0 on >= 4/4 seeds' }];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: expected, legs, criteria });
  check('W6a', 'a complete, disjoint, single-engine panel PASSES',
    r.pass && r.classification === 'supported',
    `pass=${r.pass} class=${r.classification} — ${r.detail}`);
}

{
  const legs = [manifestFor([1, 2], { runs: [okRun(1), okRun(2)] })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2, 3, 4], legs });
  check('W6b', 'a MISSING seed fails the cohort even though the leg succeeded',
    !r.pass && r.detail.includes('missing'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const legs = [
    manifestFor([1, 2], { runs: [okRun(1), okRun(2)] }),
    manifestFor([2, 3], { runs: [okRun(2), okRun(3)] }),
  ];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2, 3], legs });
  check('W6c', 'a DUPLICATE seed fails the cohort',
    !r.pass && r.detail.includes('duplicate'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const legs = [
    manifestFor([1], { runs: [okRun(1)] }),
    manifestFor([2], { runs: [okRun(2)], identity: { engine: 'ts-evo-poc/0.5.0', commit: 'abc123', armSpecHash: 'h1', ticks: 12000 } }),
  ];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2], legs });
  check('W6d', 'MIXED engine versions across legs fail the cohort',
    !r.pass && r.detail.includes('engine'),
    `pass=${r.pass} — ${r.detail}`);
}

// The regression this whole section exists for: run-arm.mjs records a
// policy-violating seed in `runs` anyway and parks the reason in `failures`.
// A verifier that reads only `runs` sees clean finite numbers over contaminated
// evidence and calls the cohort INTACT.
{
  const legs = [manifestFor([1], {
    runs: [okRun(1)],
    failures: [{ seed: 1, error: 'decomposer captured 50 under --zero', evidenceClass: 'capture-policy-violation' }],
  })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6g', 'per-leg FAILURES are inherited; a contaminated seed cannot pass the cohort',
    !r.pass && r.detail.includes('capture-policy-violation'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const legs = [manifestFor([1], {
    runs: [okRun(1)],
    headerMismatches: [{ seed: 1, want: { finalTick: 12000 }, got: { finalTick: 6000 } }],
  })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6h', 'per-leg header MISMATCHES are inherited too',
    !r.pass && r.detail.includes('mismatch'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  // A manifest that cannot say what went wrong is not trustworthy.
  const legs = [{ arm: 'flatline', identity: { engine: 'e' }, seeds: [1], runs: [okRun(1)] }];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6i', 'a leg manifest with no `failures` array is itself invalid',
    !r.pass && r.detail.includes('failures'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  // Mixed horizons: a ticks override on one leg must not verify as one panel.
  const legs = [
    manifestFor([1], { runs: [okRun(1)] }),
    manifestFor([2], {
      runs: [{ ...okRun(2), finalTick: 6000 }],
      identity: { engine: 'ts-evo-poc/0.6.0', commit: 'abc123', armSpecHash: 'h1', ticks: 6000 },
    }),
  ];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2], legs });
  check('W6j', 'legs run at DIFFERENT horizons are not one experiment',
    !r.pass && r.detail.includes('ticks'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  // A criterion naming a metric that does not exist must not silently pass.
  const legs = [manifestFor([1, 2], { runs: [okRun(1), okRun(2)] })];
  const criteria = [{ id: 'typo', metric: 'conss', op: '>', value: 0, required: 1, statement: 'typo' }];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2], legs, criteria });
  check('W6k', 'a criterion with an UNKNOWN metric is an integrity failure, not a silent skip',
    !r.pass && r.classification === 'not measured' && r.detail.includes('unknown metric'),
    `pass=${r.pass} class=${r.classification} — ${r.detail}`);
}

{
  // An arm that declares an expected identity and measures a different one is
  // describing a different simulation. No arm declares this today, so without a
  // fixture the check could regress unnoticed.
  const legs = [manifestFor([1], { runs: [okRun(1)] })];
  const r = evaluateCohort({
    armName: 'flatline', expectedSeeds: [1], legs,
    expect: { engine: 'ts-evo-poc/0.5.0' },
  });
  check('W6m', 'a DECLARED identity that disagrees with the measured one fails',
    !r.pass && r.detail.includes('engine'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const legs = [manifestFor([1], { runs: [okRun(1)] })];
  const r = evaluateCohort({
    armName: 'flatline', expectedSeeds: [1], legs,
    expect: { engine: 'ts-evo-poc/0.6.0' },
  });
  check('W6n', 'a MATCHING declared identity does not fail',
    r.pass, `pass=${r.pass} — ${r.detail}`);
}

{
  // A corrupt manifest must produce an INVALID verdict, never a TypeError.
  const legs = [manifestFor([1], { runs: [okRun(1), null] })];
  let threw = null;
  let r = null;
  try {
    r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  } catch (err) {
    threw = err.message;
  }
  check('W6o', 'a null entry in `runs` is an INVALID verdict, not a crash',
    threw === null && r !== null && !r.pass,
    threw === null ? `pass=${r.pass} — ${r.detail}` : `THREW: ${threw}`);
}

{
  // Owner decision, pinned: a green workflow means the EVIDENCE is trustworthy,
  // never that the hypothesis was correct. Falsification is a result, so it
  // exits 0 — and the headline must say so loudly enough that a reader cannot
  // take the green tick as confirmation.
  const legs = [
    manifestFor([1, 2], { runs: [{ ...okRun(1), pop: 4 }, { ...okRun(2), pop: 0 }] }),
  ];
  const criteria = [{ id: 'surviving', metric: 'pop', op: '>=', value: 1, required: 2, statement: 'pop >= 1 on >= 2/2 seeds' }];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2], legs, criteria });
  check('W6p', 'a FALSIFIED verdict exits green and says so unmistakably',
    r.pass === true
    && r.classification === 'falsified'
    && r.headline.includes('PREDICTION FALSIFIED')
    && r.headline.includes('NOT because anything was confirmed')
    && r.exitPolicy.greenDoesNotMean === 'the hypothesis was correct',
    `pass=${r.pass} class=${r.classification}`);
  check('W6q', 'the exit policy is carried on the verdict, not just printed',
    r.exitPolicy.nonzeroReservedFor.includes('evidence-integrity violation')
    && r.exitPolicy.nonzeroReservedFor.includes('execution failure'),
    `nonzero reserved for: ${JSON.stringify(r.exitPolicy.nonzeroReservedFor)}`);
}

{
  // An INVALID cohort must never read as a scientific verdict, whatever the
  // biology looks like.
  const legs = [manifestFor([1], { runs: [okRun(1)] })];
  const r = evaluateCohort({
    armName: 'flatline', expectedSeeds: [1, 2], legs,
    criteria: [{ id: 'x', metric: 'pop', op: '>', value: 0, required: 1, statement: 'x' }],
  });
  check('W6r', 'an INVALID cohort reports no scientific verdict at all',
    !r.pass && r.classification === 'not measured' && r.headline.includes('EVIDENCE INVALID'),
    `class=${r.classification} — ${r.headline}`);
}

// --- Review finding: identity absent from EVERY leg ------------------------
// The guard was `missing > 0 && seen.size > 0`, so when no leg recorded a
// field the comparison set was empty and the field was silently skipped.
for (const f of ['engine', 'commit', 'armSpecHash']) {
  const legs = [1, 2].map((i) => {
    const id = { ...manifestFor([i]).identity };
    delete id[f];
    return manifestFor([i], { runs: [okRun(i)], identity: id });
  });
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2], legs });
  check(`W6s-${f}`, `identity absent from ALL legs (${f}) fails the cohort`,
    !r.pass && r.detail.includes(f),
    `pass=${r.pass} — ${r.detail}`);
}

{
  // A declared expectation must be satisfied by a PRESENT value, not skipped
  // because nothing recorded one.
  const legs = [manifestFor([1], { runs: [okRun(1)], identity: {} })];
  const r = evaluateCohort({
    armName: 'flatline', expectedSeeds: [1], legs, expect: { engine: 'ts-evo-poc/0.6.0' },
  });
  check('W6t', 'a declared identity no leg records is a failure, not a skip',
    !r.pass && r.detail.includes('cannot be verified'),
    `pass=${r.pass} — ${r.detail}`);
}

// --- Review finding: cohort must re-derive the per-seed verdict -------------
// The verifier trusted the leg's `failures` array to be complete. A corrupted
// or legacy manifest with empty failures and an out-of-tolerance residual passed.
{
  const legs = [manifestFor([1], {
    runs: [{ ...okRun(1), residualPct: 0.9 }],
    failures: [], // the leg claims nothing went wrong
  })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6u', 'an out-of-tolerance residual fails even with an EMPTY failures array',
    !r.pass && r.detail.includes('0.5% tolerance'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const legs = [manifestFor([1], { runs: [{ ...okRun(1), ledgerStatus: 'contradictory' }], failures: [] })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6v', 'a non-ok ledgerStatus fails even with an EMPTY failures array',
    !r.pass && /ledger status/.test(r.detail),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const legs = [manifestFor([1], { runs: [{ ...okRun(1), capturePolicyOk: false }], failures: [] })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6w', 'a failed capturePolicyOk fails even with an EMPTY failures array',
    !r.pass && r.detail.includes('capture policy'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  // An absent status is unverifiable, which is not the same as compliant.
  const { ledgerStatus, ...noStatus } = okRun(1);
  const legs = [manifestFor([1], { runs: [noStatus], failures: [] })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6x', 'an ABSENT ledgerStatus fails rather than passing by omission',
    !r.pass && r.detail.includes('ledgerStatus'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const { capturePolicyOk, ...noCap } = okRun(1);
  const legs = [manifestFor([1], { runs: [noCap], failures: [] })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6y', 'an ABSENT capturePolicyOk fails rather than passing by omission',
    !r.pass && r.detail.includes('capturePolicyOk'),
    `pass=${r.pass} — ${r.detail}`);
}

// --- Review finding: the cohort must be checked against the REQUESTED run ----
// Cross-leg agreement proves the legs came from the same place. It does not
// prove they came from the place that was ASKED FOR.
{
  // A complete, internally consistent panel for a different arm.
  const legs = [manifestFor([1, 2], { runs: [okRun(1), okRun(2)], arm: 'consumer-yield' })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2], legs });
  check('W6z', 'legs that internally agree but are a DIFFERENT ARM are rejected',
    !r.pass && r.detail.includes('arm'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  // Every leg driven by a different (edited) arms.json than the one supplied.
  const legs = [manifestFor([1, 2], {
    runs: [okRun(1), okRun(2)],
    identity: { engine: 'ts-evo-poc/0.6.0', commit: 'abc123', armSpecHash: 'a-different-hash', ticks: 6000 },
  })];
  const r = evaluateCohort({
    armName: 'flatline', expectedSeeds: [1, 2], legs, expect: { armSpecHash: 'the-supplied-hash' },
  });
  check('W7o', 'a cohort driven by a DIFFERENT arms.json is rejected',
    !r.pass && r.detail.includes('armSpecHash'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const legs = [manifestFor([1, 2], {
    runs: [okRun(1), okRun(2)],
    identity: { engine: 'ts-evo-poc/0.6.0', commit: 'abc123', armSpecHash: 'h1', ticks: 12000 },
  })];
  const r = evaluateCohort({
    armName: 'flatline', expectedSeeds: [1, 2], legs, expect: { armSpecHash: 'h1' },
  });
  check('W7p', 'a matching arms.json hash passes',
    r.pass, `pass=${r.pass} — ${r.detail}`);
}

{
  // Declared horizon mismatch: the run overrode to 24000 against a 6000 arm.
  const legs = [manifestFor([1], { runs: [okRun(1)], declaredTicks: 24000 })];
  const r = evaluateCohort({
    armName: 'flatline', expectedSeeds: [1], legs, expect: { declaredTicks: 6000 },
  });
  check('W7q', 'a declared-horizon mismatch is rejected',
    !r.pass && r.detail.includes('declaredTicks'),
    `pass=${r.pass} — ${r.detail}`);
}

// --- Review finding: finalTick must match the verified horizon --------------
{
  const legs = [manifestFor([1], {
    runs: [{ ...okRun(1), finalTick: 3000 }],
    // deliberately EMPTY: the verifier must not rely on the runner noticing
    headerMismatches: [],
  })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W7r', 'a finalTick earlier than the cohort horizon is rejected even with EMPTY headerMismatches',
    !r.pass && r.detail.includes('final checkpoint is tick 3000'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  const legs = [manifestFor([1], { runs: [okRun(1)], headerMismatches: [] })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W7s', 'a finalTick equal to the cohort horizon passes',
    r.pass, `pass=${r.pass} — ${r.detail}`);
}

// --- Review finding: executed horizon must equal the REGISTERED horizon -----
// ticksOverrideApplied is a claim the manifest makes about itself. If the two
// recorded numbers disagree, the evidence disagrees even when the flag says
// otherwise.
{
  const legs = [manifestFor([1], {
    runs: [{ ...okRun(1), finalTick: 3000 }],
    ticksOverrideApplied: false, // the manifest's own story is "no override"
    declaredTicks: 6000,
    identity: { engine: 'ts-evo-poc/0.6.0', commit: 'abc123', armSpecHash: 'h1', ticks: 3000 },
  })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W7t', 'ticks != declaredTicks fails even when ticksOverrideApplied is FALSE',
    !r.pass && r.detail.includes('EXECUTED to tick 3000'),
    `pass=${r.pass} — ${r.detail}`);
}

{
  // The flag alone must still be honoured: an override back to the declared
  // value is still not the pre-registered run.
  const legs = [manifestFor([1], {
    runs: [okRun(1)],
    ticksOverrideApplied: true,
    declaredTicks: 12000,
    identity: { engine: 'ts-evo-poc/0.6.0', commit: 'abc123', armSpecHash: 'h1', ticks: 12000 },
  })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W7u', 'ticksOverrideApplied is still honoured independently of the value check',
    !r.pass && r.detail.includes('HORIZON OVERRIDE'),
    `pass=${r.pass} — ${r.detail}`);
}

// --- Review finding: preflight must reject what the KIT rejects -------------
// Preflight that accepts a value the run will reject reports success first and
// then fails the expensive screen on the same value.
{
  let threw = null;
  try { expandSeeds('0'); } catch (e) { threw = e.message; }
  check('W7v', 'preflight rejects seed 0, which the diagnostic kit rejects',
    threw !== null, `expandSeeds('0') -> ${threw ?? 'NO ERROR (kit would reject it later)'}`);
}

{
  let threw = null;
  try { expandSeeds('4294967296'); } catch (e) { threw = e.message; }
  check('W7w', 'preflight rejects a seed above the kit 2^32-1 bound',
    threw !== null, `expandSeeds('4294967296') -> ${threw ?? 'NO ERROR'}`);
}

{
  // Inside the kit's bound and still fine — the guard must not be over-tight.
  check('W7x', 'a seed at the kit boundary is still accepted',
    expandSeeds('4294967295').length === 1 && expandSeeds('1').length === 1,
    `expandSeeds('4294967295') and expandSeeds('1') both accepted`);
}

{
  // `strictlyPositiveInt` in the kit requires a safe integer, so a 20-digit
  // ticks passes a naive "is it a number > 0" test and dies at run time.
  const r = runCli('tools/diagnostics/plan-seeds.mjs',
    ['cli', '1:10', '4', '99999999999999999999', '100', 'balanced', 'config-only', 'nutrientRegen']);
  check('W7y', 'preflight rejects a non-safe-integer ticks, which strictlyPositiveInt rejects',
    r.code === 2 && r.out.includes('::error::'),
    `exit=${r.code} — ${r.out.trim().slice(0, 90)}`);
}

{
  const r = runCli('tools/diagnostics/plan-seeds.mjs',
    ['cli', '0', '4', '1500', '100', 'balanced', 'config-only', 'nutrientRegen']);
  check('W7z', 'the CLI preflight rejects seed 0 end to end',
    r.code === 2 && r.out.includes('::error::'),
    `exit=${r.code} — ${r.out.trim().slice(0, 90)}`);
}

{
  const legs = [manifestFor([1], { runs: [{ ...okRun(1), residualPct: null }] })];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1], legs });
  check('W6e', 'an ABSENT ledger value fails the cohort',
    !r.pass, `pass=${r.pass} — ${r.detail}`);
}

{
  // Found by running the real chain end to end: both legs agreed on the
  // horizon, so the cohort looked internally consistent and reported a
  // confident verdict — while the criteria are declared at a different horizon.
  // An override must not masquerade as the pre-registered test.
  const criteria = [{ id: 'consumers-viable', metric: 'cons', op: '>', value: 0, required: 1, statement: 'cons > 0 at tick 6000' }];
  const legs = [
    manifestFor([1], {
      runs: [okRun(1)],
      ticksOverrideApplied: true, declaredTicks: 6000,
      identity: { engine: 'ts-evo-poc/0.6.0', commit: 'abc123', armSpecHash: 'h1', ticks: 200 },
    }),
    manifestFor([2], {
      runs: [{ ...okRun(2), finalTick: 200 }],
      ticksOverrideApplied: true, declaredTicks: 6000,
      identity: { engine: 'ts-evo-poc/0.6.0', commit: 'abc123', armSpecHash: 'h1', ticks: 200 },
    }),
  ];
  const r = evaluateCohort({ armName: 'consumer-yield', expectedSeeds: [1, 2], legs, criteria });
  check('W6l', 'a HORIZON OVERRIDE cannot report the pre-registered verdict',
    !r.pass && r.classification === 'not measured' && r.detail.includes('HORIZON OVERRIDE'),
    `class=${r.classification} — ${r.detail}`);
}

{
  // The distinction the issue is really about: the jobs succeeded, and the
  // biology was falsified. Those are different statements.
  const legs = [
    manifestFor([1, 2], { runs: [{ ...okRun(1), pop: 4 }, { ...okRun(2), pop: 0 }] }),
  ];
  const criteria = [{ id: 'surviving', metric: 'pop', op: '>=', value: 1, required: 2, statement: 'pop >= 1 on >= 2/2 seeds' }];
  const r = evaluateCohort({ armName: 'flatline', expectedSeeds: [1, 2], legs, criteria });
  check('W6f', 'a FALSIFIED hypothesis is reported as falsified, not as a run failure',
    r.pass && r.classification === 'falsified',
    `pass=${r.pass} class=${r.classification} — ${r.detail}`);
}

// ===========================================================================
// W7 — the workflow CLIs are actually EXECUTED, not merely imported
// ===========================================================================
// A regression shipped here that every other check missed: adding a `prereg`
// subcommand changed the argument parsing, and `plan-legs.js <arm> <legs>` —
// the exact call the ladder workflow's plan job makes — began exiting 2. The
// ladder became entirely undispatchable.
//
// Nothing caught it because the CLIs were never RUN. They were read, reviewed,
// and reasoned about, and every other fixture exercised a different file. The
// defect class is not "bad argument parsing"; it is "a path nothing executes".
// These fixtures execute both CLIs exactly as the workflows invoke them.

import { execFileSync } from 'node:child_process';

/**
 * Run a workflow CLI and capture stdout/exit code without throwing.
 *
 * `GITHUB_OUTPUT` / `GITHUB_STEP_SUMMARY` are stripped from the child
 * environment. Inherited, they would make the `prereg` invocation append this
 * fixture's output to the REAL job summary, and a planner invocation would
 * truncate the real step output file. A test harness that scribbles on the
 * build it is running inside is its own source of confusing evidence.
 */
function runCli(rel, args, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  delete env.GITHUB_OUTPUT;
  delete env.GITHUB_STEP_SUMMARY;
  Object.assign(env, extraEnv);
  try {
    const out = execFileSync(process.execPath, [rel, ...args], {
      cwd: root, encoding: 'utf8', timeout: 30000, env,
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

{
  // The ladder plan job's exact invocation.
  const r = runCli('tools/ladder/plan-legs.js', ['flatline', '6']);
  check('W7a', 'plan-legs.js <arm> <legs> succeeds (the ladder plan job call)',
    r.code === 0 && /legs=6/.test(r.out),
    `exit=${r.code} — ${r.out.trim() || '(no output)'}`);
}

{
  const r = runCli('tools/ladder/plan-legs.js', ['bogus', '6']);
  check('W7b', 'plan-legs.js rejects an unknown arm',
    r.code !== 0 && /unknown arm/.test(r.out),
    `exit=${r.code} — ${r.out.trim().slice(0, 90)}`);
}

{
  const r = runCli('tools/ladder/plan-legs.js', ['prereg', 'flatline']);
  check('W7c', 'plan-legs.js prereg <arm> prints the pre-registration',
    r.code === 0 && /Pre-registration/.test(r.out) && /falsified if/.test(r.out),
    `exit=${r.code} — ${r.out.trim().split('\n')[0]}`);
}

{
  // Both forms must keep working together; a keyword dispatch that shifts
  // positional args is exactly the regression this section exists to catch.
  const plan = runCli('tools/ladder/plan-legs.js', ['flatline', '3']);
  const prereg = runCli('tools/ladder/plan-legs.js', ['prereg', 'flatline']);
  check('W7d', 'positional and subcommand invocations coexist',
    plan.code === 0 && prereg.code === 0,
    `plan exit=${plan.code}, prereg exit=${prereg.code}`);
}

{
  const r = runCli('tools/diagnostics/plan-seeds.mjs', ['panel', '1:10', '4']);
  check('W7e', 'plan-seeds.mjs panel expands a range for the shell planner',
    r.code === 0 && r.out.trim() === '1,2,3,4,5,6,7,8,9,10',
    `exit=${r.code} out="${r.out.trim()}"`);
}

{
  const r = runCli('tools/diagnostics/plan-seeds.mjs', ['cli', '1:10', '4', '1500', '100', 'balanced', 'config-only', 'nutrientRegen']);
  check('W7f', 'plan-seeds.mjs cli validates every dispatch input',
    r.code === 0 && /validated/.test(r.out),
    `exit=${r.code} — ${r.out.trim() || '(no output)'}`);
}

{
  // An adversarial dispatch value must be refused as DATA at the CLI boundary,
  // which is where it actually enters the process.
  const r = runCli('tools/diagnostics/plan-seeds.mjs', ['panel', '$(id)', '4']);
  check('W7g', 'plan-seeds.mjs refuses a shell-metacharacter panel',
    r.code === 2 && r.out.includes('::error::') && !r.out.includes('at async'),
    `exit=${r.code} — ${(r.out.trim() || '(no output)').slice(0, 90)}`);
}

{
  const r = runCli('tools/diagnostics/plan-seeds.mjs', ['cli', '1:10', '4', '$(id)', '100', 'balanced', 'config-only', 'nutrientRegen']);
  check('W7h', 'plan-seeds.mjs cli refuses a non-integer ticks CLEANLY',
    r.code === 2 && r.out.includes('::error::') && !r.out.includes('at async'),
    `exit=${r.code} — ${(r.out.trim() || '(no output)').slice(0, 90)}`);
}

{
  // The seeds/legs arguments go through a different code path than ticks. A
  // crash there would still block the workflow, but it would be reported as a
  // stack trace rather than as the bad input it is.
  const r = runCli('tools/diagnostics/plan-seeds.mjs', ['cli', '$(id)', '4', '1500', '100', 'balanced', 'config-only', 'nutrientRegen']);
  check('W7i', 'plan-seeds.mjs cli refuses a bad SEED panel cleanly',
    r.code === 2 && r.out.includes('::error::') && !r.out.includes('at async'),
    `exit=${r.code} — ${(r.out.trim() || '(no output)').slice(0, 90)}`);
}

{
  const r = runCli('tools/diagnostics/plan-seeds.mjs', ['cli', '1:10', '4; id', '1500', '100', 'balanced', 'config-only', 'nutrientRegen']);
  check('W7j', 'plan-seeds.mjs cli refuses a non-integer LEG count cleanly',
    r.code === 2 && r.out.includes('::error::') && !r.out.includes('at async'),
    `exit=${r.code} — ${(r.out.trim() || '(no output)').slice(0, 90)}`);
}

{
  // The ladder plan job consumes `matrix=` / `legs=` from GITHUB_OUTPUT, not
  // stdout. Writing that file was previously unexercised, so the artifact the
  // workflow actually depends on had no guard at all.
  const tmp = join(root, 'build', 'workflow-checks-gh-output.tmp');
  mkdirSync(join(root, 'build'), { recursive: true });
  const r = runCli('tools/ladder/plan-legs.js', ['flatline', '3'], { GITHUB_OUTPUT: tmp });
  let parsed = null;
  let detail = `exit=${r.code}`;
  try {
    const text = readFileSync(tmp, 'utf8');
    const m = /matrix=(\[[^\]]*\])/.exec(text);
    const g = /legs=(\d+)/.exec(text);
    parsed = m && g ? JSON.parse(m[1]) : null;
    detail = `exit=${r.code} wrote "${text.trim()}"`;
  } catch (err) {
    detail = `exit=${r.code} — GITHUB_OUTPUT unreadable: ${err.message}`;
  }
  rmSync(tmp, { force: true });
  check('W7k', 'plan-legs.js writes the GITHUB_OUTPUT matrix the ladder job reads',
    r.code === 0 && parsed !== null && parsed.length === 3 && parsed[0] === 0,
    detail);
}

// The cohort CLI's EXIT MAPPING is the load-bearing consequence of the Owner
// decision: falsification exits 0, integrity violation exits 1. W6p proves the
// function returns pass===true for a falsified cohort; nothing proved the
// PROCESS exits 0, so a later edit could have inverted the mapping and every
// function-level fixture would still be green. This runs the real CLI.
{
  const mkPanel = (dir, mutate) => {
    const seeds = Array.from({ length: 18 }, (_, i) => 41001 + i);
    const runs = seeds.map((s) => ({
      seed: s, prod: 1, cons: 1, dec: 1, pop: 1, finalTick: 6000,
      totalInput: 300, residualPct: 0.01, residualOk: true,
      ledgerStatus: 'ok', capturePolicyOk: true,
    }));
    const m = {
      arm: 'consumer-yield',
      // Must match what the verifier derives from the supplied arms.json, or the
      // cohort is rejected for binding before it ever reaches a verdict.
      identity: {
        engine: 'ts-evo-poc/0.6.0', commit: 'FIXTURE', ticks: 6000,
        armSpecHash: createHash('sha256')
          .update(readFileSync(join(root, 'tools/ladder/arms.json'), 'utf8')).digest('hex'),
      },
      declaredTicks: 6000,
      ticksOverrideApplied: false,
      seeds, runs, failures: [], headerMismatches: [], warnings: [],
    };
    mutate?.(m, seeds);
    mkdirSync(join(root, 'build', dir), { recursive: true });
    writeFileSync(join(root, 'build', dir, 'manifest.json'), JSON.stringify(m, null, 2));
    return join(root, 'build', dir);
  };

  // consumer-yield's criteria need cons>0 on >=12/18 and all guilds on >=12/18,
  // so FALSIFYING needs at least 7 failing seeds. With 9 dead seeds both
  // clauses land on 9/18.
  const falsified = mkPanel('wc-falsified', (m, seeds) => {
    for (const r of m.runs) { if (seeds.indexOf(r.seed) < 9) { r.cons = 0; r.dec = 0; r.pop = 0; } }
  });
  const f = runCli('tools/ladder/cohort-verify.mjs',
    ['tools/ladder/arms.json', 'consumer-yield', falsified]);
  check('W7l', 'a FALSIFIED cohort exits 0 and leads with the verdict',
    f.code === 0 && f.out.includes('PREDICTION FALSIFIED') && f.out.includes('NOT because anything was confirmed'),
    `exit=${f.code} — ${f.out.trim().split('\n').find((l) => l.includes('FALSIFIED')) ?? f.out.trim().slice(0, 120)}`);

  const invalid = mkPanel('wc-invalid', (m, seeds) => {
    m.runs = m.runs.filter((r) => r.seed !== 41018); // a claimed seed with no run
  });
  const v = runCli('tools/ladder/cohort-verify.mjs',
    ['tools/ladder/arms.json', 'consumer-yield', invalid]);
  check('W7m', 'an INVALID cohort exits NON-ZERO and issues no verdict',
    v.code !== 0 && v.out.includes('EVIDENCE INVALID') && !v.out.includes('PREDICTION FALSIFIED'),
    `exit=${v.code} — ${v.out.trim().split('\n').find((l) => l.includes('INVALID')) ?? '(no verdict line)'}`);

  const corrupt = mkPanel('wc-corrupt');
  writeFileSync(join(corrupt, 'manifest.json'), '{ this is not json');
  const c = runCli('tools/ladder/cohort-verify.mjs',
    ['tools/ladder/arms.json', 'consumer-yield', corrupt]);
  check('W7n', 'a CORRUPT manifest fails cleanly, not with a stack trace',
    c.code !== 0 && c.out.includes('::error::') && !c.out.includes('at async'),
    `exit=${c.code} — ${c.out.trim().slice(0, 120)}`);

  for (const d of ['wc-falsified', 'wc-invalid', 'wc-corrupt']) {
    rmSync(join(root, 'build', d), { recursive: true, force: true });
  }
}

// ===========================================================================
// W8 — concurrency policy must actually preserve dispatched experiments
// ===========================================================================
// GitHub's documented default is `queue: single`: a new run CANCELS the pending
// run in the same group. That silently drops experiments. `queue: max` preserves
// up to 100 pending runs, and `queue: max` together with
// `cancel-in-progress: true` is a workflow VALIDATION ERROR — the workflow would
// not run at all.
//
// A previous version of this change grouped on `github.run_attempt` believing it
// was a dispatch identity. It is not: it starts at 1 for every newly dispatched
// run, so same-arm dispatches still collided and the first was still dropped.
// These fixtures read the workflow, so that cannot come back silently.
//
// THIS CANNOT PROVE RUN-QUEUING BEHAVIOUR — only Actions can. It proves the
// declared policy is the one we intend. Exercising several pending dispatches is
// a manual Actions step, recorded as unproven in REPORT.md.
for (const [wfPath, label] of [
  ['.github/workflows/diagnostics.yml', 'diagnostics'],
  ['.github/workflows/ladder.yml', 'ladder'],
]) {
  const text = readFileSync(join(root, wfPath), 'utf8');
  // `concurrency:` plus every following INDENTED line, and nothing else. A
  // non-greedy repetition here silently captures only the header, which is how
  // a guard can report the policy it cannot actually see.
  const block = /^concurrency:[ \t]*\n(?:[ \t]+[^\n]*\n?)*/m.exec(text)?.[0] ?? '';

  check(`W8-${label}`, `${label} concurrency QUEUES pending runs rather than cancelling them`,
    /^[ \t]*queue:[ \t]*max[ \t]*$/m.test(block),
    `declared block:${block ? '\n' + block.trimEnd() : ' NOT FOUND'}`);
}

for (const [wfPath, label] of [
  ['.github/workflows/diagnostics.yml', 'diagnostics'],
  ['.github/workflows/ladder.yml', 'ladder'],
]) {
  const text = readFileSync(join(root, wfPath), 'utf8');
  const block = /^concurrency:[ \t]*\n(?:[ \t]+[^\n]*\n?)*/m.exec(text)?.[0] ?? '';
  const queues = /^[ \t]*queue:[ \t]*max[ \t]*$/m.test(block);
  const cancels = /^[ \t]*cancel-in-progress:[ \t]*true[ \t]*$/m.test(block);
  check(`W8-${label}-valid`, `${label} does not combine queue:max with cancel-in-progress:true`,
    !(queues && cancels),
    queues && cancels
      ? 'INVALID COMBINATION — GitHub rejects this workflow at parse time'
      : `queue:max=${queues}, cancel-in-progress:true=${cancels}`);
}

// ===========================================================================

console.log(`\n${results.length - failed}/${results.length} workflow checks passed`);
if (failed > 0) {
  console.error('FAILED:');
  for (const r of results.filter((x) => !x.pass)) console.error(`  ${r.id} ${r.name}`);
}
process.exit(failed > 0 ? 1 : 0);
