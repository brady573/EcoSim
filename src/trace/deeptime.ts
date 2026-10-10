/**
 * DEEP-TIME RESURRECTION TEST — single 50k-tick run on seed 517.
 *
 * HYPOTHESIS: when one guild dominates, within-guild mutations bring the other
 * guilds back. Seed 517 loses all producers by ~t4200 while consumers thrive
 * (C757+, B/D 1.10). If evolution resurrects, consumers with drifting photo
 * should cross 0.34 and become producers. Empty light-niche + no competition
 * = maximum adaptive-radiation pull.
 *
 * PREDICTIONS, in order of expected ease:
 *   1. Consumer->producer transitions occur (C->P matrix entries grow).
 *   2. Mean consumer photo drifts upward toward 0.34.
 *   3. Producer count returns from 0 (resurrection event).
 * Consumer resurrection and decomposer resurrection are harder (valley
 * crossing, 3-trait coordination) and not expected on this seed.
 *
 * FALSIFIED IF: zero C->P transitions across 50k ticks despite thousands of
 * consumer births, or consumer photo flat/falling, or producers never return.
 *
 * Samples every 1000 ticks (50 samples): P/C/D, transition matrix, mean photo
 * among consumers, dormant count, total population. Designed for background
 * execution (10-20 min expected).
 *
 * Run: tsx src/trace/deeptime.ts [seed] [ticks]
 */
import { World } from '../world/world.js';
import { TRAIT } from '../bio/genome.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';

const SEED = Number(process.argv[2] ?? 517);
const TICKS = Number(process.argv[3] ?? 50000);
const STEP = 1000;

const w = new World({
  config: {
    founders: 400, worldW: 2400, worldH: 2400, seed: SEED,
    consumerPhotoScale: 4, decomposerFounders: 0.25,
    decomposerDormancy: 0.05, sporeDispersal: 1,
  },
});
const s = w.store;

console.log(`DEEP-TIME seed=${SEED} ticks=${TICKS} (photox4 + seeding + dormancy + spores)`);
console.log('tick      pop   prod  cons  decomp | C->P trans  P->C trans  meanConsPhoto  dormant');
console.log('--- resurrection watch: producers extinct ~t4200; C->P transitions = evolution trying ---');

let prodExtinctTick = -1;
let prodReturnTick = -1;
let wasExtinct = false;

for (let t = 1; t <= TICKS; t++) {
  w.step();
  if (t % STEP !== 0) continue;
  const n = [0, 0, 0];
  let photoSum = 0, photoN = 0;
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const g = w.roleOf(sl).trophic;
    if (g < 0 || g >= TROPHIC_COUNT) continue;
    n[g]++;
    if (g === TROPHIC.CONSUMER) {
      photoSum += s.trait(sl, TRAIT.PHOTOSYNTHETIC_RATE);
      photoN++;
    }
  }
  const tm = w.transitionMatrix();
  const [dd] = w.dormantCounts();
  if (n[0] === 0 && !wasExtinct) { wasExtinct = true; prodExtinctTick = t; }
  if (wasExtinct && n[0] > 0 && prodReturnTick < 0) prodReturnTick = t;
  console.log(
    `${String(t).padStart(5)} ${String(s.population).padStart(7)} ${String(n[0]).padStart(5)} ` +
      `${String(n[1]).padStart(5)} ${String(n[2]).padStart(7)} | ` +
      `${String(Math.round(tm[1][0])).padStart(9)} ${String(Math.round(tm[0][1])).padStart(9)} ` +
      `${(photoN ? photoSum / photoN : 0).toFixed(4).padStart(13)} ${String(dd).padStart(8)}`,
  );
}

const tm = w.transitionMatrix();
console.log('\nFINAL TRANSITION MATRIX (parent guild -> child guild):');
console.log('         toPROD    toCONS    toDECOMP');
const NAMES = ['fromPROD', 'fromCONS', 'fromDECOMP'];
for (let g = 0; g < 3; g++) {
  console.log(
    `${NAMES[g]} ${String(Math.round(tm[g][0])).padStart(9)} ${String(Math.round(tm[g][1])).padStart(9)} ` +
      `${String(Math.round(tm[g][2])).padStart(10)}`,
  );
}
const cpTrans = Math.round(tm[1][0]);
console.log(`\nProducer extinction tick: ${prodExtinctTick < 0 ? 'never' : prodExtinctTick}`);
console.log(`Producer return tick: ${prodReturnTick < 0 ? 'NEVER' : prodReturnTick}`);
console.log(`C->P transitions total: ${cpTrans}`);
console.log(`RESURRECTED=${prodReturnTick >= 0 ? 1 : 0} (producers returned after extinction)`);
console.log(`EVOLUTION_TRIED=${cpTrans > 0 ? 1 : 0} (any consumer parent produced a producer child)`);
console.log(JSON.stringify({
  seed: SEED, ticks: TICKS,
  prodExtinctTick, prodReturnTick,
  cpTransitions: cpTrans,
  resurrected: prodReturnTick >= 0 ? 1 : 0,
  evolutionTried: cpTrans > 0 ? 1 : 0,
}));