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
import {
  MODULE_NAMES, MODULE_STRIDE, MODULE_STRIDE_GATE,
  MODULE_STRIDE_KIND, MODULE_STRIDE_MAG, MODULE_STRIDE_ONSET, MAX_MODULES, ONSET_WINDOW,
} from '../bio/modgenome.js';

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
  // `resizeTo: window` stays. Passing `window.visualViewport` here looks
  // correct and is not: PixiJS's ResizePlugin reads `clientWidth`/`clientHeight`
  // off any target that is not `window`, and VisualViewport has neither (it
  // exposes width/height/offsetLeft/scale). That yields
  // renderer.resize(undefined, undefined), collapsing the canvas to 0x0 —
  // nothing renders and nothing is hittable, which presents as "zoom is
  // broken" because no gesture can reach the canvas at all.
  //
  // The visual viewport is still honoured, by driving renderer.resize()
  // ourselves on visualViewport resize/scroll (see the mobile viewport block).
  // That keeps the correct mobile behaviour without feeding PixiJS an object
  // it cannot measure.
  resizeTo: window,
  antialias: false,
  // Explicitly cap resolution: rendering must not be allowed to imply a
  // simulation budget, and we want honest frame timings on a phone. A 3x DPR
  // phone would otherwise ask for 9x the pixels of a 1x desktop.
  resolution: Math.min(2, window.devicePixelRatio || 1),
  autoDensity: true,
  preference: 'webgl',
});
document.getElementById('stage')!.appendChild(app.canvas);

// A zero-sized canvas is indistinguishable, to the user, from "zoom doesn't
// work" — nothing renders and no gesture can reach a 0x0 element. Fail loudly
// instead, so the next such regression reports itself rather than looking like
// an input bug.
if (app.screen.width < 2 || app.screen.height < 2) {
  const msg =
    'viewer: canvas initialised at ' + app.screen.width + 'x' + app.screen.height +
    ' — gestures cannot reach it. This is a sizing fault, not a touch fault.';
  console.error(msg);
  const warn = document.createElement('pre');
  warn.textContent = msg;
  warn.style.cssText =
    'position:fixed;inset:auto 8px 8px 8px;z-index:99;margin:0;padding:10px;' +
    'background:#2a1414;color:#ffb4b4;border:1px solid #7a3030;border-radius:6px;' +
    'font:12px/1.4 ui-monospace,monospace;white-space:pre-wrap';
  document.body.appendChild(warn);
}

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

// Anchor is a Sprite property in PixiJS v8, not a Texture one — and it must be
// set per sprite because pooled sprites switch textures. Sprites were
// previously positioned with their texture's TOP-LEFT corner on the organism's
// centre, so every dot appeared offset up-and-left by half its diameter and
// tap-picking did not line up with the visible centre. Setting the anchor at
// creation makes sprite position mean centre, matching what picking tests.

/**
 * Pool of reusable sprites, grown on demand and never shrunk.
 *
 * Indexed by the caller's per-frame counter, NOT by the pool's own length.
 * The previous version did `spritePool[spritePool.length]`, which is always
 * `undefined` — an out-of-bounds read that can never hit. It therefore
 * allocated a fresh Sprite on every call, so the pool grew by the number of
 * visible organisms EVERY FRAME, while the hide loop then hid every sprite from
 * `poolUsed` onward. Net effect: the first N sprites kept their frame-1
 * coordinates forever (the visible world appeared frozen) while tens of
 * thousands of invisible sprites piled into worldLayer.children.
 *
 * A pool must be indexed by consumption position. Growth is bounded by the
 * high-water mark of simultaneously VISIBLE organisms, which is what the pool
 * is for.
 */
