/**
 * Minimal PixiJS viewer for the experimental evolution POC.
 *
 * Scope is deliberately minimal: view the world, inspect an organism, control
 * simulation speed. No product UI. It exists to make emergence inspectable
 * and to measure RENDERING throughput separately from SIMULATION throughput,
 * which is a distinction the performance protocol explicitly requires.
 *
 * CRITICAL separation, enforced here: the viewer NEVER writes simulation
 * state. It reads the world's typed arrays, derives display values, and draws.
 * Nothing in this file can change biology, and no presentation concern (frame
 * rate, zoom, population size, renderer limits) is allowed to affect the
 * simulation. Speeds are applied by choosing HOW MANY TICKS to run per frame;
 * the simulation itself is unchanged by how fast it is displayed.
 *
 * Rendering strategy, and why:
 *  - Instanced single-quad particles are far too coarse for morphology.
 *  - Rebuilding one Graphics per organism per frame is O(n) draw calls and
 *    collapses above a few thousand organisms.
 *  - So there are two modes: a batched "dots" path that draws every organism
 *    as a circle into ONE Graphics (fast, scales to 10k+), and a "morphology"
 *    path that draws the actual procedural body plan for a bounded number of
 *    organisms near the camera. Rendering cost is therefore measured, not
 *    guessed at.
 */

