"use strict";
/**
 * Abiotic scalar fields for the experimental evolution engine.
 *
 * A field is a flat Float32Array over a coarse cell grid. These carry the
 * non-living part of the world: mineral nutrient supply, dead organic matter
 * (detritus), and the dynamic abiotic axis (here a light/temperature band that
 * drifts over the run and is perturbed by disturbances).
 *
 * Fields are updated by a pull-based diffusion pass rather than a scatter, so
 * the result is independent of iteration-order artefacts and is trivially
 * deterministic.
 *
 * LIMITATION (disclosed): this is a mean-field approximation of an
 * environment, not a fluid or particle simulation. A real substrate would have
 * vertical structure and transport; this has neither. It is deliberately cheap
 * because the experiment is about organism-scale throughput, not soil physics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScalarField = void 0;
/** One scalar layer over the coarse grid. */
class ScalarField {
    name;
    cols;
    rows;
    data;
    /** Scratch buffer for the diffusion ping-pong. */
    scratch;
    constructor(name, cols, rows, fill = 0) {
        this.name = name;
        this.cols = cols;
        this.rows = rows;
        this.data = new Float32Array(cols * rows);
        this.scratch = new Float32Array(cols * rows);
        if (fill !== 0)
            this.data.fill(fill);
    }
    index(cx, cy) {
        return cy * this.cols + cx;
    }
    /** Bilinear-ish sample. Nearest-cell, clamped — cheap and stable. */
    sample(x, y, cellW, cellH) {
        let cx = (x / cellW) | 0;
        let cy = (y / cellH) | 0;
        if (cx < 0)
            cx = 0;
        else if (cx >= this.cols)
            cx = this.cols - 1;
        if (cy < 0)
            cy = 0;
        else if (cy >= this.rows)
            cy = this.rows - 1;
        return this.data[cy * this.cols + cx];
    }
    add(x, y, cellW, cellH, amount) {
        let cx = (x / cellW) | 0;
        let cy = (y / cellH) | 0;
        if (cx < 0)
            cx = 0;
        else if (cx >= this.cols)
            cx = this.cols - 1;
        if (cy < 0)
            cy = 0;
        else if (cy >= this.rows)
            cy = this.rows - 1;
        this.data[cy * this.cols + cx] += amount;
    }
    clear() {
        this.data.fill(0);
    }
    /** Total mass, for conservation accounting. */
    total() {
        let s = 0;
        for (let i = 0; i < this.data.length; i++)
            s += this.data[i];
        return s;
    }
    /**
     * Explicit 5-point diffusion with a decay term, in place.
     * `diffusivity` in [0,0.25] is the per-tick share moved to each neighbour.
     * `decay` in [0,1] is the per-tick loss (mineralisation, burial).
     */
    step(diffusivity, decay) {
        const { cols, rows, data, scratch } = this;
        for (let cy = 0; cy < rows; cy++) {
            const row = cy * cols;
            for (let cx = 0; cx < cols; cx++) {
                const i = row + cx;
                // Reflecting boundaries: the outside edge reuses the boundary value,
                // which conserves mass better than clamping to zero.
                const left = cx > 0 ? data[i - 1] : data[i];
                const right = cx < cols - 1 ? data[i + 1] : data[i];
                const up = cy > 0 ? data[i - cols] : data[i];
                const down = cy < rows - 1 ? data[i + cols] : data[i];
                const centre = data[i];
                const lap = left + right + up + down - 4 * centre;
                scratch[i] = centre + diffusivity * lap;
            }
        }
        if (decay > 0) {
            const keep = 1 - decay;
            for (let i = 0; i < data.length; i++)
                data[i] = scratch[i] * keep;
        }
        else {
            data.set(scratch);
        }
    }
    /** Fraction of cells at or below `threshold`. Used for scarcity signals. */
    fractionBelow(threshold) {
        let n = 0;
        for (let i = 0; i < this.data.length; i++)
            if (this.data[i] <= threshold)
                n++;
        return n / this.data.length;
    }
}
exports.ScalarField = ScalarField;
