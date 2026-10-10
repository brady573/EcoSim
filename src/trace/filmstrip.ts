/**
 * FILMSTRIP — bundle rendered frames into one self-contained HTML player.
 *
 * Takes PNGs from evidence/frames/<seed>-t*.png and emits a single HTML file
 * with base64-embedded frames, play/pause, scrub slider, tick readout, guild
 * counts, and legend. No server, no dependencies, no network: opens from
 * file:// in any phone browser. Portable (send the one file anywhere).
 *
 * Counts per frame are read back from the simulation by re-running to each
 * tick — cheap (frames already exist; the run is the same cost as rendering).
 *
 * Run: tsx src/trace/filmstrip.ts <seed> [ticks] [every] [--baseline]
 *   e.g. tsx src/trace/filmstrip.ts 517 2400 400
 *   -> evidence/films/517.html
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { World } from '../world/world.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';

const seed = Number(process.argv[2] ?? 517);
const ticks = Number(process.argv[3] ?? 2400);
const every = Number(process.argv[4] ?? 400);
const baseline = process.argv.includes('--baseline');
const tag = baseline ? '-base' : '';

// Collect frames: render PNGs in-memory (same code path as render.ts would
// write) and gather P/C/D counts at each frame tick in one run.
const { encodePNG } = await import('./png.js');

const SIZE = 600;
const CELL = 2400 / SIZE;
const COLORS: Array<[number, number, number]> = [[0, 200, 0], [255, 140, 0], [180, 80, 255]];
const DORMANT: [number, number, number] = [90, 90, 140];

function renderWorld(w: World): Uint8Array {
  const counts = new Int32Array(SIZE * SIZE * TROPHIC_COUNT);
  const dormant = new Int32Array(SIZE * SIZE);
  const s = w.store;
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const g = w.roleOf(sl).trophic;
    if (g < 0 || g >= TROPHIC_COUNT) continue;
    const px = Math.min(SIZE - 1, Math.max(0, Math.floor(s.x[sl] / CELL)));
    const py = Math.min(SIZE - 1, Math.max(0, Math.floor(s.y[sl] / CELL)));
    const idx = py * SIZE + px;
    counts[idx * TROPHIC_COUNT + g]++;
    if (g === TROPHIC.DECOMPOSER && w.isDormant(sl)) dormant[idx]++;
  }
  const rgb = new Uint8Array(SIZE * SIZE * 3);
  for (let i = 0; i < SIZE * SIZE; i++) {
    let best = -1, bestN = 0, total = 0;
    for (let g = 0; g < TROPHIC_COUNT; g++) {
      const n = counts[i * TROPHIC_COUNT + g];
      total += n;
      if (n > bestN) { bestN = n; best = g; }
    }
    if (best < 0) continue;
    const bright = Math.min(1, 0.25 + (total / 5) * 0.75);
    let c = COLORS[best];
    if (best === TROPHIC.DECOMPOSER && dormant[i] * 2 >= bestN) c = DORMANT;
    rgb[i * 3] = Math.round(c[0] * bright);
    rgb[i * 3 + 1] = Math.round(c[1] * bright);
    rgb[i * 3 + 2] = Math.round(c[2] * bright);
  }
  return rgb;
}

const w = new World({
  config: baseline
    ? { founders: 400, worldW: 2400, worldH: 2400, seed }
    : {
        founders: 400, worldW: 2400, worldH: 2400, seed,
        consumerPhotoScale: 4, decomposerFounders: 0.25,
        decomposerDormancy: 0.05, sporeDispersal: 1,
      },
});

interface Frame { tick: number; png: string; counts: [number, number, number]; pop: number }
const frames: Frame[] = [];
for (let t = 1; t <= ticks; t++) {
  w.step();
  if (t % every !== 0) continue;
  const s = w.store;
  const n: [number, number, number] = [0, 0, 0];
  for (let sl = 0; sl < s.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const g = w.roleOf(sl).trophic;
    if (g >= 0 && g < 3) n[g]++;
  }
  const png = encodePNG(SIZE, SIZE, renderWorld(w));
  frames.push({ tick: t, png: Buffer.from(png).toString('base64'), counts: n, pop: s.population });
}

const framesJson = JSON.stringify(frames.map((f) => ({ tick: f.tick, png: f.png, counts: f.counts, pop: f.pop })));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>seed ${seed}${tag} — ${ticks} ticks</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #000; color: #ddd; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 8px; }
  h1 { font-size: 15px; font-weight: 600; margin: 4px 0; }
  #stage { position: relative; width: min(96vw, 600px); }
  #frame { width: 100%; display: block; background: #000; }
  #readout { font-size: 13px; margin: 6px 0; font-variant-numeric: tabular-nums; }
  #readout b { color: #fff; }
  .p { color: #4f4; } .c { color: #fa0; } .d { color: #b5f; }
  #controls { display: flex; gap: 8px; align-items: center; width: min(96vw, 600px); margin: 4px 0; }
  button { flex: 0 0 auto; background: #222; color: #eee; border: 1px solid #444; border-radius: 6px; font-size: 16px; padding: 8px 14px; }
  button:active { background: #444; }
  input[type=range] { flex: 1; }
  #legend { font-size: 12px; color: #999; margin-top: 6px; text-align: center; }
</style>
</head>
<body>
<h1>seed ${seed}${tag} · ${ticks} ticks · ${baseline ? 'baseline' : 'photox4 + seeding + dormancy + spores'}</h1>
<div id="stage"><img id="frame" alt="simulation frame"></div>
<div id="readout"></div>
<div id="controls">
  <button id="play">▶</button>
  <button id="step">+1</button>
  <input id="scrub" type="range" min="0" max="${frames.length - 1}" value="0" step="1">
</div>
<div id="legend"><span class="p">■ producers</span> · <span class="c">■ consumers</span> · <span class="d">■ decomposers</span> · <span style="color:#888">■ dormant</span></div>
<script>
const frames = ${framesJson};
const img = document.getElementById('frame');
const readout = document.getElementById('readout');
const scrub = document.getElementById('scrub');
const playBtn = document.getElementById('play');
let idx = 0, timer = null;
function show(i) {
  idx = Math.max(0, Math.min(frames.length - 1, i));
  const f = frames[idx];
  img.src = 'data:image/png;base64,' + f.png;
  readout.innerHTML = 't<b>' + f.tick + '</b> · <span class="p">P' + f.counts[0] + '</span> <span class="c">C' + f.counts[1] + '</span> <span class="d">D' + f.counts[2] + '</span> · pop ' + f.pop + ' · ' + (idx + 1) + '/' + frames.length;
  scrub.value = idx;
}
function play() {
  if (timer) { clearInterval(timer); timer = null; playBtn.textContent = '▶'; return; }
  playBtn.textContent = '⏸';
  timer = setInterval(() => {
    let n = idx + 1;
    if (n >= frames.length) n = 0;
    show(n);
  }, 600);
}
playBtn.onclick = play;
document.getElementById('step').onclick = () => { if (timer) play(); show(idx + 1); };
scrub.oninput = () => { if (timer) play(); show(Number(scrub.value)); };
show(0);
</script>
</body>
</html>`;

mkdirSync('evidence/films', { recursive: true });
const path = `evidence/films/${seed}${tag}.html`;
writeFileSync(path, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`film ${path}: ${frames.length} frames, ${kb} KB, self-contained (open from file://)`);
void existsSync;
void readFileSync;