import { Application, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { World } from '../world/world.js';
import { WORLD_ENGINE_VERSION } from '../world/version.js';
import { TROPHIC, TROPHIC_NAME, MOTILITY_NAME, LIFE_STAGE_NAME } from '../bio/role.js';
import { resolveCapacity } from '../bio/phenotype.js';
import { TRAITS, TRAIT, TRAIT_COUNT } from '../bio/genome.js';

/** Ticks to advance per animation frame, per speed setting. */
const SPEEDS = [
  { label: '1x', ticks: 1 },
  { label: '4x', ticks: 4 },
  { label: '16x', ticks: 16 },
  { label: 'Max', ticks: 512 },
] as const;

const ROLE_COLOR: Record<number, number> = {
  [TROPHIC.PRODUCER]: 0x6ee7a8,
  [TROPHIC.CONSUMER]: 0xff7b7b,
  [TROPHIC.DECOMPOSER]: 0xc98bff,
};

const app = new Application();
await app.init({
  background: 0x0b0f14,
  resizeTo: window,
  antialias: false,
  // Explicitly cap resolution: rendering must not be allowed to imply a
  // simulation budget, and we want honest frame timings on a phone.
  resolution: Math.min(2, window.devicePixelRatio || 1),
  autoDensity: true,
  preference: 'webgl',
});
document.getElementById('stage')!.appendChild(app.canvas);

// --- Scene graph -----------------------------------------------------------
const worldLayer = new Container();
const overlayLayer = new Container();
const morphLayer = new Container();
const uiLayer = new Container();
app.stage.addChild(overlayLayer, worldLayer, morphLayer, uiLayer);

const substrateG = new Graphics();
const distG = new Graphics();
overlayLayer.addChild(substrateG);
overlayLayer.addChild(distG);

/**
 * Organism rendering uses a SPRITE POOL, not a rebuilt Graphics.
 *
 * The first version cleared one Graphics and re-issued a circle() per organism
 * every frame. That is the documented PixiJS v8 anti-pattern: rebuilding forces
 * geometry re-triangulation on the CPU, so per-frame cost grows with organism
 * count on the CPU side even before the GPU sees anything.
 *
 * Instead: two textures are generated ONCE (a filled disc and a ring, so
 * senescent organisms can be drawn hollow), and organisms are Sprites drawn from
 * a pool. Per frame we only write position, scale, tint and visibility. Sprites
 * sharing a texture batch, and because there are two textures and a handful of
 * tints, the draw-call count stays small and flat.
 */
const TEX_SIZE = 32;
function makeDiscTexture(): Texture {
  const g = new Graphics();
  g.circle(TEX_SIZE / 2, TEX_SIZE / 2, TEX_SIZE / 2 - 1).fill(0xffffff);
  return app.renderer.generateTexture(g);
}
function makeRingTexture(): Texture {
  const g = new Graphics();
  g.circle(TEX_SIZE / 2, TEX_SIZE / 2, TEX_SIZE / 2 - 2).stroke({ width: 4, color: 0xffffff });
  return app.renderer.generateTexture(g);
}
const discTexture = makeDiscTexture();
const ringTexture = makeRingTexture();

/** Pool of reusable sprites, grown on demand and never shrunk. */
const spritePool: Sprite[] = [];
function acquireSprite(): Sprite {
  const existing = spritePool[spritePool.length];
  if (existing) {
    existing.visible = true;
    return existing;
  }
  const sp = new Sprite(discTexture);
  spritePool.push(sp);
  worldLayer.addChild(sp);
  return sp;
}

const morphGraphics = new Graphics();
// Morphology is drawn above the dots so a close-inspected body plan is not
// hidden by the batched representation underneath it.
morphLayer.addChild(morphGraphics);
uiLayer.addChild(new Text({ text: '', style: { fill: 0xd7e0ea, fontSize: 11 } }));

// --- State ----------------------------------------------------------------
let world: World;
let speedIndex = 0;
let paused = false;
let showMorphology = false;
let showSubstrate = false;
let showDisturbances = true;
let selected = -1;
let selectedId = -1;

/** Camera, in world units. */
const cam = { x: 0, y: 0, zoom: 1 };

function makeWorld(founders: number, seed: number): void {
  const size = 4000;
  world = new World({
    config: {
      founders,
      seed,
      worldW: size,
      worldH: size,
      label: 'viewer',
      // Field and spatial cells scale with the population so the substrate
      // grid does not itself become the bottleneck at high counts.
      fieldCell: 40,
      spatialCell: 44,
    },
  });
  cam.x = size / 2;
  cam.y = size / 2;
  cam.zoom = 1;
  selected = -1;
}

// --- Rendering ------------------------------------------------------------

function worldToScreen(wx: number, wy: number): { x: number; y: number } {
  return {
    x: (wx - cam.x) * cam.zoom + app.screen.width / 2,
    y: (wy - cam.y) * cam.zoom + app.screen.height / 2,
  };
}

function drawSubstrate(): void {
  substrateG.clear();
  if (!showSubstrate) return;
  const cfg = world.config;
  const cellW = cfg.worldW / world.nutrients[0].cols;
  const cellH = cfg.worldH / world.nutrients[0].rows;
  // Substrate is drawn as coarse translucent quads. This is a visualisation
  // of simulation state only; it cannot write to it.
  const nCols = world.nutrients[0].cols;
  const nRows = world.nutrients[0].rows;
  for (let cy = 0; cy < nRows; cy++) {
    for (let cx = 0; cx < nCols; cx++) {
      const i = cy * nCols + cx;
      const fert = world.habitat.fertility.data[i];
      if (fert < 1.15) {
        // Contrasting habitats: tint poor-fertility ground so heterogeneity is
        // visible rather than inferred from the numbers.
        const a = Math.min(0.3, Math.max(0, (1.15 - fert) * 0.5));
        const p = worldToScreen(cx * cellW, cy * cellH);
        const w = cellW * cam.zoom + 1;
        const h = cellH * cam.zoom + 1;
        substrateG.rect(p.x, p.y, w, h);
        substrateG.fill({ color: 0xffb86b, alpha: a });
      }
    }
  }
}

function drawDisturbances(): void {
  distG.clear();
  if (!showDisturbances) return;
  const t = world.tick;
  for (const ev of world.abiotic.activeEvents()) {
    const age = (t - ev.tick) / Math.max(1, ev.remaining);
    if (age > 1 || age < 0) continue;
    const p = worldToScreen(ev.x, ev.y);
    const r = ev.radius * cam.zoom * (0.85 + 0.15 * ev.magnitude);
    const alpha = 0.05 + 0.16 * ev.magnitude * (1 - age);
    distG.circle(p.x, p.y, Math.max(2, r));
    distG.stroke({ color: 0xffffff, alpha, width: 2 });
  }
}

function drawOrganisms(): void {
  const store = world.store;
  const view = app.screen;
  const zoom = cam.zoom;

  // Cull to the viewport so per-frame cost tracks what is VISIBLE, not total
  // population. Pool entries beyond what we draw are simply hidden.
  const halfW = view.width / (2 * zoom);
  const halfH = view.height / (2 * zoom);
  const minX = cam.x - halfW;
  const maxX = cam.x + halfW;
  const minY = cam.y - halfH;
  const maxY = cam.y + halfH;

  let drawn = 0;
  let poolUsed = 0;
  for (let slot = 0; slot < store.count; slot++) {
    if (!world.aliveAt(slot)) continue;
    const x = store.x[slot];
    const y = store.y[slot];
    if (x < minX || x > maxX || y < minY || y > maxY) continue;
    const r = world.roleOf(slot);
    const rad = Math.max(0.8, world.effectiveRadius(slot) * zoom);
    // Texture covers a diameter of TEX_SIZE world-scaled pixels, so scale maps
    // the requested radius onto the texture's inscribed radius.
    const scale = (rad * 2) / (TEX_SIZE - 2);
    const sp = acquireSprite();
    poolUsed++;
    sp.texture = r.stage === 2 ? ringTexture : discTexture;
    sp.x = (x - cam.x) * zoom + view.width / 2;
    sp.y = (y - cam.y) * zoom + view.height / 2;
    sp.scale.set(scale);
    sp.tint = ROLE_COLOR[r.trophic] ?? 0xffffff;
    // Juveniles are dimmer so developmental growth is visible at a glance.
    sp.alpha = r.stage === 0 ? 0.55 : 0.95;
    drawn++;
  }
  for (let i = poolUsed; i < spritePool.length; i++) spritePool[i].visible = false;
}

function drawMorphology(): void {
  morphGraphics.clear();
  if (!showMorphology) return;
  // Bounded: only organisms near the camera, capped, so morphology mode is
  // explicitly a close-inspection tool rather than an unbounded cost.
  const CAP = 220;
  const store = world.store;
  const zoom = cam.zoom;
  const halfW = app.screen.width / (2 * zoom);
  const halfH = app.screen.height / (2 * zoom);
  let drawn = 0;

  for (let slot = 0; slot < store.count && drawn < CAP; slot++) {
    if (!world.aliveAt(slot)) continue;
    const x = store.x[slot];
    const y = store.y[slot];
    if (Math.abs(x - cam.x) > halfW * 0.5 || Math.abs(y - cam.y) > halfH * 0.5) continue;
    const phen = store.phen[slot] as MorphShape | null;
    if (!phen || !phen.body) continue;
    const r = world.roleOf(slot);
    const col = ROLE_COLOR[r.trophic] ?? 0xffffff;
    const h = store.heading[slot];
    const scale = Math.max(0.6, zoom) * 1.6;
    const cos = Math.cos(h) * scale;
    const sin = Math.sin(h) * scale;

    // Spine: the procedural body plan, drawn along the organism's heading.
    for (const seg of phen.spine ?? []) {
      const lx = seg.u * 6;
      const ly = seg.v * 6;
      const sx = (x + lx * cos - ly * sin - cam.x) * zoom + app.screen.width / 2;
      const sy = (y + lx * sin + ly * cos - cam.y) * zoom + app.screen.height / 2;
      morphGraphics.circle(sx, sy, Math.max(1.2, seg.radius * scale));
      morphGraphics.fill({ color: col, alpha: 0.55 });
    }
    for (const part of phen.parts ?? []) {
      const seg = phen.spine?.[Math.min(part.segment, (phen.spine?.length ?? 1) - 1)];
      if (!seg) continue;
      const bx = seg.u * 6;
      const by = seg.v * 6;
      const len = part.length * scale;
      const ax = part.angle + h;
      const sx0 = (x + bx * cos - by * sin - cam.x) * zoom + app.screen.width / 2;
      const sy0 = (y + bx * sin + by * cos - cam.y) * zoom + app.screen.height / 2;
      const sx1 = sx0 + Math.cos(ax) * len;
      const sy1 = sy0 + Math.sin(ax) * len;
      morphGraphics.moveTo(sx0, sy0);
      morphGraphics.lineTo(sx1, sy1);
      morphGraphics.stroke({ color: col, alpha: 0.4, width: Math.max(1, part.thickness * scale) });
    }
    drawn++;
  }
}

interface MorphShape {
  body?: { segments: number; modules: number };
  spine?: Array<{ u: number; v: number; radius: number; angle: number }>;
  parts?: Array<{ kind: number; segment: number; angle: number; length: number; thickness: number }>;
}

// --- Interaction -----------------------------------------------------------
let dragging = false;
let dragMoved = 0;
let lastPointer = { x: 0, y: 0 };

app.canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragMoved = 0;
  lastPointer = { x: e.clientX, y: e.clientY };
  app.canvas.setPointerCapture(e.pointerId);
});
app.canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastPointer.x;
  const dy = e.clientY - lastPointer.y;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  cam.x -= dx / cam.zoom;
  cam.y -= dy / cam.zoom;
  lastPointer = { x: e.clientX, y: e.clientY };
});
app.canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  try {
    app.canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* pointer already released */
  }
  if (dragMoved < 6) selectAt(e);
});
app.canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const before = worldToScreenFromClient(e.clientX, e.clientY);
  const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
  cam.zoom = Math.max(0.12, Math.min(14, cam.zoom * factor));
  const after = worldToScreenFromClient(e.clientX, e.clientY);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
}, { passive: false });

