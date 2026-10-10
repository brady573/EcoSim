/**
 * MINI-BUNDLER — concatenate tsc CommonJS output into one browser IIFE.
 *
 * Why this exists: TS 7 removed AMD/UMD/outFile; no bundler is installed and
 * none can be installed offline. Browsers block ES modules from file://
 * (CORS). So: tsc emits per-file CommonJS under build/app/, and this script
 * topologically orders them by require() edges and wraps each in a require
 * shim inside one IIFE. No eval, no network, deterministic output.
 *
 * Run: node scripts/bundle-app.mjs  (from the experiment directory)
 *   -> build/sim-app.js (single file, assigns window.SimApp)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'app');
const ENTRY = 'app/main.js';

const files = new Map(); // id -> { code, deps: string[] }

// Synchronous walk (top-level await avoided for clarity).
import { readdirSync, statSync } from 'node:fs';
(function walkSync(dir, base) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (statSync(p).isDirectory()) walkSync(p, rel);
    else if (name.endsWith('.js')) files.set(rel, { code: readFileSync(p, 'utf8'), deps: [] });
  }
})(ROOT, '');

// ESM->CJS transform: tsc with module=node16 under "type": "module" emits ESM
// (import/export). The bundle shim speaks CJS (require/exports), so translate
// the small emit subset the engine uses: named imports, export const/function/
// class, local export lists, and re-export lists. Anything else fails loudly.
let __reIdx = 0;
for (const [, f] of files) {
  let code = f.code;
  // 1. Re-exports: export { A, B as C } from './x.js';
  code = code.replace(/export\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']\s*;?/g, (_m, list, target) => {
    const names = list.split(',').map((s) => s.trim()).filter(Boolean);
    const v = `__re${__reIdx++}`;
    let s = `const ${v} = require(${JSON.stringify(target)});`;
    for (const n of names) {
      const parts = n.split(/\s+as\s+/);
      const src = parts[0].trim();
      const alias = (parts[1] ?? src).trim();
      s += `exports.${alias} = ${v}.${src};`;
    }
    return s;
  });
  // 2. Named imports (incl. multiline): import { A, B as C } from './x.js';
  code = code.replace(/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']\s*;?/g, (_m, list, target) => {
    const names = list.split(',').map((s) => s.trim()).filter(Boolean).map((n) => {
      const parts = n.split(/\s+as\s+/);
      const src = parts[0].trim();
      const alias = (parts[1] ?? src).trim();
      return src === alias ? src : `${src}: ${alias}`;
    });
    return `const { ${names.join(', ')} } = require(${JSON.stringify(target)});`;
  });
  // Side-effect imports: import './x.js';
  code = code.replace(/import\s*["']([^"']+)["']\s*;?/g, (_m, target) => `require(${JSON.stringify(target)});`);
  // 3. Declared exports: export const/function/class/async function NAME
  const exported = [];
  code = code.replace(/export\s+(async\s+function\s+([A-Za-z_$][\w$]*)|function\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)|let\s+([A-Za-z_$][\w$]*)|var\s+([A-Za-z_$][\w$]*))/g,
    (_m, _d, af, fn, cl, co, le, va) => {
      const name = af ?? fn ?? cl ?? co ?? le ?? va;
      exported.push(name);
      return _m.replace(/^export\s+/, '');
    });
  // 4. Local export lists: export { A, B as C };
  code = code.replace(/export\s*\{([\s\S]*?)\}\s*;?/g, (_m, list) => {
    const names = list.split(',').map((s) => s.trim()).filter(Boolean);
    return names.map((n) => {
      const parts = n.split(/\s+as\s+/);
      const src = parts[0].trim();
      const alias = (parts[1] ?? src).trim();
      return `exports.${alias} = ${src};`;
    }).join('\n');
  });
  if (exported.length > 0) code += `\n${exported.map((n) => `exports.${n} = ${n};`).join('\n')}\n`;
  if (/^\s*export\s+/m.test(code)) throw new Error(`unhandled export form in module (first 200 chars): ${code.slice(0, 200)}`);
  if (/^\s*import\s+/m.test(code)) throw new Error(`unhandled import form in module (first 200 chars): ${code.slice(0, 200)}`);
  f.code = code;
}
// Parse require("...") edges; resolve relative to importer.
const REQ = /require\(["']([^"']+)["']\)/g;
for (const [id, f] of files) {
  let m;
  while ((m = REQ.exec(f.code)) !== null) {
    const target = m[1];
    if (!target.startsWith('.')) continue; // no bare imports expected
    const dir = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '';
    const parts = (dir ? dir + '/' : '') + target;
    // Normalize a/b/../c segments.
    const segs = [];
    for (const s of parts.split('/')) {
      if (s === '..') segs.pop();
      else if (s !== '.') segs.push(s);
    }
    let norm = segs.join('/');
    if (!norm.endsWith('.js')) norm += '.js';
    if (!files.has(norm)) throw new Error(`unresolved require ${target} from ${id} (want ${norm})`);
    if (!f.deps.includes(norm)) f.deps.push(norm);
  }
}

// Topological order (DFS post-order). Cycles would recurse forever; the engine
// has no runtime import cycles (verified: history<->world edge is type-only).
const order = [];
const visited = new Set();
const visiting = new Set();
function visit(id) {
  if (visited.has(id)) return;
  if (visiting.has(id)) throw new Error(`import cycle at ${id}`);
  visiting.add(id);
  for (const d of files.get(id).deps) visit(d);
  visiting.delete(id);
  visited.add(id);
  order.push(id);
}
visit(ENTRY);
for (const id of files.keys()) visit(id); // unreachable-but-emitted files last

// Emit IIFE with require shim.
let out = `'use strict';\n/* Bundled simulation engine (tsc CJS + mini-bundler). Do not edit. */\n`;
out += `var SimApp = (function(){\nvar __mods = {};\n`;
out += `function __req(id){ if(!__mods[id]) throw new Error('missing module '+id); if(!__mods[id].i) { __mods[id].i = 1; __mods[id].f(__mods[id].r, __mods[id].e, {exports: __mods[id].e}); } return __mods[id].e; }\n`;
out += `function __norm(from, t){ if(t.charAt(0) !== '.') return t; var d = from.indexOf('/') < 0 ? '' : from.slice(0, from.lastIndexOf('/') + 1); var segs = []; var parts = (d + t).split('/'); for (var i = 0; i < parts.length; i++) { var s = parts[i]; if (s === '..') segs.pop(); else if (s !== '.' && s !== '') segs.push(s); } var n = segs.join('/'); return n.slice(-3) === '.js' ? n : n + '.js'; }\n`;
out += `function __def(id, fn){ var self = { f: fn, e: {}, i: 0 }; self.r = function(t){ return __req(__norm(id, t)); }; __mods[id] = self; }\n`;
for (const id of order) {
  const code = files.get(id).code
    .replace(/"use strict";?/g, '')
    .replace(/Object\.defineProperty\(exports, "__esModule", \{ value: true \}\);?/g, '');
  out += `__def(${JSON.stringify(id)}, function(require, exports, module){${code}\n});\n`;
}
out += `return __req(${JSON.stringify(ENTRY)});\n})();\n`;
if (typeof window !== 'undefined') window.SimApp = SimApp;

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'sim-app.js');
writeFileSync(outPath, out);
console.log(`bundle: ${order.length} modules -> ${outPath} (${(out.length / 1024).toFixed(0)} KB)`);
