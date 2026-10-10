/**
 * Reproduction of user-observed seed 5738877 to t12000.
 * User screenshot at t11990: P1214/C15854/D15557. Decomposers dominated early,
 * consumers surged later. Tracking guilds, mineralizers, and transitions.
 * Run: tsx src/trace/repro5738877.ts
 */
import { World } from '../world/world.js';
import { TROPHIC_COUNT } from '../bio/role.js';

const w = new World({ config: {
  founders: 400, worldW: 2400, worldH: 2400, seed: 5738877,
  consumerPhotoScale: 4, decomposerFounders: 0.25,
  decomposerDormancy: 0.05, sporeDispersal: 1,
}});
const s = w.store;
for (let t = 1; t <= 12000; t++) {
  w.step();
  if (t % 1000 === 0 || t === 2400) {
    const n = [0, 0, 0];
    let miners = 0;
    for (let sl = 0; sl < s.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      const g = w.roleOf(sl).trophic;
      if (g >= 0 && g < TROPHIC_COUNT) n[g]++;
      if (w.bioticMineraliser[sl] === 1) miners++;
    }
    const tm = w.transitionMatrix();
    console.log(
      `t${t}: P${n[0]}/C${n[1]}/D${n[2]} pop=${s.population} miners=${miners} ` +
      `C->P=${Math.round(tm[1][0])} P->C=${Math.round(tm[0][1])}`,
    );
  }
}
const d = w.demographics();
const bd = (g: number): string => {
  const b = d.births[g].reduce((a: number, x: number) => a + x, 0);
  const dd = d.deaths[g].reduce((a: number, x: number) => a + x, 0);
  return `${b}/${dd}=${dd > 0 ? (b / dd).toFixed(2) : 'n/a'}`;
};
console.log(`B/D prod=${bd(0)} cons=${bd(1)} decomp=${bd(2)}`);
console.log(JSON.stringify({ seed: 5738877, ticks: 12000 }));