const spritePool: Sprite[] = [];
function spriteAt(index: number): Sprite {
  const existing = spritePool[index];
  if (existing) {
    existing.visible = true;
    return existing;
  }
  const sp = new Sprite(discTexture);
  sp.anchor.set(0.5);
  spritePool[index] = sp;
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

/**
 * Camera, in world units.
 *
 * Zoom bounds are shared by wheel and pinch so the two gestures cannot drift
 * apart, and so a pinch cannot drive the camera somewhere a wheel could not.
 */
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 14;
/**
 * Movement in CSS pixels still counted as a tap.
 *
 * 6px was a mouse-sized threshold. A fingertip routinely drifts more than that
 * while pressing, which made taps unreliable on touch: the view panned a few
 * pixels and nothing was selected. 12px sits above resting tremor and below a
 * deliberate drag.
 */
const TAP_SLOP = 12;
const cam = { x: 0, y: 0, zoom: 1 };

/**
 * Modular genome v2 toggle state.
 *
 * `null` is NOT the same as `false` here, and the distinction is load-bearing:
 * `null` is the declared baseline and is what the knob means when unset. The
 * engine gates on `config.genomeV2 === true`, so both `null` and `false` take
 * the same code path today — but only `null` is guaranteed to stay the
 * declared behaviour if that ever changes. The viewer passes `null` for "off"
 * so what you see untoggled is the parity baseline, not a third state.
 */
let genomeV2: boolean | null = null;

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
      genomeV2,
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
    const sp = spriteAt(poolUsed);
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
  // Hide only the tail beyond this frame's high-water mark. With the fixed
  // pool this bounds worldLayer.children permanently; the pool grows to the
  // most organisms ever visible at once and then stops.
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
    // ONE scale for screen-space geometry. The previous version folded zoom into
    // this (`Math.max(0.6, zoom) * 1.6`) AND multiplied world->screen by zoom
    // again at each use, so spine offsets and appendage lengths were scaled by
    // zoom twice while their radii were scaled once. Shape therefore skewed as
    // the user zoomed. Rotation direction and radii use `rot`; world->screen
    // conversion applies zoom exactly once, below.
    const rot = 1.6;
    const cos = Math.cos(h) * rot;
    const sin = Math.sin(h) * rot;

    // Spine: the procedural body plan, drawn along the organism's heading.
    for (const seg of phen.spine ?? []) {
      const lx = seg.u * 6 * rot;
      const ly = seg.v * 6 * rot;
      const sx = (x + lx * cos / rot - ly * sin / rot - cam.x) * zoom + app.screen.width / 2;
      const sy = (y + lx * sin / rot + ly * cos / rot - cam.y) * zoom + app.screen.height / 2;
      // Radius is in world units: one zoom factor, matching the position.
      morphGraphics.circle(sx, sy, Math.max(1.2, seg.radius * rot * zoom));
      morphGraphics.fill({ color: col, alpha: 0.55 });
    }
    for (const part of phen.parts ?? []) {
      const seg = phen.spine?.[Math.min(part.segment, (phen.spine?.length ?? 1) - 1)];
      if (!seg) continue;
      const bx = seg.u * 6 * rot;
      const by = seg.v * 6 * rot;
      // Appendage length is a world-unit length, so it is converted to screen
      // by a single zoom, exactly like the spine radius above.
      const len = part.length * rot * zoom;
      const ax = part.angle + h;
      const sx0 = (x + bx * cos / rot - by * sin / rot - cam.x) * zoom + app.screen.width / 2;
      const sy0 = (y + bx * sin / rot + by * cos / rot - cam.y) * zoom + app.screen.height / 2;
      const sx1 = sx0 + Math.cos(ax) * len;
      const sy1 = sy0 + Math.sin(ax) * len;
      morphGraphics.moveTo(sx0, sy0);
      morphGraphics.lineTo(sx1, sy1);
      morphGraphics.stroke({ color: col, alpha: 0.4, width: Math.max(1, part.thickness * rot * zoom) });
    }
    drawn++;
  }
}

interface MorphShape {
  body?: { segments: number; modules: number };
  spine?: Array<{ u: number; v: number; radius: number; angle: number }>;
  parts?: Array<{ kind: number; segment: number; angle: number; length: number; thickness: number }>;
  /**
   * Module tally for the CURRENT derivation, written by Phenotype.
   *
   * `moduleTotal` is the magnitude actually applied and `moduleUpkeep` the cost
   * actually billed. Both are re-derived as the organism ages, so they reflect
   * what the organism is doing right now rather than what its genome could do.
   */
  moduleTotal?: number;
  moduleUpkeep?: number;
}

