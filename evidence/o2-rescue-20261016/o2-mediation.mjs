/**
 * O2 EVIDENCE — viability mediation observation across matched arms (read-only, portable).
 *
 * Replay (clean checkout of the PR head):
 *   npm install
 *   npm run view:build
 *   node evidence/o2-rescue-20261016/o2-mediation.mjs
 *
 * Per seed (517, 41001; viability diagnostic config; samples t0/t100/t250/t500):
 *  - A CONTROL (no knobs), B SUPPRESSED ({recalcOnly:0} + null rescue),
 *    C RESCUED ({recalcOnly:0} + {recalcOnly:true}).
 *  - Endpoints, all read-only via public engine state + ReproProbe + flux books:
 *    * producer-DISPLAYED photo uptake per pool: photoUptake[0][p] (display
 *      readout, NOT a phenotype-specific claim); all-guild aggregate retained
 *      separately labeled and never called producer uptake.
 *    * producer energy: sum of store.energy over live producer-displayed
 *      organisms (engine state, exact definition).
 *    * realized births: cumulative ReproProbe.placed by newborn guild +
 *      sexual/asexual path (engine-reported events, same instrument family as
 *      matingdiag).
 *    * retention: live census trajectory by displayed guild.
 *    * deaths: DERIVED identity deaths = N(prev) + placed(prev→now) − N(now)
 *      per guild per interval — exact given the two measured series, NOT a
 *      direct death counter. The engine has no death-cause probe; a direct
 *      death counter would be new instrumentation (not proposed here).
 *    * cyclic context: per-pool abioticRegen totals per arm — confounded with
 *      trajectories, reported as context, never a mediation coefficient.
 *  - Twins determinism + digest equality on the C arm; null-rescue parity.
 *
 * Engine: `ts-evo-poc/0.6.6`, gates `gates/0.8.0` (G35).
 * Compiled build used; never tsx for horizons. Arm-by-arm description only:
 * NO efficacy verdict, NO reliance verdict, NO thresholds are stated here.
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
const SAMPLES = [0, 100, 250, 500];
const f1 = (n) => Number(n).toFixed(1);

class BirthProbe {
  constructor() {
    this.placedCounts = [[0, 0], [0, 0], [0, 0]]; // [guild][asexual, sexual]
    this.queuedCounts = [[0, 0], [0, 0], [0, 0]];
  }
  blocked() {}
  reachedRoll() {}
  fired() {}
  queued(guild, sexual, count) { this.queuedCounts[guild][sexual ? 1 : 0] += count; }
  placed(guild, sexual) { this.placedCounts[guild][sexual ? 1 : 0]++; }
}

function build(seed, sup, resc) {
  const probe = new BirthProbe();
  const w = new World({
    config: {
      ...VIABILITY, seed,
      ...(sup === undefined ? {} : { phenoMineralReturn: sup }),
      ...(resc === undefined ? {} : { phenoMineralRescue: resc }),
    },
    reproProbe: probe,
  });
  return { w, probe };
}

function census(w) {
  const n = [0, 0, 0];
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i)) continue;
    n[w.roleOf(i).trophic]++;
  }
  return n;
}
function producerEnergy(w) {
  let e = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i) || w.roleOf(i).trophic !== 0) continue;
    e += w.store.energy[i];
  }
  return e;
}

function runArm(seed, name, sup, resc) {
  const { w, probe } = build(seed, sup, resc);
  const traj = [];
  traj.push({ t: 0, census: census(w), energy: producerEnergy(w), placed: [0, 0, 0] });
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    if (SAMPLES.includes(t)) {
      traj.push({
        t, census: census(w), energy: producerEnergy(w),
        placed: probe.placedCounts.map((g) => g[0] + g[1]),
      });
    }
  }
  const f = w.getFluxSnapshot();
  // Producer-DISPLAYED uptake only; all-guild aggregate labeled as such.
  const prodPhoto = [0, 1, 2].map((p) => f.photoUptake[0][p]);
  const allGuildPhoto = [0, 1, 2].map((p) => f.photoUptake[0][p] + f.photoUptake[1][p] + f.photoUptake[2][p]);
  const exo = f.exogenousReplacement.accepted.flat(Infinity).reduce((x, y) => x + y, 0);
  const abio = [...f.abioticRegen];
  const pools = w.nutrients.map((n) => n.data.reduce((x, y) => x + y, 0));
  return { w, probe, traj, prodPhoto, allGuildPhoto, exo, abio, pools, hash: w.hashState() };
}

for (const seed of [517, 41001]) {
  const A = runArm(seed, 'A', undefined, undefined);
  const B = runArm(seed, 'B', SUP, undefined);
  const C = runArm(seed, 'C', SUP, RESC);
  for (const [name, R] of [['A', A], ['B', B], ['C', C]]) {
    console.log(`seed ${seed} ${name} prodDisplayedPhoto[${R.prodPhoto.map(f1).join(',')}] allGuildPhoto[${R.allGuildPhoto.map(f1).join(',')}] abioPerPool=[${R.abio.map(f1).join(',')}] pools=[${R.pools.map((x) => x.toFixed(0)).join(',')}]`);
    for (const s of R.traj) {
      const births = `birthsP/C/D=[${s.placed.join('/')}]`;
      console.log(`  t${s.t} censusP/C/D=[${s.census.join('/')}] prodEnergy=${f1(s.energy)} ${s.t === 0 ? '(initial; no births yet)' : births}`);
    }
    // Deaths per interval: exact identity from measured census + placed.
    for (let k = 1; k < R.traj.length; k++) {
      const prev = R.traj[k - 1], now = R.traj[k];
      const placed = [0, 1, 2].map((g) => now.placed[g] - prev.placed[g]);
      const deaths = [0, 1, 2].map((g) => prev.census[g] + placed[g] - now.census[g]);
      console.log(`  deaths t${prev.t}->t${now.t} P/C/D=[${deaths.join('/')}] (identity: N(prev)+placed−N(now); no direct death probe exists)`);
    }
  }
  console.log(`seed ${seed} C exogenousAccepted=${f1(C.exo)} (delivery at suppressed cells/ticks/pools)`);
  const C2 = runArm(seed, 'C2', SUP, RESC);
  const e1 = C.w.getFluxSnapshot().exogenousReplacement.accepted.flat(Infinity);
  const e2 = C2.w.getFluxSnapshot().exogenousReplacement.accepted.flat(Infinity);
  console.log(`seed ${seed} C-twins exoMismatch=${e1.filter((v, i) => v !== e2[i]).length} digests=${C.hash === C2.hash ? 'equal' : 'DIFFER'}`);
  const BN = runArm(seed, 'BN', SUP, null);
  console.log(`seed ${seed} nullRescueParity=${BN.hash === B.hash ? 'equal' : 'DIFFER'} (must be equal)`);
}
