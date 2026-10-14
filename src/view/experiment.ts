/** Construction and read-only provenance shared by the primary UI and tests. */
import { World } from '../world/world.js';
import { runIdentity } from '../world/version.js';
import { E, ELEMENT_NAMES } from '../bio/elements.js';

export function createViewerWorld(founders: number, seed: number, chemistry: boolean, genomeV2: boolean): World {
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new Error('Seed must be an integer from 1 to 4294967295');
  }
  if (!Number.isSafeInteger(founders) || founders < 1) throw new Error('Founders must be a positive integer');
  return new World({ config: {
    founders, seed, worldW: 4000, worldH: 4000, fieldCell: 40,
    spatialCell: 44, label: 'viewer',
    chemistry: chemistry ? true : null, genomeV2: genomeV2 ? true : null,
  } });
}

export function viewerProvenance(world: World): string {
  const cfg = world.config;
  return `${runIdentity(cfg.chemistry === true)} | seed ${cfg.seed} | founders ${cfg.founders}`
    + ` | Genome V2 ${cfg.genomeV2 === true ? 'on' : 'off'} | tick ${world.tick} (open-ended)`;
}

/** Exact resolved configuration, not a preset description. No mutable refs. */
export function viewerReplayConfig(world: World): string {
  return JSON.stringify({
    identity: runIdentity(world.config.chemistry === true),
    seed: world.config.seed, tick: world.tick,
    resolvedConfig: world.config,
    replay: 'Construct World with resolvedConfig and step it tick times; exact state is same-runtime only.',
  }, null, 2);
}

export function chemistryMeasurements(world: World): ReadonlyArray<readonly [string, string]> {
  if (!world.chemistry || !world.chemAudit) return [];
  const flux = world.chemistry.flux;
  return [
    ['chemical income / growth spend', `${flux.chemEnergyIncome.toFixed(3)} / ${flux.chemEnergySpent.toFixed(3)}`],
    ['chemical C built (mol)', flux.chemCarbonBuilt.toFixed(4)],
    ['reaction executions', String(Array.from(world.chemEvidence.runs).reduce((a, b) => a + b, 0))],
    ['element residuals (%)', world.chemAudit.residual.map((r) => `${r.element} ${(r.residualFraction * 100).toFixed(4)}`).join('; ')],
    ['settlement clamp (mol, cumulative)', world.chemistry.totalClamped().toFixed(6)],
  ];
}

export function organismChemistry(world: World, slot: number): string {
  const st = world.chemStores;
  if (!st || !world.aliveAt(slot)) return '';
  const base = slot * E.COUNT;
  const vector = (data: Float64Array) => ELEMENT_NAMES
    .map((name, e) => `${name} ${data[base + e].toFixed(4)}`).join('; ');
  return `Tissue (mol): ${vector(st.biomass)} | Stores (mol): ${vector(st.stores)}`
    + ` | Expressed capability mask: 0x${st.capMask[slot].toString(16)}`;
}