function worldToScreenFromClient(cx: number, cy: number): { x: number; y: number } {
  const rect = app.canvas.getBoundingClientRect();
  return {
    x: (cx - rect.left - app.screen.width / 2) / cam.zoom + cam.x,
    y: (cy - rect.top - app.screen.height / 2) / cam.zoom + cam.y,
  };
}

/** Pick the nearest living organism to a screen position, within a tolerance. */
function selectAt(e: PointerEvent): void {
  const p = worldToScreenFromClient(e.clientX, e.clientY);
  const store = world.store;
  let best = -1;
  let bestD = (14 / cam.zoom) ** 2;
  for (let slot = 0; slot < store.count; slot++) {
    if (!world.aliveAt(slot)) continue;
    const dx = store.x[slot] - p.x;
    const dy = store.y[slot] - p.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = slot;
    }
  }
  selected = best;
  selectedId = best >= 0 ? world.store.id[best] : -1;
  renderInspector();
}

// --- Inspector ------------------------------------------------------------
function renderInspector(): void {
  const el = document.getElementById('inspect')!;
  if (selected < 0 || !world.aliveAt(selected) || world.store.id[selected] !== selectedId) {
    el.style.display = 'none';
    return;
  }
  const store = world.store;
  const slot = selected;
  const r = world.roleOf(slot);
  const phen = store.phen[slot] as MorphShape | null;
  const p = store.physical;
  const base = slot * TRAIT_COUNT;

  // Show the most expressed traits rather than the whole block: an inspector is for
  // understanding one organism, not for dumping a genome.
  const order = Array.from({ length: TRAIT_COUNT }, (_, i) => i).sort(
    (a, b) => p[base + b] - p[base + a],
  );
  const traitRows = order
    .slice(0, 10)
    .map((i) => {
      const spec = TRAITS[i];
      const v = p[base + i];
      const barW = Math.round(v * 40);
      return (
        `<tr><td class="k">${spec.name}</td><td>${v.toFixed(2)}` +
        `<span class="tiny"> ${spec.lo.toFixed(2)}–${spec.hi.toFixed(2)}</span></td>` +
        `<td><span class="tiny">${'▮'.repeat(Math.max(1, Math.min(40, barW)))}</span></td></tr>`
      );
    })
    .join('');

  el.style.display = 'block';
  el.innerHTML =
    `<h1>Organism #${store.id[slot]} ${store.id[slot] === selectedId ? '' : ''}</h1>` +
    `<table>` +
    `<tr><td class="k">role</td><td>${TROPHIC_NAME[r.trophic]}</td></tr>` +
    `<tr><td class="k">motility</td><td>${MOTILITY_NAME[r.motility]}</td></tr>` +
    `<tr><td class="k">life stage</td><td>${LIFE_STAGE_NAME[r.stage]} (maturation ${r.maturation.toFixed(2)})</td></tr>` +
    `<tr><td class="k">age / lifespan</td><td>${store.age[slot]} / ${store.trait(slot, TRAIT.LIFESPAN).toFixed(0)} ticks</td></tr>` +
    `<tr><td class="k">energy</td><td>${store.energy[slot].toFixed(1)} / ${resolveCapacity(store.phen[slot], store.trait(slot, TRAIT.STORAGE_CAPACITY)).toFixed(0)}</td></tr>` +
    `<tr><td class="k">damage</td><td>${store.damage[slot].toFixed(1)} / 100</td></tr>` +
    `<tr><td class="k">body</td><td>${phen?.body?.segments ?? '?'} segments, modules ${(phen?.body?.modules ?? 0).toString(2)}</td></tr>` +
    `<tr><td class="k">radius / reach</td><td>${world.effectiveRadius(slot).toFixed(2)} / ${r.reach.toFixed(2)}</td></tr>` +
    `<tr><td class="k">lineage</td><td>${world.lineageKeyOf(store.lineage[slot])} (gen ${store.generationDepth[slot]})</td></tr>` +
    `<tr><td class="k">parent</td><td>${store.parentId[slot] >= 0 ? '#' + store.parentId[slot] : 'founder'}</td></tr>` +
    `<tr><td class="k">born</td><td>tick ${store.bornTick[slot]}</td></tr>` +
    `<tr><td class="k">ingested / spent</td><td>${store.energyIngested[slot].toFixed(0)} / ${store.energySpent[slot].toFixed(0)}</td></tr>` +
    `<tr><td class="k">mineraliser</td><td>${r.bioticMineraliser ? 'yes' : 'no'}</td></tr>` +
    `</table><h1 style="margin-top:6px">Most expressed traits</h1><table>${traitRows}</table>` +
    `<div class="tiny" style="margin-top:6px">Role and stage are readouts derived from the genome, not assigned.</div>`;
}

