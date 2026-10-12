/**
 * Evidence validation for ladder arms — PURE functions, no I/O, no dependencies.
 *
 * Split out of run-arm.mjs so the failure paths can be tested in CI without
 * running a 36-seed x 12000-tick simulation. The runner used to be one script
 * whose only reachable paths required a real probe run, which is why the
 * defects this file addresses could sit in it unnoticed: every branch that
 * mattered was a branch that only runs when something has already gone wrong.
 *
 * THE THREE DISTINCT OUTCOMES. An arm leg that reports a number has to have
 * earned it. These are not the same event and must not be collapsed:
 *
 *   MISSING     the measurement was never taken. A `null` that silently skips
 *               a tolerance check is the single most dangerous state in the
 *               ladder, because the leg then looks green while having checked
 *               nothing. This is why parseLedgerStrict never returns null.
 *   VIOLATION   a measurement exists and the books do not balance (or the run
 *               violated its declared capture policy). The engine is suspect.
 *   VALID       a complete, finite, self-consistent measurement that is inside
 *               tolerance. The only case in which a number may be reported.
 *
 * WHAT IS AND IS NOT CHECKABLE FROM THE LEDGER LINE.
 *
 * The line prints `detritus` = the SUSPENDED pool only. The engine's residual
 * is (input - (biomass + detritus + sediment + litter + dissipated)) / input,
 * and sediment and litter are NOT printed. So residualPct canNOT be recomputed
 * from the printed fields, and no check here pretends otherwise. What CAN be
 * established, because every term is printed, is the set of identities below.
 * `accounted <= totalInput` is sound for the same reason in reverse: sediment
 * and litter are non-negative, so the printed (partial) accounted total can
 * never exceed total input. A line where it does is self-contradictory.
 */

/** Guild index order used by the ledger's per-guild capture breakdown. */
export const GUILD_NAMES = ['producer', 'consumer', 'decomposer'];

/**
 * The only dials that SANCTION guild capture under `--zero`, indexed by guild.
 *
 * These three are the photosynthetic capture scales, one per guild. Lifting
 * one permits that guild to earn energy and forbids the other two. Every other
 * liftable dial governs a different energy path -- basalFoodPerCell books as
 * `organic`, nutrientRegen/excretionRate are matter sources, and the yield
 * dials govern trophic transfer -- so lifting one of those must NOT be read as
 * permission for a guild to photosynthesise.
 *
 * Getting this backwards is the failure mode issue #5 item 2 describes:
 * accounting balances perfectly while a forbidden input is booked as capture.
 */
export const CAPTURE_DIAL_BY_GUILD = ['producerCaptureScale', 'consumerPhotoScale', 'decomposerPhotoScale'];

/** Parse the senesprobe/scenesprobe header without losing colon-bearing settings. */
export function parseSenescenceHeader(line) {
  if (!line.startsWith('SENESCENCE ')) throw new Error(`unexpected header: ${line.slice(0, 80)}`);
  const cfg = {};
  for (const tok of line.slice('SENESCENCE '.length).split(/\s+(?=[a-z]+[x=])/)) {
    const eq = tok.indexOf('=');
    if (eq > 0) cfg[tok.slice(0, eq)] = tok.slice(eq + 1);
  }
  return cfg;
}

/** Return direct header mismatches for the identity fields the probe echoes. */
export function senescenceHeaderMismatches(cfg, { seed, ticks, setting }) {
  const want = { seed: String(seed), ticks: String(ticks), setting: String(setting) };
  const mismatch = Object.fromEntries(Object.entries(want)
    .filter(([key, value]) => cfg[key] !== value)
    .map(([key, value]) => [key, { want: value, got: cfg[key] ?? null }]));
  return Object.keys(mismatch).length ? [{ want, got: cfg, mismatch }] : [];
}

/** Every numeric field the LEDGER line must carry. */
export const LEDGER_NUMERIC_FIELDS = [
  'totalInput', 'founding', 'capture', 'organic',
  'biomass', 'detritus', 'dissipated', 'accounted', 'residualPct',
];

/** Fields that cannot be negative: each is a physical quantity, not a balance. */
const NON_NEGATIVE_FIELDS = [
  'totalInput', 'founding', 'capture', 'organic',
  'biomass', 'detritus', 'dissipated', 'accounted',
];

/**
 * Conservation failure threshold, percent of total input. Matches the tolerance
 * gate G3 uses, deliberately: the ladder must not be laxer than the gate that
 * guards the engine it is measuring.
 */
export const RESIDUAL_TOLERANCE_PCT = 0.5;

