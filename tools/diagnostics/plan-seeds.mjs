/**
 * Seed panel expansion and shard allocation. Dependency-free, no I/O.
 *
 * Split out of scripts/run-diagnostics.sh because the shell planner could not
 * see what the diagnostic kit sees. `1:10` is a VALID panel to the kit — its
 * own parser expands ranges — but the shell planner split only on comma and
 * space, so it counted `1:10` as ONE token, started ONE leg, and handed the
 * entire range to it. Four requested shards became one, silently, and the run
 * reported success.
 *
 * The rule this module exists to enforce: expand the panel ONCE, then allocate.
 * Two parsers reading the same string is how the two halves of a shard plan come
 * to disagree about what was requested.
 *
 * Allocation is round-robin over the expanded list, so a panel of one slow and
 * many fast seeds spreads the cost instead of concentrating it. It is
 * deterministic: the same (seeds, legs) always yields the same allocation, and
 * that equality is what W4c asserts.
 *
 * SCOPE — read before assuming production uses this. `allocateShards` is the
 * canonical round-robin DEFINITION and is exercised by the W4 fixtures, but it
 * is not what the diagnostics job runs: that path chunks contiguously in
 * scripts/run-diagnostics.sh, and the ladder shards by its own inline filter in
 * run-arm.mjs. Coverage is exact-once in all three. If you change the allocation
 * rule, change all three together or the leg-to-seed mapping will diverge — the
 * same "two answers to one question" failure item 4 exists to prevent.
 */

/** Upper bound on a single dispatch. A mistyped range must not burn unbounded CPU. */
export const MAX_SEEDS = 256;

/** Upper bound on parallel legs. Beyond this the runner gains nothing and CI loses. */
export const MAX_LEGS = 32;

/**
 * Seed value bounds, copied from the diagnostic kit's own `parseSeed`
 * (tools/diagnostics/evo-diagnostics.mjs).
 *
 * Preflight exists to reject at DISPATCH time what the run would reject later.
 * If the two disagree, validation passes and then the expensive screen fails on
 * the same value — which is worse than no validation, because it reports
 * success first. The kit rejects 0 and anything above 2^32-1 ("avoid 32-bit
 * aliases"), and requires a safe integer; so does this.
 */
export const MIN_SEED = 1;
export const MAX_SEED = 4294967295;

/**
 * MAX_SEEDS is deliberately TIGHTER than the kit's 10,000 and is not a copy of
 * it. This planner governs a dispatch that fans the panel out across parallel
 * legs on shared CI runners, so its bound is a resource decision; the kit's is a
 * memory guard for a single process. Both are intentional and neither is a bug.
 */

const DIGITS = /^\d+$/;

