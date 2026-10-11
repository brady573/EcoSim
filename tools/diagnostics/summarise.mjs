/**
 * Manifest summarisation for the diagnostics workflow. Dependency-free, no I/O.
 *
 * The summary step used to print `m.targets.length` unconditionally. Two of the
 * three suites write a manifest with no `targets` field at all — `factorial-core`
 * writes `switches` and `runCount` — so a COMPLETELY SUCCESSFUL factorial screen
 * threw a TypeError inside the `if: always()` step and left the workflow
 * reporting failure. The experiment had succeeded; the report about it had not.
 *
 * This reads the manifest by the schema it actually has, and degrades to an
 * explicit "unrecognised manifest" line rather than throwing. A summariser that
 * can throw is a summariser that can report a successful run as a failed one,
 * which is its own kind of evidence-integrity failure.
 *
 * It also never fails the job. Whether the EXPERIMENT succeeded is the
 * experiment job's business; the summary's job is to describe what exists.
 */
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {object|null} manifest parsed manifest.json, or null when unreadable
 * @param {string} legId directory name, used to label the line
 * @returns {{ok: boolean, line: string, units: number|null, skipped: number}}
 */
export function summariseManifest(manifest, legId) {
  const label = `leg ${legId}`;

  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, units: null, skipped: 0, line: `${label}: manifest missing or unreadable` };
  }

  const seeds = Array.isArray(manifest.seeds) ? manifest.seeds : [];
  const runs = Number.isFinite(manifest.runCount) ? manifest.runCount : null;
  const skipped = Array.isArray(manifest.skippedTargets) ? manifest.skippedTargets.length : 0;
  const seedStr = seeds.length === 0 ? 'none' : JSON.stringify(seeds);

  // Factorial and target/config screens are different schemas; dispatch on which
  // field is present rather than on a name the workflow could get wrong.
  let units = null;
  let what = null;
  if (Array.isArray(manifest.switches)) {
    units = manifest.switches.length;
    what = 'switches';
  } else if (Array.isArray(manifest.targets)) {
    units = manifest.targets.length;
    what = 'targets';
  }

  if (units === null) {
    return {
      ok: false,
      units: null,
      skipped,
      line: `${label}: seeds=${seedStr}, runs=${runs ?? 'unknown'}, ` +
        'manifest carries neither `switches` nor `targets`; cannot report the panel size',
    };
  }

  const suffix = skipped > 0 ? `, unsweepable=${skipped}` : '';
  return {
    ok: true,
    units,
    skipped,
    line: `${label}: seeds=${seedStr}, ${what}=${units}, runs=${runs ?? 'unknown'}${suffix}`,
  };
}

/** Render the full `### Engine` section from a list of {legId, manifest} entries. */
export function renderEngineSection(entries) {
  const lines = ['### Engine'];
  for (const { legId, manifest } of entries) {
    lines.push('- ' + summariseManifest(manifest, legId).line);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI — read every leg manifest under an output root and write the job summary.
//
// Never throws and never exits non-zero. A summariser that can fail a run would
// report a successful experiment as a failed one, which is a false negative on
// the run and a false alarm on the infrastructure — and it is how a real screen
// ends up being distrusted for the wrong reason.
// ---------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].endsWith('summarise.mjs')) {
  const [outRoot] = process.argv.slice(2);
  if (!outRoot) {
    console.error('usage: summarise.mjs <outRoot>');
    process.exit(2);
  }

  let legDirs = [];
  try {
    legDirs = readdirSync(outRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name.startsWith('leg'))
      .map((d) => d.name)
      .sort();
  } catch {
    legDirs = [];
  }

  const entries = legDirs.map((legId) => {
    try {
      return { legId, manifest: JSON.parse(readFileSync(join(outRoot, legId, 'manifest.json'), 'utf8')) };
    } catch {
      return { legId, manifest: null };
    }
  });

  const out = [renderEngineSection(entries)];

  if (entries.length === 0) {
    out.push('- no leg manifests found — the screen did not complete');
  } else {
    out.push('');
    out.push('### Inert controls (no observed state change)');
    for (const { legId } of entries) {
      const csvPath = join(outRoot, legId, 'effects.csv');
      let csv = '';
      try { csv = readFileSync(csvPath, 'utf8'); } catch { continue; }
      for (const row of csv.split('\n').slice(1)) {
        if (row.endsWith('NO_OBSERVED_STATE_CHANGE')) {
          const cells = row.split(',');
          out.push(`- ${cells[0]} @ ${cells[3] ?? '?'} (${legId})`);
        }
      }
    }
    out.push('');
    out.push('"Inert" means no state-hash change within THIS horizon and seed panel.');
    out.push('It is not evidence that the control is irrelevant.');
  }

  const text = out.join('\n');
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
  }
  console.log(text);
}