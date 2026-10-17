/**
 * L1 — single config-only local nutrient-limitation screen (Issue #15, Owner
 * authorization 2026-10-16). Executes docs/issue15-L1-preregistration.md, which
 * was committed BEFORE this script was run.
 *
 * Replay (clean checkout of the PR head):
 *   npm install
 *   npm run view:build
 *   node evidence/issue15-L1-20261017/l1-screen.mjs
 *
 * Read-only: constructs worlds, steps them, reads public state + O3/O2 books.
 * No engine change, no RNG draw, no perturbation.
 *
 * Candidate L1 = viability + producerCaptureScale 1.0, nutrientRegen 0,
 * nutrientFloor 0 (everything else identical to the accepted viability config).
 * Arms A (null) / B (recalcOnly suppressed) / C (B + same-event replacement).
 *
 * Outputs: machine-readable JSON (l1-panel.json) + human-readable text on
 * stdout. Verdict logic is deliberately NOT here: classification is read from
 * the archived numbers against the preregistered R1/R2/H-L1 rules.
 */
import { writeFileSync } from 'node:fs';
import { TRAIT } from '../../build/bio/genome.js';
import { World } from '../../build/world/world.js';

const VIABILITY = {
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
const L1 = { producerCaptureScale: 1.0, nutrientRegen: 0, nutrientFloor: 0 };
const SUP = { carrionOnly: 1, recalcOnly: 0, dual: 1 };
const RESC = { carrionOnly: false, recalcOnly: true, dual: false };
const SEEDS = [517, 41001];
const TICKS = 500;
const SAMPLES = [0, 100, 250, 500];
const CLASS = ['carrionOnly', 'recalcOnly', 'dual', 'neither'];
const POOL = ['A', 'B', 'C'];
const SRC = ['sediment', 'detritus', 'litter'];
const r3 = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Strict local-limitation detector (read-only).
 * Any pool with affinity > 1e-4 that is empty at the organism's cell forces
 * Liebig lim = 0 => zero photosynthetic income that tick (see preregistration
 * section 1). Returns per-pool empty counts over alive producer-DISPLAYED
 * organisms plus the total producer count.
 */
function localLimitation(w) {
  const cols = w.nutrients[0].cols, rows = w.nutrients[0].rows;
  const fw = w.config.worldW / cols, fh = w.config.worldH / rows;
  let producers = 0;
  const emptyByPool = [0, 0, 0];
  let limited = 0;
  const headroomByPool = [0, 0, 0];
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i) || w.roleOf(i).trophic !== 0) continue;
    producers++;
    const cx = Math.min(cols - 1, Math.max(0, (w.store.x[i] / fw) | 0));
    const cy = Math.min(rows - 1, Math.max(0, (w.store.y[i] / fh) | 0));
    const ci = cy * cols + cx;
    let anyEmpty = false;
    for (let p = 0; p < 3; p++) {
      const aff = w.store.trait(i, TRAIT.NUTRIENT_A + p); // A,B,C are consecutive
      const cap = w.nutrientCapAt(p, ci);
      headroomByPool[p] += cap > 0 ? w.nutrients[p].data[ci] / cap : 0;
      if (aff > 1e-4 && w.nutrients[p].data[ci] <= 1e-9) {
        emptyByPool[p]++;
        anyEmpty = true;
      }
    }
    if (anyEmpty) limited++;
  }
  return {
    producers,
    limitedProducers: limited,
    limitedFrac: producers > 0 ? r3(limited / producers) : 0,
    emptyByPool,
    meanHeadroomByPool: producers > 0 ? headroomByPool.map((h) => r3(h / producers)) : [0, 0, 0],
  };
}

function classSourceTotals(fam, cls) {
  const out = { byPool: [0, 0, 0], bySource: [0, 0, 0], total: 0 };
  for (let g = 0; g < 3; g++) for (let p = 0; p < 3; p++) {
    let poolSum = 0;
    for (let s = 0; s < 3; s++) {
      const v = fam[cls][g][p][s];
      poolSum += v;
      out.bySource[s] += v;
    }
    out.byPool[p] += poolSum;
    out.total += poolSum;
  }
  return {
    byPool: out.byPool.map(r3), bySource: out.bySource.map(r3),
    bySourceName: SRC.map((n, i) => `${n}=${r3(out.bySource[i])}`),
    total: r3(out.total),
  };
}

