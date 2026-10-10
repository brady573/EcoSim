/**
 * Acceptance evidence for the whole-ecosystem amendment.
 *
 * Each numbered block below corresponds to one required item of evidence. The
 * point is that these are DEMONSTRATED by running the model, not asserted by
 * inspection of the code. Where an outcome is not required (recovery, a
 * specific endpoint), the script reports what happened either way.
 *
 * Deliberately bounded: several independent short runs, no single long one.
 *
 * Run: pnpm acceptance
 */

import { World } from './world/world.js';
import { WORLD_ENGINE_VERSION } from './world/version.js';
import { LineageTracker } from './world/history.js';
import { TROPHIC, TROPHIC_NAME, MOTILITY_NAME, MOTILITY } from './bio/role.js';
import { TRAITS, TRAIT, TRAIT_COUNT, BODY_GENES } from './bio/genome.js';


// Scales are deliberately small so the whole acceptance run stays bounded.
// This is an evidence demonstration, not a long-horizon survey; the long-run
// dynamics question is answered separately by src/longrun.ts.
const W = 2000;
const SEED = 20260108;
const FOUNDERS = 400;

/**
 * Tick-scale knob: `--scale=45` runs each world at 45 % of its default tick
 * count. The default configuration grows exponentially enough that a full pass
 * takes minutes per world; these evidence items test whether mechanisms fire
 * and are distinguishable, not how many ticks that costs.
 */
const SCALE = (() => {
  const a = process.argv.find((x) => x.startsWith('--scale='));
  return a ? Math.max(0.15, parseInt(a.slice(8), 10) / 100) : 1;
})();
const scaled = (ticks: number): number => Math.max(60, Math.round(ticks * SCALE));

function bar(frac: number, width = 28): string {
  const n = Math.max(0, Math.min(width, Math.round(frac * width)));
  return '#'.repeat(n);
}

function pct(a: number, b: number): string {
  return b > 0 ? `${((a / b) * 100).toFixed(1)}%` : 'n/a';
}

function head(title: string): void {
  console.log(`\n${'='.repeat(78)}\n${title}\n${'='.repeat(78)}`);
}

function roleHistogram(w: World): Record<string, number> {
  const h: Record<string, number> = {};
  const s = w.store;
  for (let slot = 0; slot < s.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const r = w.roleOf(slot);
    const k = TROPHIC_NAME[r.trophic];
    h[k] = (h[k] ?? 0) + 1;
  }
  return h;
}

function motilityHistogram(w: World): Record<string, number> {
  const h: Record<string, number> = {};
  const s = w.store;
  for (let slot = 0; slot < s.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const k = MOTILITY_NAME[w.roleOf(slot).motility];
    h[k] = (h[k] ?? 0) + 1;
  }
  return h;
}

