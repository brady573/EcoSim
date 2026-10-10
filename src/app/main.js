"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRun = createRun;
exports.stepRun = stepRun;
exports.readRun = readRun;
exports.renderRun = renderRun;
exports.pixelSize = pixelSize;
/**
 * APP POC ENTRY — minimal browser API over the simulation engine.
 *
 * Pure TypeScript, no Node imports (direct or transitive): safe to bundle
 * with tsc --module amd for file:// execution. The HTML shell provides the
 * AMD loader, Canvas renderer, and controls; this module exposes only:
 *   createRun(seed, baseline) — new World with app defaults
 *   stepRun(run, n)           — advance n ticks
 *   readRun(run)              — tick/pop/guild counts for the HUD
 *   renderRun(run)            — RGB pixel buffer (via shared pixels.ts)
 *
 * Configuration mirrors the combined winner measured in REPORT.md. Baseline
 * flag gives declared behavior. Both paths are digest-identical to their CLI
 * equivalents (verified: same seed+config => same hashState).
 */
const world_js_1 = require("../world/world.js");
const role_js_1 = require("../bio/role.js");
const pixels_js_1 = require("../trace/pixels.js");
function createRun(seed, baseline) {
    const world = new world_js_1.World({
        config: baseline
            ? { founders: 400, worldW: 2400, worldH: 2400, seed }
            : {
                founders: 400, worldW: 2400, worldH: 2400, seed,
                consumerPhotoScale: 4, decomposerFounders: 0.25,
                decomposerDormancy: 0.05, sporeDispersal: 1,
            },
    });
    return { world, seed };
}
function stepRun(handle, n) {
    for (let i = 0; i < n; i++)
        handle.world.step();
}
function readRun(handle) {
    const w = handle.world;
    const s = w.store;
    const counts = [0, 0, 0];
    for (let sl = 0; sl < s.count; sl++) {
        if (!w.aliveAt(sl))
            continue;
        const g = w.roleOf(sl).trophic;
        if (g >= 0 && g < role_js_1.TROPHIC_COUNT)
            counts[g]++;
    }
    const [dormant] = w.dormantCounts();
    return {
        tick: w.tick,
        pop: s.population,
        producers: counts[role_js_1.TROPHIC.PRODUCER],
        consumers: counts[role_js_1.TROPHIC.CONSUMER],
        decomposers: counts[role_js_1.TROPHIC.DECOMPOSER],
        dormant,
    };
}
function renderRun(handle) {
    return (0, pixels_js_1.renderWorld)(handle.world);
}
function pixelSize() {
    return pixels_js_1.PIXEL_SIZE;
}