// --- Interaction -----------------------------------------------------------
//
// Pointer Events rather than mouse/touch events, because they unify mouse,
// touch and pen in one path. That is what makes the SAME code serve a desktop
// mouse and a phone: the only thing that genuinely differs is how many pointers
// are down at once.
//
// Zoom was previously wheel-only. A phone has no wheel, so on mobile the world
// could not be zoomed at all — you could pan across 4000 world units at a fixed
// scale and organisms were sub-pixel. Two-finger pinch is the touch equivalent
// of the wheel and is handled below.
//
// Tracking every active pointer in a Map rather than a single "last pointer"
// is what makes pinch possible: with only the most recent pointer retained, a
// second finger's movement is indistinguishable from a drag and the view
// jitters instead of scaling.
const pointers = new Map<number, { x: number; y: number }>();
let dragMoved = 0;
let pinchMoved = false;

/** Distance between the first two active pointers, or 0 if fewer than two. */
function pinchDistance(): number {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pinchMidpoint(): { x: number; y: number } {
  const [a, b] = [...pointers.values()];
  if (!a || !b) return { x: 0, y: 0 };
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Zoom about a screen anchor so the world point under it stays put. */
function zoomAbout(factor: number, cx: number, cy: number): void {
  const before = worldToScreenFromClient(cx, cy);
  cam.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, cam.zoom * factor));
  const after = worldToScreenFromClient(cx, cy);
  cam.x += before.x - after.x;
  cam.y += before.y - after.y;
}

app.canvas.addEventListener('pointerdown', (e) => {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    dragMoved = 0;
    pinchMoved = false;
  }
  try {
    app.canvas.setPointerCapture(e.pointerId);
  } catch {
    /* capture is best-effort */
  }
});

app.canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);
  if (!prev) return;
  const next = { x: e.clientX, y: e.clientY };

  if (pointers.size >= 2) {
    // Pinch: scale by the ratio of distances, anchored at the midpoint so the
    // world point between the fingers stays under the fingers.
    const beforeDist = pinchDistance();
    const mid = pinchMidpoint();
    pointers.set(e.pointerId, next);
    const afterDist = pinchDistance();
    if (beforeDist > 0 && afterDist > 0) {
      pinchMoved = true;
      zoomAbout(afterDist / beforeDist, mid.x, mid.y);
    }
    return;
  }

  pointers.set(e.pointerId, next);
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  cam.x -= dx / cam.zoom;
  cam.y -= dy / cam.zoom;
});

function endPointer(e: PointerEvent, cancelled: boolean): void {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  try {
    app.canvas.releasePointerCapture(e.pointerId);
  } catch {
    /* pointer already released */
  }
  // A CANCELLED pointer is not a completed gesture — the browser took it away
  // (system gesture, palm rejection, context interruption). Treating it as a
  // tap selected whatever organism happened to be under the departing finger.
  // Cancels clean up state and select nothing.
  if (cancelled) return;
  // Only a genuine tap selects. A pinch, or a drag, must not pick whatever
  // happens to sit under the last finger to lift.
  if (wasSingle && !pinchMoved && dragMoved < TAP_SLOP) selectAt(e);
}

app.canvas.addEventListener('pointerup', (e) => endPointer(e, false));
app.canvas.addEventListener('pointercancel', (e) => endPointer(e, true));
// A pointer can leave the window entirely (task switcher, incoming call) and
// never deliver pointerup. Without this the map leaks entries and every later
// gesture is misread as a multi-touch one.
window.addEventListener('blur', () => pointers.clear());

