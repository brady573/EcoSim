/** Negative evidence-layer fixtures, not additional simulation executions. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { assertExplained } from './check-cho-evidence.mjs';
import { conservationReport } from '../build/world/chemistry.js';

export function choEvidenceFixtures(root = '.') {
  const record = JSON.parse(readFileSync(`${root}/evidence/cho-attribution-20261017/control-41001-result.json`, 'utf8'));
  assertExplained(record.audit, record.attribution);
  const mutations = {
    'null-zero-output': r => { r.audit.outputs[0] = null; },
    'missing-zero-output': r => { delete r.audit.outputs[0]; },
    'string-zero-output': r => { r.audit.outputs[0] = '0'; },
    'nonfinite-output': r => { r.audit.outputs[0] = NaN; },
    'false-green-strict-flag': r => { r.audit.residual[0].ok = true; },
    'wrong-residual-number': r => { r.audit.residual[0].residual = 0; },
    'wrong-inventory': r => { r.audit.environment[0] += 1; },
    'wrong-element-label': r => { r.audit.residual[0].element = 'N'; },
    'missing-compartment': r => { delete r.audit.stores; },
    'empty-strict-reports': r => { r.audit.residual = []; },
    'null-attribution': r => { r.attribution.reactionDefect[0] = null; },
    'wrong-unexplained': r => { r.attribution.unexplained[0] = 0; },
    'invalid-tick': r => { r.audit.tick = 0.5; },
  };
  for (const [name, mutate] of Object.entries(mutations)) {
    const changed = structuredClone(record); mutate(changed);
    assert.throws(() => assertExplained(changed.audit, changed.attribution), { code: 'ERR_ASSERTION' }, name);
  }
  const coherent = structuredClone(record);
  coherent.audit.environment[0] += 1;
  const values = v => Float64Array.from({ length: 7 }, (_, e) => v[e]);
  const held = Float64Array.from({ length: 7 }, (_, e) => coherent.audit.biomass[e] + coherent.audit.stores[e] + coherent.audit.environment[e]);
  coherent.audit.residual = conservationReport(values(coherent.audit.initial), held, values(coherent.audit.inputs), values(coherent.audit.outputs));
  coherent.attribution.unexplained = coherent.audit.residual.map((r, e) => r.residual - coherent.attribution.reactionDefect[e] - coherent.attribution.clampCreation[e]);
  assert.throws(() => assertExplained(coherent.audit, coherent.attribution), /unexplained residual exceeds/,
    'coherent raw books with unbooked carbon must still fail explanatory closure');
  console.log(`C/H/O evidence negative fixtures: ${Object.keys(mutations).length + 1} missing/corrupt/false-green/unbooked records rejected; original accepted.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) choEvidenceFixtures();
