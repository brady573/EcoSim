/** Real Chromium smoke. CI only; no fake browser claims from headless World. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { runIdentity } from '../build/world/version.js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = resolve(root, 'build/browser-smoke');
mkdirSync(out, { recursive: true });
const port = 5189;
const url = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['build/view/serve.js'], { cwd: root,
  env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = '';
server.stdout.on('data', (s) => { serverLog += s; });
server.stderr.on('data', (s) => { serverLog += s; });
const failures = [];
const results = [];
let browser;
const snapshot = (page) => page.evaluate(async () => (await import('/view/viewer.js')).viewerBrowserSnapshot());
const until = (page, predicate) => page.waitForFunction(async (source) => {
  const s = (await import('/view/viewer.js')).viewerBrowserSnapshot();
  return Function('s', `return (${source})(s)`)(s);
}, predicate.toString(), { timeout: 15000 });
async function pause(page) {
  const s = await snapshot(page);
  if (!s.paused) await page.locator('#btn-pause').click();
  await until(page, (s) => s.paused);
}
async function primary(mobile) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(e.message));
  try {
    await page.goto(url);
    await page.waitForSelector('canvas');
    await until(page, (s) => s.drawn > 0);
    await pause(page);
    // Playwright fill() does not support range inputs. Update the actual UI
    // input and emit its normal event; World is still built by Restart.
    await page.locator('#pop').evaluate((el) => {
      el.value = '400'; el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#seed').fill('517');
    for (const chemistry of [false, true]) for (const genome of [false, true]) {
      await page.locator('#experiment-mode').selectOption(chemistry ? 'chemistry' : 'legacy');
      if ((await page.locator('#btn-genome').getAttribute('aria-pressed')) !== String(genome)) {
        await page.locator('#btn-genome').click();
      }
      await page.locator('#btn-restart').click();
      await until(page, (s) => s.tick === 0 && s.drawn > 0);
      const initial = await snapshot(page);
      assert.equal(initial.config.resolvedConfig.chemistry, chemistry ? true : null);
      assert.equal(initial.config.resolvedConfig.genomeV2, genome ? true : null);
      assert.ok(initial.provenance.includes(runIdentity(chemistry)) && initial.provenance.includes('seed 517'));
      await page.locator('#btn-config').click();
      let config = JSON.parse(await page.locator('#resolved-config').inputValue());
      assert.deepEqual(config.resolvedConfig, initial.config.resolvedConfig);
      // Close the config panel before picking: otherwise it occludes the canvas.
      await page.locator('#btn-config').click();
      await page.locator('#btn-4x').click();
      await until(page, (s) => s.tick >= 32);
      await pause(page);
      const advanced = await snapshot(page);
      if (chemistry && genome) {
        assert.ok(advanced.chemicalIncome > 0 && advanced.chemicalCarbonBuilt > 0);
      }
      await page.waitForFunction(({ identity, genome }) => {
        const text = document.getElementById('stats-table').textContent;
        return text.includes(identity) && text.includes(`Genome V2 ${genome ? 'on' : 'off'}`)
          && text.includes('seed 517');
      }, { identity: runIdentity(chemistry), genome });
      const stats = await page.locator('#stats-table').innerText();
      assert.equal(stats.includes('chemical income / growth spend'), chemistry);
      const pick = await page.evaluate(async () => {
        const s = (await import('/view/viewer.js')).viewerBrowserSnapshot();
        return s.picks.find((p) => document.elementFromPoint(p.x, p.y)?.tagName === 'CANVAS');
      });
      assert.ok(pick, 'non-vacuous unobscured organism witness');
      if (mobile) await page.touchscreen.tap(pick.x, pick.y);
      else await page.mouse.click(pick.x, pick.y);
      await page.locator('#inspect').waitFor({ state: 'visible' });
      assert.ok((await page.locator('#inspect').innerText()).includes('Organism #'));
      assert.equal((await page.locator('#inspect').innerText()).includes('Tissue (mol):'), chemistry);
      assert.equal((await snapshot(page)).hash, advanced.hash, 'picking/inspection must not mutate biology');
      await page.screenshot({ path: `${out}/${mobile ? 'mobile' : 'desktop'}-${chemistry}-${genome}.png` });
      for (const bad of ['0', '1.5', '4294967296']) {
        await page.locator('#seed').fill(bad);
        await page.locator('#btn-restart').click();
        assert.ok((await page.locator('#run-error').innerText()).length > 0);
        assert.equal((await snapshot(page)).hash, advanced.hash);
      }
      await page.locator('#seed').fill('517');
      await page.locator('#btn-restart').click();
      assert.equal((await snapshot(page)).hash, initial.hash);
      await page.locator('#inspect').waitFor({ state: 'hidden' });
      results.push({ test: 'primary modes, inspect, invalid seed and deterministic restart', mobile, chemistry, genome });
    }
    const canvas = await page.locator('canvas').boundingBox();
    assert.ok(canvas && canvas.width > 0 && canvas.height > 0);
    // Use an uncovered canvas point for gestures, not controls or dock panels.
    const point = await page.evaluate(() => {
      for (let y = 100; y < innerHeight - 150; y += 40) for (let x = 20; x < innerWidth - 20; x += 40) {
        if (document.elementFromPoint(x, y)?.tagName === 'CANVAS') return { x, y };
      }
    });
    assert.ok(point, 'uncovered gesture surface');
    let before = await snapshot(page);
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, -300);
    await until(page, (s) => s.camera.zoom !== 1);
    let after = await snapshot(page);
    assert.ok(after.camera.zoom > before.camera.zoom);
    before = after;
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 40, point.y + 30, { steps: 5 });
    await page.mouse.up();
    after = await snapshot(page);
    assert.ok(after.camera.x !== before.camera.x || after.camera.y !== before.camera.y);
    assert.equal(after.hash, before.hash);
    if (mobile) {
      assert.equal(await page.locator('html').getAttribute('data-layout'), 'dock');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const session = await context.newCDPSession(page);
      before = await snapshot(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [
        { x: point.x, y: point.y, id: 1 }, { x: point.x + 30, y: point.y, id: 2 },
      ] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
        { x: point.x - 10, y: point.y, id: 1 }, { x: point.x + 50, y: point.y, id: 2 },
      ] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      after = await snapshot(page);
      assert.notEqual(after.camera.zoom, before.camera.zoom, 'real touch pinch changes zoom');
      assert.equal(after.hash, before.hash);
    }
    results.push({ test: 'canvas delivery, wheel/pan/touch and layout', mobile });
  } finally { await context.close(); }
}
async function portable() {
  const context = await browser.newContext();
  await context.route(/^https?:/, (route) => route.abort());
  const page = await context.newPage();
  page.on('pageerror', (e) => failures.push(e.message));
  try {
    await page.goto(pathToFileURL(resolve(root, 'evidence/app/evo-sim-poc.html')).href);
    assert.ok((await page.locator('#note').innerText()).includes('chemistry and Genome V2 are off'));
    for (const preset of ['base', 'eco']) {
      await page.locator('#mode').selectOption(preset);
      await page.locator('#seed').fill('517');
      await page.locator('#run').click();
      await page.waitForFunction(() => /t[1-9]\d*/.test(document.getElementById('readout').textContent));
      await page.locator('#pause').click();
      await page.locator('#export').click();
      const dump = JSON.parse(await page.locator('#dumptext').inputValue());
      assert.equal(dump.seed, 517);
      assert.equal(dump.baseline, preset === 'base');
      assert.ok(dump.tick > 0 && dump.pop > 0);
      // Actual Canvas pixel witness; no network is available in this context.
      const colors = await page.locator('#cv').evaluate((cv) => {
        const pixels = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        const rgb = new Set();
        for (let i = 0; i < pixels.length; i += 4) rgb.add(`${pixels[i]},${pixels[i+1]},${pixels[i+2]}`);
        return rgb.size;
      });
      assert.ok(colors > 1, 'portable Canvas actually draws nonblank pixels');
      results.push({ test: 'offline file-open portable', preset, tick: dump.tick });
    }
    await page.screenshot({ path: `${out}/portable.png` });
  } finally { await context.close(); }
}
try {
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(serverLog);
    try { if ((await fetch(url)).ok) break; } catch { /* starting */ }
    if (i === 99) throw new Error('primary server did not start');
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  await primary(false);
  await primary(true);
  await portable();
  assert.deepEqual(failures, [], 'no uncaught browser page errors');
  writeFileSync(`${out}/results.json`, JSON.stringify({ status: 'passed', results }, null, 2));
  console.log('Browser smoke passed: actual Chromium desktop/mobile + offline portable.');
} catch (e) {
  writeFileSync(`${out}/results.json`, JSON.stringify({ status: 'failed', completed: results,
    error: String(e), pageErrors: failures }, null, 2));
  throw e;
} finally {
  if (browser) await browser.close();
  server.kill();
  writeFileSync(`${out}/server.log`, serverLog);
}
