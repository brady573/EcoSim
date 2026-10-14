/**
 * FUNCTIONAL ECOLOGICAL RELIANCE PROBE — Owner handoff Task 3
 * Measures reliance using actual process/capability knockouts and rescues.
 * No quotas, no forced extinction, no invented biological services.
 *
 * Engine: ts-evo-poc/0.6.2
 * Run: node build/trace/relianceprobe.js [ticks] [seed]
 */
import { World } from '../world/world.js';
import { TROPHIC } from '../bio/role.js';

const TICKS = Number(process.argv[2] ?? 2000);
if (!Number.isFinite(TICKS) || TICKS <= 0) throw new Error(`bad ticks: ${process.argv[2]}`);
const SEED = Number(process.argv[3] ?? 517);
if (!Number.isFinite(SEED) || SEED <= 0) throw new Error(`bad seed: ${process.argv[3]}`);

const SAMPLE_EVERY = 500;

interface KnockoutConfig {
  name: string;
  overrides: Partial<{
    consumerPhotoScale: number | null;
    decomposerPhotoScale: number | null;
    producerCaptureScale: number | null;
    bioticMineralisation: number;
    excretionRate: number;
    nutrientCyclic: boolean | null;
    nutrientRegen: number;
    basalFoodPerCell: number;
    grazeYieldScale: number;
    consumerBasalScale: number | null;
    pioneerBonus: { grace: number; discount: number } | null;
    decomposerDormancy: number | null;
    mixotrophyCarbon: boolean | null;
    mixotrophySaturation: number;
  }>;
  description: string;
}

const KNOCKOUTS: KnockoutConfig[] = [
  {
    name: 'CONTROL',
    overrides: {},
    description: 'Full default config (excretion-return effective)',
  },
  {
    name: 'NO_BIOTIC_MINERALIZATION',
    overrides: { bioticMineralisation: 0 },
    description: 'Decomposers cannot return nutrient from organic matter',
  },
  {
    name: 'NO_EXCRETION_RETURNS',
    overrides: { excretionRate: 0 },
    description: 'No metabolic nutrient returns from any guild',
  },
  {
    name: 'NO_NUTRIENT_CYCLIC',
    overrides: { nutrientCyclic: false },
    description: 'Abiotic regeneration decoupled from decomposer activity',
  },
  {
    name: 'NO_ABIOTIC_REGEN',
    overrides: { nutrientRegen: 0 },
    description: 'No abiotic nutrient regeneration (weathering)',
  },
  {
    name: 'NO_BASAL_FOOD',
    overrides: { basalFoodPerCell: 0 },
    description: 'No exogenous organic input (detritus rain)',
  },
  {
    name: 'NO_DECOMPOSER_MINERALIZATION_NO_CYCLIC',
    overrides: { bioticMineralisation: 0, nutrientCyclic: false },
    description: 'Decomposers mineralize nothing; cyclic regen off (full decomposer nutrient knockout)',
  },
  {
    name: 'NO_CONSUMER_GRAZE',
    overrides: { grazeYieldScale: 0 },
    description: 'Consumers cannot gain energy from grazing',
  },
  {
    name: 'NO_PRODUCER_CAPTURE',
    overrides: { producerCaptureScale: 0 },
    description: 'Producers cannot photosynthesize (zero capture)',
  },
  {
    name: 'CHEAP_CONSUMER_UPKEEP',
    overrides: { consumerBasalScale: 0.1 },
    description: 'Consumer upkeep reduced 10x (rescue for graze knockout)',
  },
  {
    name: 'FULL_NUTRIENT_KNOCKOUT',
    overrides: { bioticMineralisation: 0, excretionRate: 0, nutrientCyclic: false, nutrientRegen: 0, basalFoodPerCell: 0 },
    description: 'All nutrient return pathways disabled',
  },
  {
    name: 'FULL_NUTRIENT_KNOCKOUT_RESCUE_REGEN',
    overrides: { bioticMineralisation: 0, excretionRate: 0, nutrientCyclic: false, basalFoodPerCell: 0, nutrientRegen: 0.01 },
    description: 'All biotic nutrient paths off; high abiotic regen rescue',
  },
];

function buildWorld(seed: number, overrides: KnockoutConfig['overrides']): World {
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
      bioticMineralisation: 0.45,
      ...overrides,
    },
  });
}

function countGuilds(w: World): { P: number; C: number; D: number } {
  let p = 0, c = 0, d = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i)) continue;
    const g = w.roleOf(i).trophic;
    if (g === TROPHIC.PRODUCER) p++;
    else if (g === TROPHIC.CONSUMER) c++;
    else if (g === TROPHIC.DECOMPOSER) d++;
  }
  return { P: p, C: c, D: d };
}

