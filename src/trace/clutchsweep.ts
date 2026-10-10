/**
 * CLUTCH SWEEP — does the mechanical fecundity ceiling bind?
 *
 * THE CEILING
 * Births are queued as `max(1, round(clutchSize * (0.5 + rand)))`. The founder
 * init is 0.35, giving round(0.175..0.525) = 0 or 1, clamped to exactly 1. The
 * trait is declared 1..11 but cannot express more than a single offspring below
 * ~1.33. So every consumer produces at most ONE offspring per successful
 * breeding event, and the event itself succeeds on only ~2% of eligible ticks.
 *
 * TWO COMPETING EXPLANATIONS FOR CONSUMER EXTINCTION
 *   (a) MECHANICAL CEILING - even if consumers wanted to breed, they physically
 *       cannot produce enough offspring. Real herbivores manage ~1 surviving
 *       offspring per adult lifetime; measured here is 35 births across 3 seeds
 *       x 2400 ticks, far below that.
 *   (b) SELECTION GRADIENT - evolution dismantles asexualRate (measured: 0.2 ->
 *       0.0051) because reproduction costs energy and does not pay, so no
 *       fecundity increase would survive.
 *
 * These predict DIFFERENT results from a clutch sweep:
 *   If (a) binds: raising the clutch should raise B/D materially. More offspring
 *      per event should directly multiply births.
 *   If (b) binds: raising the clutch may raise births transiently, but selection
 *      should erode the trait (as it did for asexualRate, where seeding 0.8 ended
 *      at 0.0392), and B/D still fails to cross 1.0.
 *
 * Run: tsx src/trace/clutchsweep.ts [ticks]
 */
import { World } from '../world/world.js';
import { TRAIT } from '../bio/genome.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { ReproProbeLog } from './reproprobe.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = [24601, 777, 1234];
// NORMALISED GENES in [0,1], not physical values. express(g) = 1 + g*10.
// Declared founder gene 0.35 expresses to a physical clutch of 4.5.
// An earlier version of this sweep passed physical values (2,5,9); all of them
// clamped to gene 1.0 and produced byte-identical runs, which is exactly the
// silent-saturation failure documented on TraitSpec.init.
const LEVELS: Array<number | null> = [null, 0.0, 0.15, 0.55];

interface Cell {
  seed: number;
  init: number | null;
  births: number;
  deaths: number;
  pop: number;
  prodShare: number;
  consumersAt: number[];
  meanClutchTrait: number;
  probe: ReproProbeLog;
  digestOff: string;
  digestOn: string;
}

const cells: Cell[] = [];
for (const init of LEVELS) {
  for (const seed of SEEDS) {
    const probe = new ReproProbeLog(TROPHIC_COUNT);
    const wOff = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed, clutchSizeInit: init } });
    for (let t = 0; t < TICKS; t++) wOff.step();
    const w = new World({ config: { founders: 400, worldW: 2400, worldH: 2400, seed, clutchSizeInit: init }, reproProbe: probe });
    const s = w.store;
    const marks = new Set([200, 400, 600, 800, 1000, 1400, 1800, 2100, 2300, 2400]);
    const at: number[] = [];
    for (let t = 1; t <= TICKS; t++) {
      w.step();
      if (marks.has(t)) {
        let n = 0;
        for (let sl = 0; sl < s.count; sl++) if (w.aliveAt(sl) && w.roleOf(sl).trophic === TROPHIC.CONSUMER) n++;
        at.push(n);
      }
    }
    const d = w.demographics();
    const en = [0, 0, 0];
    let clutchSum = 0, clutchN = 0;
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      const g = w.roleOf(sl).trophic;
      if (g >= 0 && g < TROPHIC_COUNT) en[g] += s.energy[sl];
      if (g === TROPHIC.CONSUMER) { clutchSum += s.trait(sl, TRAIT.CLUTCH_SIZE); clutchN++; }
    }
    const te = en.reduce((a, b) => a + b, 0) || 1;
    cells.push({
      seed, init,
      births: d.births[1][0] + d.births[1][1],
      deaths: d.deaths[1][0] + d.deaths[1][1] + d.deaths[1][2],
      pop: s.population,
      prodShare: (en[0] / te) * 100,
      consumersAt: at,
      meanClutchTrait: clutchN ? clutchSum / clutchN : 0,
      probe,
      digestOff: wOff.hashState(),
      digestOn: w.hashState(),
    });
  }
}