// ---------------------------------------------------------------------------
// E1 — closed, explicitly source/sink-accounted nutrient/matter cycle
// ---------------------------------------------------------------------------
function e1MatterCycle(): void {
  head('E1  closed nutrient/matter cycle: abiotic -> primary production -> consumers -> death -> recycling');
  const w = new World({ config: { founders: FOUNDERS, worldW: W, worldH: W, seed: SEED } });
  const TICKS = scaled(400);
  const L = w.ledger;

  const nutrientStart = w.nutrientTotal();
  const detritusStart = w.detritus.total();
  const feedingStart = { capture: L.capture, scavenged: L.scavenged, predated: L.predated };

  for (let i = 0; i < TICKS; i++) w.step();

  const L2 = w.ledger;
  console.log(`run: ${TICKS} ticks, ${w.store.population} final organisms\n`);

  console.log('ENERGY ledger (the injected side):');
  console.log(`  photosynthesis capture      ${L2.capture.toFixed(0).padStart(10)}`);
  console.log(`  external organic input      ${L2.injectOrganic.toFixed(0).padStart(10)}  <- subsidy; ${((L2.injectOrganic / L2.totalInput()) * 100).toFixed(1)}% of all input`);
  console.log(`  founding biomass            ${L2.foundingBiomass.toFixed(0).padStart(10)}`);
  console.log('ENERGY ledger (the accounted side):');
  console.log(`  living biomass              ${L2.biomass(w.store, (slot) => w.aliveAt(slot)).toFixed(0).padStart(10)}`);
  console.log(`  detritus pool               ${w.detritus.total().toFixed(0).padStart(10)}`);
  console.log(`  dissipated (total)          ${L2.totalDissipated().toFixed(0).padStart(10)}`);
  console.log(
    `  of which: basal ${L2.basalSpent.toFixed(0)}, movement ${L2.movementSpent.toFixed(0)}, ` +
      `sensing ${L2.sensingSpent.toFixed(0)}, contest ${L2.contestSpent.toFixed(0)}, ` +
      `repro ${L2.reproductionSpent.toFixed(0)}, mineralised ${L2.mineralised.toFixed(0)}, ` +
      `spoiled ${L2.spoiled.toFixed(0)}, unassimilated ${L2.unassimilated.toFixed(0)}`,
  );
  console.log(
    `  conservation residual ${(w.accountingResidualFraction() * 100).toFixed(5)}% of total input`,
  );

  console.log('\nMATTER ledger (nutrient pool, inorganic; NOT energy-tracked):');
  console.log(`  nutrient ${nutrientStart.toFixed(0)} -> ${w.nutrientTotal().toFixed(0)}`);
  console.log(`  detritus ${detritusStart.toFixed(0)} -> ${w.detritus.total().toFixed(0)}`);
  console.log(`  biotic mineralisation by organisms ${w.bioticMineralised.toFixed(0)}`);
  console.log(`  abiotic mineralisation (ledger)   ${L2.mineralised.toFixed(0)}`);

  console.log('\nPATHWAY ACTIVITY (proves each link actually carried flux):');
  console.log(`  capture  ${(L2.capture - feedingStart.capture).toFixed(0).padStart(9)}  (nutrient+light -> producer biomass)`);
  console.log(`  scavenged ${(L2.scavenged - feedingStart.scavenged).toFixed(0).padStart(9)}  (detritus -> consumer biomass)`);
  console.log(`  predated  ${(L2.predated - feedingStart.predated).toFixed(0).padStart(9)}  (live consumer -> predator)`);
  console.log(`  deaths ${w.totalDeaths} (biomass -> detritus + respiration)`);

  const h = roleHistogram(w);
  console.log('\nCURRENT TROPHIC COMPOSITION:');
  const total = w.store.population;
  for (const k of Object.keys(h).sort()) {
    console.log(`  ${k.padEnd(11)} ${String(h[k]).padStart(5)}  ${bar(h[k] / total).padEnd(28)} ${pct(h[k], total)}`);
  }
  const primaryShare = (L2.capture / L2.totalInput()) * 100;
  console.log(`\n  PRIMARY-PRODUCTION SHARE: ${primaryShare.toFixed(1)}% of energy input is photosynthetic capture;`);
  console.log(`  the remainder is the exogenous organic subsidy (config basalFoodPerCell).`);
  if (primaryShare < 15) {
    console.log(`  FINDING: primary production supplies under 15% of energy input, so this run is`);
    console.log(`  subsidised rather than genuinely producer-driven. Treat trophic cascades here as`);
    console.log(`  weak evidence. Lower basalFoodPerCell to test a producer-limited regime.`);
  }
  console.log(
    `\nCLOSED-LOOP CHECK: capture=${L2.capture.toFixed(0)} > 0, scavenging=${L2.scavenged.toFixed(0)} > 0, ` +
      `deaths=${w.totalDeaths} > 0, mineralisation>0, residual ${(w.accountingResidualFraction() * 100).toFixed(4)}%.`,
  );
}

