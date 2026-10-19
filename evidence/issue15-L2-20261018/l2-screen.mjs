/**
 * L2 — single prospective config-only candidate with the event-time
 * photosynthesis observer (Issue #15, Owner decision 2026-10-18). Executes
 * docs/issue15-L2-preregistration.md, which was committed BEFORE this script
 * was run and before any L2 candidate outcome was observed.
 *
 * Engine: ts-evo-poc/0.6.7 (branch issue15/l2-observer-rescue, successor to
 * merged main 06be7da / 0.6.6). Replay on a clean checkout:
 *   npm install && npm run view:build
 *   node evidence/issue15-L2-20261018/l2-screen.mjs
 *
 * Read-only script: constructs worlds, steps them, reads public state +
 * observer + O3/O2 books. Verdict logic is NOT here — classification is read
 * from the archived numbers against the frozen R1/R2 rules.
 *
 * A-first discipline: arm A runs for both seeds and the preregistered R1 is
 * evaluated and printed BEFORE any B/C world is CONSTRUCTED; the script
 * refuses to run B/C unless its own computed R1 flags true. No tuning, no
 * second candidate, no threshold interpretation happens in this file.
 */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { World } from '../../build/world/world.js';
import { WORLD_ENGINE_VERSION } from '../../build/world/version.js';
import { afterR2 } from './l2-protocol.mjs';

const BASE = {
  founders: 400, worldW: 2400, worldH: 2400,
  consumerPhotoScale: 0, consumerBasalScale: 0.25,
  decomposerPhotoScale: 0, decomposerFounders: 0.25,
  decomposerDormancy: 0.05, sporeDispersal: 1,
  grazeYieldScale: 1.0, plantYieldPerMass: 0, radiation: null,
  foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
  dormantThreatBlind: null, mixotrophyCarbon: null,
  mixotrophySaturation: 1.0, nutrientCyclic: true,
  producerCaptureScale: 0.35, nutrientFloor: 0.05, reproSurplusTicks: 30,
  basalFoodPerCell: 0.01, nutrientRegen: 0.0002,
  excretionRate: 0.06, meatYieldPerMass: 0, bioticMineralisation: 0.45,
};
const L2 = { producerCaptureScale: 1.0, nutrientFloor: 0, nutrientRegen: 0.0002, nutrientCyclic: true };
const SUP = { carrionOnly: 1, recalcOnly: 0, dual: 1 };
const RESC = { carrionOnly: false, recalcOnly: true, dual: false };
const SEEDS = [517, 41001];
const TICKS = 750;
const SAMPLES = [0, 100, 250, 500, 625, 750];
const MIN_EVENTS = 100;
const LATE = ['500-625', '625-750'];
const r3 = (n) => Math.round(n * 1e6) / 1e6;

function armConfig(seed, sup, resc) {
  return {
    ...BASE, ...L2, seed, photoObserver: true,
    ...(sup === undefined ? {} : { phenoMineralReturn: sup }),
    ...(resc === undefined ? {} : { phenoMineralRescue: resc }),
  };
}

// Per-sample capture: snapshot state + the book quantities the R2 lost-flow
// identity needs as CUMULATIVE values (deltas across samples then give the
// per-window lost flow without between-world substitution).
function runToeSnapshot(w) {
  const f = w.getFluxSnapshot();
  let prodE = 0, P = 0, C = 0, D = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i)) continue;
    const g = w.roleOf(i).trophic;
    if (g === 0) { P++; prodE += w.store.energy[i]; }
    else if (g === 1) C++;
    else D++;
  }
  const pools = w.nutrients.map((n) => n.data.reduce((x, y) => x + y, 0));
  const caps = [0, 1, 2].map((p) => {
    let s = 0;
    for (let i = 0; i < w.habitat.fertility.data.length; i++)
      s += w.config.nutrientPerCell * w.habitat.fertility.data[i] * w.config.nutrientCapacity[p];
    return s;
  });
  const d = w.demographics();
  const shadowRecalc = f.bioticMineralizationShadow.accepted[1];
  const actualRecalc = f.bioticMineralizationByPheno.accepted[1];
  let lostCum = 0, exoAcc = 0;
  for (let g = 0; g < 3; g++) for (let p = 0; p < 3; p++) for (let s = 0; s < 3; s++) {
    lostCum += shadowRecalc[g][p][s] - actualRecalc[g][p][s];
  }
  exoAcc = f.exogenousReplacement.accepted.flat(Infinity).reduce((a, b) => a + b, 0);
  return {
    census: { P, C, D },
    producerEnergy: r3(prodE),
    producerDisplayedUptake: [0, 1, 2].map((p) => r3(f.photoUptake[0][p])),
    allGuildUptake: [0, 1, 2].map((p) => r3(f.photoUptake[0][p] + f.photoUptake[1][p] + f.photoUptake[2][p])),
    pools: pools.map(r3),
    capUtil: pools.map((s, p) => r3(caps[p] > 0 ? s / caps[p] : 0)),
    birthsByGuildPath: d.births,
    deathsByGuildCause: d.deaths,
    abioticRegen: f.abioticRegen.map(r3),
    cumulative: {
      lostRecalcAccepted: r3(lostCum),
      exogenousAccepted: r3(exoAcc),
      exogenousAttempted: r3(f.exogenousReplacement.attempted.flat(Infinity).reduce((a, b) => a + b, 0)),
      exogenousCapLoss: r3(f.exogenousReplacement.capLoss.flat(Infinity).reduce((a, b) => a + b, 0)),
      exogenousEviction: r3(f.exogenousReplacement.eviction.flat(Infinity).reduce((a, b) => a + b, 0)),
      actualRecalcAccepted: r3(actualRecalc.flat(Infinity).reduce((a, b) => a + b, 0)),
      shadowRecalcAccepted: r3(shadowRecalc.flat(Infinity).reduce((a, b) => a + b, 0)),
    },
  };
}

