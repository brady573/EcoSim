/**
 * Uniform-grid spatial index for the experimental evolution engine.
 *
 * Neighbour queries are the dominant cost in an ecosystem sim: sensing,
 * mating, predation and crowding all need "who is near me". A uniform grid
 * beats a tree here because the world is bounded, the cell size is roughly
 * uniform, and rebuild-per-tick with a counting sort beats incremental tree
 * maintenance when most organisms move.
 *
 * Determinism: buckets are rebuilt every tick by counting sort in slot order,
 * so neighbour iteration order is a pure function of slot order. That matters
 * because contested interactions resolve against this order.
 */

export class SpatialGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly invCell: number;

  /** cells + 1 prefix offsets into `items`. */
  private cellStart: Int32Array;
  /** Slot indices grouped by cell. */
  private items: Int32Array;
  /** Scratch cursor used while building. */
  private cursor: Int32Array;
  /** Packed-index -> real-slot translation for the current build. */
  private packedIndex = new Int32Array(4096);
  private packedCount = 0;

  constructor(
    readonly worldW: number,
    readonly worldH: number,
    cellSize: number,
    capacity: number,
  ) {
    this.cellSize = cellSize;
    this.invCell = 1 / cellSize;
    this.cols = Math.max(1, Math.ceil(worldW / cellSize));
    this.rows = Math.max(1, Math.ceil(worldH / cellSize));
    const cells = this.cols * this.rows;
    this.cellStart = new Int32Array(cells + 1);
    this.cursor = new Int32Array(cells + 1);
    this.items = new Int32Array(Math.max(1, capacity));
  }

  cellIndex(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  columnOf(x: number): number {
    const cx = (x * this.invCell) | 0;
    return cx < 0 ? 0 : cx >= this.cols ? this.cols - 1 : cx;
  }

  rowOf(y: number): number {
    const cy = (y * this.invCell) | 0;
    return cy < 0 ? 0 : cy >= this.rows ? this.rows - 1 : cy;
  }

  /** Rebuild from position arrays. O(n + cells). */
  build(x: Float32Array, y: Float32Array, count: number): void {
    const cells = this.cols * this.rows;
    if (this.items.length < count) this.items = new Int32Array(count * 2);
    this.cellStart.fill(0);

    // Pass 1: histogram.
    for (let i = 0; i < count; i++) {
      const cx = this.columnOf(x[i]);
      const cy = this.rowOf(y[i]);
      this.cellStart[cy * this.cols + cx + 1]++;
    }
    // Pass 2: prefix sum.
    for (let c = 0; c < cells; c++) this.cellStart[c + 1] += this.cellStart[c];
    // Pass 3: scatter, walking slots in order.
    this.cursor.set(this.cellStart.subarray(0, cells));
    for (let i = 0; i < count; i++) {
      const cx = this.columnOf(x[i]);
      const cy = this.rowOf(y[i]);
      this.items[this.cursor[cy * this.cols + cx]++] = i;
    }
  }

  /**
   * Map packed neighbour indices back to real organism slots.
   *
   * The grid is built over a live-packed position array so dead slots are not
   * indexed, which means a query returns PACKED indices. This translation is
   * what turns them back into real slots.
   */
  buildPackedIndices(packed: Int32Array, count: number): void {
    if (this.packedIndex.length < count) this.packedIndex = new Int32Array(count * 2);
    this.packedIndex.set(packed.subarray(0, count));
    this.packedCount = count;
  }

  /**
   * Fill `out` with slot indices whose cell overlaps the circle
   * (px,py,radius) and return how many were written. Caller filters by exact
   * distance. The returned order is cell-major then slot order, which is
   * stable for a given world state.
   */
  query(px: number, py: number, radius: number, out: Int32Array): number {
    const minCx = this.columnOf(px - radius);
    const maxCx = this.columnOf(px + radius);
    const minCy = this.rowOf(py - radius);
    const maxCy = this.rowOf(py + radius);
    let n = 0;
    const cap = out.length;
    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowBase = cy * this.cols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        const c = rowBase + cx;
        const end = this.cellStart[c + 1];
        for (let k = this.cellStart[c]; k < end; k++) {
          if (n >= cap) return n;
          const packedIdx = this.items[k];
          out[n++] = packedIdx < this.packedCount ? this.packedIndex[packedIdx] : packedIdx;
        }
      }
    }
    return n;
  }

  /** Population density per cell, for crowding pressure and diagnostics. */
  density(x: Float32Array, y: Float32Array, count: number, out: Float32Array): Float32Array {
    out.fill(0);
    for (let i = 0; i < count; i++) {
      const cx = this.columnOf(x[i]);
      const cy = this.rowOf(y[i]);
      out[cy * this.cols + cx] += 1;
    }
    return out;
  }
}