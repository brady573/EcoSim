#!/usr/bin/env node
/**
 * Headless, dependency-free sensitivity lab for evo-sim-poc.html.
 * Reads the shipped simulation engine; does not modify the HTML or engine.
 * Node.js 20+; run `node evo-diagnostics.mjs --help`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INT_KEYS = new Set(['worldW', 'worldH', 'fieldCell', 'spatialCell', 'founders', 'abioticCycle',
  'shadeGrain', 'metapopulationPatches', 'disturbanceInterval', 'maxPopulation']);
const PROB_KEYS = new Set(['disturbanceChance', 'litterFraction', 'litterRainShare', 'bioticMineralisation',
  'excretionRate']);
const NONNEGATIVE = new Set(['lightAmplitude', 'tempAmplitude', 'nutrientDecay', 'nutrientDiffusivity',
  'detritusDiffusivity', 'detritusDecay', 'sedimentDecay', 'litterDecay', 'shadeExtinction',
  'locomotionCostScale', 'stressMutagenesis', 'meatYieldPerMass', 'immigrationWeight',
  'litterPerCell', 'litterFraction', 'litterRainShare', 'energyPerCarrion', 'basalFoodPerCell',
  'recyclingRate', 'bioticMineralisation', 'nutrientRegen', 'excretionRate', 'birthCostFactor',
  'energyPerFood', 'sedimentPerCell', 'nutrientPerCell', 'disturbanceChance', 'founders']);
const STRUCTURAL = new Set(['worldW', 'worldH', 'fieldCell', 'spatialCell', 'founders',
  'metapopulationPatches', 'shadeGrain', 'maxPopulation']);
const NULL_LEVELS = {
  reproThresholdInit: [0.45, 0.75],
  asexualRateInit: [0.1, 0.4],
  clutchSizeInit: [0.2, 0.5],
  reproActCostScale: [0.7, 1.3],
  birthTransferScale: [0.7, 1.3],
  predationYieldScale: [0.7, 1.3],
  consumerPhotoScale: [0.5, 4],
  consumerBasalScale: [0.7, 1.3],
  producerCaptureScale: [0.7, 1.3],
  decomposerFounders: [0.1, 0.25],
  decomposerDormancy: [0.05, 0.25],
  sporeDispersal: [0.5, 1],
};
const DEFAULT_SEEDS = [11, 42];
const METRICS = ['population', 'avgPopulation', 'peakPopulation', 'producers', 'consumers',
  'decomposers', 'dormant', 'births', 'deaths', 'starveDeaths', 'ageDeaths', 'damageDeaths',
  'biomass', 'nutrient', 'detritus', 'sediment', 'litter', 'meanEnergy', 'meanGeneration',
  'contestedInteractions', 'disturbances', 'accountingResidualFraction', 'capHits'];

function help() {
  process.stdout.write(`Evolution Simulation Diagnostic Lab (Node 20+, no packages)\n\n` +
`  node evo-diagnostics.mjs --list\n` +
`  node evo-diagnostics.mjs --mode balanced --target consumerPhotoScale --seeds 11,42,517 --ticks 600 --interval 100\n` +
`  node evo-diagnostics.mjs --mode balanced --all --config-only --seeds 1:10 --ticks 1500 --interval 100 --out ./diag-full\n` +
`  node evo-diagnostics.mjs --mode balanced --all --seeds 11,42,517 --ticks 1500 --interval 100 --out ./diag-full\n` +
`  node evo-diagnostics.mjs --target trait:photosyntheticRate --target body:shell --habitat-seed 1234\n` +
`  node evo-diagnostics.mjs --target habitatSeed --seeds 11,42\n\n` +
`Options:\n` +
`  --html PATH           Bundled simulation HTML (default: beside this script)\n` +
`  --mode balanced|base  Which actual POC preset to test (default: balanced)\n` +
`  --seeds CSV           Integer seeds, arbitrary string seeds, or ranges a:b; default 11,42\n` +
`  --seed-file PATH      JSON array or newline-separated world seed values\n` +
`  --habitat-seed VAL    Pin the habitat RNG to an independent seed; by default follows world seed\n` +
`  --ticks N            Total ticks per run (default: 300)\n` +
`  --interval N         Sampling interval; exact final tick always sampled (default: 100)\n` +
`  --target NAME        Repeatable: config name, trait:name, body:name, nutrientCapacity[0..2]\n` +
`  --all                Sweep all experimental config fields + 42 traits + 12 body genes\n` +
`  --factorial-core     16 combinations of the 4 balanced-mode switches, with interactions\n` +
`  --config-only        With --all, exclude genome and body-gene tests\n` +
`  --set NAME=JSON      Repeatable fixed config override (e.g. --set founders=200)\n` +
`  --out PATH           Output folder; default ./evo-diag-results\n` +
`  --list               Print all available parameters and return\n` +
`  --help               Show this text\n` +
`All sensitivity comparisons use the SAME world seed and habitat-seed policy for\n` +
`both sides of every pair. Results are computed separately per seed.\n`);
}
function parseArgs(argv) {
  const args = { html: path.join(HERE, 'evo-sim-poc.html'), mode: 'balanced', seeds: DEFAULT_SEEDS,
    ticks: 300, interval: 100, targets: [], set: {}, out: path.resolve('evo-diag-results'),
    all: false, configOnly: false, factorialCore: false, list: false, help: false, habitatSeed: undefined };
  const fields = new Set(['html', 'mode', 'seeds', 'seed-file', 'habitat-seed', 'ticks', 'interval',
    'target', 'set', 'out']);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all') { args.all = true; continue; }
    if (arg === '--config-only') { args.configOnly = true; continue; }
    if (arg === '--factorial-core') { args.factorialCore = true; continue; }
    if (arg === '--list') { args.list = true; continue; }
    if (arg === '--help' || arg === '-h') { args.help = true; continue; }
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!fields.has(name)) throw new Error(`Unknown option --${name}`);
    const val = eq === -1 ? argv[++i] : arg.slice(eq + 1);
    if (val === undefined || val.startsWith('--')) throw new Error(`Missing value for --${name}`);
    switch (name) {
      case 'html': args.html = path.resolve(val); break;
      case 'mode': args.mode = val; break;
      case 'seeds': args.seeds = parseSeeds(val); break;
      case 'seed-file': {
        const raw = fs.readFileSync(path.resolve(val), 'utf8').trim();
        const items = raw.startsWith('[') ? JSON.parse(raw) : raw.split(/\r?\n/).filter(s => s.trim() && !s.trim().startsWith('#'));
        if (!Array.isArray(items)) throw new Error('--seed-file must be a JSON array or newline-separated values');
        args.seeds = items.map(x => parseSeed(String(x)));
        break;
      }
      case 'habitat-seed': args.habitatSeed = parseSeed(val); break;
      case 'ticks': args.ticks = strictlyPositiveInt(val, 'ticks'); break;
      case 'interval': args.interval = strictlyPositiveInt(val, 'interval'); break;
      case 'target': args.targets.push(val); break;
      case 'set': {
        const j = val.indexOf('=');
        if (j < 1) throw new Error('--set needs NAME=VALUE');
        const k = val.slice(0, j); const v = val.slice(j + 1);
        try { args.set[k] = JSON.parse(v); } catch { args.set[k] = v; }
        break;
      }
      case 'out': args.out = path.resolve(val); break;
    }
  }
  if (!['balanced', 'base'].includes(args.mode)) throw new Error('--mode must be balanced or base');
  if (args.seeds.length === 0) throw new Error('At least one seed required');
  if (args.seeds.length > 10000) throw new Error('Seed list exceeds 10,000');
  return args;
}
function strictlyPositiveInt(v, label) {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${label} must be a positive safe integer`);
  return n;
}
function parseSeed(v) {
  const s = String(v).trim();
  if (!s) throw new Error('Empty seed is invalid');
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isSafeInteger(n) || n < 1 || n > 4294967295)
      throw new Error(`Integer seed ${s} must be in [1,4294967295] (avoid 32-bit aliases)`);
    return n;
  }
  return s;
}
function parseSeeds(s) {
  const result = [];
  for (const item of s.split(',')) {
    const part = item.trim();
    const m = /^(\d+):(\d+)$/.exec(part);
    if (m) {
      const a = parseSeed(m[1]); const b = parseSeed(m[2]);
      if (a > b || b - a > 9999) throw new Error(`Invalid seed range ${part}`);
      for (let k = a; k <= b; k++) result.push(k);
    } else result.push(parseSeed(part));
  }
  return [...new Set(result)];
}
function loadEngine(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const match = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/i.exec(html);
  if (!match || !match[1].includes('var SimApp = (function()'))
    throw new Error('Cannot locate shipped inline SimApp bundle');
  const sentinel = 'return __req("app/main.js");';
  if (!match[1].includes(sentinel)) throw new Error('Unsupported bundle layout; no engine modified');
  const script = match[1].replace(sentinel,
    'return {World: __req("world/world.js").World, config: __req("world/config.js"), ' +
    'genes: __req("bio/genome.js"), version: __req("world/version.js")};');
  return vm.runInNewContext(`${script}\nSimApp;`, { performance }, { filename: htmlPath, timeout: 10000 });
}
function baseConfig(engine, args) {
  const c = { founders: 400, worldW: 2400, worldH: 2400, ...args.set };
  if (args.mode === 'balanced') Object.assign(c, {
    consumerPhotoScale: 4, decomposerFounders: 0.25, decomposerDormancy: 0.05, sporeDispersal: 1,
  });
  // Explicit fixed --set wins over the preset, just as an experimental override should.
  Object.assign(c, args.set);
  if (args.habitatSeed !== undefined) c.habitatSeed = args.habitatSeed;
  return c;
}
function allTargets(engine, configOnly) {
  const keys = Object.keys(engine.config.DEFAULT_CONFIG).filter(k => k !== 'label' && k !== 'seed');
  const result = keys.flatMap(k => k === 'nutrientCapacity'
    ? ['nutrientCapacity[0]', 'nutrientCapacity[1]', 'nutrientCapacity[2]'] : [k]);
  result.push('habitatSeed');
  if (!configOnly) {
    for (const s of engine.genes.TRAITS) result.push(`trait:${s.name}`);
    for (const s of engine.genes.BODY_GENES) result.push(`body:${s.name}`);
  }
  return result;
}
function findTarget(engine, name, effectiveConfig) {
  if (name.startsWith('trait:')) {
    const s = engine.genes.TRAITS.find(x => x.name === name.slice(6));
    if (!s) throw new Error(`Unknown trait ${name}`);
    const lo = Math.max(0, s.init - 0.15), hi = Math.min(1, s.init + 0.15);
    return {name, kind: 'trait', spec: s, baseline: s.init, levels: [lo, hi].filter(x => x !== s.init), structural: false};
  }
  if (name.startsWith('body:')) {
    const s = engine.genes.BODY_GENES.find(x => x.name === name.slice(5));
    if (!s) throw new Error(`Unknown body gene ${name}`);
    return {name, kind: 'body', spec: s, baseline: s.init,
      levels: [Math.max(s.lo, s.init - 1), Math.min(s.hi, s.init + 1)].filter(x => x !== s.init), structural: false};
  }
  if (name === 'habitatSeed') return {name, kind: 'habitat', baseline: effectiveConfig.habitatSeed ?? 'follows world seed',
    levels: [127, 65521].filter(x => x !== effectiveConfig.habitatSeed), structural: false};
  const m = /^nutrientCapacity\[(\d)\]$/.exec(name);
  if (m) {
    const idx = Number(m[1]);
    if (idx > 2) throw new Error(`Unknown nutrient index ${name}`);
    const n = effectiveConfig.nutrientCapacity[idx];
    return {name, kind: 'nutrient', index: idx, baseline: n,
      levels: [n * .8, n * 1.2], structural: false};
  }
  if (!Object.hasOwn(engine.config.DEFAULT_CONFIG, name) || name === 'label' || name === 'seed')
    throw new Error(`Unknown/metadata target ${name}; use --list for choices`);
  const def = effectiveConfig[name];
  if (def === null || Object.hasOwn(NULL_LEVELS, name)) {
    const defined = NULL_LEVELS[name];
    // A null-default control the lab has no safe perturbation for is reported
    // as skipped, not fatal. Throwing here aborted an entire screen the first
    // time the engine gained a new structured diagnostic (radiation,
    // pioneerBonus, foodDisease, the interdependence pair, ...). One
    // unsweepable control must not cost the other fifty.
    if (!defined) return {name, kind: 'skip', reason: 'no safe intervention defined for null control'};
    // Structured (object-valued) defaults can never be perturbed by the
    // scalar +/-20% path below.
    if (def !== null && typeof def === 'object') return {name, kind: 'skip', reason: 'structured control'};
    if (def !== null && !Number.isFinite(def)) return {name, kind: 'skip', reason: 'non-numeric control'};
    const levels = [null, ...defined].filter(x => x !== def);
    return {name, kind: 'config', baseline: def, levels, structural: STRUCTURAL.has(name)};
  }
  if (!Number.isFinite(def)) throw new Error(`Unsupported config target type ${name}`);
  let levels;
  if (def === 0) levels = [0, name === 'basalFoodPerCell' ? 0.002 : 0.1];
  else if (INT_KEYS.has(name)) {
    const d = Math.max(1, Math.round(Math.abs(def) * 0.2));
    levels = [Math.max(name === 'metapopulationPatches' ? 0 : 1, def - d), def + d];
  } else {
    const d = Math.abs(def) * 0.2;
    levels = [def - d, def + d];
  }
  if (NONNEGATIVE.has(name)) levels = levels.map(n => Math.max(0, n));
  if (PROB_KEYS.has(name)) levels = levels.map(n => Math.min(1, Math.max(0, n)));
  if (name === 'nutrientDiffusivity' || name === 'detritusDiffusivity')
    levels = levels.map(n => Math.min(.25, Math.max(0, n)));
  return {name, kind: 'config', baseline: def, levels, structural: STRUCTURAL.has(name)};
}
function validateOverrides(engine, args) {
  for (const [k, v] of Object.entries(args.set)) {
    if (k !== 'habitatSeed' && !Object.hasOwn(engine.config.DEFAULT_CONFIG, k))
      throw new Error(`Unknown config override ${k}`);
    if (k === 'seed' || k === 'label') throw new Error(`Set seed via --seeds, not --set ${k}`);
    if (k === 'nutrientCapacity') {
      if (!Array.isArray(v) || v.length !== 3 || v.some(n => !Number.isFinite(n) || n < 0))
        throw new Error('nutrientCapacity requires an array of three nonnegative numbers');
    } else if (v !== null && (typeof v !== 'number' || !Number.isFinite(v)) && k !== 'habitatSeed')
      throw new Error(`--set ${k} needs a finite number or null`);
    if (k === 'habitatSeed') parseSeed(String(v));
  }
}
function configFor(engine, args, target, level, seed) {
  const c = baseConfig(engine, args);
  c.seed = seed;
  if (target && level !== null) {
    if (target.kind === 'config') c[target.name] = level;
    if (target.kind === 'habitat') c.habitatSeed = level;
    if (target.kind === 'multi') Object.assign(c, level);
    if (target.kind === 'nutrient') {
      const current = c.nutrientCapacity ?? engine.config.DEFAULT_CONFIG.nutrientCapacity;
      c.nutrientCapacity = Array.from(current); c.nutrientCapacity[target.index] = level;
    }
  }
  return c;
}
function guildCounts(w) {
  const counts = [0, 0, 0];
  for (let slot = 0; slot < w.store.count; slot++) {
    if (!w.aliveAt(slot)) continue;
    const g = w.roleOf(slot).trophic;
    if (g >= 0 && g <= 2) counts[g]++;
  }
  return counts;
}
function readMetrics(w) {
  const m = w.measure();
  const counts = guildCounts(w);
  const [dormant] = w.dormantCounts();
  const reasons = w.deathReasons();
  return {
    population: m.population, producers: counts[0], consumers: counts[1], decomposers: counts[2],
    dormant, births: w.totalBirths, deaths: w.totalDeaths,
    starveDeaths: reasons.starve, ageDeaths: reasons.age, damageDeaths: reasons.damage,
    biomass: m.biomass, nutrient: m.nutrient, detritus: m.detritus, sediment: m.sediment,
    litter: m.litter, meanEnergy: m.meanEnergy, meanGeneration: m.meanGeneration,
    contestedInteractions: m.contestedInteractions, disturbances: w.abiotic.history.length,
    accountingResidualFraction: w.accountingResidualFraction(), capHits: w.populationCapHits,
  };
}
function runWorld(engine, args, target, level, seed) {
  const config = configFor(engine, args, target, level, seed);
  let changedSpec;
  if (target && (target.kind === 'trait' || target.kind === 'body') && level !== null) {
    changedSpec = target.spec;
  }
  const old = changedSpec?.init;
  if (changedSpec) changedSpec.init = level;
  try {
    const t0 = performance.now();
    const w = new engine.World({config});
    let previousTick = 0;
    let previousPop = w.store.population;
    let area = 0;
    let peak = previousPop;
    let extinctionTick = previousPop === 0 ? 0 : null;
    const timeSeries = [];
    for (let t = 1; t <= args.ticks; t++) {
      w.step();
      if (t % args.interval === 0 || t === args.ticks) {
        const sample = readMetrics(w);
        area += (previousPop + sample.population) * (t - previousTick) / 2;
        peak = Math.max(peak, sample.population);
        if (extinctionTick === null && sample.population === 0) extinctionTick = t;
        previousTick = t; previousPop = sample.population;
        timeSeries.push({tick:t, ...sample});
      }
    }
    const final = timeSeries.at(-1);
    return {
      seed, habitatSeed: config.habitatSeed ?? seed, target: target?.name ?? 'baseline',
      level: level === null ? 'baseline' : level, mode: args.mode, hash0: null,
      hash: w.hashState(), elapsedMs: performance.now() - t0,
      configFingerprint: engine.config.configFingerprint(w.config),
      final: {...final, avgPopulation: area / args.ticks, peakPopulation: peak,
        extinctionTick, births: w.totalBirths, deaths: w.totalDeaths},
      timeline: timeSeries,
      diagnostics: {deathReasons: w.deathReasons(), demographics: w.demographics(),
        transitions: w.transitionMatrix(), phaseShares: w.phaseShares()},
    };
  } finally {
    if (changedSpec) changedSpec.init = old;
  }
}
function mean(v) { return v.length ? v.reduce((a,b) => a + b, 0) / v.length : null; }
function median(v) {
  if (!v.length) return null;
  const sorted = [...v].sort((a,b)=>a-b);
  const j = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[j] : (sorted[j-1] + sorted[j]) / 2;
}
function approxInterval(d) {
  if (d.length < 10) return [null,null];
  const center = mean(d);
  const variance = d.reduce((a,x) => a + (x-center)**2,0) / (d.length-1);
  const t = d.length < 20 ? 2.262 : d.length < 30 ? 2.093 : d.length < 50 ? 2.045 : d.length < 100 ? 2.01 : 1.98;
  const margin = t * Math.sqrt(variance / d.length);
  return [center-margin, center+margin];
}
function csvValue(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(filename, rows) {
  const columns = [...new Set(rows.flatMap(x => Object.keys(x)))];
  fs.writeFileSync(filename, columns.join(',') + '\n' + rows.map(r =>
    columns.map(k => csvValue(r[k])).join(',')).join('\n') + '\n');
}

function runCoreFactorial(engine, args) {
  const switches = [
    {name: 'consumerPhotoScale', on: 4},
    {name: 'decomposerFounders', on: 0.25},
    {name: 'decomposerDormancy', on: 0.05},
    {name: 'sporeDispersal', on: 1},
  ];
  fs.mkdirSync(args.out, {recursive: true});
  const fd = fs.openSync(path.join(args.out, 'runs.jsonl'), 'w');
  const bySeed = new Map();
  const flat = [];
  const start = performance.now();
  try {
    console.log(`FACTORIAL ${engine.version.WORLD_ENGINE_VERSION} | ${args.seeds.length} seeds | 16 combinations | ${args.ticks} ticks`);
    for (const seed of args.seeds) {
      const group = [];
      for (let mask = 0; mask < 16; mask++) {
        const state = Object.fromEntries(switches.map((s,i) => [s.name, (mask & (1 << i)) ? s.on : null]));
        const r = runWorld(engine, args, {name:'core-factorial',kind:'multi'}, state, seed);
        fs.writeSync(fd, JSON.stringify({...r, mask})+'\n');
        group[mask] = r;
        flat.push({seed, mask, ...Object.fromEntries(switches.map((s,i)=>[s.name,(mask & (1<<i))? 'on':'off'])),
          hash:r.hash, ...r.final});
      }
      bySeed.set(String(seed), group);
      console.log(`seed ${seed}: pop all-off=${group[0].final.population} all-on=${group[15].final.population}`);
    }
  } finally { fs.closeSync(fd); }
  // Paired contrasts are first computed within each world seed, then summarized
  // across seeds. Main effects average across the other three switches;
  // interactions are difference-in-differences averaged across the other two.
  const effects = [];
  for (let a=0; a<4; a++) {
    for (let b=-1; b<a; b++) {
      const interaction = b >= 0;
      const name = interaction ? `${switches[b].name} × ${switches[a].name}` : switches[a].name;
      for (const metric of METRICS) {
        const perSeed = [];
        for (const seed of args.seeds) {
          const group = bySeed.get(String(seed));
          const contrasts = [];
          for (let mask=0; mask<16; mask++) {
            if (mask & (1<<a)) continue;
            if (interaction && (mask & (1<<b))) continue;
            const v=(m)=>group[m].final[metric];
            if (!interaction) contrasts.push(v(mask | (1<<a)) - v(mask));
            else contrasts.push(v(mask | (1<<a) | (1<<b)) - v(mask | (1<<a)) - v(mask | (1<<b)) + v(mask));
          }
          perSeed.push(mean(contrasts));
        }
        const [ci95Low,ci95High] = approxInterval(perSeed);
        effects.push({effect:name,kind:interaction?'pairwise-interaction':'main-effect',metric,
          meanEffect:mean(perSeed),medianSeedEffect:median(perSeed),
          minSeedEffect:Math.min(...perSeed), maxSeedEffect:Math.max(...perSeed),
          ci95Low,ci95High,seeds:perSeed.length});
      }
    }
  }
  writeCsv(path.join(args.out,'factorial-effects.csv'),effects);
  writeCsv(path.join(args.out,'factorial-runs.csv'),flat);
  const manifest = {engineVersion:engine.version.WORLD_ENGINE_VERSION,sourceFile:path.resolve(args.html),
    design:'full 2^4 factorial',switches,mode:args.mode,ticks:args.ticks,interval:args.interval,
    seeds:args.seeds,habitatSeedPolicy:args.habitatSeed ?? 'follow-world-seed',
    fixedOverrides:args.set, elapsedMs:performance.now()-start,runCount:args.seeds.length*16,
    interpretation:'Main effect is average on-minus-off across all other combinations; pairwise interaction is average difference-in-differences. Each seed is paired.',
    caveats:['No independent randomness per mechanism; divergent PRNG draw counts can contribute to ecological effect.',
      'Factorial-only switch values take precedence over --set for the four tested switches.',
      '95% intervals are rough seed-sample t approximations, not evidence of mechanistic independence.']};
  fs.writeFileSync(path.join(args.out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`COMPLETE: ${args.out} | factorial-effects.csv, factorial-runs.csv, runs.jsonl, manifest.json`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { help(); return; }
  const engine = loadEngine(args.html);
  validateOverrides(engine, args);
  if (args.list) {
    console.log(`ENGINE ${engine.version.WORLD_ENGINE_VERSION} | ${Object.keys(engine.config.DEFAULT_CONFIG).length} config fields | ${engine.genes.TRAITS.length} traits | ${engine.genes.BODY_GENES.length} body genes`);
    console.log('Configuration (including seed and label metadata):');
    for (const [k, v] of Object.entries(engine.config.DEFAULT_CONFIG)) console.log(`  ${k.padEnd(27)} ${JSON.stringify(v)}`);
    console.log('Additional accepted (non-default) key: habitatSeed');
    console.log('Traits (normalized founder init):');
    for (const s of engine.genes.TRAITS) console.log(`  trait:${s.name.padEnd(26)} init=${s.init}, physical=[${s.lo},${s.hi}]`);
    console.log('Body genes (integer founder init):');
    for (const s of engine.genes.BODY_GENES) console.log(`  body:${s.name.padEnd(27)} init=${s.init}, integer=[${s.lo},${s.hi}]`);
    return;
  }
  if (args.factorialCore) { runCoreFactorial(engine, args); return; }
  const selected = args.all ? allTargets(engine, args.configOnly) : args.targets;
  if (!selected.length) throw new Error('Specify at least one --target, or --all, or --list');
  const effectiveConfig = engine.config.resolveConfig(baseConfig(engine, args));
  const resolved = [...new Set(selected)].map(n => findTarget(engine, n, effectiveConfig));
  // Controls the lab cannot perturb safely are reported and dropped rather than
  // aborting the whole screen. The first time the engine gained a structured
  // diagnostic (radiation, pioneerBonus, foodDisease, the interdependence pair)
  // this threw and cost the other fifty controls their entire run.
  const skipped = resolved.filter(t => t.kind === 'skip');
  const targets = resolved.filter(t => t.kind !== 'skip');
  if (skipped.length) {
    console.log(`SKIPPED ${skipped.length} unsweepable control(s): ${skipped.map(t => t.name).join(', ')}`);
  }
  fs.mkdirSync(args.out, {recursive:true});
  const lines = fs.openSync(path.join(args.out, 'runs.jsonl'), 'w');
  const baselines = new Map();
  const results = [];
  const start = performance.now();
  function saveRun(r) { fs.writeSync(lines, JSON.stringify(r)+'\n'); return r; }
  try {
    console.log(`ENGINE ${engine.version.WORLD_ENGINE_VERSION} | ${args.mode} | ${args.ticks} ticks | ${args.seeds.length} seeds | ${targets.length} targets`);
    for (const seed of args.seeds) {
      const b = saveRun(runWorld(engine, args, null, null, seed));
      baselines.set(String(seed), b);
      console.log(`baseline seed ${seed}: pop=${b.final.population} P/C/D=${b.final.producers}/${b.final.consumers}/${b.final.decomposers} hash=${b.hash}`);
    }
    // One repeated baseline run is a fast deterministic gate: same config+seed+ticks.
    const repeat = runWorld(engine, args, null, null, args.seeds[0]);
    if (repeat.hash !== baselines.get(String(args.seeds[0])).hash)
      throw new Error(`REPEATABILITY FAILURE: ${repeat.hash} != ${baselines.get(String(args.seeds[0])).hash}`);
    console.log('repeatability gate: PASS (identical state hash)');
    for (let k = 0; k < targets.length; k++) {
      const target = targets[k];
      const uniqueLevels = [...new Set(target.levels.map(x => JSON.stringify(x)))].map(x => JSON.parse(x));
      for (let li = 0; li < uniqueLevels.length; li++) {
        const level = uniqueLevels[li];
        const pairs = [];
        for (const seed of args.seeds) {
          const r = saveRun(runWorld(engine, args, target, level, seed));
          pairs.push({baseline: baselines.get(String(seed)), intervention: r});
        }
        const alteredSeeds = pairs.filter(x => x.baseline.hash !== x.intervention.hash).length;
        for (const metric of METRICS) {
          const d = pairs.map(x => x.intervention.final[metric] - x.baseline.final[metric]);
          const base = pairs.map(x => x.baseline.final[metric]);
          const avg = mean(base);
          const absolute = mean(d);
          const [ci95Low, ci95High] = approxInterval(d);
          results.push({target: target.name, targetKind: target.kind, structural: target.structural,
            baseValue: target.baseline, intervention: level, metric,
            baselineMean: avg, changeMean: absolute, medianSeedChange: median(d),
            ci95Low, ci95High, sameDirectionSeeds: d.filter(x => x === 0 || Math.sign(x) === Math.sign(absolute)).length,
            changePercent: avg === 0 ? null : 100 * absolute / Math.abs(avg),
            minSeedChange: Math.min(...d), maxSeedChange: Math.max(...d),
            changedStateSeeds: alteredSeeds, testedSeeds: pairs.length,
            label: alteredSeeds === 0 ? 'NO_OBSERVED_STATE_CHANGE' :
              target.structural ? 'STRUCTURAL_CONFOUNDED' : 'OBSERVED',
          });
        }
        console.log(`[${k + 1}/${targets.length}] ${target.name} = ${JSON.stringify(level)} | changed ${alteredSeeds}/${pairs.length} seeds`);
      }
    }
  } finally { fs.closeSync(lines); }
  writeCsv(path.join(args.out, 'effects.csv'), results);
  const seedSummary = args.seeds.map(seed => {
    const b = baselines.get(String(seed));
    return {seed, habitatSeed:b.habitatSeed, hash:b.hash, ...b.final};
  });
  writeCsv(path.join(args.out, 'baseline-seeds.csv'), seedSummary);
  const manifest = {
    engineVersion: engine.version.WORLD_ENGINE_VERSION,
    sourceFile: path.resolve(args.html), mode:args.mode, ticks:args.ticks,
    interval:args.interval, seeds:args.seeds, habitatSeedPolicy: args.habitatSeed ?? 'follow-world-seed',
    baseConfig:baseConfig(engine,args), targets:targets.map(t => ({name:t.name, kind:t.kind,
      baseline:t.baseline, interventions:t.levels, structural:t.structural})),
    repeatability: 'PASS for first world seed and baseline',
    elapsedMs:performance.now()-start, runCount: args.seeds.length*(1 + targets.reduce((n,t) => n + new Set(t.levels).size,0)) + 1,
    skippedTargets: skipped.map(t => ({name: t.name, reason: t.reason})),
    caveats: [
      'All comparisons use same world seed; stochastic streams can diverge when interventions change RNG draw counts.',
      'Only habitat seed can be independently set without changing the engine. Individual phenotype seeds are derived internally.',
      'AUC population is trapezoid-approximated at the requested sample interval, not tick-exact.',
      'NO_OBSERVED_STATE_CHANGE means no hash difference within this tested horizon; not proof of parameter irrelevance.',
      'STRUCTURAL_CONFOUNDED parameters change geometry, founding density, or capacity; do not interpret as isolated biological effects.',
      'Single-seed or small-seed sensitivity estimates are exploratory, not statistical confidence intervals.',
      'Approximate 95% confidence intervals are supplied only for >=10 seeds using a t-approximation and assume seeds constitute an independent representative sample; this is not proof of general ecological effects.',
      'Trait and body interventions edit founder initialization before World construction and restore it afterward; they do not modify the HTML engine on disk.',
    ],
  };
  fs.writeFileSync(path.join(args.out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`COMPLETE: ${args.out}\n  effects.csv (paired sensitivity metrics)\n  baseline-seeds.csv (seed outcomes)\n  runs.jsonl (per-run timeline/demographics/hash)\n  manifest.json (full protocol and engine version)`);
}
try { main(); } catch (e) { console.error(`ERROR: ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1; }
