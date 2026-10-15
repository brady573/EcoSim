/**
 * A2 REACHABILITY / LIMITATION PROBE — Issue #15 Tier-0 (read-only, portable).
 *
 * Question: does the proposed A2 candidate (viability config with
 * nutrientFloor:0, basalFoodPerCell:0) actually bind producer uptake on any
 * pool, or is it still compensated/saturated? No success criterion is
 * fabricated; saturation is reported as a valid outcome.
 *
 * Replay (clean checkout):
 *   npm install
 *   npm run view:build
 *   node evidence/issue15-pilot-scratch-20261015/a2-reachability.mjs
 *
 * Engine source: ts-evo-poc/0.6.3 (source SHA in source-SHA.txt; engine
 * source unchanged — working tree adds only docs/ + this evidence dir).
 * Compiled build used; never tsx for horizons.
 */
import { World } from '../../build/world/world.js';
import { TRAIT } from '../../build/bio/genome.js';

const T0 = Date.now();

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
const A2 = { nutrientFloor: 0, basalFoodPerCell: 0 };

function build(seed, overrides = {}) {
  return new World({ config: { ...VIABILITY, seed, ...overrides } });
}
const sum = (a) => a.flat(Infinity).reduce((x, y) => x + y, 0);
const f1 = (n) => Number(n).toFixed(1);

function snapshot(w) {
  const f = w.getFluxSnapshot();
  let P = 0, C = 0, D = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i)) continue;
    const g = w.roleOf(i).trophic;
    if (g === 0) P++; else if (g === 1) C++; else D++;
  }
  const photoPool = [0, 1, 2].map((p) => f.photoUptake[0][p] + f.photoUptake[1][p] + f.photoUptake[2][p]);
  const exPool = [0, 1, 2].map((p) =>
    f.excretionReturns.accepted[0][p] + f.excretionReturns.accepted[1][p] + f.excretionReturns.accepted[2][p]);
  const bioPool = [0, 1, 2].map((p) => {
    let s = 0;
    for (let g = 0; g < 3; g++) for (let src = 0; src < 3; src++) s += f.bioticMineralization.accepted[g][p][src];
    return s;
  });
  const totals = w.nutrients.map((n) => n.data.reduce((a, b) => a + b, 0));
  const caps = [0, 1, 2].map((p) => {
    const cap = w.config.nutrientCapacity[p];
    let s = 0;
    for (let i = 0; i < w.habitat.fertility.data.length; i++)
      s += w.config.nutrientPerCell * w.habitat.fertility.data[i] * cap;
    return s;
  });
  const utils = totals.map((t, p) => (caps[p] > 0 ? t / caps[p] : 0));
  const org = {
    det: w.detritus.data.reduce((a, b) => a + b, 0),
    sed: w.sediment.data.reduce((a, b) => a + b, 0),
    lit: w.litter.data.reduce((a, b) => a + b, 0),
  };
  return { P, C, D, photoPool, exPool, bioPool, abio: [...f.abioticRegen], totals, utils, org, hash: w.hashState() };
}

function branchCensus(w) {
  // Disjoint donor classes from role.ts:208-211 qualifiers (census only, NOT flux).
  const cls = { carrionOnly: 0, recalcOnly: 0, dual: 0, neither: 0 };
  const byGuild = [0, 0, 0];
  let total = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i) || w.bioticMineraliser[i] !== 1) continue;
    total++;
    byGuild[w.roleOf(i).trophic]++;
    const photo = w.store.trait(i, TRAIT.PHOTOSYNTHETIC_RATE);
    const carrion = w.store.trait(i, TRAIT.CARRION_AFFINITY);
    const recalc = w.store.trait(i, TRAIT.RECALCITRANT_DIGESTION);
    const speed = w.store.trait(i, TRAIT.SPEED);
    const carr = photo < 0.34 && carrion > 0.55 && speed < 2.4;
    const rec = photo < 0.34 && recalc > 0.5;
    if (carr && rec) cls.dual++;
    else if (carr) cls.carrionOnly++;
    else if (rec) cls.recalcOnly++;
    else cls.neither++;
  }
  return { total, byGuild, ...cls };
}

