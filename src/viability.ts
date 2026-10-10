/**
 * Short behavioural diagnostic. Answers one question: where does the
 * predator-prey loop break? Separates detection opportunity from choice from
 * contact, so an inert ecology is distinguishable from a broken detector.
 *
 * Run: pnpm viability   (short by design)
 */

import { World } from './world/world.js';
import { INTENT, INTENT_NAME } from './world/world.js';
import { TRAIT } from './bio/genome.js';

const FOUNDERS = 300;
const WORLD = 2200;
const TICKS = 400;

function main(): void {
  const w = new World({
    config: { founders: FOUNDERS, worldW: WORLD, worldH: WORLD, seed: 4242, label: 'viability' },
  });

  console.log(`founders=${FOUNDERS} world=${WORLD}x${WORLD} ticks=${TICKS} seed=4242\n`);
  console.log('tick   pop  detPrey detThreat detMate  meanE   births deaths | preyDet%  threatDet%  submitted(pred,mate)');
  console.log('-'.repeat(112));

  for (let i = 0; i < TICKS; i++) {
    w.step();
    if (w.tick % 50 !== 0) continue;
    const s = w.snapshot;
    const pop = Math.max(1, s.population);
    console.log(
      `${String(w.tick).padStart(4)} ${String(s.population).padStart(5)} ` +
        `${String(w.lastDetectedPrey).padStart(8)} ${String(w.lastDetectedThreat).padStart(9)} ` +
        `${String(w.lastDetectedMate).padStart(7)} ` +
        `${s.meanEnergy.toFixed(1).padStart(7)} ` +
        `${String(s.births).padStart(7)} ${String(s.deaths).padStart(6)} | ` +
        `${((w.lastDetectedPrey / pop) * 100).toFixed(1).padStart(8)}% ` +
        `${((w.lastDetectedThreat / pop) * 100).toFixed(1).padStart(10)}%  ` +
        `${String(w.submittedByKind[0]).padStart(6)},${String(w.submittedByKind[2])}`,
    );
  }

  const total = w.intentCounts.reduce((a, b) => a + b, 0) || 1;
  console.log('\nbehavioural composition (cumulative over run):');
  for (let i = 0; i < 7; i++) {
    const pct = (w.intentCounts[i] / total) * 100;
    const bar = '#'.repeat(Math.round(pct / 2));
    console.log(`  ${INTENT_NAME[i].padEnd(9)} ${pct.toFixed(2).padStart(6)}%  ${bar}`);
  }
  void INTENT;

  console.log('\ncontest submissions by kind:');
  const kinds = ['predation', 'territorial', 'mating', 'scavenge'];
  for (let i = 0; i < 4; i++) console.log(`  ${kinds[i].padEnd(12)} ${w.submittedByKind[i]}`);
  console.log(`  resolved      ${w.interactions.totalResolved} (cumulative)`);
  console.log(`  collapsed     ${w.interactions.totalCollapsed}`);
  console.log(`  abandoned     ${w.interactions.totalAbandoned}`);

  // Scale relationships, to check the gape band is not empty by construction.
  const s = w.store;
  let minS = Infinity;
  let maxS = -Infinity;
  let sum = 0;
  let n = 0;
  let ratioInBand = 0;
  let pairs = 0;
  for (let slot = 0; slot < s.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const size = s.trait(slot, TRAIT.SIZE);
    minS = Math.min(minS, size);
    maxS = Math.max(maxS, size);
    sum += size;
    n++;
    for (let j = 0; j < 40; j++) {
      const other = (slot + 1 + j * 37) % s.count;
      if (!w.aliveAt(other) || other === slot) continue;
      pairs++;
      const ratio = s.trait(other, TRAIT.SIZE) / Math.max(0.05, size);
      if (ratio > 0.16 && ratio < 0.92) ratioInBand++;
    }
  }
  console.log(
    `\nbody size: min=${minS.toFixed(2)} mean=${(sum / Math.max(1, n)).toFixed(2)} max=${maxS.toFixed(2)} ` +
      `(physical range 0.35..15.5)`,
  );
  console.log(`sampled pairs inside the edible gape band (0.16 < ratio < 0.92): ${ratioInBand}/${pairs}`);
  console.log(`\nfinal: pop=${w.snapshot.population} biomass=${w.snapshot.biomass.toFixed(0)} residual=${(w.accountingResidualFraction() * 100).toFixed(6)}%`);
}

main();