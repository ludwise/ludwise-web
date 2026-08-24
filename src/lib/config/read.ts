/**
 * Configuration, resolved once per isolate.
 *
 * Split from `index.ts` - which is the pure validation - so the validation can
 * be tested without a global to reset between cases, and so this file is the
 * only place that knows configuration is cached at all.
 *
 * Lazy rather than eager, and that is load-bearing on Workers. A throw at
 * module evaluation kills the isolate before any handler exists, which produces
 * an opaque platform error with no request id and nothing useful in the logs.
 * Resolved on first use instead, middleware catches the failure and answers a
 * structured 503 that an operator can actually act on.
 */

import { loadConfig, type AppConfig } from './index.js';

let cached: AppConfig | undefined;

/**
 * Where configuration values come from.
 *
 * `process.env` rather than a Cloudflare binding import, because the
 * `nodejs_compat_populate_process_env` flag is pinned in `wrangler.jsonc` and
 * populates it from the Worker's `vars`. That keeps this module free of
 * `cloudflare:*`, which matters more than it looks: the architecture test bans
 * that import outside the composition root, and configuration is read from
 * tests that have no Workers runtime at all.
 *
 * `wrangler types` narrows `process.env` to the literal values in
 * `wrangler.jsonc`, but `loadConfig` takes the widest possible shape on
 * purpose: it has to be able to see a value that is missing or wrong, because
 * that is the situation it exists to report. Passing the narrowed type in is
 * safe - it is assignable - and the validation still runs against whatever the
 * deployment actually has, because those literal types describe what the
 * configuration file says rather than what the runtime received.
 */
export function getConfig(): AppConfig {
  cached ??= loadConfig(process.env);
  return cached;
}

/** Test-only. Clears the cached configuration. */
export function resetConfigCache(): void {
  cached = undefined;
}
