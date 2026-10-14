/**
 * VIABILITY GATE ATTRIBUTION — which reproduction gate stops consumers in the
 * viability config (diagnostic, engine-ordered).
 *
 * READ-ONLY instrument: constructs Worlds, steps them, reports. Never writes
 * biology. Pinned to the viability-061 world config: --zero + lifts
 * producerCaptureScale 0.35, basalFoodPerCell 0.01, grazeYieldScale 1.0,
 * nutrientRegen 0.0002, argvRest off,4,0.25,null,null,null,0.15,null,off,off,
 * on,1.0,null,0.05,30.
 *
 * METHOD (corrected 2026-10-12 after review): v1 of this probe replicated the
 * gate checks by hand, BEFORE the step, in its own order — so its exclusive
 * shares could not establish engine gate precedence. This version attaches a
 * ReproProbeLog through the engine's own observer seam (WorldOptions
 * reproProbe), which the engine calls at the actual reproduction decision
 * point, in engine order (cooldown -> fraction -> maturity -> damage ->
 * surplus -> sexual routing). Each run executes twice (probe off/on) with a
 * hashState comparison: any divergence is reported as perturbation, not data.
 *
 * Config-identity tripwire (unchanged): the effective config must reproduce
 * the archived viability-061 t6000 endpoints exactly (decomposerPhotoScale 0
 * closing the P0-2 leak path, grazeYieldScale 1.0). Mismatch voids the run.
 *
 * Run (compiled only): node build/trace/viabilitygates.js [ticks] [seeds...]
 * Defaults: 6000 ticks; contrast seeds 41002 (fail), 41004 + 41012 (persist).
 */
import { World } from '../world/world.js';
import { TROPHIC, TROPHIC_COUNT } from '../bio/role.js';
import { ReproProbeLog, REPRO_GATE_NAMES } from './reproprobe.js';

const TICKS = Number(process.argv[2] ?? 6000);
if (!Number.isFinite(TICKS) || TICKS <= 0) {
  throw new Error(`bad ticks: ${process.argv[2]} (want >0)`);
}
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(41002, 41004, 41012);
if (SEEDS.some((s) => !Number.isFinite(s) || s <= 0)) {
  throw new Error(`bad seeds: ${process.argv.slice(3).join(' ')} (want positive integers)`);
}

function buildWorld(seed: number, probe: ReproProbeLog | null): World {
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
      excretionRate: 0, meatYieldPerMass: 0,
    },
    reproProbe: probe ?? undefined,
  });
}

function census(w: World): [number, number, number] {
  let fp = 0, fc = 0, fd = 0;
  for (let sl = 0; sl < w.store.count; sl++) {
    if (!w.aliveAt(sl)) continue;
    const t = w.roleOf(sl).trophic;
    if (t === TROPHIC.PRODUCER) fp++;
    else if (t === TROPHIC.CONSUMER) fc++;
    else fd++;
  }
  return [fp, fc, fd];
}

console.log('VIABILITY GATE ATTRIBUTION (engine order, observed at the decision point)');
console.log('consumer guild blocked[] in REPRO_GATE order + reached-roll/fired.\n');

for (const seed of SEEDS) {
  const wOff = buildWorld(seed, null);
  for (let t = 1; t <= TICKS; t++) wOff.step();
  const digestOff = wOff.hashState();

  const log = new ReproProbeLog(TROPHIC_COUNT);
  const wOn = buildWorld(seed, log);
  for (let t = 1; t <= TICKS; t++) wOn.step();
  const digestOn = wOn.hashState();

  if (digestOff !== digestOn) {
    console.log(`seed ${seed}: PERTURBATION — probe changed the run (digests differ). Data withheld.`);
    continue;
  }
  const r = log.read(TROPHIC.CONSUMER);
  if (!r) {
    console.log(`seed ${seed}: no consumer record.`);
    continue;
  }
  const parts = REPRO_GATE_NAMES.map((n, i) => `${n}=${r.blocked[i] ?? 0}`);
  const [fp, fc, fd] = census(wOn);
  console.log(
    `seed ${seed}: nonperturbing (digest match). consumer { ${parts.join(' ')} } ` +
    `reachedRoll=${r.reachedRoll} fired=${r.fired} final P${fp}/C${fc}/D${fd}`,
  );
}
console.log('\nGate order is the engine\u2019s (cooldown, fraction, maturity, damage, surplus, sexual).');
console.log('Final census must match the archived viability-061 endpoints or the run is void (see REPORT).');