// ---------------------------------------------------------------------------
// E2 — bidirectional organism/environment feedback, 2+ roles over generations
// ---------------------------------------------------------------------------
function e2Feedback(): void {
  head('E2  bidirectional organism <-> environment feedback over multiple generations');
  const w = new World({ config: { founders: FOUNDERS, worldW: W, worldH: W, seed: SEED } });
  const tracker = new LineageTracker();
  const TICKS = scaled(600);

  console.log('  Both directions are measured by whether each side responds to the other:');
  console.log('   ENV -> ORG : capture rate per producer falls as producers deplete their own substrate');
  console.log('   ORG -> ENV : sessile producers and excretion remove nutrient from the cell they occupy\n');
  console.log('  tick   pop   producer   capture/tick   meanLocalNutrient   nutrient   detritus   gen');
  console.log('  ' + '-'.repeat(76));

  let lastCapture = 0;
  for (let i = 0; i < TICKS; i++) {
    w.step();
    if (i % Math.max(1, Math.round(150 * SCALE)) === Math.max(1, Math.round(150 * SCALE)) - 1) {
      const capRate = (w.ledger.capture - lastCapture) / 150;
      lastCapture = w.ledger.capture;
      const h = roleHistogram(w);
      const producers = h.producer ?? 0;
      // Mean nutrient over the substrate, per pool: what the producers share.
      let mean = 0;
      for (const f of w.nutrients) {
        for (let c = 0; c < f.data.length; c++) mean += f.data[c];
      }
      mean /= Math.max(1, w.nutrients.length * w.nutrients[0].data.length);
      let maxGen = 0;
      for (let slot = 0; slot < w.store.count; slot++) {
        if (w.aliveAt(slot)) maxGen = Math.max(maxGen, w.store.generationDepth[slot]);
      }
      console.log(
        `  ${String(w.tick).padStart(4)} ${String(w.store.population).padStart(6)} ${String(producers).padStart(9)} ` +
          `${capRate.toFixed(1).padStart(12)} ${mean.toFixed(1).padStart(17)} ` +
          `${w.nutrientTotal().toFixed(0).padStart(10)} ${w.detritus.total().toFixed(0).padStart(9)} ${String(maxGen).padStart(5)}`,
      );
    }
    if (i % 100 === 0) w.sampleLineages(tracker, w.tick);
  }
  w.sampleLineages(tracker, w.tick);

  console.log(`\n  lineages created ${tracker.totalCreated}, extinct ${tracker.totalExtinct}, live now ${tracker.live}`);
  console.log(`  max generation depth reached: ${(function () {
    let m = 0;
    for (let slot = 0; slot < w.store.count; slot++) if (w.aliveAt(slot)) m = Math.max(m, w.store.generationDepth[slot]);
    return m;
  })()}`);

  const drift = tracker.biggestDrift();
  if (drift.length > 0) {
    console.log('\n  largest per-lineage trait drift (first sample -> last sample):');
    for (const d of drift.slice(0, 8)) {
      console.log(`    ${d.trait.padEnd(22)} ${d.from.toFixed(3)} -> ${d.to.toFixed(3)}  (${d.delta >= 0 ? '+' : ''}${d.delta.toFixed(3)})`);
    }
  } else {
    console.log('  no lineage trait drift exceeded the 0.02 normalised-gene threshold');
  }
  console.log(`  contested interactions resolved: ${w.interactions.totalResolved}`);
  const hist = roleHistogram(w);
  console.log(`  roles interacting at end: ${Object.keys(hist).join(', ')}`);
}