// --- Stats panel -----------------------------------------------------------
const ROLE_ORDER = [TROPHIC.PRODUCER, TROPHIC.CONSUMER, TROPHIC.DECOMPOSER];

function drawStats(fps: number, frameMs: number, simMs: number, drawMs: number): void {
  const store = world.store;
  const counts: Record<number, number> = {};
  for (let slot = 0; slot < store.count; slot++) {
    if (!world.aliveAt(slot)) continue;
    const t = world.roleOf(slot).trophic;
    counts[t] = (counts[t] ?? 0) + 1;
  }
  const pop = store.population;
  const rows =
    `<tr><td class="k">engine</td><td>${WORLD_ENGINE_VERSION}</td></tr>` +
    `<tr><td class="k">tick</td><td>${world.tick}</td></tr>` +
    `<tr><td class="k">population</td><td>${pop}</td></tr>` +
    `<tr><td class="k">births / deaths</td><td>${world.totalBirths} / ${world.totalDeaths}</td></tr>` +
    `<tr><td class="k">contests</td><td>${world.interactions.totalResolved}</td></tr>` +
    `<tr><td class="k">mean energy</td><td>${pop > 0 ? (world.snapshot.biomass / pop).toFixed(1) : '0'}</td></tr>` +
    `<tr><td class="k">disturbances</td><td>${world.abiotic.activeCount} active / ${world.disturbancesFired}</td></tr>` +
    `<tr><td class="k">residual</td><td>${(world.accountingResidualFraction() * 100).toFixed(4)}%</td></tr>` +
    `<tr><td class="k">zoom</td><td>${cam.zoom.toFixed(2)}&times;</td></tr>`;
  document.getElementById('stats-table')!.innerHTML = rows;
  // FPS and SIMULATION cost are reported separately on purpose: a frame can
  // be render-bound or simulation-bound, and conflating them hides which.
  document.getElementById('fps-line')!.innerHTML =
    `render ${fps.toFixed(0)} fps &middot; frame ${frameMs.toFixed(1)}ms (draw ${drawMs.toFixed(1)}ms)` +
    `<br>sim ${simMs.toFixed(2)}ms/tick &middot; ${((simMs || 0.001)).toFixed(2)}ms budgeted`;

  document.getElementById('legend-rows')!.innerHTML = ROLE_ORDER.map((t) => {
    const n = counts[t] ?? 0;
    return (
      `<div><span class="swatch" style="background:#${ROLE_COLOR[t].toString(16).padStart(6, '0')}"></span>` +
      `${TROPHIC_NAME[t]} <span class="tiny">${n}</span></div>`
    );
  }).join('') + `<div class="tiny" style="margin-top:4px">hollow = senescent, dim = juvenile</div>`;
}

