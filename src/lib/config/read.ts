/**
 * Configuration, resolved once per isolate.
 *
 * Split from `index.ts`, which is the pure validation. The validation can then
 * be tested without a global to reset between cases. This file is also the
 * only place that knows configuration is cached at all.
 *
 * Lazy rather than eager, and that is load-bearing on Workers. A throw at
 * module evaluation kills the isolate before any handler exists. That produces
 * an opaque platform error with no request id and nothing useful in the logs.
 * Resolved on first use instead, middleware catches the failure and answers a
 * structured 503 that an operator can actually act on.
 */

import { loadConfig, type AppConfig } from './index.js';

let cached: AppConfig | undefined;

/**
 * Where configuration values come from.
 *
 * `process.env`, populated from the Worker's `vars` by the pinned
 * `nodejs_compat_populate_process_env` flag, rather than a `cloudflare:*`
 * import. The architecture test bans that import outside the composition root.
 * Tests with no Workers runtime could not use it anyway.
 *
 * `wrangler types` narrows `process.env` to the literals in `wrangler.jsonc`,
 * but `loadConfig` takes the widest shape on purpose. It must be able to see a
 * value that is missing or wrong, since that is what it exists to report. Those
 * literal types describe what the configuration file says, not what the runtime
 * received.
 */
export function getConfig(): AppConfig {
  cached ??= loadConfig(process.env);
  return cached;
}

/** Test-only. Clears the cached configuration. */
export function resetConfigCache(): void {
  cached = undefined;
}