/**
 * Capture-zero tolerance, absolute units.
 *
 * Tied to the probe's OUTPUT PRECISION, not chosen for convenience: the LEDGER
 * line prints every capture component with toFixed(1), so any true value below
 * 0.05 already prints as "0.0" and is unrecoverable. 0.05 is therefore the
 * tightest threshold this measurement can support. Stated plainly rather than
 * left implicit: a guild capturing less than 0.05 total energy units over a
 * whole run is invisible to this check. That is a known limit of the
 * measurement, not a claim that such capture is impossible.
 */
export const CAPTURE_ZERO_TOLERANCE = 0.05;

/** Rounding slack for identities computed from toFixed(1) fields. */
const PRINT_ROUNDING_SLACK = 0.5;

/**
 * Parse the probe's LEDGER line into a strictly validated ledger.
 *
 * Never returns null and never returns a partially-populated ledger that looks
 * usable. A caller that ignores `problems` still gets `status !== 'ok'`, which
 * is the property that makes "a missing measurement cannot read as a pass".
 *
 * @param {string[]} lines raw probe stdout split into lines
 * @returns {{status: string, ledger: object|null, problems: string[]}}
 */
export function parseLedgerStrict(lines) {
  const problems = [];
  const line = (lines ?? []).find((l) => typeof l === 'string' && l.startsWith('LEDGER '));
  if (line === undefined) {
    return {
      status: 'missing',
      ledger: null,
      problems: ['probe emitted no LEDGER line; conservation was never measured'],
    };
  }

  const raw = {};
  for (const tok of line.slice('LEDGER '.length).trim().split(/\s+/)) {
    const eq = tok.indexOf('=');
    if (eq > 0) raw[tok.slice(0, eq)] = tok.slice(eq + 1);
  }

  // --- presence -------------------------------------------------------------
  const absent = [];
  for (const k of LEDGER_NUMERIC_FIELDS) {
    if (!(k in raw)) absent.push(k);
  }
  if (!('captureByGuild' in raw)) absent.push('captureByGuild');
  if (absent.length > 0) {
    return {
      status: 'malformed',
      ledger: null,
      problems: [`LEDGER line is missing required field(s): ${absent.join(', ')}`],
    };
  }

  // --- finite numeric values ------------------------------------------------
  // A bare `-?[\d.]+` regex would accept "1.2.3" as a capture of something, and
  // Number('NaN') silently yields the NaN that used to slip past the tolerance
  // check. Numeric shape is therefore validated separately from finiteness so
  // the two failures stay distinguishable in the manifest.
  const NUMERIC = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
  let nonFinite = false;
  let malformed = false;

  const ledger = {};
  for (const k of LEDGER_NUMERIC_FIELDS) {
    const tok = raw[k];
    if (!NUMERIC.test(tok)) {
      // Distinguish "this token names a non-finite quantity" from "this token is
      // not a number at all". Both are rejected; keeping them apart means a
      // manifest can tell an engineer which one actually happened.
      if (/nan|inf/i.test(tok)) {
        nonFinite = true;
        problems.push(`LEDGER field '${k}' is not finite: '${tok}'`);
      } else {
        malformed = true;
        problems.push(`LEDGER field '${k}' is not a number: '${tok}'`);
      }
      continue;
    }
    const v = Number(tok);
    if (!Number.isFinite(v)) {
      nonFinite = true;
      problems.push(`LEDGER field '${k}' is not finite: '${tok}'`);
      continue;
    }
    ledger[k] = v;
  }

  const guildTok = raw.captureByGuild;
  const guildParts = guildTok.split('/');
  if (guildParts.length !== GUILD_NAMES.length) {
    malformed = true;
    problems.push(
      `captureByGuild must carry exactly ${GUILD_NAMES.length} guild values, got ${guildParts.length}: '${guildTok}'`,
    );
  }
  const captureByGuild = [];
  for (const p of guildParts) {
    if (!NUMERIC.test(p)) {
      nonFinite = nonFinite || /nan|inf/i.test(p);
      malformed = malformed || !/nan|inf/i.test(p);
      problems.push(`captureByGuild entry is not a number: '${p}'`);
      continue;
    }
    const v = Number(p);
    if (!Number.isFinite(v)) {
      nonFinite = true;
      problems.push(`captureByGuild entry is not finite: '${p}'`);
      continue;
    }
    captureByGuild.push(v);
  }
  ledger.captureByGuild = captureByGuild;

  if (nonFinite) return { status: 'nonfinite', ledger: null, problems };
  if (malformed) return { status: 'malformed', ledger: null, problems };

  // --- self-consistency -----------------------------------------------------
  // These identities hold by construction in the probe, which is exactly why
  // they are worth asserting: a truncated, reordered, corrupted or hand-edited
  // LEDGER line still parses as numbers, and only the identities expose it.
  for (const k of NON_NEGATIVE_FIELDS) {
    if (ledger[k] < 0) {
      problems.push(`LEDGER field '${k}' is negative (${ledger[k]}); that quantity cannot be`);
    }
  }
  for (let g = 0; g < captureByGuild.length; g++) {
    if (captureByGuild[g] < 0) {
      problems.push(`captureByGuild[${GUILD_NAMES[g]}] is negative (${captureByGuild[g]})`);
    }
  }

  const guildSum = captureByGuild.reduce((a, b) => a + b, 0);
  checkIdentity(problems, 'capture == sum(captureByGuild)',
    ledger.capture, guildSum, PRINT_ROUNDING_SLACK);
  checkIdentity(problems, 'totalInput == founding + capture + organic',
    ledger.totalInput, ledger.founding + ledger.capture + ledger.organic, PRINT_ROUNDING_SLACK);
  checkIdentity(problems, 'accounted == biomass + detritus + dissipated',
    ledger.accounted, ledger.biomass + ledger.detritus + ledger.dissipated, PRINT_ROUNDING_SLACK);

  // Monotonicity, not an equality: sediment and litter are real, non-negative,
  // and omitted from the printed `detritus`. So accounted (partial) must sit at
  // or below totalInput. Equality is impossible here; excess is a defect.
  if (ledger.accounted > ledger.totalInput + PRINT_ROUNDING_SLACK) {
    problems.push(
      `accounted (${ledger.accounted}) exceeds totalInput (${ledger.totalInput}); ` +
        `the printed sinks exceed every source, which cannot happen`,
    );
  }

  if (problems.length > 0) return { status: 'contradictory', ledger: null, problems };
  return { status: 'ok', ledger, problems: [] };
}