// --- Controls --------------------------------------------------------------
const popInput = document.getElementById('pop') as HTMLInputElement;
const popVal = document.getElementById('pop-val') as HTMLElement;
const seedInput = document.getElementById('seed') as HTMLInputElement;
popInput.addEventListener('input', () => { popVal.textContent = popInput.value; });

const SPEED_BUTTON_IDS = ['btn-1x', 'btn-4x', 'btn-16x', 'btn-max'];

function setSpeed(i: number): void {
  speedIndex = i;
  paused = false;
  (document.getElementById('btn-pause') as HTMLButtonElement).textContent = 'Pause';
  SPEED_BUTTON_IDS.forEach((id, k) =>
    (document.getElementById(id) as HTMLButtonElement).setAttribute('aria-pressed', String(k === i)),
  );
}
document.getElementById('btn-pause')!.addEventListener('click', () => {
  paused = !paused;
  (document.getElementById('btn-pause') as HTMLButtonElement).textContent = paused ? 'Resume' : 'Pause';
});
document.getElementById('btn-1x')!.addEventListener('click', () => setSpeed(0));
document.getElementById('btn-4x')!.addEventListener('click', () => setSpeed(1));
document.getElementById('btn-16x')!.addEventListener('click', () => setSpeed(2));
document.getElementById('btn-max')!.addEventListener('click', () => setSpeed(3));
document.getElementById('btn-morph')!.addEventListener('click', () => {
  showMorphology = !showMorphology;
  (document.getElementById('btn-morph') as HTMLButtonElement).setAttribute('aria-pressed', String(showMorphology));
});
document.getElementById('btn-overlay')!.addEventListener('click', () => {
  showSubstrate = !showSubstrate;
  (document.getElementById('btn-overlay') as HTMLButtonElement).setAttribute('aria-pressed', String(showSubstrate));
});
document.getElementById('btn-disturb')!.addEventListener('click', () => {
  showDisturbances = !showDisturbances;
  (document.getElementById('btn-disturb') as HTMLButtonElement).setAttribute('aria-pressed', String(showDisturbances));
});
document.getElementById('btn-restart')!.addEventListener('click', () => {
  makeWorld(parseInt(popInput.value, 10), parseInt(seedInput.value, 10) || 1);
  renderInspector();
});