function runArm(seed, sup, resc) {
  const w = new World({ config: armConfig(seed, sup, resc) });
  const samples = [runToeSnapshot(w)];
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    if (SAMPLES.includes(t)) samples.push(runToeSnapshot(w));
  }
  return { samples, observer: w.getPhotoObserverSnapshot(), hash: w.hashState(), resolvedConfig: w.config };
}

// ---- R1 evaluation against the frozen rule --------------------------------
// Counts are the producer-DISPLAYED per-guild counters (eligibleEvents filter
// is producer-only, not "sampled producer events" and not mixed-guild totals).
function frameR1(seed, A) {
  const obs = A.observer;
  const per = LATE.map((label) => {
    const w = obs.windows.find((x) => x.label === label);
    const g = w.perGuild[0]; // producer DISPLAYED guild
    const frac = g.eligibleEvents > 0 ? g.limitedEvents / g.eligibleEvents : 0;
    return {
      label,
      eligible: g.eligibleEvents,
      limited: g.limitedEvents,
      frac: r3(frac),
      pctGat5: frac >= 0.05,
      eventsBelow100: g.eligibleEvents < MIN_EVENTS,
      uniqueOrganisms: g.uniqueOrganisms,
      uniqueCells: g.uniqueCells,
      limitedUniqueOrganisms: g.limitedUniqueOrganisms,
      limitedUniqueCells: g.limitedUniqueCells,
      limitedBoundPools: g.limitedBindingByPool,
      avgLim: g.eligibleEvents > 0 ? r3(g.sumLim / g.eligibleEvents) : null,
      sumShortfall: r3(g.sumShortfall),
      limZeroEvents: g.zeroLimEvents,
      limPartialEvents: g.partialLimEvents,
      boundPools: g.bindingByPool.map((b, i) => ({ pool: 'ABC'[i], bindingEvents: b })),
    };
  });
  const met = per.every((x) => x.pctGat5 && !x.eventsBelow100);
  const unmeasurable = per.some((x) => x.eventsBelow100);
  return { seed, per, met, unmeasurable };
}

// ---- A FIRST --------------------------------------------------------------
const A = {};
for (const seed of SEEDS) A[seed] = runArm(seed, undefined, undefined);
const r1 = {};
for (const seed of SEEDS) r1[seed] = frameR1(seed, A[seed]);

const r1Met = SEEDS.some((s) => r1[s].met);
const r1Unmeasurable = SEEDS.every((s) => r1[s].unmeasurable);

const out = { prereg: 'docs/issue15-L2-preregistration.md', engine: 'ts-evo-poc/0.6.7', candidate: L2, seeds: {}, R1: r1, arms: {} };
out.engine = WORLD_ENGINE_VERSION;
out.sourceSHA = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
out.command = 'node evidence/issue15-L2-20261018/l2-screen.mjs';
out.resolvedConfigs = Object.fromEntries(SEEDS.map((s) => [s, A[s].resolvedConfig]));
out.arms.A = Object.fromEntries(SEEDS.map((s) => [s, { samples: A[s].samples, observer: A[s].observer }]));

