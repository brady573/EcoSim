/**
 * GRAZE METER — split graze submits by outcome channel (diagnostic, Step 0).
 *
 * READ-ONLY instrument: constructs a World, steps it, reports. Never writes
 * biology. Added because 36/36 archived runs in the evaluated arm config show
 * grazeSubmit in the thousands with grazeWins=0/grazeEnergy=0, and the B/D
 * line cannot separate contest losses from zero-delta wins from abandoned
 * contests. Every non-mating contest is already recorded with (kind, outcome,
 * delta) by InteractionQueue.resolve, so this probe only tallies records.
 *
 * Config is PINNED to the evaluated arm (consumer-yield / prospective-guilds):
 * --zero + lifts producerCaptureScale:0.35, basalFoodPerCell:0.25, argvRest
 * off,4,0.25,null,null,null,0.15,null,off,off,off,0.4,null,0,null.
 * No new knobs, no argv positions to misalign: seeds and ticks only.
 * Armour rejects need no measurement: armour gene range is 0..1
 * (genome.ts), so bite = 1-armour*0.55 >= 0.45 always exceeds the 0.02 gate.
 *
 * Config-identity check: trajectories are deterministic per engine+config, so
 * the t1000/t2000 P/C/D checkpoints printed here must match the archived
 * seed files exactly (same JS runtime modulo libm last-bits; any drift is
 * reported, not hidden). If they match, the config is proven identical.
 *
 * Run (compiled only; never tsx for long horizons):
 *   node build/trace/grazemeter.js [ticks] [seed,seed,...]
 * Defaults: 2000 ticks; seeds 41001,41008,52002 (high-submit, D=0 endpoints).
 */
import { World } from '../world/world.js';
import { TROPHIC } from '../bio/role.js';
import { INTERACTION, OUTCOME } from '../bio/interactions.js';

const TICKS = Number(process.argv[2] ?? 2000);
if (!Number.isFinite(TICKS) || TICKS <= 0) {
  throw new Error(`bad ticks: ${process.argv[2]} (want >0)`);
}
const SEEDS = process.argv[3]?.includes(',')
  ? process.argv[3].split(',').map(Number)
  : process.argv.slice(3).filter((a) => /^\d+$/.test(a)).map(Number);
if (!SEEDS.length) SEEDS.push(41001, 41008, 52002);
if (SEEDS.some((s) => !Number.isFinite(s) || s <= 0)) {
  throw new Error(`bad seeds: ${process.argv.slice(3).join(' ')} (want positive integers)`);
}

function guildCounts(w: World): [number, number, number] {
  const c: [number, number, number] = [0, 0, 0];
  for (let slot = 0; slot < w.store.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    c[w.roleOf(slot).trophic]++;
  }
  return c;
}

for (const seed of SEEDS) {
  const w = new World({
    config: {
      founders: 400, worldW: 2400, worldH: 2400, seed,
      decomposerFounders: 0.25, decomposerDormancy: 0.05, sporeDispersal: 1,
      consumerBasalScale: 0.25,
      radiation: null,
      foodDisease: 0.15, pioneerBonus: null, dormantSenescence: null,
      dormantThreatBlind: null, mixotrophyCarbon: null,
      mixotrophySaturation: 0.4, nutrientCyclic: null,
      nutrientFloor: 0, reproSurplusTicks: null,
      // NOTE: the arm's positional consumerPhotoScale=4 is voided by the
      // preset spread below (effective 0); written once to keep tsc honest.
      // --zero preset + the arm's two lifts, spread last exactly as the
      // ladder probe does (positional dials cannot override the preset).
      ...{
        producerCaptureScale: 0.35,
        consumerPhotoScale: 0,
        decomposerPhotoScale: 0,
        basalFoodPerCell: 0.25,
        nutrientRegen: 0,
        excretionRate: 0,
        meatYieldPerMass: 0,
        grazeYieldScale: 0,
        plantYieldPerMass: 0,
      },
    },
  });
  console.log(`GRAZEMETER seed=${seed} ticks=${TICKS} (pinned evaluated-arm config)`);
  let abandoned = 0;
  let defenderWins = 0;
  let attackerWinsPositive = 0;
  let attackerWinsZero = 0;
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    const recs = w.interactions.peekRecords();
    const n = w.interactions.resolutionCount();
    for (let i = 0; i < n; i++) {
      const r = recs[i];
      if (r.kind !== INTERACTION.GRAZE) continue;
      if (r.outcome === OUTCOME.ABANDONED) abandoned++;
      else if (r.outcome === OUTCOME.DEFENDER_WINS) defenderWins++;
      else if (r.delta > 0) attackerWinsPositive++;
      else attackerWinsZero++;
    }
    if (t % 1000 === 0 || t === TICKS) {
      const [p, c, d] = guildCounts(w);
      let prodEnergy = 0;
      let prodN = 0;
      for (let slot = 0; slot < w.store.count; slot++) {
        if (!w.aliveAt(slot)) continue;
        if (w.roleOf(slot).trophic !== TROPHIC.PRODUCER) continue;
        prodEnergy += w.store.energy[slot];
        prodN++;
      }
      console.log(
        `  t${t} P${p}/C${c}/D${d} submits=${abandoned + defenderWins + attackerWinsPositive + attackerWinsZero}` +
        ` meanProducerEnergy=${prodN > 0 ? (prodEnergy / prodN).toFixed(2) : 'n/a'}`,
      );
    }
  }
  const total = abandoned + defenderWins + attackerWinsPositive + attackerWinsZero;
  const share = (x: number) => (total > 0 ? ((x / total) * 100).toFixed(1) : 'n/a');
  console.log(
    `GRAZE-SPLIT seed=${seed} submits=${total} abandoned=${abandoned}(${share(abandoned)})` +
    ` defenderWins=${defenderWins}(${share(defenderWins)})` +
    ` attackerWinsDelta0=${attackerWinsZero}(${share(attackerWinsZero)})` +
    ` attackerWinsDeltaPos=${attackerWinsPositive}(${share(attackerWinsPositive)})` +
    ` worldGrazeWins=${w.grazeWins} worldGrazeEnergy=${Math.round(w.grazeEnergy)}`,
  );
}
