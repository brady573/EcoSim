/**
 * BIRTH-TRANSFER SWEEP — is the gradient the parent's per-child energy charge?
 *
 * THE INFERENCE UNDER TEST
 * The current investigation concluded: "reproduction is a net cost in this
 * world, so evolution dismantles it." That was inferred, not isolated. Two
 * independent experiments are consistent with it:
 *   - seeding `asexualRate` 4x high (0.8) is eroded back to 0.0392 and consumers
 *     still fail, with B/D never crossing 1.0 in 9 runs
 *   - seeding `clutchSize` 6.5x high raises births 63 -> 90 but raises mortality
 *     proportionally, so replacement still fails
 *
 * Both point at cost rather than capacity. This sweep isolates the cost itself.
 *
 * The act cost has ALREADY been isolated and eliminated: reproActCostScale=0
 * (free breeding) left end asexualRate at 0.0051, identical to declared cost
 * 0.0051. So the act cost is not the gradient.
 *
 * This sweep tests the strongest remaining candidate: the PARENTAL RESERVE
 * TRANSFER, `energy[parent] * birthCostFactor(0.42) * 0.5` per child. It was
 * excluded from the act-cost sweep on the reasoning that a child is made of its
 * parent's material rather than taxed for it. That reasoning is questionable -
 * it is a real charge, it is the largest reproduction energy term, and uniquely
 * among the three charges it SCALES WITH CLUTCH SIZE. A 6.5x clutch is a 6.5x
 * bill, which would predict the observed lockstep (births and deaths rising
 * together when clutch was raised).
 *
 * PREDICTIONS
 *   TRANSFER IS THE GRADIENT: making the per-child charge near-zero preserves
 *     end asexualRate well above 0.005 and raises B/D toward or past 1.0.
 *   NOT THE TRANSFER: end asexualRate still collapses to ~0.005 and B/D still
 *     fails. Then the gradient is outside individual energy accounting entirely -
 *     most likely population-level dilution, since maxPopulation 60,000 is never
 *     approached and reproduction may buy no competitive advantage at all.
 *
 * CAVEAT: at scale 0 offspring appear from nothing, violating the closed energy
 * budget this simulation is built on. Scale 0 is a DIRECTIONAL DIAGNOSTIC of
 * the gradient, not a candidate ecology.
 *
 * Run: tsx src/trace/reprocost.ts [ticks]
 */
import { World } from '../world/world.js';
import { TRAIT } from '../bio/genome.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { ReproProbeLog } from './reproprobe.js';

const TICKS = Number(process.argv[2] ?? 2400);
const SEEDS = [24601, 777, 1234];
// null = declared behaviour (scale 1). Then progressively cheaper per-child charge.
const LEVELS: Array<number | null> = [null, 0.5, 0.0];

interface Cell {
  seed: number;
  scale: number | null;
  births: number;
  deaths: number;
  pop: number;
  prodShare: number;
  consumersAt: number[];
  endAsexual: number;
  probe: ReproProbeLog;
  digestOff: string;
  digestOn: string;
}

const cells: Cell[] = [];
for (const scale of LEVELS) {
  for (const seed of SEEDS) {
    const cfg = { founders: 400, worldW: 2400, worldH: 2400, seed, birthTransferScale: scale };
    const probe = new ReproProbeLog(TROPHIC_COUNT);
    const wOff = new World({ config: cfg });
    for (let t = 0; t < TICKS; t++) wOff.step();
    const w = new World({ config: cfg, reproProbe: probe });
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
    let aSum = 0, aN = 0;
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      const g = w.roleOf(sl).trophic;
      if (g >= 0 && g < TROPHIC_COUNT) en[g] += s.energy[sl];
      if (g === TROPHIC.CONSUMER) { aSum += s.trait(sl, TRAIT.ASEXUAL_RATE); aN++; }
    }
    const te = en.reduce((a, b) => a + b, 0) || 1;
    const c = probe.read(TROPHIC.CONSUMER);
    cells.push({
      seed, scale,
      births: d.births[1][0] + d.births[1][1],
      deaths: d.deaths[1][0] + d.deaths[1][1] + d.deaths[1][2],
      pop: s.population,
      prodShare: (en[0] / te) * 100,
      consumersAt: at,
      endAsexual: aN ? aSum / aN : (c?.asexualMean ?? 0),
      probe,
      digestOff: wOff.hashState(),
      digestOn: w.hashState(),
    });
  }
}

const label = (s: number | null): string => (s === null ? 'declared(1.0)' : `xfer(${s.toFixed(1)})`);
const perturbed = cells.some((c) => c.digestOff !== c.digestOn);

