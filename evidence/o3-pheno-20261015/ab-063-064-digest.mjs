/**
 * Pre/post-mirror nonperturbation A/B — portable (no worktree paths baked in).
 *
 * Compares a baseline 0.6.3 build against a candidate 0.6.4+O3 build with
 * identical seed/config/command: 5 sampled trajectory digests + all
 * pre-existing guild books elementwise + census. 2 seeds x 500 ticks.
 *
 * Usage (from a checkout of the candidate PR head):
 *   # baseline 0.6.3 (source 8956699 — record with `git rev-parse HEAD` there):
 *   git worktree add /tmp/o3base 8956699
 *   cd /tmp/o3base && npm install && npm run view:build
 *   # candidate (this checkout — record with `git rev-parse HEAD`):
 *   npm install && npm run view:build
 *   node evidence/o3-pheno-20261015/ab-063-064-digest.mjs \
 *     /tmp/o3base/build/world/world.js ./build/world/world.js
 *
 * Both SHAs, exact commands and outputs are archived alongside (see README).
 */
import { pathToFileURL } from 'node:url';

const [baselineWorldJs, candidateWorldJs] = process.argv.slice(2);
if (!baselineWorldJs || !candidateWorldJs) {
  throw new Error('usage: ab-063-064-digest.mjs <baseline-build/world/world.js> <candidate-build/world/world.js>');
}
const { World: W063 } = await import(pathToFileURL(baselineWorldJs).href);
const { World: W064 } = await import(pathToFileURL(candidateWorldJs).href);

const CFG = (seed) => ({
  founders: 400, worldW: 2400, worldH: 2400, seed,
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
});
const flat = (a) => a.flat(Infinity);

console.log(`baseline=${baselineWorldJs} candidate=${candidateWorldJs} ticks=500 seeds=[517,41001]`);
for (const seed of [517, 41001]) {
  const a = new W063({ config: CFG(seed) });
  const b = new W064({ config: CFG(seed) });
  const da = [], db = [];
  for (let t = 1; t <= 500; t++) {
    a.step(); b.step();
    if (t % 100 === 0) { da.push(a.hashState()); db.push(b.hashState()); }
  }
  const digestsEqual = da.every((d, i) => d === db[i]);
  const fa = a.getFluxSnapshot(), fb = b.getFluxSnapshot();
  let guildMismatch = 0;
  for (const fam of ['excretionReturns', 'bioticMineralization']) {
    for (const book of ['attempted', 'accepted', 'capLoss', 'eviction']) {
      const A = flat(fa[fam][book]), B = flat(fb[fam][book]);
      A.forEach((v, i) => { if (v !== B[i]) guildMismatch++; });
    }
  }
  flat(fa.photoUptake).forEach((v, i) => { if (v !== flat(fb.photoUptake)[i]) guildMismatch++; });
  const P = [0, 0, 0];
  for (let i = 0; i < a.store.count; i++) { if (!a.aliveAt(i)) continue; P[a.roleOf(i).trophic]++; }
  console.log(`seed ${seed} digests5x=${digestsEqual} guildBooksMismatch=${guildMismatch} census=P${P[0]}/C${P[1]}/D${P[2]}`);
  if (!digestsEqual || guildMismatch !== 0) process.exitCode = 1;
}