/** Assert |a - b| <= slack, recording a readable message on failure. */
function checkIdentity(problems, name, a, b, slack) {
  const diff = Math.abs(a - b);
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  if (diff > slack && diff > 1e-9 * scale) {
    problems.push(`ledger identity failed: ${name} (${a} vs ${b}, diff ${diff.toFixed(3)} > ${slack})`);
  }
}

/**
 * Group a parse status into the three classes the ladder must report distinctly.
 *
 *   'missing'    -> 'measurement-missing'  (nothing was measured)
 *   'nonfinite'  -> 'measurement-invalid'  (measured, but the value is unusable)
 *   'malformed'  -> 'measurement-invalid'
 *   'contradictory' -> 'accounting-violation'
 *   'ok'         -> 'valid'
 */
export function classifyLedgerStatus(status) {
  switch (status) {
    case 'missing': return 'measurement-missing';
    case 'nonfinite':
    case 'malformed': return 'measurement-invalid';
    case 'contradictory': return 'accounting-violation';
    default: return 'valid';
  }
}

/**
 * Apply the residual tolerance to an already-validated ledger.
 * Only meaningful when status === 'ok'; returns pass=false otherwise so a
 * caller cannot accidentally read an unmeasured residual as an in-tolerance one.
 */
export function residualWithinTolerance(ledger) {
  if (!ledger || typeof ledger.residualPct !== 'number' || !Number.isFinite(ledger.residualPct)) {
    return { pass: false, detail: 'no finite residual to test' };
  }
  const pct = ledger.residualPct;
  const pass = Math.abs(pct) <= RESIDUAL_TOLERANCE_PCT;
  return {
    pass,
    detail: pass
      ? `residual ${pct}% within ${RESIDUAL_TOLERANCE_PCT}% tolerance`
      : `accounting residual ${pct}% exceeds ${RESIDUAL_TOLERANCE_PCT}% tolerance — ` +
        'energy conservation is violated on this seed',
  };
}

/**
 * Which guilds may capture under a given arm declaration.
 *
 * A guild is permitted only if its own capture scale is explicitly lifted.
 * Absence of a lift is prohibition: under `--zero` the default for every
 * capture dial is 0, so "not lifted" and "must be zero" are the same statement.
 *
 * @param {boolean} zero whether the arm declares `zero: true`
 * @param {Record<string, number>} lifts declared lifts
 * @returns {{permitted: boolean[], forbidden: boolean[]}}
 */
