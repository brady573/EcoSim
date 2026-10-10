/**
 * Tiny smoke test. Deliberately small and fast.
 *
 * Purpose: catch gross logic errors (NaN populations, collapsed accounting,
 * immediate extinction) at a scale that finishes in well under a second, before
 * spending any time on gates or benchmarks.
 *
 * Run: pnpm smoke
 */

import { World } from './world/world.js';
import { WORLD_ENGINE_VERSION } from './world/version.js';
import { configFingerprint } from './world/config.js';

function main(): void {
  console.log(`engine ${WORLD_ENGINE_VERSION}`);
  const cfg = { founders: 200, label: 'smoke', seed: 7, worldW: 2000, worldH: 2000 };
  console.log(`config fingerprint ${configFingerprint(cfg as never)}`);

  const w = new World({ config: cfg as never });
  console.log(
    `start: pop=${w.store.population} energy=${w.ledger.biomass(w.store, (slot) => w.aliveAt(slot)).toFixed(1)} ` +
      `detritus=${w.detritus.total().toFixed(1)} nutrient=${w.nutrientTotal().toFixed(1)}`,
  );
  console.log(`start hash ${w.hashState()}`);

  const marks = [1, 5, 20, 60, 150, 300];
  let next = 0;
  for (let i = 0; i < 300; i++) {
    w.step();
    if (next < marks.length && w.tick === marks[next]) {
      next++;
      const s = w.snapshot;
      const res = w.accountingResidualFraction();
      console.log(
        `t=${String(w.tick).padStart(3)} pop=${String(s.population).padStart(5)} ` +
          `births=${String(s.births).padStart(5)} deaths=${String(s.deaths).padStart(5)} ` +
          `meanE=${s.meanEnergy.toFixed(2).padStart(7)} ` +
          `prod=${String(s.trophicProducers).padStart(4)} cons=${String(s.trophicConsumers).padStart(4)} ` +
          `apex=${String(s.trophicApex).padStart(3)} ` +
          `disturb=${s.activeDisturbances} ` +
          `resid=${(res * 100).toFixed(6)}%`,
      );
      if (!Number.isFinite(res)) {
        console.error('FAIL: accounting residual is not finite');
        process.exitCode = 1;
        return;
      }
    }
  }

  const s = w.snapshot;
  console.log(`\nfinal hash ${w.hashState()}`);
  const reasons = w.deathReasons();
  console.log(
    `deaths: damage=${reasons.damage} age=${reasons.age} starve=${reasons.starve} ` +
      `total=${w.totalDeaths}`,
  );
  console.log(`born=${w.totalBirths} died=${w.totalDeaths} pop=${s.population}`);
  console.log(
    `population identity: founders(${cfg.founders}) + births(${w.totalBirths}) - deaths(${w.totalDeaths}) = ` +
      `${cfg.founders + w.totalBirths - w.totalDeaths} (actual ${w.store.population})`,
  );
  console.log(`phenotype derivations: ${w.store.phenotypeDerivations}`);
  console.log(`peak population: ${w.peakPopulation}  cap hits: ${w.populationCapHits}`);
  console.log(`disturbances fired: ${w.disturbancesFired}`);

  const ok =
    w.store.population === cfg.founders + w.totalBirths - w.totalDeaths &&
    Number.isFinite(w.snapshot.biomass) &&
    Math.abs(w.accountingResidualFraction()) < 0.01;
  console.log(ok ? '\nSMOKE PASS' : '\nSMOKE FAIL');
  if (!ok) process.exitCode = 1;
}

main();