const SEEDS = [517, 41001];
const ARMS = [
  ['A', {}],
  ['A2', A2],
  ['B1A', { bioticMineralisation: 0 }],
  ['B1A2', { ...A2, bioticMineralisation: 0 }],
  ['B2A2', { ...A2, excretionRate: 0 }],
  ['PA2', { ...A2, producerCaptureScale: 0 }],
];

console.log('A2 REACHABILITY seed x arm @500t (portable; viability base; A2=floor0+rain0)');
for (const seed of SEEDS) {
  for (const [name, ov] of ARMS) {
    const w = build(seed, ov);
    for (let t = 0; t < 500; t++) w.step();
    const s = snapshot(w);
    console.log(`seed ${seed} ${name} P${s.P}/C${s.C}/D${s.D} ` +
      `photo[${s.photoPool.map(f1).join(',')}] ex[${s.exPool.map(f1).join(',')}] ` +
      `bio[${s.bioPool.map(f1).join(',')}] abio[${s.abio.map(f1).join(',')}] ` +
      `pools[${s.totals.map(f1).join(',')}] util[${s.utils.map((u) => u.toFixed(2)).join(',')}] ` +
      `org[${f1(s.org.det)},${f1(s.org.sed)},${f1(s.org.lit)}] hash${s.hash.slice(0, 12)}`);
  }
}

console.log('');
console.log('TRAJECTORY @2000t A / A2 / B1A2 (t500/1000/1500/2000 P/C/D + cumulative producer photo)');
for (const seed of SEEDS) {
  for (const [name, ov] of [['A', {}], ['A2', A2], ['B1A2', { ...A2, bioticMineralisation: 0 }]]) {
    const w = build(seed, ov);
    const pts = [];
    for (let t = 1; t <= 2000; t++) {
      w.step();
      if (t % 500 === 0) {
        const s = snapshot(w);
        const prodPhoto = s.photoPool.reduce((a, b) => a + b, 0);
        pts.push(`t${t}:P${s.P}/C${s.C}/D${s.D}/ph${f1(prodPhoto)}/u[${s.utils.map((u) => u.toFixed(2)).join(',')}]`);
      }
    }
    console.log(`seed ${seed} ${name} ${pts.join(' ')}`);
  }
}

console.log('');
console.log('PHENOTYPE-BRANCH CENSUS @500t A2 (disjoint headcount; denominators != flux)');
for (const seed of SEEDS) {
  const w = build(seed, A2);
  for (let t = 0; t < 500; t++) w.step();
  const c = branchCensus(w);
  console.log(`seed ${seed} A2 mineralisers total=${c.total} guildP/C/D=${c.byGuild.join('/')} ` +
    `carrionOnly=${c.carrionOnly} recalcOnly=${c.recalcOnly} dual=${c.dual} neither=${c.neither}`);
}

console.log('');
console.log('CONTROLS @A2 seed 517/41001: P must collapse uptake; N repeat byte-identical; observer reads nonperturbing');
for (const seed of SEEDS) {
  const p = build(seed, { ...A2, producerCaptureScale: 0 });
  for (let t = 0; t < 500; t++) p.step();
  const ps = snapshot(p);
  const n1 = build(seed, A2);
  for (let t = 0; t < 500; t++) n1.step();
  const n2 = build(seed, A2);
  for (let t = 0; t < 500; t++) n2.step();
  const r = build(seed, A2);
  for (let t = 0; t < 500; t++) { r.step(); if (t % 50 === 0) { r.getFluxSnapshot(); r.hashState(); } }
  console.log(`seed ${seed} PA2 producerPhotoTotal=${f1(ps.photoPool.reduce((a, b) => a + b, 0))} (expect ~0) ` +
    `N identical=${n1.hashState() === n2.hashState()} ` +
    `observerReadsEqual=${r.hashState() === n1.hashState()}`);
}
console.log(`elapsed ${(Date.now() - T0) / 1000}s`);