function runArm(seed, sup, resc) {
  const w = new World({
    config: {
      ...VIABILITY, ...L1, seed,
      ...(sup === undefined ? {} : { phenoMineralReturn: sup }),
      ...(resc === undefined ? {} : { phenoMineralRescue: resc }),
    },
  });
  const samples = [];
  const snap = (t) => {
    const f = w.getFluxSnapshot();
    let prodE = 0, P = 0, C = 0, D = 0;
    for (let i = 0; i < w.store.count; i++) {
      if (!w.aliveAt(i)) continue;
      const g = w.roleOf(i).trophic;
      if (g === 0) { P++; prodE += w.store.energy[i]; }
      else if (g === 1) C++; else D++;
    }
    const pools = w.nutrients.map((n) => n.data.reduce((x, y) => x + y, 0));
    const caps = [0, 1, 2].map((p) => {
      let s = 0;
      for (let i = 0; i < w.habitat.fertility.data.length; i++)
        s += w.config.nutrientPerCell * w.habitat.fertility.data[i] * w.config.nutrientCapacity[p];
      return s;
    });
    const d = w.demographics();
    // Lost flow = shadow.accepted - actual.accepted per pool (recalcOnly class).
    const shadowRecalc = f.bioticMineralizationShadow.accepted[1];
    const actualRecalc = f.bioticMineralizationByPheno.accepted[1];
    const lostRecalc = [0, 1, 2].map((p) => {
      let s = 0;
      for (let g = 0; g < 3; g++) for (let src = 0; src < 3; src++) s += shadowRecalc[g][p][src] - actualRecalc[g][p][src];
      return r3(s);
    });
    return {
      t,
      census: { P, C, D },
      producerEnergy: r3(prodE),
      producerDisplayedUptake: [0, 1, 2].map((p) => r3(f.photoUptake[0][p])),
      allGuildUptake: [0, 1, 2].map((p) => r3(f.photoUptake[0][p] + f.photoUptake[1][p] + f.photoUptake[2][p])),
      pools: pools.map(r3),
      capUtil: pools.map((t2, p) => r3(caps[p] > 0 ? t2 / caps[p] : 0)),
      localLimitation: localLimitation(w),
      birthsByGuildPath: d.births.map((g) => g.map(r3)),
      deathsByGuildCause: d.deaths.map((g) => g.map(r3)),
      exogenous: {
        attempted: r3(f.exogenousReplacement.attempted.flat(Infinity).reduce((x, y) => x + y, 0)),
        accepted: r3(f.exogenousReplacement.accepted.flat(Infinity).reduce((x, y) => x + y, 0)),
        capLoss: r3(f.exogenousReplacement.capLoss.flat(Infinity).reduce((x, y) => x + y, 0)),
        eviction: r3(f.exogenousReplacement.eviction.flat(Infinity).reduce((x, y) => x + y, 0)),
      },
      bioticBySourceAccepted: {
        recalcOnly: classSourceTotals(f.bioticMineralizationByPheno.accepted, 1),
        carrionOnly: classSourceTotals(f.bioticMineralizationByPheno.accepted, 0),
        dual: classSourceTotals(f.bioticMineralizationByPheno.accepted, 2),
      },
      abioticRegen: f.abioticRegen.map(r3),
      lostRecalcAcceptedByPool: lostRecalc,
    };
  };
  samples.push(snap(0));
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    if (SAMPLES.includes(t)) samples.push(snap(t));
  }
  return { samples, hash: w.hashState() };
}

const out = { prereg: 'docs/issue15-L1-preregistration.md', engine: 'ts-evo-poc/0.6.6', candidate: L1, seeds: {}, twins: {} };
for (const seed of SEEDS) {
  const A = runArm(seed, undefined, undefined);
  const B = runArm(seed, SUP, undefined);
  const C = runArm(seed, SUP, RESC);
  const C2 = runArm(seed, SUP, RESC);
  out.seeds[seed] = { A: A.samples, B: B.samples, C: C.samples };
  out.twins[seed] = { cDigestEqual: C.hash === C2.hash };
  console.log(`=== seed ${seed} ===`);
  for (const [name, R] of [['A', A], ['B', B], ['C', C]]) {
    for (const s of R.samples) {
      const lim = s.localLimitation;
      console.log(`seed ${seed} ${name} t${s.t} census P/C/D=[${s.census.P}/${s.census.C}/${s.census.D}] `
        + `prodEnergy=${s.producerEnergy} prodDisplayedUptake=[${s.producerDisplayedUptake.join(',')}] `
        + `limitedProducers=${lim.limitedProducers}/${lim.producers} (${(lim.limitedFrac * 100).toFixed(2)}%) `
        + `emptyByPool[A/B/C]=[${lim.emptyByPool.join('/')}] meanHeadroom=[${lim.meanHeadroomByPool.join(',')}] `
        + `capUtil=[${s.capUtil.join(',')}] exo.acc=${s.exogenous.accepted} lostRecalcByPool=[${s.lostRecalcAcceptedByPool.join(',')}]`);
    }
  }
  console.log(`seed ${seed} C-twins digestsEqual=${C.hash === C2.hash}`);
}
writeFileSync('evidence/issue15-L1-20261017/l1-panel.json', JSON.stringify(out, null, 1));
console.log('wrote evidence/issue15-L1-20261017/l1-panel.json');