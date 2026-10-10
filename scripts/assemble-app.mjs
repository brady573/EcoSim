/**
 * APP ASSEMBLY — inline the engine bundle into the HTML shell.
 *
 * Reads build/sim-app.js + src/app/shell.html, replaces the /*__BUNDLE__*\/
 * marker with the bundle source, writes one self-contained file. No server,
 * no imports, no network: opens from file:// on any phone browser.
 *
 * Run: node scripts/assemble-app.mjs [outpath]
 *   default: evidence/app/evo-sim-poc.html
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const bundle = readFileSync(join(root, 'build', 'sim-app.js'), 'utf8');
let shell = readFileSync(join(root, 'src', 'app', 'shell.html'), 'utf8');
if (!shell.includes('/*__BUNDLE__*/')) throw new Error('bundle marker missing in shell.html');
shell = shell.replace('/*__BUNDLE__*/', () => bundle);
const out = process.argv[2] ?? join(root, 'evidence', 'app', 'evo-sim-poc.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, shell);
console.log(`app: ${out} (${(Buffer.byteLength(shell) / 1024).toFixed(0)} KB, self-contained)`);
