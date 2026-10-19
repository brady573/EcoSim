/**
 * L2 photosynthesis-site observer (issue #15, Owner decision 2026-10-18).
 *
 * Strictly observational: records event-time Liebig data at the photosynthesis
 * computation site, BEFORE consumption, into bounded aggregators keyed by
 * declared time window. It performs NO field write, NO RNG draw, NO
 * iteration-order change and contributes NOTHING to hashState. Enabling it
 * must be byte-identical to disabling it (G36 asserts).
 *
 * MEMORY SHAPE (exact, not constant): the retained per-event sample is capped
 * at `sampleCap` per window, but the distinct-participant/location tracking
 * accumulates one Set entry per DISTINCT organism ID and per DISTINCT spatial
 * cell seen — per window, and mirrored per displayed guild. That is
 * O(distinct organisms + distinct cells per window) memory, on the order of
 * the live population and geography, NOT a fixed ceiling. `retainedEventCount`
 * answers only the capped-sample question; `distinctMeasure` reports the
 * actual Set footprint. A fixed-size subset view is deliberately NOT claimed.
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

export interface PhotoObserverGuildStats {
  eligibleEvents: number;
  limitedEvents: number;
  zeroLimEvents: number;
  partialLimEvents: number;
  sumLim: number;
  sumShortfall: number;
  /** Binding-pool counts over ALL eligible events of this guild. */
  bindingByPool: [number, number, number];
  /** DISTINCT participants over ALL eligible events of this guild (O(set) cost). */
  uniqueOrganisms: number;
  uniqueCells: number;
  /** DISTINCT participants among this guild's LIMITED events ONLY (lim <= 0.90). */
  limitedUniqueOrganisms: number;
  limitedUniqueCells: number;
  /** Binding-pool counts over this guild's LIMITED events ONLY. */
  limitedBindingByPool: [number, number, number];
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
  /** DISTINCT participants over ALL eligible events (O(set) cost, see class doc). */
  uniqueOrganisms: number;
  uniqueCells: number;
  /** DISTINCT participants among LIMITED events ONLY (lim <= 0.90), all guilds. */
  limitedUniqueOrganisms: number;
  limitedUniqueCells: number;
  /** Binding-pool counts over LIMITED events ONLY, all guilds. */
  limitedBindingByPool: [number, number, number];
  sample: PhotoObserverEvent[];
  /** Per DISPLAYED guild: the same counters restricted to that guild. */
  perGuild: [PhotoObserverGuildStats, PhotoObserverGuildStats, PhotoObserverGuildStats];
}

const LIMIT_THRESHOLD = 0.9;

type GuildAcc = Omit<PhotoObserverGuildStats, 'bindingByPool' | 'limitedBindingByPool'> & {
  _orgs: Set<number>; _cells: Set<number>; _limOrgs: Set<number>; _limCells: Set<number>;
  bindingByPool: [number, number, number]; limitedBindingByPool: [number, number, number];
};
type WindowAcc = Omit<PhotoObserverWindowStats, 'pool' | 'limitedBindingByPool' | 'perGuild'> & {
  _orgs: Set<number>; _cells: Set<number>; _limOrgs: Set<number>; _limCells: Set<number>;
  sample: PhotoObserverEvent[]; perGuild: GuildAcc[];
  pool: [PhotoObserverPoolStats, PhotoObserverPoolStats, PhotoObserverPoolStats];
  limitedBindingByPool: [number, number, number];
};

export interface PhotoObserverSnapshot {
  windows: PhotoObserverWindowStats[];
  outOfWindowEvents: number;
}

export class PhotoObserver {
  readonly windows: PhotoObserverWindow[];
  readonly sampleCap: number;
  private stats: WindowAcc[];

