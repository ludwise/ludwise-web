// @ts-check
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Which build this is: version, commit and CI run.
 *
 * Extracted from astro.config.mjs because there are now two things to build.
 * The site gets these through Vite `define`. The ingestion Worker is bundled
 * by Wrangler and gets them through `--define`. Two copies of "how do we work
 * out the commit" would drift. The symptom of that drift is a log record
 * blaming the wrong commit - which is only ever discovered while reading logs
 * during an incident.
 *
 * Node built-ins are fine here: this runs during a build, never in workerd.
 */

/** Best-effort local commit lookup. Absent in tarball or no-.git checkouts. */
function localGitCommit() {
  try {
    // execFileSync (argument array, no shell) rather than execSync, so there is
    // no shell interpolation surface and behavior matches on Windows.
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * @param {URL} packageJsonUrl
 * @returns {{ version: string, gitCommit: string, buildId: string }}
 */
export function buildIdentity(packageJsonUrl) {
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8'));

  return {
    version: packageJson.version,
    // GITHUB_SHA is always set in Actions, so the git subprocess only ever
    // runs locally.
    gitCommit: process.env.GITHUB_SHA ?? localGitCommit(),
    buildId: process.env.GITHUB_RUN_ID ?? 'local',
  };
}

/**
 * The identity as bundler `define` entries.
 *
 * Every value is JSON-stringified because `define` is raw text substitution in
 * both bundlers. An unquoted value is injected as a bare identifier, which
 * esbuild rejects outright ("must be an entity name or JS literal") and Vite
 * would happily inject as a syntax error.
 *
 * @param {{ version: string, gitCommit: string, buildId: string }} identity
 * @returns {Record<string, string>}
 */
export function buildDefines(identity) {
  return {
    __BUILD_VERSION__: JSON.stringify(identity.version),
    __BUILD_GIT_COMMIT__: JSON.stringify(identity.gitCommit),
    __BUILD_ID__: JSON.stringify(identity.buildId),
  };
}

/**
 * The defines as command-line arguments for Wrangler.
 *
 * `--define name:value` with the value already quoted by buildDefines. Kept
 * beside it rather than in the deploy script so it can be tested without the
 * script running a deploy on import.
 *
 * @param {Record<string, string>} defines
 * @returns {string[]}
 */
export function defineArgs(defines) {
  return Object.entries(defines).flatMap(([name, value]) => ['--define', `${name}:${value}`]);
}