console.log(`BIRTH-TRANSFER SWEEP — ${TICKS} ticks, seeds ${SEEDS.join('/')}`);
console.log('Scales ONLY the per-child parental transfer (birthCostFactor 0.42 * 0.5).');
console.log('The act cost spend(1.1 + size*0.35) and cooldown (8-34 ticks) are untouched.');
console.log('At scale 0 offspring appear from nothing - a directional diagnostic only.');
console.log(`nonPerturbing=${!perturbed} (hashState probe-off vs probe-on)\n`);
console.log('scale          seed   consBirths consDeaths    B/D   pop  prod%  endAsexual  consumers at t=200..2400');
for (const c of cells) {
  const bd = c.deaths > 0 ? (c.births / c.deaths).toFixed(2) : 'n/a';
  console.log(
    `${label(c.scale).padEnd(14)} ${String(c.seed).padStart(5)} ${String(c.births).padStart(11)} ${String(c.deaths).padStart(11)} ` +
      `${bd.padStart(6)} ${String(c.pop).padStart(6)} ${c.prodShare.toFixed(1).padStart(6)} ${c.endAsexual.toFixed(4).padStart(10)}   ` +
      c.consumersAt.map((n) => String(n).padStart(5)).join(''),
  );
}

console.log('\nSUMMARY BY ACT-COST SCALE');
console.log('scale          meanB/D  seedsB>D  seedsAliveAtEnd  meanEndAsexual  meanBirths  meanDeaths');
const rows = LEVELS.map((sc) => {
  const g = cells.filter((c) => c.scale === sc);
  const bd = g.map((c) => (c.deaths > 0 ? c.births / c.deaths : 0));
  return {
    sc,
    bd: bd.reduce((a, b) => a + b, 0) / bd.length,
    above: g.filter((c) => c.births > c.deaths).length,
    alive: g.filter((c) => c.consumersAt.at(-1)! > 0).length,
    asex: g.reduce((a, c) => a + c.endAsexual, 0) / g.length,
    births: g.reduce((a, c) => a + c.births, 0) / g.length,
    deaths: g.reduce((a, c) => a + c.deaths, 0) / g.length,
  };
});
for (const r of rows) {
  console.log(
    `${label(r.sc).padEnd(14)} ${r.bd.toFixed(3).padStart(9)} ${String(r.above).padStart(9)} ${String(r.alive).padStart(16)} ` +
      `${r.asex.toFixed(4).padStart(14)} ${r.births.toFixed(1).padStart(11)} ${r.deaths.toFixed(1).padStart(11)}`,
  );
}

console.log('\nDECISION');
const free = rows.find((r) => r.sc === 0.0);
const base = rows.find((r) => r.sc === null)!;
const crossed = rows.some((r) => r.bd > 1.0);
const traitHeld = (free?.asex ?? 0) > (base.asex ?? 0) * 3;
console.log(`  declared      B/D ${base.bd.toFixed(3)}  endAsexual ${base.asex.toFixed(4)}  births ${base.births.toFixed(1)}  deaths ${base.deaths.toFixed(1)}`);
console.log(`  free breeding B/D ${(free?.bd ?? 0).toFixed(3)}  endAsexual ${(free?.asex ?? 0).toFixed(4)}  births ${(free?.births ?? 0).toFixed(1)}  deaths ${(free?.deaths ?? 0).toFixed(1)}`);
console.log(`\nCOST_DRIVEN=${crossed && traitHeld ? 1 : 0} (B/D crosses 1.0 AND asexualRate persists when free)`);
console.log(`  B/D crosses 1.0 anywhere : ${crossed}`);
console.log(`  trait held when free    : ${traitHeld} (free endAsexual ${(free?.asex ?? 0).toFixed(4)} vs declared ${base.asex.toFixed(4)})`);
if (crossed) console.log('  -> reproduction is eroded because of its energy cost; making it free restores the guild.');
else console.log('  -> the gradient runs DEEPER than the energy cost. The current conclusion is WRONG.');
console.log(`\nnonPerturbing=${!perturbed}`);
console.log(JSON.stringify({
  declaredBD: +base.bd.toFixed(4),
  freeBD: +(free?.bd ?? 0).toFixed(4),
  declaredEndAsexual: +base.asex.toFixed(5),
  freeEndAsexual: +(free?.asex ?? 0).toFixed(5),
  costDriven: crossed && traitHeld ? 1 : 0,
  probeNonPerturbing: perturbed ? 0 : 1,
}));