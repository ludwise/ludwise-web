/**
 * What this Worker needs to know about itself, and the guardrails around it.
 *
 * Small deliberately: the backend validates provider credentials, database
 * bindings and email settings, and this Worker has none. If this file grows a
 * secret, something is in the wrong repository.
 *
 * The one rule worth code: a frontend environment may only talk to its own
 * backend environment. Staging reading production publishes production prices
 * on a hostname not meant to be public. Cloudflare's model makes that mostly
 * structural - a binding names a script - and `assertEnvironmentsMatch` catches
 * what it cannot, a binding naming the wrong script, failing closed.
 */

/** The environments this site is deployed to. A closed set on purpose. */
export const ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export class ConfigError extends Error {
  readonly code = 'ERR_CONFIG_INVALID';
  /**
   * Which settings were wrong, for the logs.
   *
   * Names only, never values. A configuration value can be a hostname, a
   * binding name or - in some future - something sensitive, and an error that
   * echoes what it was given is how that reaches a response. The names alone
   * are enough for an operator holding the deployment.
   */
  readonly fields: readonly string[];

  constructor(fields: readonly string[]) {
    super(`ERR_CONFIG_INVALID: ${fields.join(', ')}`);
    this.name = 'ConfigError';
    this.fields = fields;
  }
}

export interface AppConfig {
  readonly environment: Environment;
  readonly siteUrl: string;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly analyticsEnabled: boolean;
  /**
   * How long the backend has to answer, in milliseconds.
   *
   * Configurable because the right value differs by environment rather than by
   * opinion: a local backend running under `wrangler dev` with a cold isolate
   * is legitimately slower than a deployed one. A developer should not have
   * to see timeout pages because of it.
   */
  readonly backendTimeoutMs: number;
}

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;

function isEnvironment(value: string): value is Environment {
  return (ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Reads and validates configuration, collecting every problem before failing.
 *
 * Every problem rather than the first: an operator fixing a bad deployment
 * should see the whole list once, not discover the next one after each redeploy.
 *
 * Nothing is defaulted where a wrong guess would be silent. `ENVIRONMENT` has
 * no default at all - guessing `development` would disable protections, and
 * guessing `production` would enable indexing on a deployment whose
 * configuration is already known to be broken.
 */
export function loadConfig(source: Readonly<Record<string, string | undefined>>): AppConfig {
  const fields: string[] = [];

  const environmentRaw = source['ENVIRONMENT'] ?? '';
  if (!isEnvironment(environmentRaw)) fields.push('ENVIRONMENT');

  const siteUrl = source['SITE_URL'] ?? '';
  if (siteUrl === '' || !isAbsoluteHttpUrl(siteUrl)) fields.push('SITE_URL');

  const logLevelRaw = source['LOG_LEVEL'] ?? 'info';
  if (!(LOG_LEVELS as readonly string[]).includes(logLevelRaw)) fields.push('LOG_LEVEL');

  const timeoutRaw = source['BACKEND_TIMEOUT_MS'];
  const backendTimeoutMs = timeoutRaw === undefined ? 5_000 : Number(timeoutRaw);
  if (!Number.isSafeInteger(backendTimeoutMs) || backendTimeoutMs < 1) {
    fields.push('BACKEND_TIMEOUT_MS');
  }

  if (fields.length > 0) throw new ConfigError(fields);

  return {
    environment: environmentRaw as Environment,
    siteUrl,
    logLevel: logLevelRaw as AppConfig['logLevel'],
    // Anything other than the literal 'true' is off. An analytics switch that
    // defaults on when misspelled is a privacy decision made by a typo.
    analyticsEnabled: source['ANALYTICS_ENABLED'] === 'true',
    backendTimeoutMs,
  };
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Refuses to serve a page built from one environment's site and another's data.
 *
 * The backend reports its own environment on `/api/health`, and the site
 * compares it to its own once per isolate. A mismatch is a deployment fault
 * rather than a request fault. So it fails every request rather than the
 * unlucky one that noticed - a site that half-works against the wrong backend
 * is harder to diagnose than one that refuses.
 *
 * Development is exempt in one direction only, and the asymmetry is the point.
 * A developer may deliberately point a local site at a *staging* backend to
 * reproduce something, which is a real workflow and reads data that is already
 * disposable. Nothing may point at production: not local, not staging. That is
 * not a workflow, it is the accident this function exists to prevent.
 */
export function assertEnvironmentsMatch(site: Environment, backend: string): void {
  if (site === backend) return;

  const allowed = site === 'development' && backend === 'staging';
  if (allowed) return;

  throw new ConfigError(['BACKEND_ENVIRONMENT']);
}