app.canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
  zoomAbout(factor, e.clientX, e.clientY);
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

  // Module readout: the organism's INHERITED INSTRUCTIONS, with the gate state
  // that decides whether each is currently expressed. Development and energy
  // gates are shown, because an encoded module that is switched off is the most
  // misleading thing this panel could omit — it looks like dead DNA.
  let moduleSection = '';
  if (genomeV2 === true) {
    const n = store.moduleCount[slot];
    if (n === 0) {
      moduleSection =
        `<h1 style="margin-top:6px">Modules</h1>` +
        `<div class="tiny">none &mdash; every module was deleted from this lineage</div>`;
    } else {
      const mbase = slot * MAX_MODULES * MODULE_STRIDE;
      const age = store.age[slot];
      const life = Math.max(1, store.trait(slot, TRAIT.LIFESPAN));
      const ageFrac = Math.max(0, Math.min(1, age / life));
      const cap = resolveCapacity(phen, store.trait(slot, TRAIT.STORAGE_CAPACITY));
      const eFrac = cap > 0 ? Math.max(0, Math.min(1, store.energy[slot] / cap)) : 0;
      const rowsM: string[] = [];
      for (let i = 0; i < n; i++) {
        const off = mbase + i * MODULE_STRIDE;
        const kind = store.geneModules[off + MODULE_STRIDE_KIND];
        const mag = store.geneModules[off + MODULE_STRIDE_MAG];
        const onset = store.geneModules[off + MODULE_STRIDE_ONSET];
        const gate = store.geneModules[off + MODULE_STRIDE_GATE];
        // Mirrors the engine's gating FORMULA, but evaluated at the organism's
        // exact current age and energy — an ESTIMATE, not the engine's cached
        // result. The engine re-expresses only on its 16-tick role-refresh
        // cadence, so between refreshes this can disagree with the phenotype
        // the rest of this panel describes. Labelled "predicted" accordingly,
        // and the authoritative expressed figures come from the cached
        // phenotype rather than from this sum.
        const dev = Math.max(0, Math.min(1, (ageFrac - onset) / ONSET_WINDOW));
        const g = gate < 1 ? (eFrac >= gate ? 1 : 0) : 1;
        const predicted = dev * g;
        const state = predicted <= 0 ? 'dormant' : predicted >= 0.999 ? 'on' : 'partial';
        rowsM.push(
          `<tr><td class="k">${MODULE_NAMES[kind] ?? kind}</td>` +
          `<td>${mag.toFixed(2)} &middot; onset ${onset.toFixed(2)}` +
          `${gate < 1 ? ` &middot; needs ${(gate * 100).toFixed(0)}% energy` : ''}</td>` +
          `<td class="${predicted <= 0 ? 'tiny' : ''}">${state} ${(predicted * 100).toFixed(0)}%</td></tr>`,
        );
      }
      moduleSection =
        `<h1 style="margin-top:6px">Modules (${n})</h1><table>${rowsM.join('')}</table>` +
        `<div class="tiny" style="margin-top:4px">` +
        `cached: ${(phenOf(slot)?.moduleTotal ?? 0).toFixed(2)} structure expressed, ` +
        `${(phenOf(slot)?.moduleUpkeep ?? 0).toFixed(4)} basal-gene units (NOT energy spent). ` +
        `States above are predicted from age/energy and refresh every 16 ticks, ` +
        `so they can lag the cached phenotype near a threshold.</div>`;
    }
  }

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
    moduleSection +
    `<div class="tiny" style="margin-top:6px">Role and stage are readouts derived from the genome, not assigned.</div>`;
}

// --- Stats panel -----------------------------------------------------------
const ROLE_ORDER = [TROPHIC.PRODUCER, TROPHIC.CONSUMER, TROPHIC.DECOMPOSER];

/**
 * Aggregate module state across living organisms.
 *
 * Reports what is actually EXPRESSED, not what is merely encoded. A module can
 * be present in the genome and currently switched off — development gates it
 * until its onset, and the condition gate sheds it when energy cannot sustain
 * it. Showing only genome length would therefore overstate what the organisms
 * are doing right now.
 */
/** Cached phenotype for a slot, typed with the module tally fields. */
function phenOf(slot: number): MorphShape | null {
  return world.store.phen[slot] as MorphShape | null;
}

