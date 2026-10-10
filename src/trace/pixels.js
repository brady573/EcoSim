"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIXEL_CELL = exports.PIXEL_SIZE = void 0;
exports.renderWorld = renderWorld;
const role_js_1 = require("../bio/role.js");
exports.PIXEL_SIZE = 600;
exports.PIXEL_CELL = 2400 / exports.PIXEL_SIZE;
const COLORS = [
    [0, 200, 0], // producer green
    [255, 140, 0], // consumer orange
    [180, 80, 255], // decomposer purple
];
const DORMANT = [90, 90, 140];
function renderWorld(w) {
    const SIZE = exports.PIXEL_SIZE;
    const CELL = exports.PIXEL_CELL;
    // Per-pixel guild tallies: [pixel][guild].
    const counts = new Int32Array(SIZE * SIZE * role_js_1.TROPHIC_COUNT);
    const dormant = new Int32Array(SIZE * SIZE);
    const s = w.store;
    for (let sl = 0; sl < s.count; sl++) {
        if (!w.aliveAt(sl))
            continue;
        const g = w.roleOf(sl).trophic;
        if (g < 0 || g >= role_js_1.TROPHIC_COUNT)
            continue;
        const px = Math.min(SIZE - 1, Math.max(0, Math.floor(s.x[sl] / CELL)));
        const py = Math.min(SIZE - 1, Math.max(0, Math.floor(s.y[sl] / CELL)));
        const idx = py * SIZE + px;
        counts[idx * role_js_1.TROPHIC_COUNT + g]++;
        if (g === role_js_1.TROPHIC.DECOMPOSER && w.isDormant(sl))
            dormant[idx]++;
    }
    const rgb = new Uint8Array(SIZE * SIZE * 3);
    for (let i = 0; i < SIZE * SIZE; i++) {
        let best = -1, bestN = 0, total = 0;
        for (let g = 0; g < role_js_1.TROPHIC_COUNT; g++) {
            const n = counts[i * role_js_1.TROPHIC_COUNT + g];
            total += n;
            if (n > bestN) {
                bestN = n;
                best = g;
            }
        }
        if (best < 0)
            continue; // black
        const bright = Math.min(1, 0.25 + (total / 5) * 0.75);
        let c = COLORS[best];
        // Dormant-majority decomposer pixel renders slate instead of purple.
        if (best === role_js_1.TROPHIC.DECOMPOSER && dormant[i] * 2 >= bestN)
            c = DORMANT;
        rgb[i * 3] = Math.round(c[0] * bright);
        rgb[i * 3 + 1] = Math.round(c[1] * bright);
        rgb[i * 3 + 2] = Math.round(c[2] * bright);
    }
    return rgb;
}
