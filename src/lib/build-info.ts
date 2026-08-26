/**
 * Immutable identity of the running build.
 *
 * Every production log record carries these values so an error can be traced
 * back to an exact commit. See docs/operations/logging.md.
 *
 * `environment` is deliberately absent: it is runtime configuration, not build
 * metadata. Baking it in would make one artifact un-promotable between
 * environments, which the main -> production branch model depends on.
 */
export interface BuildInfo {
  /** Package version, maintained by release-please. */
  readonly version: string;
  /** Full commit SHA, or 'unknown' outside a git checkout. */
  readonly gitCommit: string;
  /** First 7 characters of the commit SHA, for human-readable log fields. */
  readonly gitCommitShort: string;
  /** CI run identifier, or 'local'. */
  readonly buildId: string;
  /** True when build metadata came from fallbacks rather than a real build. */
  readonly isLocalBuild: boolean;
}

const UNKNOWN_COMMIT = 'unknown';
const LOCAL_BUILD_ID = 'local';

// Replaced textually by Vite `define` (astro.config.mjs). The `typeof` guard is
// required, not defensive: Vitest loads no astro config, so an unguarded
// reference throws ReferenceError at module load. Vite folds the guard away.
const version = typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : '0.0.0-dev';
const gitCommit =
  typeof __BUILD_GIT_COMMIT__ !== 'undefined' ? __BUILD_GIT_COMMIT__ : UNKNOWN_COMMIT;
const buildId = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : LOCAL_BUILD_ID;

export const BUILD_INFO: BuildInfo = Object.freeze({
  version,
  gitCommit,
  gitCommitShort: gitCommit === UNKNOWN_COMMIT ? UNKNOWN_COMMIT : gitCommit.slice(0, 7),
  buildId,
  isLocalBuild: buildId === LOCAL_BUILD_ID || gitCommit === UNKNOWN_COMMIT,
});
