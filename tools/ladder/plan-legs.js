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
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Dispatch on the literal 'prereg' keyword ONLY. Treating "did argv[2] look like
// a subcommand" as the discriminator is wrong: the workflow calls this with two
// plain arguments (`<armName> <legs>`), so a positional dispatch silently
// shifted them and made every ladder dispatch exit 2 at the plan job.
const argv = process.argv.slice(2);
const wantsPrereg = argv[0] === 'prereg';
const [armName, legsRaw] = wantsPrereg ? argv.slice(1) : argv;
const spec = JSON.parse(readFileSync(join(here, 'arms.json'), 'utf8'));

const arm = spec.arms[armName];
if (!arm) {
  console.error(`::error::unknown arm '${armName}'. Declared: ${Object.keys(spec.arms).join(', ')}`);
  process.exit(2);
}

/**
 * `prereg` prints the arm's pre-registration into the job summary.
 *
 * This was previously an inline `node -e` with `${{ inputs.arm }}` pasted into
 * the script body. GitHub expands those expressions BEFORE the shell parses
 * anything, so the value was expanded into source text, not passed as data —
 * a dispatch value containing $(id) would run. Reading the arm name from argv
 * makes it a string to look up rather than a fragment of code to execute.
 *
 * The lookup is against the parsed arms.json, so an unknown arm name is an
 * error rather than an interpolated expression.
 */
if (wantsPrereg) {
  const out = [
    '### Pre-registration',
    `- arm: \`${armName}\` — ${arm.title}`,
    `- declared: ${arm.preregistered}`,
    `- hypothesis: ${arm.hypothesis}`,
    `- prediction: ${arm.prediction}`,
    `- falsified if: ${arm.falsification}`,
  ];
  if (arm.notPredicted) out.push(`- NOT predicted: ${arm.notPredicted}`);
  for (const c of (arm.confoundsControlled ?? [])) out.push(`- confound controlled: ${c}`);
  if (arm.criteria) {
    out.push('- machine-readable criteria (evaluated by the cohort verifier):');
    for (const c of arm.criteria) {
      out.push(`  - ${c.id}: ${c.statement} — needs >= ${c.required} of ${c.metric} ${c.op} ${c.value}`);
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, out.join('\n') + '\n');
  }
  console.log(out.join('\n'));
  process.exit(0);
}

if (legsRaw === undefined) {
  console.error('usage: plan-legs.js <armName> <legs> | plan-legs.js prereg <armName>');
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
