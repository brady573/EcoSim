/**
 * PIXEL RENDERER — see the simulation. Guild-colored pixels on black.
 *
 * Minimal by design: no dependencies (PNG via src/trace/png.ts + node:zlib),
 * no engine changes except the read-only isDormant() bit, no browser needed.
 * Output is standard PNG, viewable in any phone gallery.
 *
 * LAYOUT: 2400x2400 world -> 600x600 image (4x4 world units per pixel).
 * COLORS (dominant guild per pixel wins; brightness scales 1..5+ organisms):
 *   producer  green  (0,200,0)
 *   consumer  orange (255,140,0)
 *   decomposer purple (180,80,255), dormant dim slate (90,90,140)
 *
 * MODES:
 *   snapshot <seed> <tick>              one PNG: evidence/snaps/<seed>-t<tick>.png
 *   frames <seed> <ticks> <every>       series: evidence/frames/<seed>-t<t>.png
 *
 * Configuration is the combined winner (photox4 + seeding + dormancy + spores),
 * documented here so renders match the measured dynamics. Pass --baseline for
 * declared behavior instead.
 *
 * Run: tsx src/trace/render.ts snapshot 517 2400
 *      tsx src/trace/render.ts frames 517 2400 400
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { World } from '../world/world.js';

import { encodePNG } from './png.js';
import { renderWorld, PIXEL_SIZE } from './pixels.js';

function makeWorld(seed: number, baseline: boolean): World {
  return new World({
    config: baseline
      ? { founders: 400, worldW: 2400, worldH: 2400, seed }
      : {
          founders: 400, worldW: 2400, worldH: 2400, seed,
          consumerPhotoScale: 4, decomposerFounders: 0.25,
          decomposerDormancy: 0.05, sporeDispersal: 1,
        },
  });
}

const mode = process.argv[2];
const seed = Number(process.argv[3] ?? 517);
const baseline = process.argv.includes('--baseline');

if (mode === 'snapshot') {
  const tick = Number(process.argv[4] ?? 2400);
  const w = makeWorld(seed, baseline);
  for (let t = 1; t <= tick; t++) w.step();
  mkdirSync('evidence/snaps', { recursive: true });
  const path = `evidence/snaps/${seed}-t${tick}${baseline ? '-base' : ''}.png`;
  writeFileSync(path, encodePNG(PIXEL_SIZE, PIXEL_SIZE, renderWorld(w)));
  const s = w.store;
  let n = [0, 0, 0];
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const g = w.roleOf(sl).trophic;
    if (g >= 0 && g < 3) n[g]++;
  }
  console.log(`snapshot ${path} at tick ${tick}: P${n[0]}/C${n[1]}/D${n[2]} pop=${s.population}`);
} else if (mode === 'frames') {
  const ticks = Number(process.argv[4] ?? 2400);
  const every = Number(process.argv[5] ?? 400);
  mkdirSync('evidence/frames', { recursive: true });
  const w = makeWorld(seed, baseline);
  let made = 0;
  for (let t = 1; t <= ticks; t++) {
    w.step();
    if (t % every !== 0) continue;
    const path = `evidence/frames/${seed}-t${t}${baseline ? '-base' : ''}.png`;
    writeFileSync(path, encodePNG(PIXEL_SIZE, PIXEL_SIZE, renderWorld(w)));
    made++;
  }
  console.log(`frames: ${made} PNGs in evidence/frames/${seed}-t*${baseline ? '-base' : ''}.png (every ${every} to ${ticks})`);
} else {
  console.log('usage: render.ts snapshot <seed> <tick> [--baseline]');
  console.log('       render.ts frames <seed> <ticks> <every> [--baseline]');
}
