import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { World } from '/root/EcoSim-issue5/build/world/world.js';
import { runIdentity } from '/root/EcoSim-issue5/build/world/version.js';

const directory = '/tmp/opencode/matched-18-1000-20261014';
mkdirSync(directory, { recursive: true });
const seeds = Array.from({ length: 18 }, (_, i) => 41001 + i);
const ticks = 1000;
const ledger = `${directory}/runs.jsonl`;
writeFileSync(ledger, '');
writeFileSync(`${directory}/protocol.json`, JSON.stringify({
  seeds, ticks, founders: 400,
  arms: ['legacy: chemistry=null, genomeV2=null', 'advanced: chemistry=true, genomeV2=true'],
  purpose: 'Descriptive paired comparison, no preregistered ecological verdict.',
  confound: 'Chemistry and Genome V2 change together; not a chemistry-only intervention.',
  command: 'node /tmp/opencode/matched-18-1000.mjs',
}, null, 2));

for (const seed of seeds) for (const arm of ['legacy', 'advanced']) {
  const advanced = arm === 'advanced';
  const w = new World({ config: {
    seed, founders: 400, chemistry: advanced ? true : null,
    genomeV2: advanced ? true : null, label: 'matched-18-1000',
  } });
  const initialHash = w.hashState();
  writeFileSync(`${directory}/${arm}-${seed}-config.json`, JSON.stringify(w.config, null, 2));
  const start = performance.now();
  for (let i = 0; i < ticks; i++) w.step();
  const elapsedMs = performance.now() - start;
  const counts = [0, 0, 0];
  let maxDepth = 0;
  for (let slot = 0; slot < w.store.count; slot++) if (w.aliveAt(slot)) {
    counts[w.roleOf(slot).trophic]++;
    maxDepth = Math.max(maxDepth, w.store.generationDepth[slot]);
  }
  const row = {
    seed, arm, identity: runIdentity(advanced), tick: w.tick,
    initialHash, finalHash: w.hashState(), population: w.store.population,
    guildCounts: counts, births: w.totalBirths, deaths: w.totalDeaths,
    birthsByGuildPath: w.demographics().births, maxLiveGenerationDepth: maxDepth,
    energyResidualFraction: w.accountingResidualFraction(),
    chemistry: advanced ? {
      income: w.chemistry.flux.chemEnergyIncome,
      spent: w.chemistry.flux.chemEnergySpent,
      carbonBuilt: w.chemistry.flux.chemCarbonBuilt,
      clampedTotal: w.chemistry.totalClamped(),
      elementalResiduals: w.chemAudit.residual,
    } : null,
    elapsedMs, ticksPerSecond: ticks * 1000 / elapsedMs,
  };
  appendFileSync(ledger, `${JSON.stringify(row)}\n`);
  console.log(`${arm} seed=${seed} tick=${w.tick} pop=${row.population} P/C/D=${counts.join('/')} births=${row.births}`);
}
writeFileSync(`${directory}/complete.json`, JSON.stringify({ runs: 36, seeds: 18, ticks }));
console.log(`COMPLETED: ${directory}`);
