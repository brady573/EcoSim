import { createHash } from 'node:crypto';

/** Exact bytes of all own engine data, including RNG and module buffers.
 * Excludes only the trace and measured wall-clock timings. Diagnostic only:
 * this does not replace the versioned run hash or redefine historical evidence.
 */
export function boundaryStateDigest(world, ignoredConfigKeys = []) {
  const h = createHash('sha256');
  const seen = new Map();
  const excluded = new Set(['boundaryLog', 'traceLog', 'repro', 'traceIdLineage',
    'timings', 'totals', 'phenotypeMs', 'lineageMs']);
  function visit(value, root = false, config = false) {
    if (value === null || typeof value !== 'object') {
      h.update(`${typeof value}:${String(value)};`); return;
    }
    if (seen.has(value)) { h.update(`ref:${seen.get(value)};`); return; }
    seen.set(value, seen.size);
    h.update(`${value.constructor.name};`);
    if (ArrayBuffer.isView(value)) {
      h.update(`bytes:${value.byteLength};`);
      h.update(Buffer.from(value.buffer, value.byteOffset, value.byteLength)); return;
    }
    if (value instanceof ArrayBuffer) { h.update(`bytes:${value.byteLength};`); h.update(Buffer.from(value)); return; }
    if (value instanceof Map || value instanceof Set) {
      h.update(`size:${value.size};`);
      for (const item of value) visit(item);
      h.update('end;');
      return;
    }
    for (const key of Object.keys(value).sort()) {
      if (root && excluded.has(key)) continue;
      if (config && ignoredConfigKeys.includes(key)) continue;
      h.update(`${key.length}:${key};`); visit(value[key], false, root && (key === 'config' || key === 'chemCfg'));
    }
    h.update('end;');
  }
  visit(world, true);
  return h.digest('hex');
}
