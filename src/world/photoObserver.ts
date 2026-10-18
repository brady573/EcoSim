/**
 * L2 photosynthesis-site observer (issue #15, Owner decision 2026-10-18).
 *
 * Strictly observational: records event-time Liebig data at the photosynthesis
 * computation site, BEFORE consumption, into bounded aggregators keyed by
 * declared time window. It performs NO field write, NO RNG draw, NO
 * iteration-order change and contributes NOTHING to hashState. Enabling it
 * must be byte-identical to disabling it (G36 asserts).
 *
 * Measurement only. It is not biology and not a permanent subsidy.
 */

export interface PhotoObserverWindow {
  label: string;
  lo: number;
  hi: number;
}

export interface PhotoObserverPoolStats {
  desired: number;
  present: number;
  uptake: number;
  bindingEvents: number;
}

export interface PhotoObserverEvent {
  tick: number;
  cell: number;
  organismId: number;
  displayedGuild: number;
  demand: number;
  affinity: [number, number, number];
  desired: [number, number, number];
  present: [number, number, number];
  lim: number;
  binding: [boolean, boolean, boolean];
  uptake: [number, number, number];
  shortfall: number;
}

export interface PhotoObserverWindowStats {
  label: string;
  lo: number;
  hi: number;
  eligibleEvents: number;
  limitedEvents: number;
  sumLim: number;
  sumDemand: number;
  sumShortfall: number;
  pool: [PhotoObserverPoolStats, PhotoObserverPoolStats, PhotoObserverPoolStats];
  uniqueOrganisms: number;
  uniqueCells: number;
  sample: PhotoObserverEvent[];
}

const LIMIT_THRESHOLD = 0.9;

export interface PhotoObserverSnapshot {
  windows: PhotoObserverWindowStats[];
  outOfWindowEvents: number;
}

export class PhotoObserver {
  readonly windows: PhotoObserverWindow[];
  readonly sampleCap: number;
  private stats: Array<PhotoObserverWindowStats & { _orgs: Set<number>; _cells: Set<number> }>;

  constructor(windows?: PhotoObserverWindow[], sampleCap = 64) {
    this.windows = windows ?? [
      { label: '0-100', lo: 1, hi: 100 },
      { label: '100-250', lo: 101, hi: 250 },
      { label: '250-500', lo: 251, hi: 500 },
      { label: '500-625', lo: 501, hi: 625 },
      { label: '625-750', lo: 626, hi: 750 },
    ];
    this.sampleCap = sampleCap;
    this.stats = this.windows.map((w) => ({
      label: w.label,
      lo: w.lo,
      hi: w.hi,
      eligibleEvents: 0,
      limitedEvents: 0,
      sumLim: 0,
      sumDemand: 0,
      sumShortfall: 0,
      pool: [
        { desired: 0, present: 0, uptake: 0, bindingEvents: 0 },
        { desired: 0, present: 0, uptake: 0, bindingEvents: 0 },
        { desired: 0, present: 0, uptake: 0, bindingEvents: 0 },
      ],
      uniqueOrganisms: 0,
      uniqueCells: 0,
      sample: [],
      _orgs: new Set<number>(),
      _cells: new Set<number>(),
    }));
  }

  private windowIndex(tick: number): number {
    for (let i = 0; i < this.windows.length; i++) {
      const w = this.windows[i];
      if (tick >= w.lo && tick <= w.hi) return i;
    }
    return -1;
  }

  record(ev: PhotoObserverEvent): void {
    const wi = this.windowIndex(ev.tick);
    if (wi < 0) {
      this.outOfWindowEvents++;
      return;
    }
    const st = this.stats[wi];
    st.eligibleEvents++;
    if (ev.lim <= LIMIT_THRESHOLD) st.limitedEvents++;
    st.sumLim += ev.lim;
    st.sumDemand += ev.demand;
    st.sumShortfall += ev.shortfall;
    for (let p = 0; p < 3; p++) {
      const ps = st.pool[p];
      ps.desired += ev.desired[p];
      ps.present += ev.present[p];
      ps.uptake += ev.uptake[p];
      if (ev.binding[p]) ps.bindingEvents++;
    }
    st._orgs.add(ev.organismId);
    st._cells.add(ev.cell);
    st.uniqueOrganisms = st._orgs.size;
    st.uniqueCells = st._cells.size;
    if (st.sample.length < this.sampleCap) {
      // Store a copy: the caller's locals are scoped to the tick loop, but a
      // plain array copy keeps the retained sample independent of any later
      // reuse of the same array object by the engine.
      st.sample.push({
        tick: ev.tick,
        cell: ev.cell,
        organismId: ev.organismId,
        displayedGuild: ev.displayedGuild,
        demand: ev.demand,
        affinity: [...ev.affinity] as [number, number, number],
        desired: [...ev.desired] as [number, number, number],
        present: [...ev.present] as [number, number, number],
        lim: ev.lim,
        binding: [...ev.binding] as [boolean, boolean, boolean],
        uptake: [...ev.uptake] as [number, number, number],
        shortfall: ev.shortfall,
      });
    }
  }

  /** Serializable aggregate (private sets collapsed to counts). */
  snapshot(): PhotoObserverSnapshot {
    return {
      windows: this.stats.map((st) => ({
        label: st.label,
        lo: st.lo,
        hi: st.hi,
        eligibleEvents: st.eligibleEvents,
        limitedEvents: st.limitedEvents,
        sumLim: st.sumLim,
        sumDemand: st.sumDemand,
        sumShortfall: st.sumShortfall,
        pool: [
          { ...st.pool[0] },
          { ...st.pool[1] },
          { ...st.pool[2] },
        ],
        uniqueOrganisms: st.uniqueOrganisms,
        uniqueCells: st.uniqueCells,
        sample: st.sample,
      })),
      outOfWindowEvents: this.outOfWindowEvents,
    };
  }

  /** Per-window exclusive events outside any declared window for diagnostics. */
  outOfWindowEvents = 0;

  /** Memory bound: number of retained event records across all windows. */
  retainedEventCount(): number {
    let n = 0;
    for (const st of this.stats) n += st.sample.length;
    return n;
  }
}