  constructor(windows?: PhotoObserverWindow[], sampleCap = 64) {
    this.windows = windows ?? [
      { label: '0-100', lo: 1, hi: 100 },
      { label: '100-250', lo: 101, hi: 250 },
      { label: '250-500', lo: 251, hi: 500 },
      { label: '500-625', lo: 501, hi: 625 },
      { label: '625-750', lo: 626, hi: 750 },
    ];
    this.sampleCap = sampleCap;
    this.stats = this.windows.map((w): WindowAcc => ({
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
      limitedUniqueOrganisms: 0,
      limitedUniqueCells: 0,
      limitedBindingByPool: [0, 0, 0],
      sample: [],
      _orgs: new Set<number>(),
      _cells: new Set<number>(),
      _limOrgs: new Set<number>(),
      _limCells: new Set<number>(),
      perGuild: [0, 1, 2].map((): GuildAcc => ({
        eligibleEvents: 0, limitedEvents: 0, zeroLimEvents: 0, partialLimEvents: 0,
        sumLim: 0, sumShortfall: 0,
        bindingByPool: [0, 0, 0], limitedBindingByPool: [0, 0, 0],
        uniqueOrganisms: 0, uniqueCells: 0,
        limitedUniqueOrganisms: 0, limitedUniqueCells: 0,
        _orgs: new Set<number>(), _cells: new Set<number>(),
        _limOrgs: new Set<number>(), _limCells: new Set<number>(),
      })),
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
    if (ev.lim <= LIMIT_THRESHOLD) {
      st._limOrgs.add(ev.organismId);
      st._limCells.add(ev.cell);
      st.limitedUniqueOrganisms = st._limOrgs.size;
      st.limitedUniqueCells = st._limCells.size;
      for (let p = 0; p < 3; p++) if (ev.binding[p]) st.limitedBindingByPool[p]++;
    }
    const g = ev.displayedGuild;
    if (g >= 0 && g <= 2) {
      const gs = st.perGuild[g];
      gs.eligibleEvents++;
      gs.sumLim += ev.lim;
      gs.sumShortfall += ev.shortfall;
      gs._orgs.add(ev.organismId);
      gs._cells.add(ev.cell);
      gs.uniqueOrganisms = gs._orgs.size;
      gs.uniqueCells = gs._cells.size;
      for (let p = 0; p < 3; p++) if (ev.binding[p]) gs.bindingByPool[p]++;
      if (ev.lim <= LIMIT_THRESHOLD) {
        gs.limitedEvents++;
        if (ev.lim <= 0) gs.zeroLimEvents++;
        else gs.partialLimEvents++;
        gs._limOrgs.add(ev.organismId);
        gs._limCells.add(ev.cell);
        gs.limitedUniqueOrganisms = gs._limOrgs.size;
        gs.limitedUniqueCells = gs._limCells.size;
        for (let p = 0; p < 3; p++) if (ev.binding[p]) gs.limitedBindingByPool[p]++;
      }
    }
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
        limitedUniqueOrganisms: st.limitedUniqueOrganisms,
        limitedUniqueCells: st.limitedUniqueCells,
        limitedBindingByPool: [...st.limitedBindingByPool] as [number, number, number],
        sample: st.sample,
        perGuild: [
          this.guildView(st.perGuild[0]),
          this.guildView(st.perGuild[1]),
          this.guildView(st.perGuild[2]),
        ] as [PhotoObserverGuildStats, PhotoObserverGuildStats, PhotoObserverGuildStats],
      })),
      outOfWindowEvents: this.outOfWindowEvents,
    };
  }

  private guildView(g: GuildAcc): PhotoObserverGuildStats {
    return {
      eligibleEvents: g.eligibleEvents,
      limitedEvents: g.limitedEvents,
      zeroLimEvents: g.zeroLimEvents,
      partialLimEvents: g.partialLimEvents,
      sumLim: g.sumLim,
      sumShortfall: g.sumShortfall,
      bindingByPool: [...g.bindingByPool] as [number, number, number],
      uniqueOrganisms: g.uniqueOrganisms,
      uniqueCells: g.uniqueCells,
      limitedUniqueOrganisms: g.limitedUniqueOrganisms,
      limitedUniqueCells: g.limitedUniqueCells,
      limitedBindingByPool: [...g.limitedBindingByPool] as [number, number, number],
    };
  }

  /**
   * Honest memory accounting. Retained sample records are capped
   * (`retainedEventCount`), but the participant/location Sets are NOT: they
   * grow with distinct organism IDs and distinct cells seen per window (riff
   * on live engine scale, e.g. up to the population cap per window). Report
   * the actual tracked sizes rather than advertising a constant ceiling.
   */
  distinctMeasure(): { organisms: number; cells: number; organismsLimited: number; cellsLimited: number } {
    let organisms = 0, cells = 0, organismsLimited = 0, cellsLimited = 0;
    for (const st of this.stats) {
      organisms += st._orgs.size;
      cells += st._cells.size;
      organismsLimited += st._limOrgs.size;
      cellsLimited += st._limCells.size;
      for (const gs of st.perGuild) {
        cells += gs._cells.size;
        organisms += gs._orgs.size;
        organismsLimited += gs._limOrgs.size;
        cellsLimited += gs._limCells.size;
      }
    }
    return { organisms, cells, organismsLimited, cellsLimited };
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