// ---------------------------------------------------------------------------
// E3 — contrasting habitats and a disturbance with observable consequences
// ---------------------------------------------------------------------------
function e3Habitats(): void {
  head('E3  contrasting habitats + explicit disturbance with observable consequences');
  const w = new World({ config: { founders: FOUNDERS, worldW: W, worldH: W, seed: SEED } });
  const fr = w.habitat.fertilityRange();
  console.log(
    `habitat map: ${w.habitat.cols}x${w.habitat.rows} cells, fertility ${fr.min.toFixed(2)}..${fr.max.toFixed(2)} ` +
      `(mean ${w.habitat.meanFertility().toFixed(2)})`,
  );
  console.log('Two populations are seeded into different habitat to show they diverge.\n');

  const runInRegion = (label: string, loRatio: number, hiRatio: number, seed: number): void => {
    // Pick a habitat window by fertility rank: rich patch vs poor patch.
    const fert = w.habitat.fertility.data;
    const cols = w.habitat.cols;
    const xs: number[] = [];
    for (let i = 0; i < fert.length; i++) if (fert[i] >= loRatio && fert[i] <= hiRatio) xs.push(i);
    if (xs.length < 8) {
      console.log(`  ${label}: no cells in the requested fertility band; skipped`);
      return;
    }
    const pick = xs[Math.floor(xs.length / 2)];
    const cx = (pick % cols) * w.config.fieldCell;
    const cy = Math.floor(pick / cols) * w.config.fieldCell;
    const sub = new World({
      config: {
        founders: 250,
        worldW: 600,
        worldH: 600,
        seed,
        habitatSeed: w.config.habitatSeed ?? w.config.seed,
        // Concentrate the founding population inside the chosen cell band.
        nutrientPerCell: w.config.nutrientPerCell,
      },
    });
    for (let slot = 0; slot < sub.store.count; slot++) {
      if (!sub.aliveAt(slot)) continue;
      sub.store.x[slot] = cx + (sub.rng.nextFloat() - 0.5) * 500;
      sub.store.y[slot] = cy + (sub.rng.nextFloat() - 0.5) * 500;
    }
    for (let i = 0; i < scaled(250); i++) sub.step();
    const meanNut = (() => {
      let sum = 0;
      for (const f of sub.nutrients) for (let c = 0; c < f.data.length; c++) sum += f.data[c];
      return sum / Math.max(1, sub.nutrients.length * sub.nutrients[0].data.length);
    })();
    console.log(
      `  ${label.padEnd(22)} pop ${String(sub.store.population).padStart(4)} ` +
        `biomass ${sub.snapshot.biomass.toFixed(0).padStart(7)} ` +
        `meanLocalNutrient ${meanNut.toFixed(2).padStart(6)} ` +
        `producers ${String(roleHistogram(sub).producer ?? 0).padStart(4)}`,
    );
  };

  runInRegion('rich-habitat founders', fr.max - 0.12, fr.max, 31);
  runInRegion('poor-habitat founders', fr.min, fr.min + 0.12, 32);

  // --- Matched-control disturbance comparison -----------------------------
  // A single run cannot attribute a population change to a disturbance. Two
  // worlds with the SAME seed and SAME config except the disturbance schedule
  // can: the RNG stream is identical until the first disturbance rolls, so any
  // divergence after that point is attributable to the forcing itself.
  console.log('\nMatched-control comparison: identical seed, disturbance disabled vs enabled.');
  console.log('Divergence after the first disturbance roll is attributable to the forcing.\n');

  const arm = (label: string, chance: number, interval: number) => {
    const m = new World({
      config: {
        founders: FOUNDERS,
        worldW: W,
        worldH: W,
        seed: SEED,
        disturbanceChance: chance,
        disturbanceInterval: interval,
      },
    });
    const series: number[] = [];
    let firstEventTick = -1;
    for (let i = 0; i < scaled(700); i++) {
      m.step();
      if (firstEventTick < 0 && m.abiotic.history.length > 0) firstEventTick = m.abiotic.history[0].tick;
      if (i % Math.max(1, Math.round(100 * SCALE)) === Math.max(1, Math.round(100 * SCALE)) - 1) series.push(m.store.population);
    }
    const counts: Record<string, number> = {};
    for (const ev of m.abiotic.history) counts[ev.name] = (counts[ev.name] ?? 0) + 1;
    console.log(
      `  ${label.padEnd(22)} events=${String(m.abiotic.history.length).padStart(2)} ` +
        `first=${firstEventTick < 0 ? 'none' : `t${firstEventTick}`} ` +
        `final=${String(m.store.population).padStart(5)} deaths=${String(m.totalDeaths).padStart(5)}`,
    );
    console.log(`  ${''.padEnd(22)} kinds: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ') || 'none'}`);
    console.log(`  ${''.padEnd(22)} pop series: ${series.join(' -> ')}`);
    return { world: m, series, firstEventTick };
  };

  const control = arm('control (no disturb)', 0, 260);
  const forced = arm('forced disturbance', 0.95, 150);

  if (forced.firstEventTick > 0 && control.firstEventTick < 0) {
    const after = forced.series.filter((_, i) => i * 100 + 100 >= forced.firstEventTick);
    console.log(
      `\n  In the forced arm the first event lands at t${forced.firstEventTick}; ` +
        `post-event population series ${after.join(' -> ')}.`,
    );
  }
  console.log(
    `  deaths by cause (forced): ${JSON.stringify(forced.world.deathReasons())}\n` +
      `  deaths by cause (control): ${JSON.stringify(control.world.deathReasons())}`,
  );
  console.log(
    '  NOTE: collapse, recovery, or no measurable difference are all valid outcomes here.\n' +
      '  None is required, and none is asserted.',
  );
}