const label = (i: number | null): string =>
  i === null ? 'declared(0.35)' : `gene(${i.toFixed(2)})->${(1 + i * 10).toFixed(1)}`;
const perturbed = cells.some((c) => c.digestOff !== c.digestOn);

console.log(`CLUTCH SWEEP — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('Only the founder clutchSize init varies; the trait stays heritable.');
console.log(`nonPerturbing=${!perturbed} (hashState probe-off vs probe-on)\n`);
console.log('init           seed   consBirths consDeaths    B/D   pop  prod%  endClutchTrait  consumers at t=200..2400');
for (const c of cells) {
  const bd = c.deaths > 0 ? (c.births / c.deaths).toFixed(2) : 'n/a';
  console.log(
    `${label(c.init).padEnd(14)} ${String(c.seed).padStart(5)} ${String(c.births).padStart(11)} ${String(c.deaths).padStart(11)} ` +
      `${bd.padStart(6)} ${String(c.pop).padStart(6)} ${c.prodShare.toFixed(1).padStart(6)} ` +
      `${c.meanClutchTrait.toFixed(3).padStart(15)}   ` + c.consumersAt.map((n) => String(n).padStart(5)).join(''),
  );
}

console.log('\nSUMMARY BY CLUTCH INIT');
console.log('init           meanB/D  seedsB>D  seedsAliveAtEnd  meanEndClutch  meanBirths  vsDeclared');
const base = cells.filter((c) => c.init === null);
const baseBirths = base.reduce((a, c) => a + c.births, 0) / base.length;
for (const init of LEVELS) {
  const g = cells.filter((c) => c.init === init);
  const bd = g.map((c) => (c.deaths > 0 ? c.births / c.deaths : 0));
  const meanBd = bd.reduce((a, b) => a + b, 0) / bd.length;
  const meanBirths = g.reduce((a, c) => a + c.births, 0) / g.length;
  const meanClutch = g.reduce((a, c) => a + c.meanClutchTrait, 0) / g.length;
  console.log(
    `${label(init).padEnd(14)} ${meanBd.toFixed(3).padStart(9)} ${String(g.filter((c) => c.births > c.deaths).length).padStart(9)} ` +
      `${String(g.filter((c) => c.consumersAt.at(-1)! > 0).length).padStart(16)} ${meanClutch.toFixed(3).padStart(14)} ` +
      `${meanBirths.toFixed(1).padStart(11)} ${(meanBirths / baseBirths).toFixed(2).padStart(11)}x`,
  );
}

console.log('\nNOTE: endClutchTrait is the mean PHYSICAL trait of consumers alive at end.');
console.log('      Declared founder gene 0.35 expresses to physical 4.5, not 0.35.');

console.log('\nDECISION TABLE');
const best = LEVELS.map((i) => {
  const g = cells.filter((c) => c.init === i);
  const bd = g.map((c) => (c.deaths > 0 ? c.births / c.deaths : 0));
  return { i, bd: bd.reduce((a, b) => a + b, 0) / bd.length, births: g.reduce((a, c) => a + c.births, 0) / g.length, clutch: g.reduce((a, c) => a + c.meanClutchTrait, 0) / g.length };
});
for (const b of best) {
  console.log(`  ${label(b.i).padEnd(14)} B/D ${b.bd.toFixed(3)}  births ${b.births.toFixed(1)}  endClutch ${b.clutch.toFixed(3)}`);
}
const ceilingBinds = best.some((b) => b.bd > 1.0);
const eroded = best.filter((b) => b.i !== null).every((b) => b.clutch < (b.i ?? 0) * 0.5);
console.log(`\nCEILING_BINDS=${ceilingBinds} (some level reaches B/D > 1.0)`);
console.log(`TRAIT_ERODED=${eroded} (every raised level ends below half its start)`);
console.log(`nonPerturbing=${!perturbed}`);
console.log(JSON.stringify({
  bestLevel: best.reduce((a, b) => (b.bd > a.bd ? b : a)).i,
  bestBD: +best.reduce((a, b) => (b.bd > a.bd ? b : a)).bd.toFixed(4),
  ceilingBinds: ceilingBinds ? 1 : 0,
  traitEroded: eroded ? 1 : 0,
  probeNonPerturbing: perturbed ? 0 : 1,
}));