function guildEnergy(w: World): { P: number; C: number; D: number } {
  let p = 0, c = 0, d = 0;
  for (let i = 0; i < w.store.count; i++) {
    if (!w.aliveAt(i)) continue;
    const g = w.roleOf(i).trophic;
    const e = w.store.energy[i];
    if (g === TROPHIC.PRODUCER) p += e;
    else if (g === TROPHIC.CONSUMER) c += e;
    else if (g === TROPHIC.DECOMPOSER) d += e;
  }
  return { P: p, C: c, D: d };
}

function nutrientTotals(w: World): number[] {
  return w.nutrients.map(n => n.data.reduce((a,b)=>a+b,0));
}

function organicTotals(w: World): { det: number; sed: number; lit: number } {
  return {
    det: w.detritus.data.reduce((a,b)=>a+b,0),
    sed: w.sediment.data.reduce((a,b)=>a+b,0),
    lit: w.litter.data.reduce((a,b)=>a+b,0),
  };
}

console.log(`FUNCTIONAL RELIANCE PROBE seed=${SEED} ticks=${TICKS}`);
console.log(`================================================================================`);
console.log('');

for (const ko of KNOCKOUTS) {
  console.log(`>>> KNOCKOUT: ${ko.name}`);
  console.log(`    ${ko.description}`);
  console.log(`    Overrides: ${JSON.stringify(ko.overrides)}`);
  
  const w = buildWorld(SEED, ko.overrides);
  
  let extinct = { P: false, C: false, D: false };
  let extinctTick = { P: -1, C: -1, D: -1 };
  let trajectory: Array<{ t: number; P: number; C: number; D: number; energy: { P: number; C: number; D: number }; nuts: number[]; org: { det: number; sed: number; lit: number } }> = [];
  
  for (let t = 1; t <= TICKS; t++) {
    w.step();
    
    if (t % SAMPLE_EVERY === 0 || t === TICKS) {
      const counts = countGuilds(w);
      const energy = guildEnergy(w);
      const nuts = nutrientTotals(w);
      const org = organicTotals(w);
      
      trajectory.push({ t, ...counts, energy, nuts, org });
      
      // Check extinction
      if (counts.P === 0 && !extinct.P) { extinct.P = true; extinctTick.P = t; }
      if (counts.C === 0 && !extinct.C) { extinct.C = true; extinctTick.C = t; }
      if (counts.D === 0 && !extinct.D) { extinct.D = true; extinctTick.D = t; }
    }
  }
  
  // Report
  const final = trajectory[trajectory.length - 1];
  console.log(`    Final t=${TICKS}: P=${final.P} C=${final.C} D=${final.D} | energy P=${final.energy.P.toFixed(0)} C=${final.energy.C.toFixed(0)} D=${final.energy.D.toFixed(0)}`);
  console.log(`    Nutrients: [${final.nuts.map(n=>n.toFixed(1)).join(', ')}]`);
  console.log(`    Organic: det=${final.org.det.toFixed(1)} sed=${final.org.sed.toFixed(1)} lit=${final.org.lit.toFixed(1)}`);
  
  if (extinct.P || extinct.C || extinct.D) {
    console.log(`    EXTINCTIONS: ${extinct.P ? `P@${extinctTick.P}` : ''} ${extinct.C ? `C@${extinctTick.C}` : ''} ${extinct.D ? `D@${extinctTick.D}` : ''}`);
  } else {
    console.log(`    ALL GUILDS PERSIST`);
  }
  
  // Trajectory summary
  console.log(`    Trajectory (t=0,500,1000,1500,2000):`);
  for (const pt of trajectory) {
    console.log(`      t${pt.t}: P=${pt.P} C=${pt.C} D=${pt.D} | nuts=[${pt.nuts.map(n=>n.toFixed(0)).join(',')}] org=[${pt.org.det.toFixed(0)},${pt.org.sed.toFixed(0)},${pt.org.lit.toFixed(0)}]`);
  }
  console.log('');
}

console.log('================================================================================');
console.log('SUMMARY TABLE:');
console.log('Knockout                          | P_final  C_final  D_final  | Extinctions');
console.log('----------------------------------|----------|----------|----------|------------');
for (const ko of KNOCKOUTS) {
  const w = buildWorld(SEED, ko.overrides);
  for (let t = 1; t <= TICKS; t++) w.step();
  const counts = countGuilds(w);
  let ext = '';
  if (counts.P === 0) ext += 'P ';
  if (counts.C === 0) ext += 'C ';
  if (counts.D === 0) ext += 'D ';
  console.log(`${ko.name.padEnd(34)} | ${String(counts.P).padStart(6)}  ${String(counts.C).padStart(6)}  ${String(counts.D).padStart(6)}  | ${ext || 'none'}`);
}