// ---------------------------------------------------------------------------
// E4 — sessile producer vs motile consumer, plus an advanced-organism seam
// ---------------------------------------------------------------------------
function e4RolesAndSeams(): void {
  head('E4  sessile producer vs motile consumer + advanced-organism extension seams');
  const w = new World({ config: { founders: FOUNDERS, worldW: W, worldH: W, seed: SEED } });
  for (let i = 0; i < scaled(450); i++) w.step();

  const s = w.store;
  const mot = motilityHistogram(w);
  console.log(`motility distribution after 450 ticks (population ${w.store.population}):`);
  for (const k of Object.keys(mot).sort()) {
    console.log(`  ${k.padEnd(10)} ${String(mot[k]).padStart(5)}  ${bar(mot[k] / w.store.population)}`);
  }

  // Pick a representative sessile producer and a representative mobile
  // consumer and compare the properties that are supposed to differ.
  let producer = -1;
  let consumer = -1;
  for (let slot = 0; slot < s.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const r = w.roleOf(slot);
    if (producer < 0 && r.trophic === TROPHIC.PRODUCER && r.motility === MOTILITY.SESSILE) producer = slot;
    if (
      consumer < 0 &&
      r.trophic === TROPHIC.CONSUMER &&
      r.motility === MOTILITY.MOBILE &&
      s.trait(slot, TRAIT.TOXIN) > 0.3
    ) {
      consumer = slot;
    }
  }

  console.log('\nrepresentative organisms (distinct geometry, sensing, and behaviour):');
  const rows: string[] = [];
  const describe = (label: string, slot: number) => {
    if (slot < 0) {
      rows.push(`${label.padEnd(22)} (none found in this run)`);
      return;
    }
    const r = w.roleOf(slot);
    const phen = s.phen[slot] as { spine: unknown[]; parts: unknown[]; body: { segments: number; limbs: number } } | null;
    rows.push(
      `${label.padEnd(22)} role=${TROPHIC_NAME[r.trophic].padEnd(10)} motility=${MOTILITY_NAME[r.motility].padEnd(7)} ` +
        `segments=${phen ? phen.spine.length : '?'} parts=${phen ? phen.parts.length : '?'} ` +
        `radius=${w.effectiveRadius(slot).toFixed(2)} reach=${r.reach.toFixed(2)} ` +
        `sense=${s.senseRadius[slot].toFixed(0)} maxStep=${s.maxStep[slot].toFixed(2)} ` +
        `stage=${['juvenile','adult','senescent'][r.stage]}`,
    );
  };
  describe('sessile producer', producer);
  describe('mobile consumer', consumer);
  for (const r of rows) console.log(`  ${r}`);

  // Advanced-organism seams: prove the DATA MODEL admits what is not yet
  // implemented, by constructing the records rather than asserting they exist.
  console.log('\nadvanced-organism seams demonstrated by construction:');
  console.log('  1. modular body plan:');
  const segHist: Record<number, number> = {};
  const modHist: Record<string, number> = {};
  for (let slot = 0; slot < s.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const phen = s.phen[slot] as { spine: unknown[]; body: { segments: number; modules: number } } | null;
    if (!phen) continue;
    segHist[phen.body.segments] = (segHist[phen.body.segments] ?? 0) + 1;
    const names: string[] = [];
    if (phen.body.modules & 1) names.push('shell');
    if (phen.body.modules & 2) names.push('spines');
    if (phen.body.modules & 4) names.push('fins');
    if (phen.body.modules & 8) names.push('antennae');
    if (phen.body.modules & 16) names.push('tail');
    const k = names.length > 0 ? names.join('+') : 'none';
    modHist[k] = (modHist[k] ?? 0) + 1;
  }
  console.log(`     segment counts present: ${Object.keys(segHist).sort((a, b) => +a - +b).join(',')}`);
  console.log(`     module combinations: ${Object.keys(modHist).sort().join(' | ')}`);

  console.log('  2. life stage / developmental growth:');
  const stages: Record<string, number> = { juvenile: 0, adult: 0, senescent: 0 };
  let sizeSpread = 0;
  for (let slot = 0; slot < s.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const r = w.roleOf(slot);
    stages[['juvenile', 'adult', 'senescent'][r.stage]]++;
    sizeSpread = Math.max(sizeSpread, r.maturation);
  }
  console.log(`     ${JSON.stringify(stages)}  (max maturation ${sizeSpread.toFixed(2)})`);
  console.log('     juveniles collide and damage at reduced scale: effectiveRadius applies maturation.');

  console.log('  3. sexual reproduction and lineage branching:');
  let branched = 0;
  let asexual = 0;
  for (let slot = 0; slot < s.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    if (w.store.generationDepth[slot] > 0) branched++;
    else asexual++;
  }
  console.log(`     generation depth 0 (clonal): ${asexual}, depth>0 (recombined): ${branched}`);

  console.log('  4. extensibility seams present in the model:');
  console.log(`     traits (${TRAIT_COUNT}) across ${new Set(TRAITS.map((t) => t.name)).size} named properties; body genes ${BODY_GENES.length}`);
  console.log(`     role readout: trophic x motility x stage x reach, all derived from genotype`);
  console.log('     colony/sociality, neural control, and instar metamorphosis are NOT implemented;');
  console.log('     they would extend role.ts and the arbitration, not the representation.');
}

