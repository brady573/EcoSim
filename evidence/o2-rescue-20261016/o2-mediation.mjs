/**
 * O2 EVIDENCE — viability mediation observation across matched arms (read-only, portable).
 *
 * Replay (clean checkout of the PR head):
 *   npm install
 *   npm run view:build
 *   node evidence/o2-rescue-20261016/o2-mediation.mjs
 *
 * Per seed (517, 41001; viability diagnostic config, 500 ticks):
 *  - A CONTROL (no knobs), B SUPPRESSED ({recalcOnly:0} + null rescue),
 *    C RESCUED ({recalcOnly:0} + {recalcOnly:true}):
 *    producer photo uptake per pool, exogenous accepted totals, abioticRegen
 *    (cyclic response, confounded with trajectories — reported, not a
 *    mediation coefficient), pool totals + capUtil, populations, twin
 *    determinism + digest equality on the C arm, null-rescue parity.
 *
 * Engine: `ts-evo-poc/0.6.6`, gates `gates/0.8.0` (G35).
 * Compiled build used; never tsx for horizons. Observations only: NO claim
 * about rescue efficacy, nutrient limitation, or guild reliance is made here.
 */
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
const SUP = { carrionOnly: 1, recalcOnly: 0, dual: 1 };
const RESC = { carrionOnly: false, recalcOnly: true, dual: false };
const TICKS = 500;
const f1 = (n) => Number(n).toFixed(1);

function build(seed, sup, resc) {
  return new World({
    config: {
      ...VIABILITY, seed,
      ...(sup === undefined ? {} : { phenoMineralReturn: sup }),
      ...(resc === undefined ? {} : { phenoMineralRescue: resc }),
    },
  });
}
function census(w) {
  let P = 0, C = 0, D = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i)) continue;
    const g = w.roleOf(i).trophic;
    if (g === 0) P++; else if (g === 1) C++; else D++;
  }
  return `P${P}/C${C}/D${D}`;
}
function arms(seed) {
  const out = {};
  for (const [name, sup, resc] of [['A', undefined, undefined], ['B', SUP, undefined], ['C', SUP, RESC]]) {
    const w = build(seed, sup, resc);
    for (let t = 0; t < TICKS; t++) w.step();
    const f = w.getFluxSnapshot();
    const photo = [0, 1, 2].map((p) => f.photoUptake[0][p] + f.photoUptake[1][p] + f.photoUptake[2][p]);
    const exo = f.exogenousReplacement.accepted.flat(Infinity).reduce((x, y) => x + y, 0);
    const abio = f.abioticRegen.reduce((x, y) => x + y, 0);
    const pools = w.nutrients.map((n) => n.data.reduce((x, y) => x + y, 0));
    out[name] = { w, photo, exo, abio, pools, census: census(w), hash: w.hashState() };
  }
  return out;
}

for (const seed of [517, 41001]) {
  const { A, B, C } = arms(seed);
  console.log(`seed ${seed} A photo[${A.photo.map(f1).join(',')}] abio=${f1(A.abio)} pools=[${A.pools.map((x) => x.toFixed(0)).join(',')}] ${A.census}`);
  console.log(`seed ${seed} B photo[${B.photo.map(f1).join(',')}] abio=${f1(B.abio)} pools=[${B.pools.map((x) => x.toFixed(0)).join(',')}] ${B.census}`);
  console.log(`seed ${seed} C photo[${C.photo.map(f1).join(',')}] exo=${f1(C.exo)} abio=${f1(C.abio)} pools=[${C.pools.map((x) => x.toFixed(0)).join(',')}] ${C.census}`);
  const wC2 = build(seed, SUP, RESC);
  for (let t = 0; t < TICKS; t++) wC2.step();
  const e1 = C.w.getFluxSnapshot().exogenousReplacement.accepted.flat(Infinity);
  const e2 = wC2.getFluxSnapshot().exogenousReplacement.accepted.flat(Infinity);
  console.log(`seed ${seed} C-twins exoMismatch=${e1.filter((v, i) => v !== e2[i]).length} digests=${C.hash === wC2.hashState() ? 'equal' : 'DIFFER'}`);
  const wNull = build(seed, SUP, null);
  for (let t = 0; t < TICKS; t++) wNull.step();
  console.log(`seed ${seed} nullRescueParity=${wNull.hashState() === B.hash ? 'equal' : 'DIFFER'} (must be equal)`);
}