console.log('=== L2 A-first R1 (frozen rule, producer-DISPLAYED eligible events) ===');
for (const seed of SEEDS) {
  const f = r1[seed];
  for (const w of f.per) {
    console.log(`seed ${seed} window ${w.label}: limited=${w.limited}/${w.eligible} (${(w.frac * 100).toFixed(2)}%) `
      + `>=5%=${w.pctGat5} events>=100=${!w.eventsBelow100} uniqOrganisms=${w.uniqueOrganisms} uniqCells=${w.uniqueCells} `
      + `avgLim=${w.avgLim} limZero=${w.limZeroEvents} limPartial=${w.limPartialEvents} `
      + `sumShortfall=${w.sumShortfall} boundPools=[${w.boundPools.map((b) => `${b.pool}:${b.bindingEvents}`).join(' ')}]`);
    console.log(`  eligibleOnlyCoverage=${w.uniqueOrganisms} organisms/${w.uniqueCells} cells; limitedOnlyCoverage=${w.limitedUniqueOrganisms} organisms/${w.limitedUniqueCells} cells; limitedOnlyBinding=[${w.limitedBoundPools.join(',')}]`);
  }
  console.log(`seed ${seed} R1=${f.met ? 'MET' : (f.unmeasurable ? 'UNMEASURABLE' : 'NOT MET')}`);
}
console.log(`R1 overall (>=1 seed met): ${r1Met ? 'MET' : (r1Unmeasurable ? 'UNMEASURABLE on all seeds' : 'NOT MET -> STOP-A')}`);

// ---- B/C conditional on R1 (the script refuses to run them otherwise) -----
const B = {}, C = {}, twins = {};
let r2 = { met: false, passingSeeds: [] };
if (r1Met) {
  for (const seed of SEEDS) {
    B[seed] = runArm(seed, SUP, undefined);
  }
  out.arms.B = Object.fromEntries(SEEDS.map((s) => [s, { samples: B[s].samples, observer: B[s].observer }]));
  const lost = Object.fromEntries(SEEDS.map((s) => [s, windowBooks(B, s).lateBoth.lost]));
  r2 = afterR2(r1, lost, () => {
    // Frozen protocol: once a qualifying R1 seed meets R2, the matched panel
    // includes BOTH discovery seeds. Do not label other seeds R1/R2-qualified.
    for (const seed of SEEDS) {
      C[seed] = runArm(seed, SUP, RESC);
      twins[seed] = runArm(seed, SUP, RESC);
    }
    out.arms.C = Object.fromEntries(SEEDS.map((s) => [s, { samples: C[s].samples, observer: C[s].observer }]));
  });
  out.R2 = { ...r2, lostBySeed: lost };
  console.log(`R2: ${r2.met ? 'MET' : 'NOT MET -> STOP-B; C skipped'}`);
} else {
  console.log('R1 not met: B and C skipped per frozen STOP-A (no tuning, no second candidate).');
}

// Twin determinism (C twice) and per-seed twin digest check.
for (const seed of SEEDS) {
  if (r2.met) console.log(`seed ${seed} C-twin digestsEqual=${C[seed].hash === twins[seed].hash}`);
}

// Per-window lost flow from cumulative book deltas (exact windows from sample
// values, no between-world substitution).
function windowBooks(arm, seed) {
  const s = arm[seed].samples;
  const at = (t) => s.find((x) => x.t === t);
  // samples array is ordered t0..t750; find by index: SAMPLES=[0,100,250,500,625,750]
  const s500 = s[3], s625 = s[4], s750 = s[5], sAt = s[0];
  return {
    lateBoth: { lost: r3(s750.cumulative.lostRecalcAccepted - s500.cumulative.lostRecalcAccepted), exoAcc: r3(s750.cumulative.exogenousAccepted - s500.cumulative.exogenousAccepted) },
    first: { lost: r3(s625.cumulative.lostRecalcAccepted - s500.cumulative.lostRecalcAccepted), exoAcc: r3(s625.cumulative.exogenousAccepted - s500.cumulative.exogenousAccepted) },
    second: { lost: r3(s750.cumulative.lostRecalcAccepted - s625.cumulative.lostRecalcAccepted), exoAcc: r3(s750.cumulative.exogenousAccepted - s625.cumulative.exogenousAccepted) },
    totalRun: { lost: r3(s750.cumulative.lostRecalcAccepted - sAt.cumulative.lostRecalcAccepted), exoAcc: r3(s750.cumulative.exogenousAccepted - sAt.cumulative.exogenousAccepted) },
  };
}

// Print per-seed late-window book deltas for classification (R2 >= 1.0).
if (r2.met) {
  for (const seed of SEEDS) {
    const wb = windowBooks(B, seed);
    const wc = windowBooks(C, seed);
    console.log(`seed ${seed} B late500-750 lost=${wb.lateBoth.lost} (window1=${wb.first.lost}, window2=${wb.second.lost}) exoAcc=${wb.lateBoth.exoAcc}`);
    console.log(`seed ${seed} C late500-750 lost=${wc.lateBoth.lost} exoAcc=${wc.lateBoth.exoAcc} (totalRun exoAcc=${wc.totalRun.exoAcc})`);
  }
}

writeFileSync('evidence/issue15-L2-20261018/l2-panel.json', JSON.stringify(out, null, 1));
console.log('wrote evidence/issue15-L2-20261018/l2-panel.json');
