/**
 * O1 GATE-2 EVIDENCE — phenotype-class suppression demonstration (read-only, portable).
 *
 * Replay (clean checkout of the PR head):
 *   npm install
 *   npm run view:build
 *   node evidence/o1-knockout-20261015/o1-demonstration.mjs
 *
 * Per seed (517, 41001; viability diagnostic config, 500 ticks):
 *  - NULL arm vs SUPPRESS arm ({carrionOnly:1, recalcOnly:0, dual:1}):
 *    per-class accepted deficit via O3 books, cyclic-regen feedback distinctly
 *    (abioticRegen totals), populations retained (alive counts), twin
 *    determinism incl. new books + digest equality, null-knob == unset digest.
 *
 * Engine: ts-evo-poc/0.6.5 (O1 knob null-default; knob-set runs carry the 0.6.5
 * behavior identity).
 * Compiled build used; never tsx for horizons. Observations only, no verdict.
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
const SUPPRESS = { carrionOnly: 1, recalcOnly: 0, dual: 1 };
const CLASS = ['carrionOnly', 'recalcOnly', 'dual', 'neither'];
const TICKS = 500;

const build = (seed, knob) => new World({
  config: { ...VIABILITY, seed, ...(knob === undefined ? {} : { phenoMineralReturn: knob }) },
});
const classTotals = (fam) => {
  const tot = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) for (let g = 0; g < 3; g++) for (let p = 0; p < 3; p++) for (let s = 0; s < 3; s++) tot[c] += fam[c][g][p][s];
  return tot;
};
const classAccepted = (w) => classTotals(w.getFluxSnapshot().bioticMineralizationByPheno.accepted);
const classShadow = (w) => classTotals(w.getFluxSnapshot().bioticMineralizationShadow.accepted);
const alive = (w) => {
  let n = 0, P = 0, C = 0, D = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i)) continue;
    n++;
    const g = w.roleOf(i).trophic;
    if (g === 0) P++; else if (g === 1) C++; else D++;
  }
  return { n, P, C, D };
};

for (const seed of [517, 41001]) {
  const wNull = build(seed, undefined);
  for (let t = 0; t < TICKS; t++) wNull.step();
  const wSup = build(seed, SUPPRESS);
  for (let t = 0; t < TICKS; t++) wSup.step();
  const aN = classAccepted(wNull), aS = classAccepted(wSup);
  const shS = classShadow(wSup);
  const forgone = aN.map((_, c) => c === 1 ? shS[c] - aS[c] : 0);
  const abN = wNull.getFluxSnapshot().abioticRegen.reduce((x, y) => x + y, 0);
  const abS = wSup.getFluxSnapshot().abioticRegen.reduce((x, y) => x + y, 0);
  const lN = alive(wNull), lS = alive(wSup);
  const wNullKnob = build(seed, null);
  for (let t = 0; t < TICKS; t++) wNullKnob.step();
  const wSup2 = build(seed, SUPPRESS);
  for (let t = 0; t < TICKS; t++) wSup2.step();
  const q1 = wSup.getFluxSnapshot().bioticMineralizationByPheno.accepted;
  const q2 = wSup2.getFluxSnapshot().bioticMineralizationByPheno.accepted;
  let mm = 0;
  for (let c = 0; c < 4; c++) for (let g = 0; g < 3; g++) for (let p = 0; p < 3; p++) for (let src = 0; src < 3; src++)
    if (q1[c][g][p][src] !== q2[c][g][p][src]) mm++;
  console.log(`seed ${seed} NULL accepted [${aN.map((v) => v.toFixed(1)).join(',')}] abio=${abN.toFixed(2)} alive=P${lN.P}/C${lN.C}/D${lN.D}`);
  console.log(`seed ${seed} SUPP accepted [${aS.map((v) => v.toFixed(1)).join(',')}] abio=${abS.toFixed(2)} alive=P${lS.P}/C${lS.C}/D${lS.D}`);
  console.log(`seed ${seed} recalcDeficit=${(aN[1] - aS[1]).toFixed(1)} recalcSuppressedToZero=${aS[1] === 0} nullRestores=${wNullKnob.hashState() === wNull.hashState()} twins=${mm === 0 && wSup.hashState() === wSup2.hashState() ? 'equal' : 'DIFFER'}`);
  console.log(`seed ${seed} shadowForgone recalc=${forgone[1].toFixed(1)} (pool/source-local dose basis; cumulative, not cell/time-exact)`);
}