function moduleStats(): { rows: string; kinds: Record<number, number> } {
  const store = world.store;
  const kinds: Record<number, number> = {};
  let withModules = 0, totalModules = 0, encoded = 0;
  let expressedMag = 0, chargedUpkeep = 0;

  for (let slot = 0; slot < store.count; slot++) {
    if (!world.aliveAt(slot)) continue;
    const n = store.moduleCount[slot];
    if (n === 0) continue;
    withModules++;
    totalModules += n;
    const base = slot * MAX_MODULES * MODULE_STRIDE;
    for (let i = 0; i < n; i++) {
      const kind = store.geneModules[base + i * MODULE_STRIDE + MODULE_STRIDE_KIND];
      kinds[kind] = (kinds[kind] ?? 0) + 1;
      encoded++;
    }
    // Both figures come from the CACHED PHENOTYPE, which the engine re-derives
    // as the organism ages. `moduleTotal` is the magnitude actually applied;
    // `moduleUpkeep` is a sum of module upkeep coefficients in the SAME
    // normalised gene space as BASAL_COST — NOT energy deducted. The engine
    // converts that into an actual charge via upkeepOf() (allometric M^0.75),
    // a thermal term, mods.metabolismMul and spend(). The UI labels it
    // accordingly; summing DECLARED per-kind upkeep here instead would report a
    // cost the organisms are not paying.
    const p2 = phenOf(slot);
    expressedMag += p2?.moduleTotal ?? 0;
    chargedUpkeep += p2?.moduleUpkeep ?? 0;
  }

  if (withModules === 0) {
    return { rows: `<tr><td class="k">modules</td><td>none &mdash; knob unset</td></tr>`, kinds };
  }
  const rows =
    `<tr><td class="k">genome v2</td><td class="warn">ON &mdash; diagnostic</td></tr>` +
    `<tr><td class="k">with modules</td><td>${withModules} / ${store.population} organisms</td></tr>` +
    `<tr><td class="k">modules</td><td>${encoded} total &middot; ${(totalModules / withModules).toFixed(2)} mean</td></tr>` +
    // LABELLED FOR WHAT IT IS. `moduleUpkeep` is a sum of module upkeep
    // coefficients expressed in the same normalised units as the BASAL_COST
    // GENE — not energy actually deducted. The engine then turns that gene into
    // an energy charge through `upkeepOf()` (allometric M^0.75 mass scaling),
    // a thermal term and `mods.metabolismMul`, and finally `spend()`. Calling
    // this "upkeep/tick" asserted a charged cost the viewer never observes.
    `<tr><td class="k">expressing</td><td>${expressedMag.toFixed(1)} structure &middot; ${chargedUpkeep.toFixed(4)} basal-gene units</td></tr>`;
  return { rows, kinds };
}