// --- Main loop -------------------------------------------------------------
makeWorld(parseInt(popInput.value, 10), parseInt(seedInput.value, 10) || 1);
setSpeed(0);
(document.getElementById('btn-disturb') as HTMLButtonElement).setAttribute('aria-pressed', 'true');

let fpsAccum = 0;
let fpsFrames = 0;
let fps = 0;
let lastFrame = performance.now();
let inspectorTick = 0;

app.ticker.add(() => {
  // --- Advance the simulation. This is the ONLY place the viewer calls
  // step(); speed changes how many ticks run, never what a tick does.
  const simStart = performance.now();
  if (!paused) {
    const ticks = SPEEDS[speedIndex].ticks;
    // Hard per-frame tick budget so "Max" degrades gracefully on slow devices
    // instead of locking the tab.
    const budgetEnd = simStart + 12;
    let done = 0;
    do {
      world.step();
      done++;
    } while (done < ticks && performance.now() < budgetEnd);
  }
  const simMs = performance.now() - simStart;

  const drawStart = performance.now();
  drawSubstrate();
  drawDisturbances();
  drawOrganisms();
  drawMorphology();
  const drawMs = performance.now() - drawStart;

  const nowMs = performance.now();
  const frameMs = nowMs - lastFrame;
  lastFrame = nowMs;
  fpsAccum += frameMs;
  fpsFrames++;
  if (fpsAccum > 400) {
    fps = (fpsFrames * 1000) / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
  }

  // Inspection is DOM work, so refresh it periodically rather than per frame.
  if (++inspectorTick % 15 === 0 && selected >= 0) renderInspector();
  drawStats(fps, frameMs, simMs, drawMs);
});

console.log(
  `%c DE evolution POC viewer %c ${WORLD_ENGINE_VERSION} — EXPERIMENTAL`,
  'background:#6ee7a8;color:#0b0f14;font-weight:bold',
  'color:#8698ad',
);
console.log('The viewer reads simulation state only; it never writes it.');