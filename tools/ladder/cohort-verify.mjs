/**
 * Cohort verification for a ladder arm. Dependency-free, read-only, deterministic.
 *
 * WHY THIS EXISTS. Each ladder leg verifies its OWN output. That is necessary and
 * it is not sufficient: it cannot tell whether the panel as a whole was
 * measured. A leg that never launched, a seed measured twice, a leg left over
 * from a different engine, or a seed whose ledger never parsed all produce the
 * same thing — a set of individually green jobs and a scientifically
 * meaningless number. Before this stage, `consumer-yield` predicted three-guild
 * survival on >= 12/18 seeds and no stage in the workflow ever established it.
 *
 * TWO SEPARATE VERDICTS, deliberately not merged.
 *
 *   INTEGRITY  was the evidence collected at all, once each, from one engine?
 *             This is a question about plumbing and it is pass/fail.
 *   SCIENCE    what did the pre-registered prediction actually say about the
 *             organisms? This is supported / falsified / not measured.
 *
 * A panel can be perfectly intact and scientifically falsified. Reporting that
 * as a FAILURE would teach the reader to distrust the runner for a biological
 * result, which is how real findings get mistaken for broken infrastructure. And
 * reporting it as a PASS would turn a refuted hypothesis into a green tick.
 *
 * WHERE EXPRESSIBLE. `criteria` is an OPTIONAL machine-readable companion to an
 * arm's prose prediction. An arm without it yields "not measured" — never a
 * guess scraped out of the English. The prose stays authoritative and is carried
 * through verbatim so a reader can judge against the original wording.
 *
 * Usage: node tools/ladder/cohort-verify.mjs <arms.json> <armName> <legDir...>
 */
import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

import { createHash } from 'node:crypto';
import { expandSeeds } from '../diagnostics/plan-seeds.mjs';
import { RESIDUAL_TOLERANCE_PCT } from './evidence.mjs';

/** Metrics a criterion may reference, and how each is derived from one run. */
const METRICS = {
  pop: (r) => r.pop,
  prod: (r) => r.prod,
  cons: (r) => r.cons,
  dec: (r) => r.dec,
  allGuildsNonZero: (r) => Number(r.prod > 0 && r.cons > 0 && r.dec > 0),
  extinct: (r) => Number(r.pop === 0),
  residualPct: (r) => r.residualPct,
};

const OPS = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
};

/**
 * Identity fields that must be identical across every leg of one cohort.
 * `ticks` and `declaredTicks` are here on purpose: a cohort assembled from legs
 * run at different horizons, or against different declared horizons, is not one
 * experiment — and that is the dead-ticks-knob failure reappearing one level up.
 *
 * `declaredTicks` is in this list rather than only in `expect` because the
 * resolved-identity map is populated from these fields. An `expect` key that is
 * not listed here could never be satisfied, because nothing would ever read it.
 */
export const IDENTITY_FIELDS = ['arm', 'engine', 'commit', 'armSpecHash', 'ticks', 'declaredTicks'];

/**
 * Read one identity field off a leg manifest.
 *
 * run-arm.mjs nests the resolved identity under `identity`; older/hand-built
 * manifests carry the same keys at the top level. Reading only the top level
 * silently yielded `undefined` for every real manifest, the null-guard then
 * filtered those out, and the comparison set was empty — so a cohort spanning
 * two engines compared equal to itself. Both shapes are accepted so the
 * fixture and production shapes agree.
 */
function legIdentity(leg, field) {
  if (!leg || typeof leg !== 'object') return undefined;
  const nested = leg.identity;
  if (nested && nested[field] !== undefined && nested[field] !== null) return nested[field];
  return leg[field];
}