export function permittedGuilds(zero, lifts = {}) {
  // A lift must be a POSITIVE value. Presence alone is not permission:
  // `lifts: { producerCaptureScale: 0 }` lifts nothing, so treating the key's
  // existence as a licence would permit exactly the capture the arm forbids.
  const permitted = CAPTURE_DIAL_BY_GUILD.map(
    (dial) => !!zero && Number(lifts[dial]) > 0,
  );
  return { permitted, forbidden: permitted.map((p) => !p) };
}

/**
 * Enforce the declared capture policy against a validated ledger.
 *
 * An arm that is not a `--zero` arm has no capture prohibition, and this
 * returns pass=true immediately: inventing a prohibition the arm never declared
 * would fail honest arms for a rule they were not under.
 *
 * For a `--zero` arm: permitted guilds may capture freely; forbidden guilds
 * must be within CAPTURE_ZERO_TOLERANCE. This is asserted even when the ledger
 * balances, because a system can mint energy, book it as capture, and still
 * reconcile its books. That is precisely the defect PR #3 was written against.
 */
export function evaluateCapturePolicy({ ledger, zero, lifts, finalRow }) {
  if (!zero) return { pass: true, applicable: false, detail: 'arm is not a --zero arm; no capture prohibition declared' };
  if (!ledger) return { pass: false, applicable: true, detail: 'no validated ledger; capture policy cannot be enforced' };

  const { permitted, forbidden } = permittedGuilds(true, lifts);
  const problems = [];

  for (let g = 0; g < GUILD_NAMES.length; g++) {
    const v = ledger.captureByGuild[g] ?? NaN;
    if (!Number.isFinite(v)) {
      problems.push(`${GUILD_NAMES[g]} capture is not a measured number`);
      continue;
    }
    if (permitted[g]) continue;
    if (Math.abs(v) > CAPTURE_ZERO_TOLERANCE) {
      problems.push(
        `${GUILD_NAMES[g]} captured ${v} under --zero with no sanctioned lift ` +
          `(permitted lifts for this guild: ${CAPTURE_DIAL_BY_GUILD[g]})`,
      );
    }
  }

  // Non-vacuity. "Zero capture" is only evidence when the guild existed and
  // could have captured. If a guild held zero members at every checkpoint, the
  // check passed because there was nothing to test, which is a DIFFERENT
  // statement from "the guild was present and earned nothing" — but it is not a
  // violation either. It is reported separately as `vacuous` so the caller can
  // record it as a limitation of the measurement without failing the leg: a
  // `--zero` arm whose guild is never founded is legitimate biology, and
  // treating its absence as infrastructure failure would make such an arm
  // unpassable by construction.
  const vacuous = [];
  for (let g = 0; g < GUILD_NAMES.length; g++) {
    if (!forbidden[g]) continue;
    if (finalRow && finalRow.everNonZero && !finalRow.everNonZero[GUILD_NAMES[g]]) {
      vacuous.push(`${GUILD_NAMES[g]} was empty at every checkpoint, so its zero capture proves nothing`);
    }
  }

  const pass = problems.length === 0;
  const bits = [];
  if (!pass) bits.push(...problems);
  else {
    bits.push(
      'capture by guild ' +
        GUILD_NAMES.map((n, g) => `${n}=${ledger.captureByGuild[g]}`).join(' ') +
        (permitted.some((p) => p)
          ? ` (permitted: ${CAPTURE_DIAL_BY_GUILD.filter((_, g) => permitted[g]).join(', ')})`
          : ' (no capture lift declared)'),
    );
  }
  if (vacuous.length > 0) bits.push(...vacuous);
  return { pass, applicable: true, vacuous, detail: bits.join('; ') };
}

/**
 * Extract checkpoint rows and per-guild presence from probe output.
 *
 * Anchored on the leading tick plus the '|' separator so the trailing summary
 * lines, which also contain digits and slashes, cannot match.
 *
 * @returns {{final: object|null, everNonZero: Record<string, boolean>, rows: number}}
 */
export function parseCheckpoints(lines) {
  const everNonZero = { producer: false, consumer: false, decomposer: false };
  let final = null;
  let rows = 0;
  for (const line of lines ?? []) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\|/.exec(line);
    if (!m) continue;
    rows++;
    final = {
      tick: Number(m[1]), pop: Number(m[2]),
      prod: Number(m[3]), cons: Number(m[4]), dec: Number(m[5]),
    };
    if (final.prod > 0) everNonZero.producer = true;
    if (final.cons > 0) everNonZero.consumer = true;
    if (final.dec > 0) everNonZero.decomposer = true;
  }
  return { final, everNonZero, rows };
}
