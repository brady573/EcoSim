/**
 * SPATIAL RESCUE TRACKER — per-patch guild trajectories on failing seeds
 * (diagnostic).
 *
 * READ-ONLY instrument: constructs Worlds, steps them, reports. Never writes
 * biology. Pinned to the excretion-return effective config: --zero + lifts
 * producerCaptureScale 0.35, basalFoodPerCell 0.01, grazeYieldScale 1.0,
 * nutrientRegen 0.0002, excretionRate 0.06; argvRest off,4,0.25,null,null,
 * null,0.15,null,off,off,on,1.0,null,0.05,30.
 *
 * Reads the metapopulation census through the read-only patchGridDims /
 * patchGuild accessors (pure reads; patch sums describe tick START: the
 * census rebuilds in Phase 3, so a post-step read excludes same-tick births,
 * includes same-tick deaths, and uses pre-move positions — stated in full
 * wherever rows are presented).
 * Samples every 500 ticks: per-patch P/C/D plus global totals.
 *
 * Config-identity tripwire: final global census must match the archived
 * excretion-arm t6000 endpoints exactly, or the trajectories are void.
 *
 * Run (compiled only): node build/trace/patchtrack.js [ticks] [seeds...]
 * Defaults: 6000 ticks; seeds 41001, 41016, 41018 (three failure modes).
 */
import { World } from '../world/world.js';
import { TROPHIC } from '../bio/role.js';
const TICKS = Number(process.argv[2] ?? 6000);
if (!Number.isFinite(TICKS) || TICKS <= 0) {
  throw new Error(`bad ticks: ${process.argv[2]} (want >0)`);
}
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(41001, 41016, 41018);
if (SEEDS.some((s) => !Number.isFinite(s) || s <= 0)) {
  throw new Error(`bad seeds: ${process.argv.slice(3).join(' ')} (want positive integers)`);
}
const SAMPLE_EVERY = 500;

function buildWorld(seed: number): World {
  return new World({
    config: {
      founders: 400, worldW: 2400, worldH: 2400, seed,
      consumerPhotoScale: 0, consumerBasalScale: 0.25,
      decomposerPhotoScale: 0, decomposerFounders: 0.25,
      decomposerDormancy: 0.05, sporeDispersal: 1,
      grazeYieldScale: 1.0, plantYieldPerMass: 0, radiation: null,
      foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
      dormantThreatBlind: null, mixotrophyCarbon: null,
      mixotrophySaturation: 1.0, nutrientCyclic: true,
      producerCaptureScale: 0.35, nutrientFloor: 0.05, reproSurplusTicks: 30,
      basalFoodPerCell: 0.01, nutrientRegen: 0.0002,
      excretionRate: 0.06, meatYieldPerMass: 0,
    },
  });
}

for (const seed of SEEDS) {
  const w = buildWorld(seed);
  const [cols, rows] = (w as unknown as { patchGridDims(): [number, number] }).patchGridDims();
  console.log(`PATCHTRACK seed=${seed} ticks=${TICKS} grid=${cols}x${rows} (excretion effective config)`);
  const pg = (w as unknown as { patchGuild(p: number, t: number): number }).patchGuild.bind(w);
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    if (t % SAMPLE_EVERY !== 0 && t !== TICKS) continue;
    const cells: string[] = [];
    let gp = 0, gc = 0, gd = 0;
    for (let p = 0; p < cols * rows; p++) {
      const a = pg(p, TROPHIC.PRODUCER);
      const b = pg(p, TROPHIC.CONSUMER);
      const c = pg(p, TROPHIC.DECOMPOSER);
      gp += a; gc += b; gd += c;
      cells.push(`p${p}:${a}/${b}/${c}`);
    }
    console.log(`  t${t} global=${gp}/${gc}/${gd} ${cells.join(' ')}`);
    if (t !== TICKS) continue;
    // Identity uses the LIVE store census (end-of-tick truth), never the
    // patch sums above: those describe tick start (same-tick deaths included,
    // same-tick births excluded) and would mismatch live endpoints by exactly
    // the tick's births-minus-deaths on any active seed.
    let fp = 0, fc = 0, fd = 0;
    for (let sl = 0; sl < w.store.count; sl++) {
      if (!w.aliveAt(sl)) continue;
      const g = w.roleOf(sl).trophic;
      if (g === TROPHIC.PRODUCER) fp++;
      else if (g === TROPHIC.CONSUMER) fc++;
      else fd++;
    }
    console.log(`  t${t} LIVE P${fp}/C${fc}/D${fd} (identity: must match archived endpoint)`);
  }
}
console.log('Patch rows are tick-start truth (same-tick births excluded, same-tick deaths included, pre-move positions).');
console.log('500-tick sampling misses sub-500-tick extinction/recolonization cycles: the READ rule is defined on samples.');
console.log('Final LIVE census must match archived excretion endpoints or the run is void (see REPORT).');