/**
 * The exit policy, stated once and carried into every artifact.
 *
 * Owner decision: a green workflow means THE EVIDENCE IS TRUSTWORTHY. It never
 * means the hypothesis was correct. A falsified prediction exits 0, because a
 * refuted hypothesis is a RESULT, and failing the job for one would train a
 * reader to distrust the runner for a biological outcome — which is how real
 * findings get mistaken for broken infrastructure.
 *
 * Non-zero is reserved for exactly two things: the evidence is not trustworthy,
 * or the experiment did not execute. Falsification is neither.
 */
export const EXIT_POLICY = {
  greenMeans: 'the evidence is trustworthy',
  greenDoesNotMean: 'the hypothesis was correct',
  nonzeroReservedFor: ['evidence-integrity violation', 'execution failure'],
};

/** Build the headline a reader must not be able to scroll past. */
export function verdictHeadline(classification) {
  switch (classification) {
    case 'falsified':
      return '**PREDICTION FALSIFIED** — the pre-registered outcome did NOT occur. ' +
        'This run is trustworthy evidence and a negative result. The workflow is ' +
        'GREEN because the evidence is sound, NOT because anything was confirmed.';
    case 'supported':
      return '**PREDICTION SUPPORTED** — the pre-registered outcome occurred. ' +
        'This is one cohort of one engine version on one seed panel; it is not ' +
        'independent validation.';
    default:
      return '**NOT MEASURED** — no pre-registered verdict can be issued from this run.';
  }
}

/**
 * Verify a cohort and evaluate its pre-registered criteria.
 *
 * @param {object} o
 * @param {string} o.armName
 * @param {number[]} o.expectedSeeds the declared panel
 * @param {object[]} o.legs per-leg manifests
 * @param {object[]} [o.criteria] machine-readable predictions
 * @param {object} [o.expect] identity values the cohort must match
 * @returns {{pass: boolean, classification: 'supported'|'falsified'|'not measured',
 *            headline: string, exitPolicy: typeof EXIT_POLICY, detail: string,
 *            problems: string[], identity: object, seeds: number[],
 *            numerators: object, denominators: object}}
 *   `pass` is EVIDENCE INTEGRITY only. It never reflects whether the biology
 *   agreed with the prediction: a falsified cohort has pass === true and
 *   classification === 'falsified'. See EXIT_POLICY.
 */