/** Positive safe integer, matching the kit's `strictlyPositiveInt`. */
export function parsePositiveSafeInt(raw, label) {
  const s = String(raw ?? '').trim();
  if (!DIGITS.test(s)) throw new Error(`${label} must be a positive integer, got '${raw}'`);
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${label} must be a positive safe integer, got '${raw}'`);
  return n;
}

/** One seed value under the kit's bounds. */
function validateSeedValue(n, token) {
  if (!Number.isSafeInteger(n) || n < MIN_SEED || n > MAX_SEED) {
    throw new Error(
      `integer seed ${token} must be in [${MIN_SEED},${MAX_SEED}] (avoid 32-bit aliases) — `
      + 'the diagnostic kit rejects these, so a screen would fail after preflight passed',
    );
  }
  return n;
}

/**
 * Expand a panel spec into an explicit, de-duplicated seed list.
 *
 * Accepts comma or whitespace separated parts; each part is either `n` or
 * `lo:hi` inclusive. Rejects reversed ranges, non-integers, oversized panels,
 * and anything that is not a plain integer — including shell metacharacters,
 * which are rejected as DATA here and therefore never reach a shell.
 *
 * @param {string} spec
 * @returns {number[]}
 */
export function expandSeeds(spec) {
  if (typeof spec !== 'string' || spec.trim() === '') {
    throw new Error('seed panel is empty; want "n", "lo:hi", or a comma-separated list');
  }
  const out = [];
  const seen = new Set();
  for (const part of spec.split(/[,\s]+/).filter((p) => p !== '')) {
    const range = /^(\d+):(\d+)$/.exec(part);
    if (range) {
      const lo = validateSeedValue(Number(range[1]), range[1]);
      const hi = validateSeedValue(Number(range[2]), range[2]);
      if (hi < lo) throw new Error(`reversed seed range '${part}'`);
      if (hi - lo + 1 > MAX_SEEDS) {
        throw new Error(`seed range '${part}' yields ${hi - lo + 1} seeds, over the ${MAX_SEEDS} limit`);
      }
      for (let s = lo; s <= hi; s++) add(s);
    } else if (DIGITS.test(part)) {
      add(validateSeedValue(Number(part), part));
    } else {
      throw new Error(`unparseable seed '${part}' (want an integer or "lo:hi")`);
    }
    if (out.length > MAX_SEEDS) {
      throw new Error(`seed panel exceeds the ${MAX_SEEDS} seed limit`);
    }
  }
  if (out.length === 0) throw new Error('seed panel expanded to zero seeds');

  function add(s) {
    if (seen.has(s)) return; // a seed repeated in the panel is one seed, not two
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Validate a leg count. Rejects everything that is not a plain positive
 * integer, so a value carrying shell syntax is refused rather than quoted into
 * a command line.
 */
export function parseLegs(raw) {
  const s = String(raw ?? '').trim();
  if (!DIGITS.test(s)) throw new Error(`legs must be a positive integer, got '${raw}'`);
  // Leading zeros are rejected rather than normalised, because LEGS is passed
  // through to the shell UNCHANGED and `/bin/sh` (dash) reads `08` as an
  // invalid octal digit and dies on `$(( ... ))`. The value therefore has to be
  // rejected here, where the error is actionable, rather than accepted by the
  // validator and failing later in an unrelated arithmetic expression.
  // Seeds do not have this problem: they are re-serialised canonically by
  // formatShard before anything downstream sees them.
  if (s.length > 1 && s.startsWith('0')) {
    throw new Error(`legs must not have a leading zero, got '${raw}' (write ${Number(s)})`);
  }
  const n = Number(s);
  if (n < 1) throw new Error(`legs must be at least 1, got ${n}`);
  if (n > MAX_LEGS) throw new Error(`legs must be at most ${MAX_LEGS}, got ${n}`);
  return n;
}

/**
 * Allocate an expanded seed list across N shards, round-robin.
 *
 * Legs beyond the seed count are capped rather than left empty: a leg launched
 * with no seeds to run is a job that reports success while measuring nothing,
 * which is the exact shape of the bug this module closes.
 *
 * @param {number[]} seeds
 * @param {number} legs
 * @returns {number[][]} shard index -> its seeds, in panel order
 */
export function allocateShards(seeds, legs) {
  if (!Array.isArray(seeds) || seeds.length === 0) throw new Error('allocateShards needs a non-empty seed list');
  const n = parseLegs(legs);
  const count = Math.min(n, seeds.length);
  const shards = Array.from({ length: count }, () => []);
  seeds.forEach((s, i) => shards[i % count].push(s));
  return shards;
}

/**
 * Format shards back to the comma-separated form the kit's own parser accepts,
 * and as the shard's declared panel is recorded in its manifest.
 */
export function formatShard(seeds) {
  return seeds.join(',');
}

// ---------------------------------------------------------------------------
// CLI — validate every dispatch input as DATA, expand the panel once, and write
// the shard plan to GITHUB_OUTPUT. Nothing here is ever interpolated into a
// shell script body; each value arrives as an argv element read from the
// environment and is validated before it is used or re-emitted.
// ---------------------------------------------------------------------------
const MODES = new Set(['balanced', 'base']);
const SUITES = new Set(['config-only', 'factorial-core', 'target']);

if (process.argv[1] && process.argv[1].endsWith('plan-seeds.mjs')) {
  const [subcommand, ...rest] = process.argv.slice(2);
  const fail = (msg) => {
    console.error(`::error::${msg}`);
    process.exit(2);
  };

  // `panel` is the narrow form used by scripts/run-diagnostics.sh: validate and
  // expand only. It keeps the shell script from parsing seeds with a second,
  // weaker grammar of its own.
  if (subcommand === 'panel') {
    const [seedsRaw, legsRaw] = rest;
    // Routed through `fail` like every other rejection. An uncaught throw here
    // exits 1 with a raw stack trace, while `cli` exits 2 with a readable
    // `::error::` — two different failure shapes for the same bad input, which
    // is exactly the inconsistency this layer exists to remove.
    try {
      const seeds = expandSeeds(seedsRaw ?? '');
      parseLegs(legsRaw ?? '');
      process.stdout.write(formatShard(seeds) + '\n');
    } catch (err) {
      fail(String(err.message ?? err));
    }
  } else if (subcommand === 'cli') {
    const [seedsRaw, legsRaw, ticksRaw, intervalRaw, mode, suite, target] = rest;
    // Same reason as `panel`: every rejection of the same bad input must look
    // the same. An uncaught throw exits 1 with a raw stack trace while `fail()`
    // exits 2 with a readable `::error::`, so a mistyped seed panel would be
    // reported as a crash rather than as the input error it is.
    let seeds;
    let legs;
    try {
      seeds = expandSeeds(seedsRaw ?? '');
      legs = Math.min(parseLegs(legsRaw ?? ''), seeds.length);
      parsePositiveSafeInt(ticksRaw, 'ticks');
      parsePositiveSafeInt(intervalRaw, 'interval');
    } catch (err) {
      fail(String(err.message ?? err));
    }

    if (!MODES.has(String(mode))) fail(`mode must be one of ${[...MODES].join(', ')}, got '${mode}'`);
    if (!SUITES.has(String(suite))) fail(`suite must be one of ${[...SUITES].join(', ')}, got '${suite}'`);
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(String(target ?? ''))) {
      fail(`target must be a bare config key name, got '${target}'`);
    }

    // Validated as DATA, then reported. This deliberately does NOT print a shard
    // allocation and does NOT emit a matrix: the diagnostics job runs its legs
    // itself through run-diagnostics.sh, which does its own contiguous chunking
    // over the panel expanded HERE. Printing this module's round-robin split
    // would put a plan in the workflow log that differs from the one recorded in
    // each leg's `.assigned-seeds` — two answers to "which seeds does leg N
    // cover", one of them never run.
    console.log(
      `seeds=${seeds.length} requested_legs=${legsRaw} (capped at ${legs} by seed count) ` +
      `ticks=${ticksRaw} interval=${intervalRaw} mode=${mode} suite=${suite} target=${target} — validated`,
    );
  } else {
    fail('usage: plan-seeds.mjs panel <seeds> <legs> | plan-seeds.mjs cli <seeds> <legs> <ticks> <interval> <mode> <suite> <target>');
  }
}