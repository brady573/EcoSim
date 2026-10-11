/**
 * Compute the ladder shard fan-out.
 *
 * Split out of the workflow so dispatch input reaches it as an argv ARGUMENT
 * read from the environment, not as a `${{ }}` expression pasted into a shell
 * script body. GitHub expands those before the shell parses them, so a value
 * containing $(...) would execute ahead of any check here.
 *
 * Prints two GITHUB_OUTPUT lines: the matrix array and the leg count.
 * Legs are capped at the arm's seed count so no leg launches with no seeds.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const [armName, legsRaw] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(join(here, 'arms.json'), 'utf8'));

const arm = spec.arms[armName];
if (!arm) {
  console.error(`::error::unknown arm '${armName}'. Declared: ${Object.keys(spec.arms).join(', ')}`);
  process.exit(2);
}

const seedCount = String(arm.seeds).split(',').reduce((acc, part) => {
  const m = /^(\d+):(\d+)$/.exec(part.trim());
  return acc + (m ? Number(m[2]) - Number(m[1]) + 1 : 1);
}, 0);

const requested = Number(legsRaw);
if (!Number.isInteger(requested) || requested < 1) {
  console.error(`::error::legs must be a positive integer, got '${legsRaw}'`);
  process.exit(2);
}

const legs = Math.max(1, Math.min(requested, seedCount));
const matrix = JSON.stringify(Array.from({ length: legs }, (_, i) => i));
console.log(`arm '${armName}' seeds=${seedCount} requested legs=${requested} -> ${legs}: ${matrix}`);
// Guarded so the script is runnable locally for a dry check; Actions always
// sets GITHUB_OUTPUT.
if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `matrix=${matrix}\nlegs=${legs}\n`);
} else {
  console.log(`(no GITHUB_OUTPUT set; would write matrix=${matrix} legs=${legs})`);
}