export function evaluateCohort({ armName, expectedSeeds, legs, criteria = [], expect = {} }) {
  const problems = [];

  if (!Array.isArray(legs) || legs.length === 0) {
    return fail(`no leg manifests supplied for arm '${armName}'; nothing was measured`);
  }

  // --- identity: one cohort, one engine, one declaration --------------------
  //
  // A field that is ABSENT is a problem, not a value to skip. A cohort whose
  // legs cannot name their engine cannot prove they share one, and treating
  // "unknown" as "consistent" is how an unverifiable cohort reports INTACT.
  // Every leg must NAME every identity field. Not "the legs that have it must
  // agree" — an ABSENT field is unverifiable, and treating unknown as
  // consistent is how a cohort with no provable engine reports INTACT.
  //
  // The all-missing case is the one that matters: the previous guard was
  // `missing > 0 && seen.size > 0`, so when NO leg recorded `engine` the
  // comparison set was empty, the guard was skipped, and the field was silently
  // excluded from the verdict. Complete seed coverage and finite observations
  // then produced a clean INTACT with nothing to prove it was one experiment.
  const identity = {};
  for (const f of IDENTITY_FIELDS) {
    const present = legs.map((l) => legIdentity(l, f));
    const seen = new Set(present.filter((v) => v !== undefined && v !== null));
    if (seen.size > 1) {
      problems.push(`legs disagree on ${f}: ${[...seen].join(' vs ')} — a cohort spanning two ${f}s is not one experiment`);
    }
    if (seen.size === 1) identity[f] = [...seen][0];
    const missing = present.filter((v) => v === undefined || v === null).length;
    if (missing > 0) {
      problems.push(`${missing} of ${legs.length} leg(s) do not record ${f}` +
        (seen.size === 0 ? ' — NO leg recorded it, so this cohort cannot be verified at all' : ''));
    }
  }
  // A declared expectation must be MATCHED by a present value. Previously an
  // absent measured value skipped the comparison, so an arm declaring
  // `expectIdentity` could be satisfied by artifacts that record nothing.
  for (const [f, want] of Object.entries(expect)) {
    if (want === undefined) continue;
    if (identity[f] === undefined) {
      problems.push(`this run declares ${f} = '${want}' but no leg recorded ${f}; the declaration cannot be verified`);
    } else if (identity[f] !== want) {
      problems.push(`${f} is '${identity[f]}' but this run declared '${want}' — the artifacts and the dispatch disagree`);
    }
  }
  if (legs.some((l) => !Array.isArray(l?.runs))) {
    problems.push('a leg manifest has no `runs` array; it cannot be verified');
  }

  // The requested arm is checked UNCONDITIONALLY, not via `expect`.
  //
  // Cross-leg agreement proves the legs came from the same place; it does not
  // prove they came from the place that was ASKED FOR. Making this depend on
  // the caller passing `expect` would leave the door open for any caller that
  // forgets — and every arm currently declares no `expectIdentity`, so the check
  // would simply never run.
  if (identity.arm !== undefined && identity.arm !== armName) {
    problems.push(`artifacts record arm '${identity.arm}' but arm '${armName}' was requested — ` +
      'a cohort for one arm cannot be measured against another arm\'s criteria');
  }

  // --- per-leg failures are INHERITED, not discarded -------------------------
  //
  // This is the finding that mattered most. run-arm.mjs records a seed in
  // `runs` even when that seed violated the accounting tolerance or the declared
  // capture policy, and parks the reason in `failures`. A cohort verifier that
  // reads only `runs` therefore sees clean, finite, well-covered numbers over
  // contaminated evidence and reports INTACT — laundering exactly the violation
  // the leg was built to catch. A leg that recorded any failure did not
  // produce usable evidence, so the cohort is not intact.
  for (const [i, leg] of legs.entries()) {
    if (!Array.isArray(leg?.failures)) {
      problems.push(`leg ${i} records no \`failures\` array; a manifest that cannot say what went wrong cannot be trusted`);
      continue;
    }
    // Defensive on every element: a corrupted or hand-edited manifest must
    // FAIL the cohort, never throw out of the verifier. Throwing here would be
    // reported as a crash rather than as the evidence defect it is.
    for (const f of leg.failures) {
      problems.push(`leg ${i} recorded a failure${f?.seed != null ? ` on seed ${f.seed}` : ''} ` +
        `[${f?.evidenceClass ?? 'general'}]: ${String(f?.error).slice(0, 200)}`);
    }
    const mismatches = Array.isArray(leg?.headerMismatches) ? leg.headerMismatches : [];
    for (const m of mismatches) {
      problems.push(`leg ${i} recorded a header/declaration mismatch on seed ${m?.seed ?? '?'}: ` +
        `${JSON.stringify(m).slice(0, 200)}`);
    }
  }

  // --- coverage: every declared seed, exactly once ---------------------------
  const bySeed = new Map();
  const duplicates = [];
  for (const leg of legs) {
    for (const run of leg?.runs ?? []) {
      // Same contract as the failures loop: a corrupted element must become an
      // INVALID verdict, never a TypeError. Failing closed by crashing is not
      // the same as reporting the evidence defect.
      if (!run || typeof run !== 'object') {
        problems.push(`a leg manifest contains a non-object entry in \`runs\`: ${JSON.stringify(run)}`);
        continue;
      }
      if (bySeed.has(run.seed)) duplicates.push(run.seed);
      else bySeed.set(run.seed, run);
    }
    // A seed the leg CLAIMED but did not produce is as damning as a missing one.
    for (const s of leg?.seeds ?? []) {
      if (!(leg.runs ?? []).some((r) => r?.seed === s)) {
        problems.push(`leg declared seed ${s} but recorded no run for it`);
      }
    }
  }
  if (duplicates.length > 0) {
    problems.push(`duplicate measurement for seed(s) ${[...new Set(duplicates)].join(', ')} — a seed measured twice is not two observations`);
  }

  const expected = Array.isArray(expectedSeeds) ? expectedSeeds : [];
  const missing = expected.filter((s) => !bySeed.has(s));
  const unexpected = [...bySeed.keys()].filter((s) => !expected.includes(s));
  if (missing.length > 0) problems.push(`missing seed(s): ${missing.join(', ')}`);
  if (unexpected.length > 0) problems.push(`seed(s) not in the declared panel: ${unexpected.join(', ')}`);

  // --- per-seed measurement validity ----------------------------------------
  //
  // The cohort verifier is INDEPENDENT. It does not merely aggregate what the
  // legs concluded: it re-derives the per-seed verdict from the recorded
  // measurements, so a legacy, corrupted or hand-edited manifest with an
  // out-of-tolerance residual and an empty `failures` array still fails here.
  //
  // Trusting the leg's `failures` alone would make this stage only as good as
  // the thing it is auditing, and the whole point of a second stage is that it
  // is not that thing.
  for (const [seed, r] of bySeed) {
    for (const k of ['prod', 'cons', 'dec', 'pop', 'finalTick']) {
      if (r[k] === null || r[k] === undefined || !Number.isFinite(r[k])) {
        problems.push(`seed ${seed}: '${k}' is not a measured number (${r[k]})`);
      }
    }
    if (r.residualPct === null || r.residualPct === undefined || !Number.isFinite(r.residualPct)) {
      problems.push(`seed ${seed}: ledger residual was never measured`);
    } else if (Math.abs(r.residualPct) > RESIDUAL_TOLERANCE_PCT) {
      // Re-applied here rather than trusted from the leg. Finite is not
      // compliant: 0.9% is a perfectly finite number that means the books do
      // not balance.
      problems.push(`seed ${seed}: accounting residual ${r.residualPct}% exceeds the ` +
        `${RESIDUAL_TOLERANCE_PCT}% tolerance — energy conservation is violated on this seed`);
    }

    // The ledger must have parsed cleanly, and the capture policy must hold.
    // Both are re-read from the record rather than inferred from `failures`.
    if (r.ledgerStatus !== undefined) {
      if (r.ledgerStatus !== 'ok') {
        problems.push(`seed ${seed}: ledger status is '${r.ledgerStatus}', not 'ok'`);
      }
    } else {
      problems.push(`seed ${seed}: manifest records no ledgerStatus; the measurement cannot be confirmed`);
    }
    if (r.capturePolicyOk === undefined) {
      problems.push(`seed ${seed}: manifest records no capturePolicyOk; the declared capture policy cannot be confirmed`);
    } else if (r.capturePolicyOk !== true) {
      problems.push(`seed ${seed}: the declared capture policy did not hold on this seed`);
    }
    if (r.residualOk === false) {
      problems.push(`seed ${seed}: the runner recorded the residual as out of tolerance`);
    }

    // The reported state must come from the HORIZIZON THE COHORT VERIFIED.
    // The runner already checks this and records it in `headerMismatches`, but
    // the verifier must not depend on the thing it is auditing having noticed:
    // a manifest with `finalTick: 3000` against an identity of `ticks: 6000`
    // and an empty `headerMismatches` would otherwise have a 3000-tick
    // observation measured against a 6000-tick prediction.
    const horizon = identity.ticks;
    if (horizon !== undefined && horizon !== null) {
      if (r.finalTick !== horizon) {
        problems.push(`seed ${seed}: final checkpoint is tick ${r.finalTick} but this cohort ran to tick ${horizon} ` +
          '— the reported state is from an earlier horizon than the one verified');
      }
    }
  }

  const overridden = legs.filter((l) => l?.ticksOverrideApplied === true);
  if (overridden.length > 0) {
    // Found by actually running the chain, not by a fixture. Both legs agreed
    // on the horizon, so the cohort looked internally consistent and reported a
    // confident verdict — but the arms' criteria are declared at a DIFFERENT
    // horizon, and an override is exactly the "masquerading as the
    // pre-registered run" case the runner's own comment warns about. Internally
    // consistent is not the same as pre-registered.
    const declared = legs.map((l) => l?.declaredTicks).filter((v) => Number.isFinite(v));
    problems.push(
      `${overridden.length}/${legs.length} leg(s) ran with a HORIZON OVERRIDE ` +
      `(ticks=${identity.ticks}${declared.length ? `, declared ${declared[0]}` : ''}). ` +
      'The arm\'s criteria are pre-registered at the declared horizon, so this run does not test them',
    );
  }

  if (problems.length > 0) {
    return {
      pass: false,
      classification: 'not measured',
      headline: '**EVIDENCE INVALID — no verdict can be issued.** The integrity problems are listed below.',
      exitPolicy: EXIT_POLICY,
      detail: problems.join('; '),
      problems,
      identity,
      seeds: [...bySeed.keys()].sort((a, b) => a - b),
      numerators: {},
      denominators: {},
    };
  }
  const runs = [...bySeed.values()];
  const numerators = {};
  const denominators = {};
  const unmet = [];

  // A criterion the verifier cannot evaluate is an INTEGRITY failure, not a
  // skipped term. Previously the mis-specification was pushed onto a local
  // `problems` array that the function then discarded, so a criterion naming a
  // metric that does not exist contributed nothing to either count and the arm
  // still reported SUPPORTED. A yardstick that does not parse has not measured
  // its prediction.
  for (const c of criteria) {
    if (!c || typeof c !== 'object') {
      problems.push(`a criterion is not an object: ${JSON.stringify(c)}`);
      continue;
    }
    if (!METRICS[c.metric]) {
      problems.push(`criterion '${c.id}' names unknown metric '${c.metric}' ` +
        `(known: ${Object.keys(METRICS).join(', ')}) — the prediction cannot be evaluated`);
    }
    if (!OPS[c.op]) {
      problems.push(`criterion '${c.id}' names unknown operator '${c.op}' ` +
        `(known: ${Object.keys(OPS).join(', ')}) — the prediction cannot be evaluated`);
    }
    if (!Number.isFinite(c.required)) {
      problems.push(`criterion '${c.id}' has no finite 'required' count — the prediction cannot be evaluated`);
    }
  }
  if (problems.length > 0) {
    return {
      pass: false,
      classification: 'not measured',
      headline: '**EVIDENCE INVALID — no verdict can be issued.** The integrity problems are listed below.',
      exitPolicy: EXIT_POLICY,
      detail: problems.join('; '),
      problems,
      identity,
      seeds: [...bySeed.keys()].sort((a, b) => a - b),
      numerators,
      denominators,
    };
  }

  for (const c of criteria) {
    const metric = METRICS[c.metric];
    const op = OPS[c.op];
    const hits = runs.filter((r) => op(metric(r), c.value)).length;
    numerators[c.id] = hits;
    denominators[c.id] = runs.length;
    if (hits < c.required) {
      unmet.push(`${c.id}: ${hits}/${runs.length} met '${c.statement ?? `${c.metric} ${c.op} ${c.value}`}' (needed >= ${c.required})`);
    }
  }

  if (criteria.length === 0) {
    return {
      pass: true,
      classification: 'not measured',
      headline: verdictHeadline('not measured'),
      exitPolicy: EXIT_POLICY,
      detail: `evidence intact across ${runs.length}/${expected.length} seeds, but the arm declares no ` +
        'machine-readable criteria; judge against its prose prediction',
      problems: [],
      identity,
      seeds: [...bySeed.keys()].sort((a, b) => a - b),
      numerators,
      denominators,
    };
  }

  const classification = unmet.length === 0 ? 'supported' : 'falsified';
  const met = Object.entries(numerators)
    .map(([id, n]) => `${id} ${n}/${runs.length}`)
    .join(', ');

  return {
    pass: true,
    classification,
    headline: verdictHeadline(classification),
    exitPolicy: EXIT_POLICY,
    // The headline is printed separately and is deliberately NOT repeated
    // here: it is the first thing a reader must meet, and saying it twice
    // reads as emphasis-by-volume rather than as a distinct claim.
    detail: `Evidence intact across ${runs.length}/${expected.length} seeds.\n\n` +
      `Measured against the pre-registration — ${met}.` +
      (unmet.length ? `\n\nNOT MET:\n${unmet.map((u) => `  - ${u}`).join('\n')}` : ''),
    problems: unmet,
    identity,
    seeds: [...bySeed.keys()].sort((a, b) => a - b),
    numerators,
    denominators,
  };

  function fail(detail) {
    return {
      pass: false,
      classification: 'not measured',
      headline: '**EVIDENCE INVALID — no verdict can be issued.** The problems are listed below.',
      exitPolicy: EXIT_POLICY,
      detail: detail,
      problems: [detail],
      identity: {},
      seeds: [],
      numerators: {},
      denominators: {},
    };
  }
}

