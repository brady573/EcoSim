/**
 * Is the collapse of asexualRate adaptive, or does it suppress the guild?
 *
 * MEASURED FINDING BEING TESTED
 * `asexualRate` evolves from founder 0.2 to 0.0051 in consumers and 0.0123 in
 * producers, with 45.4% of consumer roll-entry ticks at exactly zero. Mean
 * margin at the gate is IDENTICAL between consumers (0.1688) and producers
 * (0.1692), so margin is not the difference. `mateSeeking` never moves (0.3959
 * vs founder 0.4).
 *
 * `asexualRate` is read in exactly one place in the entire engine - the
 * breeding drive calculation - and affects no other mechanic. A decline in a
 * trait with no other consequence is therefore selection acting against
 * reproduction itself.
 *
 * THE HYPOTHESIS UNDER TEST
 * There is no explicit fitness function. Reproduction costs the parent
 * (`spend(slot, 1.1 + size*0.35, 'reproduction')`), and in a saturated world an
 * offspring does not out-compete its parent. If that is the whole story, then
 * "never reproduce, keep the energy" is genuinely optimal here, and the
 * guild collapse is a correct response to a missing selection pressure.
 *
 * PREDICTION IF ADAPTIVE: seeding founders with a high asexualRate buys only a
 * transient gain. Selection erodes it again and consumers still go extinct,
 * because the trait confers no lasting advantage in this world.
 *
 * PREDICTION IF ARTEFACT: consumers persist across seeds when seeded high,
 * showing the trait is load-bearing and its natural erosion is incidental.
 *
 * Run: tsx src/trace/asexualsweep.ts [ticks]
 */
import { World } from '../world/world.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { ReproProbeLog } from './reproprobe.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = [24601, 777, 1234];
const LEVELS: Array<number | null> = [null, 0.5, 0.8];

interface Cell {
  seed: number;
  init: number | null;
  finalPop: number;
  consumersAt: number[];
  consumerBirths: number;
  consumerDeaths: number;
  endAsexual: number;
  prodShare: number;
}

const cells: Cell[] = [];

for (const init of LEVELS) {
  for (const seed of SEEDS) {
    const probe = new ReproProbeLog(TROPHIC_COUNT);
    const w = new World({
      config: { founders: 400, worldW: 2400, worldH: 2400, seed, asexualRateInit: init },
      reproProbe: probe,
    });
    const s = w.store;
    // Sample consumer presence at 10 points to see RECURRENCE, not just the end.
    const at: number[] = [];
    const marks = new Set([200, 400, 600, 800, 1000, 1400, 1800, 2100, 2300, 2400]);
    for (let t = 1; t <= TICKS; t++) {
      w.step();
      if (marks.has(t)) {
        let n = 0;
        for (let sl = 0; sl < s.count; sl++) {
          if (w.aliveAt(sl) && w.roleOf(sl).trophic === TROPHIC.CONSUMER) n++;
        }
        at.push(n);
      }
    }
    const d = w.demographics();
    const en = [0, 0, 0];
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      const g = w.roleOf(sl).trophic;
      if (g >= 0 && g < TROPHIC_COUNT) en[g] += s.energy[sl];
    }
    const te = en.reduce((a, b) => a + b, 0) || 1;
    const c = probe.read(TROPHIC.CONSUMER);
    cells.push({
      seed,
      init,
      finalPop: s.population,
      consumersAt: at,
      consumerBirths: d.births[1][0] + d.births[1][1],
      consumerDeaths: d.deaths[1][0] + d.deaths[1][1] + d.deaths[1][2],
      endAsexual: c?.asexualMean ?? 0,
      prodShare: (en[0] / te) * 100,
    });
  }
}

const label = (i: number | null): string => (i === null ? 'founder(0.2)' : `forced(${i})`);

console.log(`ASEXUAL-RATE SEEDING SWEEP — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('Only the founder asexualRate init varies; the trait stays heritable,');
console.log('so selection may still erode it. Sampling consumers at 10 checkpoints.\n');
console.log('init          seed   consBirths consDeaths    B/D   pop  prod%  endAsexal  consumer presence at t=200..2400');
for (const c of cells) {
  const bd = c.consumerDeaths > 0 ? (c.consumerBirths / c.consumerDeaths).toFixed(2) : 'n/a';
  console.log(
    `${label(c.init).padEnd(13)} ${String(c.seed).padStart(5)} ${String(c.consumerBirths).padStart(11)} ` +
      `${String(c.consumerDeaths).padStart(11)} ${bd.padStart(6)} ${String(c.finalPop).padStart(6)} ` +
      `${c.prodShare.toFixed(1).padStart(6)} ${c.endAsexual.toFixed(4).padStart(10)}   ` +
      c.consumersAt.map((n) => String(n).padStart(5)).join(''),
  );
}

console.log('\nSUMMARY BY INITIAL VALUE');
console.log('init          meanB/D  seedsB>D  seedsAnyAlive  meanEndAsexal  vsFounder');
for (const init of LEVELS) {
  const g = cells.filter((c) => c.init === init);
  const bd = g.map((c) => (c.consumerDeaths > 0 ? c.consumerBirths / c.consumerDeaths : 0));
  const meanBd = bd.reduce((a, b) => a + b, 0) / bd.length;
  const meanA = g.reduce((a, c) => a + c.endAsexual, 0) / g.length;
  console.log(
    `${label(init).padEnd(13)} ${meanBd.toFixed(3).padStart(9)} ` +
      `${String(g.filter((c) => c.consumerBirths > c.consumerDeaths).length).padStart(9)} ` +
      `${String(g.filter((c) => c.consumersAt.some((n) => n > 0)).length).padStart(14)} ` +
      `${meanA.toFixed(4).padStart(14)} ${(meanA / 0.2).toFixed(3).padStart(10)}x`,
  );
}

console.log('\nINTERPRETATION HINT');
for (const init of LEVELS) {
  const g = cells.filter((c) => c.init === init);
  const meanA = g.reduce((a, c) => a + c.endAsexual, 0) / g.length;
  const anyAlive = g.filter((c) => c.consumersAt.some((n) => n > 0)).length;
  console.log(
    `  ${label(init).padEnd(13)} endAsexal ${meanA.toFixed(4)} ` +
      `(${(meanA / 0.2 * 100).toFixed(1)}% of founder) consumersAliveInAnySeed ${anyAlive}/${g.length}`,
  );
}
console.log('\nADAPTIVE would show: endAsexal eroded back toward 0.005 and consumers still extinct.');
console.log('ARTEFACT would show: consumers persist when seeded high.');