function drawStats(
  fps: number, frameMs: number, simMs: number, updateMs: number, ticksRun: number,
): void {
  const store = world.store;
  const counts: Record<number, number> = {};
  for (let slot = 0; slot < store.count; slot++) {
    if (!world.aliveAt(slot)) continue;
    const t = world.roleOf(slot).trophic;
    counts[t] = (counts[t] ?? 0) + 1;
  }
  const pop = store.population;
  const mod = moduleStats();
  const rows =
    `<tr><td class="k">engine</td><td>${WORLD_ENGINE_VERSION}</td></tr>` +
    `<tr><td class="k">tick</td><td>${world.tick}</td></tr>` +
    `<tr><td class="k">population</td><td>${pop}</td></tr>` +
    `<tr><td class="k">births / deaths</td><td>${world.totalBirths} / ${world.totalDeaths}</td></tr>` +
    `<tr><td class="k">contests</td><td>${world.interactions.totalResolved}</td></tr>` +
    `<tr><td class="k">mean energy</td><td>${pop > 0 ? (world.snapshot.biomass / pop).toFixed(1) : '0'}</td></tr>` +
    `<tr><td class="k">disturbances</td><td>${world.abiotic.activeCount} active / ${world.disturbancesFired}</td></tr>` +
    `<tr><td class="k">residual</td><td>${(world.accountingResidualFraction() * 100).toFixed(4)}%</td></tr>` +
    `<tr><td class="k">zoom</td><td>${cam.zoom.toFixed(2)}&times;</td></tr>` +
    mod.rows;
  document.getElementById('stats-table')!.innerHTML = rows;
  // FRAME cost, TICK cost and JS-UPDATE cost are reported separately and
  // labelled for what they actually measure:
  //   frame   — wall-clock between rendered frames, everything included
  //   sim     — wall-clock spent inside world.step(), over the ticks that
  //             actually ran this frame
  //   per tick— sim divided by ticks EXECUTED, not by the speed setting
  //   update  — JS scene-graph update only. PixiJS renders on the GPU after
  //             this callback returns, so this excludes GPU cost entirely and
  //             is NOT a frame time.
  const perTick = tickTotalCount > 0 ? tickTotalMs / tickTotalCount : 0;
  document.getElementById('fps-line')!.innerHTML =
    `${fps.toFixed(0)} fps &middot; frame ${frameMs.toFixed(1)}ms` +
    `<br>sim ${simMs.toFixed(2)}ms this frame (${ticksRun} tick${ticksRun === 1 ? '' : 's'})` +
    ` &middot; ${perTick.toFixed(3)}ms/tick avg` +
    `<br><span class="tiny">js update ${updateMs.toFixed(2)}ms (excludes GPU render)</span>`;

  // Module census, read straight off the genome store. Object.entries yields
  // string keys, so the kind is parsed back to a number for MODULE_NAMES.
  const moduleKinds = genomeV2 === true
    ? Object.keys(mod.kinds)
        .map(Number)
        .filter((k) => Number.isFinite(k))
        .sort((a, b) => (mod.kinds[b] ?? 0) - (mod.kinds[a] ?? 0))
        .map((k) => `<div class="tiny">${MODULE_NAMES[k] ?? k} <span class="tiny">${mod.kinds[k]}</span></div>`)
        .join('')
    : '';
  document.getElementById('legend-rows')!.innerHTML = ROLE_ORDER.map((t) => {
    const n = counts[t] ?? 0;
    return (
      `<div><span class="swatch" style="background:#${ROLE_COLOR[t].toString(16).padStart(6, '0')}"></span>` +
      `${TROPHIC_NAME[t]} <span class="tiny">${n}</span></div>`
    );
  }).join('')
    + `<div class="tiny" style="margin-top:4px">hollow = senescent, dim = juvenile</div>`
    + (moduleKinds
      ? `<div style="margin-top:5px"><h1 style="margin:0 0 2px">Modules carried</h1>${moduleKinds}</div>`
      : '');
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

// --- Modular genome v2 toggle ----------------------------------------------
// Rebuilds the world because genomeV2 is a construction-time config knob, not
// a per-tick one. Toggling it is therefore a restart, and the UI says so
// rather than silently discarding the run in progress.
const genomeBtn = document.getElementById('btn-genome') as HTMLButtonElement;
const genomeNote = document.getElementById('genome-note') as HTMLElement;

function applyGenomeToggle(): void {
  genomeBtn.setAttribute('aria-pressed', String(genomeV2 === true));
  genomeNote.textContent = genomeV2 === true
    ? 'on \u2014 diagnostic, restarts'
    : 'off \u2014 declared behaviour';
  makeWorld(parseInt(popInput.value, 10), parseInt(seedInput.value, 10) || 1);
  renderInspector();
}
genomeBtn.addEventListener('click', () => {
  genomeV2 = genomeV2 === true ? null : true;
  applyGenomeToggle();
});

// --- Collapsible panels ----------------------------------------------------
// Four fixed-corner panels cannot all fit on a phone. Rather than pick a
// breakpoint and hope, every panel collapses to its header, so overlap is
// avoidable at any viewport. The inspector keeps its own display contract:
// it stays hidden until an organism is selected.
// `querySelectorAll` is scoped to #dock so the panels it contains are still
// found: the dock uses `display: contents` on desktop (children keep their own
// fixed positions) and becomes a real flex column on narrow screens. Either way
// the panels are descendants, so lookup is unaffected.
for (const panel of document.querySelectorAll<HTMLElement>('#dock .panel, #controls.panel')) {
  const header = panel.querySelector('h1');
  if (!header || panel.id === 'inspect') continue;
  header.addEventListener('click', () => panel.classList.toggle('collapsed'));
}

// Start narrow screens compact: the controls are what you need to drive a run,
// the rest is reference. Persisted per session is unnecessary; this is a viewer.
if (window.innerWidth < 760) {
  for (const id of ['stats', 'legend']) {
    document.getElementById(id)?.classList.add('collapsed');
  }
}

// --- Input affordances ----------------------------------------------------
// The hint line names the gesture the device actually has. A phone has no
// wheel, so telling a touch user to "wheel to zoom" describes an interaction
// they cannot perform.
const hintPointer = document.getElementById('hint-pointer') as HTMLElement;
const COARSE = window.matchMedia('(pointer: coarse)').matches;
if (!COARSE) {
  hintPointer.textContent = 'drag to pan \u00b7 wheel to zoom \u00b7 click an organism to inspect';
}
if (COARSE) {
  // A phone cannot scroll the page usefully — the canvas owns every gesture —
  // so the document must not bounce or pull-to-refresh when a drag starts near
  // an edge. `overscroll-behavior` is the only thing that reliably suppresses
  // this on both iOS Safari and Android Chrome.
  document.documentElement.style.overscrollBehavior = 'none';
}

// --- Dock layout ----------------------------------------------------------
// On narrow screens every bottom-anchored panel lives in #dock, a single
// top-anchored flex column, so siblings cannot overlap by construction. But the
// column must also stay clear of #controls, whose height depends on how its
// rows wrap at the current width. That height is therefore measured and
// published as a CSS variable rather than guessed in a stylesheet — the previous
// attempt hardcoded percentages and the stack grew upward into the controls.
//
// A bottom-anchored column would have the same overlap problem from the other
// direction: with three panels expanded it needed more height than the viewport
// had, so it grew up into the controls. Anchored to the top, it grows downward
// and is capped below them instead.
const dockEl = document.getElementById('dock') as HTMLElement;
const controlsEl = document.getElementById('controls') as HTMLElement;

function syncDockLayout(): void {
  const narrow = window.matchMedia('(max-width: 640px)').matches;
  if (!narrow) {
    dockEl.style.removeProperty('--controls-h');
    return;
  }
  const gap = parseFloat(getComputedStyle(dockEl).gap) || 0;
  const h = controlsEl.offsetHeight + gap;
  dockEl.style.setProperty('--controls-h', `${Math.round(h)}px`);
}

// Re-measure whenever the controls can change height: collapse/expand, window
// resize, rotation, and the founders readout changing the slider label width.
for (const panel of document.querySelectorAll<HTMLElement>('#dock .panel, #controls.panel')) {
  const header = panel.querySelector('h1');
  if (header && panel.id !== 'inspect') {
    header.addEventListener('click', () => setTimeout(syncDockLayout, 0));
  }
}
window.addEventListener('resize', syncDockLayout);
window.addEventListener('orientationchange', () => setTimeout(syncDockLayout, 150));

// --- Mobile viewport ------------------------------------------------------
// The visual viewport changes without a window resize event on mobile: the
// address bar collapsing, a keyboard opening, or a pinch-zoom of the page all
// alter it. Left unhandled, the canvas keeps the stale size and the rendered
// world sits under the browser chrome.
const vv = window.visualViewport;
if (vv) {
  const syncViewport = () => {
    // width/height here are VisualViewport's own, which do exist. Guard against
    // a zero during the address-bar collapse animation: resizing to 0x0 blanks
    // the canvas and the next gesture then hits nothing.
    const w = Math.round(vv.width);
    const h = Math.round(vv.height);
    if (w > 0 && h > 0) app.renderer.resize(w, h);
  };
  vv.addEventListener('resize', () => { syncViewport(); syncDockLayout(); });
  vv.addEventListener('scroll', syncViewport);
  // Rotation changes the visual viewport on some Android browsers without
  // firing resize on window at all. The delay lets the rotation settle; without
  // it the sync reads the pre-rotation viewport.
  window.addEventListener('orientationchange', () => setTimeout(() => {
    syncViewport();
    syncDockLayout();
  }, 120));
}
syncDockLayout();

// --- Main loop -------------------------------------------------------------
makeWorld(parseInt(popInput.value, 10), parseInt(seedInput.value, 10) || 1);
setSpeed(0);
(document.getElementById('btn-disturb') as HTMLButtonElement).setAttribute('aria-pressed', 'true');

/** Wall-clock budget for stepping in one frame. */
const SIM_BUDGET_MS = 12;
/**
 * Frames between statistics/DOM refreshes.
 *
 * Stats and the module census are O(living organisms) and rewrite innerHTML.
 * Per frame that is both wasteful and self-measuring — it inflates the frame
 * cost it reports. 6 frames is frequent enough to feel live and cheap enough
 * to be invisible.
 */
const UI_REFRESH_EVERY = 6;
let fpsAccum = 0;
let fpsFrames = 0;
let fps = 0;
let lastFrame = performance.now();
let uiTick = 0;
let tickTotalMs = 0;
let tickTotalCount = 0;

app.ticker.add(() => {
  // --- Advance the simulation. This is the ONLY place the viewer calls
  // step(); speed changes how many ticks run, never what a tick does.
  const simStart = performance.now();
  let ticksRun = 0;
  if (!paused) {
    const ticks = SPEEDS[speedIndex].ticks;
    // Hard per-frame tick budget so "Max" degrades gracefully on slow devices
    // instead of locking the tab.
    const budgetEnd = simStart + SIM_BUDGET_MS;
    do {
      world.step();
      ticksRun++;
    } while (ticksRun < ticks && performance.now() < budgetEnd);
  }
  const simMs = performance.now() - simStart;

  const drawStart = performance.now();
  drawSubstrate();
  drawDisturbances();
  drawOrganisms();
  drawMorphology();
  // "draw" measures the JS scene-graph update only. PixiJS's actual GPU render
  // happens after this callback returns, so this number is an UPPER BOUND ON
  // JS WORK and NOT a frame cost. Labelling it "draw" alongside a real frame
  // time invited exactly the misreading it caused.
  const updateMs = performance.now() - drawStart;

  const nowMs = performance.now();
  const frameMs = nowMs - lastFrame;
  lastFrame = nowMs;
  fpsAccum += frameMs;
  fpsFrames++;
  // Accumulate per-tick cost from ticks ACTUALLY executed. The previous code
  // divided a whole frame's sim time by nothing and printed it as "ms/tick",
  // so in Max a 12ms frame spanning up to 512 ticks was reported as 12ms per
  // tick — off by up to three orders of magnitude.
  if (ticksRun > 0) { tickTotalMs += simMs; tickTotalCount += ticksRun; }
  if (fpsAccum > 400) {
    fps = (fpsFrames * 1000) / fpsAccum;
    fpsAccum = 0;
    fpsFrames = 0;
    // Reset the tick average on the same cadence so it reflects recent frames
    // rather than a lifetime average that never converges after a speed change.
    tickTotalMs = 0;
    tickTotalCount = 0;
    uiTick = 0;
  }

  // Statistics and the module census rescan every living organism and rewrite
  // several innerHTML blocks. Running that each frame inflates the very cost
  // the panel reports and throttles the viewer's own throughput. Throttled to a
  // few times a second; the FPS readout uses the frame accumulator above and
  // stays live.
  if (++uiTick >= UI_REFRESH_EVERY) {
    uiTick = 0;
    if (selected >= 0) renderInspector();
    drawStats(fps, frameMs, simMs, updateMs, ticksRun);
  }
});

console.log(
  `%c DE evolution POC viewer %c ${WORLD_ENGINE_VERSION} — EXPERIMENTAL`,
  'background:#6ee7a8;color:#0b0f14;font-weight:bold',
  'color:#8698ad',
);
console.log('The viewer reads simulation state only; it never writes it.');