// ---------------------------------------------------------------------------
// CLI — read leg manifests from disk, verify, print the verdict, and set the
// exit code from INTEGRITY only. A falsified prediction must not fail the job.
// ---------------------------------------------------------------------------
/**
 * Read a JSON file that must exist and must parse.
 *
 * A truncated or corrupt manifest is an EVIDENCE defect, not a crash. Exiting
 * on a raw stack trace reports it as a program fault, which is the opposite of
 * what happened, and it discards the one message that would have said which
 * artifact was unreadable. Exits 1 with a `::error::` naming the file.
 */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`::error::could not read ${path}: ${String(err.message).slice(0, 200)}`);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('cohort-verify.mjs')) {
  const [armsPath, armName, ...legDirs] = process.argv.slice(2);
  if (!armsPath || !armName || legDirs.length === 0) {
    console.error('usage: cohort-verify.mjs <arms.json> <armName> <legDir...>');
    process.exit(2);
  }
  const spec = readJson(armsPath);
  const arm = spec.arms[armName];
  if (!arm) {
    console.error(`::error::unknown arm '${armName}'`);
    process.exit(2);
  }

  // Bind the cohort to the REQUESTED EXPERIMENT, not merely to itself.
  //
  // Checking that the legs agree with each other proves only that they came
  // from the same place. It does not prove they came from the place that was
  // asked for: a complete, internally consistent panel for a DIFFERENT arm, an
  // older arms.json, or a different declared horizon would otherwise satisfy
  // every cross-leg check and then be measured against this arm's criteria.
  //
  // `armSpecHash` uses the SAME hashing contract as the runner, so it answers a
  // question a hash can answer: were all these legs driven by exactly this
  // declaration text? It does not prove the declaration was correct — only that
  // it is the one we are reading.
  const armSpecHash = createHash('sha256').update(readFileSync(armsPath, 'utf8')).digest('hex');

  const legs = [];
  for (const d of legDirs) {
    // A leg directory holds exactly one manifest; if a glob was expanded
    // upstream the trailing path component names the leg.
    const direct = join(d, 'manifest.json');
    const path = existsSync(direct) ? direct : join(d, 'ladder-out', 'manifest.json');
    if (!existsSync(path)) {
      console.error(`::error::no manifest.json under ${d} — that leg did not complete`);
      process.exit(1);
    }
    legs.push(readJson(path));
  }

  // `expect` is passed INTO the evaluator rather than applied afterwards, so a
  // declared-identity mismatch is part of the verdict before anything is
  // printed. Applying it after the summary line meant the console could report
  // INTACT while the step summary and the exit code reported failure.
  const result = evaluateCohort({
    armName,
    expectedSeeds: expandPanel(arm.seeds),
    legs,
    criteria: arm.criteria ?? [],
    // The requested experiment first; an arm's own `expectIdentity` is an
    // ADDITIONAL constraint on top, never a substitute for these.
    expect: {
      arm: armName,
      armSpecHash,
      declaredTicks: arm.ticks,
      ...(arm.expectIdentity ?? {}),
    },
  });

  // The verdict is an ARTIFACT, not just log text. A falsification that lives
  // only in a scrollback buffer is a result that gets lost; writing it beside
  // the immutable per-leg manifests puts it in the evidence record, where the
  // next reader finds it without re-running anything.
  // The common parent of the leg directories is where the workflow uploads from.
  const legsDir = dirname(legDirs[0]);
  const verdict = {
    arm: armName,
    title: arm.title,
    preregistered: arm.preregistered,
    classification: result.classification,
    integrity: result.pass ? 'INTACT' : 'INVALID',
    headline: result.headline,
    numerators: result.numerators,
    denominators: result.denominators,
    notMet: result.problems,
    identity: result.identity,
    seedsMeasured: result.seeds,
    exitPolicy: result.exitPolicy,
    prediction: arm.prediction ?? null,
    falsification: arm.falsification ?? null,
  };
  const verdictPath = join(legsDir, 'cohort-verdict.json');
  try {
    writeFileSync(verdictPath, JSON.stringify(verdict, null, 2) + '\n');
  } catch (err) {
    console.error(`::warning::could not write cohort-verdict.json: ${err.message}`);
  }

  console.log(`\n### Cohort verification — ${armName}`);
  console.log(`- declared: ${arm.preregistered}`);
  console.log(`- identity: ${JSON.stringify(result.identity)}`);
  console.log(`- seeds measured: ${result.seeds.length}`);
  console.log(`- evidence integrity: ${result.pass ? 'INTACT' : 'INVALID'}`);
  console.log(`\n${result.headline}`);
  console.log(`\n${result.detail}`);
  console.log(`\n### Exit policy`);
  console.log(`- A green workflow means: ${EXIT_POLICY.greenMeans}.`);
  console.log(`- It does NOT mean: ${EXIT_POLICY.greenDoesNotMean}.`);
  console.log(`- Non-zero is reserved for: ${EXIT_POLICY.nonzeroReservedFor.join('; ')}.`);
  if (arm.prediction) console.log(`\nPrediction as declared: ${arm.prediction}`);
  if (arm.falsification) console.log(`Falsified if: ${arm.falsification}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const out = [
      '',
      `### Cohort verification — ${armName}`,
      `- identity: \`${JSON.stringify(result.identity)}\``,
      `- seeds measured: ${result.seeds.length}`,
      `- evidence integrity: **${result.pass ? 'INTACT' : 'INVALID'}**`,
      '',
      result.headline,
      '',
      result.detail,
      '',
      '### Exit policy',
      `- A green workflow means **${EXIT_POLICY.greenMeans}**.`,
      `- It does NOT mean ${EXIT_POLICY.greenDoesNotMean}.`,
      `- Non-zero is reserved for: ${EXIT_POLICY.nonzeroReservedFor.join('; ')}.`,
      '',
    ];
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n'));
  }

  // INTEGRITY only. A falsified hypothesis exits 0 with a loud verdict.
  process.exit(result.pass ? 0 : 1);
}

/**
 * Expand an arm's declared panel.
 *
 * Imports the ONE validated expander rather than keeping a second copy. Two
 * parsers for the same grammar is how the shard planner and the kit came to
 * disagree about what a panel was — the defect item 4 exists to close. This
 * side previously had a looser local copy that turned a reversed range into a
 * silent empty list instead of an error.
 */
function expandPanel(spec) {
  return expandSeeds(String(spec));
}