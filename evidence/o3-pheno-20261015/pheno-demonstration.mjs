/**
 * O3 GATE-1 EVIDENCE — per-event phenotype flux demonstration (read-only, portable).
 *
 * Replay (clean checkout):
 *   npm install
 *   npm run view:build
 *   node evidence/o3-pheno-20261015/pheno-demonstration.mjs
 *
 * Reports, per seed (517, 41001; viability diagnostic config, 500 ticks):
 *  - presence + shape of getFluxSnapshot().bioticMineralizationByPheno [4][3][3][3]
 *  - accepted flux by donor class x pool x writer (event-flux, NOT headcount)
 *  - reconciliation: per-cell guild == sum(classes) worst residual, all 4 books
 *  - neither-class share (REPORTED, not asserted)
 *  - twin-run determinism incl. new books + trajectory digest equality
 *
 * Engine source: ts-evo-poc/0.6.4 (O3 mirror; same parity pair as 0.6.3).
 * Compiled build used; never tsx for horizons.
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
const CLASS = ['carrionOnly', 'recalcOnly', 'dual', 'neither'];
const TICKS = 500;

function build(seed) {
  return new World({ config: { ...VIABILITY, seed } });
}

for (const seed of [517, 41001]) {
  const w = build(seed);
  for (let t = 0; t < TICKS; t++) w.step();
  const f = w.getFluxSnapshot();
  const ph = f.bioticMineralizationByPheno;
  const old = f.bioticMineralization;
  const shapeOk = Array.isArray(ph.accepted) && ph.accepted.length === 4
    && ph.accepted.every((c) => c.length === 3 && c.every((g) => g.length === 3 && g.every((p) => p.length === 3)));
  console.log(`seed ${seed} presence+shape bioticMineralizationByPheno[4][3][3][3]: ${shapeOk ? 'OK' : 'MALFORMED'}`);

  let worst = 0;
  let attempted = 0;
  let accClass = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    for (let g = 0; g < 3; g++) {
      for (let p = 0; p < 3; p++) {
        for (let src = 0; src < 3; src++) {
          attempted += ph.attempted[c][g][p][src];
          accClass[c] += ph.accepted[c][g][p][src];
          for (const book of ['attempted', 'accepted', 'capLoss', 'eviction']) {
            let s = 0;
            for (let cc = 0; cc < 4; cc++) s += ph[book][cc][g][p][src];
            const r = Math.abs(old[book][g][p][src] - s);
            if (r > worst) worst = r;
          }
        }
      }
    }
  }
  const accTotal = accClass.reduce((a, b) => a + b, 0);
  console.log(`seed ${seed} accepted-by-class ${CLASS.map((n, c) => `${n}=${accClass[c].toFixed(1)}`).join(' ')} total=${accTotal.toFixed(1)}`);
  console.log(`seed ${seed} reconcile guild==sum(classes) worst residual ${worst.toExponential(2)} (G32 bound 1e-6 x max(1,${attempted.toFixed(1)})); neither share ${(accTotal > 0 ? (accClass[3] / accTotal) * 100 : 0).toFixed(2)}%`);

  const w2 = build(seed);
  for (let t = 0; t < TICKS; t++) w2.step();
  const q = w2.getFluxSnapshot().bioticMineralizationByPheno;
  let mismatch = 0;
  for (let c = 0; c < 4; c++) for (let g = 0; g < 3; g++) for (let p = 0; p < 3; p++) for (let src = 0; src < 3; src++)
    for (const book of ['attempted', 'accepted', 'capLoss', 'eviction'])
      if (ph[book][c][g][p][src] !== q[book][c][g][p][src]) mismatch++;
  console.log(`seed ${seed} twin determinism mismatches=${mismatch} digests=${w.hashState() === w2.hashState() ? 'equal' : 'DIFFER'}`);
}