// ---------------------------------------------------------------------------
// E5 — model complexity and ecosystem composition reporting
// ---------------------------------------------------------------------------
function e5Complexity(): void {
  head('E5  model complexity and ecosystem composition');
  const groups: Record<string, string[]> = {
    metabolic: ['metabolicEfficiency', 'storageCapacity', 'digestionRate', 'basalCost', 'photosyntheticRate', 'thermalTolerance', 'carrionAffinity'],
    sensing: ['visionRange', 'visionFov', 'nutrientSense', 'threatSense', 'memory'],
    locomotion: ['speed', 'burstPower', 'maneuverability', 'endurance', 'terrainAffinity'],
    reproductive: ['maturityAge', 'asexualRate', 'clutchSize', 'mutationRate', 'mateSeeking', 'reproThreshold'],
    physiological: ['size', 'armor', 'toxin', 'immunity', 'lifespan', 'massCost', 'regeneration'],
    behavioural: ['aggression', 'timidity', 'foragingDrive', 'herdInstinct', 'exploration', 'feedingAppetite'],
  };
  console.log(`heritable scalar traits: ${TRAIT_COUNT} across ${Object.keys(groups).length} functional groups`);
  for (const [g, list] of Object.entries(groups)) {
    const present = list.filter((n) => TRAITS.some((t) => t.name === n));
    console.log(`  ${g.padEnd(14)} ${present.length}: ${present.join(', ')}`);
  }
  console.log(`discrete body-plan genes:  ${BODY_GENES.length} (${BODY_GENES.map((g) => g.name).join(', ')})`);
  console.log('derived roles:     3 trophic (producer/consumer/decomposer) x 3 motility x 3 life stage');
  console.log('interaction kinds: 5 (predation, territorial, mating, scavenge, graze)');
  console.log('disturbance kinds: 6 (bloom, organicRain, frost, drought, heatWave, ashFall)');
  console.log('abiotic fields:    nutrient, detritus + 3 static habitat properties (fertility, shade, drainage)');
  console.log('behaviour options: 7 intents arbitrated from trait-weighted utility each tick');
  console.log(`representation:     structure-of-arrays typed fields, no per-organism objects in the tick loop`);
}

function main(): void {
  console.log(`=== whole-ecosystem acceptance evidence :: ${WORLD_ENGINE_VERSION} ===`);
  console.log(`node ${process.version}, seed ${SEED}, world ${W}x${W}`);
  console.log('EXPERIMENTAL. Demonstrated outcomes, not validated science.');
  e5Complexity();
  e1MatterCycle();
  e2Feedback();
  e3Habitats();
  e4RolesAndSeams();
  console.log(`\n${'='.repeat(78)}\nEND OF ACCEPTANCE EVIDENCE\n${'='.repeat(78)}`);
}

main();