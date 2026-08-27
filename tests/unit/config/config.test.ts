/**
 * Configuration validation, and the guardrail that keeps environments apart.
 *
 * The validation half is ordinary. The `assertEnvironmentsMatch` half is the
 * reason this file matters. A staging site reading production data publishes
 * production prices on a hostname that is not meant to be public. It also makes
 * staging's own data untrustworthy for the testing it exists to do. It is the
 * single worst configuration mistake available in this architecture. So it is
 * the one with a test naming every combination rather than a representative
 * sample.
 */

import { describe, expect, it } from 'vitest';

import {
  assertEnvironmentsMatch,
  ConfigError,
  ENVIRONMENTS,
  loadConfig,
  type Environment,
} from '../../../src/lib/config/index.js';

const VALID = {
  ENVIRONMENT: 'production',
  SITE_URL: 'https://ludwise.test',
  LOG_LEVEL: 'info',
  ANALYTICS_ENABLED: 'false',
  BACKEND_TIMEOUT_MS: '5000',
};

describe('loadConfig', () => {
  it('reads a complete configuration', () => {
    expect(loadConfig(VALID)).toEqual({
      environment: 'production',
      siteUrl: 'https://ludwise.test',
      logLevel: 'info',
      analyticsEnabled: false,
      backendTimeoutMs: 5000,
    });
  });

  it('reports every problem at once rather than the first', () => {
    // An operator fixing a bad deployment must see the whole list once, not
    // discover the next one after each redeploy.
    const error = (() => {
      try {
        loadConfig({ ENVIRONMENT: 'staging?', SITE_URL: 'not-a-url', LOG_LEVEL: 'chatty' });
      } catch (thrown) {
        return thrown;
      }
      return null;
    })();

    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).fields).toEqual(['ENVIRONMENT', 'SITE_URL', 'LOG_LEVEL']);
  });

  it('refuses to guess an absent environment', () => {
    // Guessing development would disable protections. Guessing production would
    // enable indexing on a deployment already known to be misconfigured.
    expect(() => loadConfig({ ...VALID, ENVIRONMENT: undefined })).toThrow(ConfigError);
  });

  it('refuses a site URL that is not absolute http(s)', () => {
    // It is what canonical links are built from. A relative or exotic value
    // produces canonicals pointing somewhere that is not this site.
    for (const siteUrl of ['/', 'ludwise.com', 'javascript:alert(1)', 'ftp://ludwise.com']) {
      expect(() => loadConfig({ ...VALID, SITE_URL: siteUrl }), siteUrl).toThrow(ConfigError);
    }
  });

  it('treats anything but the literal true as analytics off', () => {
    // A privacy switch that defaults on when misspelled is a decision made by
    // a typo. Checked in both directions so the field is not simply always off.
    for (const value of ['TRUE', 'yes', '1', '', undefined]) {
      expect(loadConfig({ ...VALID, ANALYTICS_ENABLED: value }).analyticsEnabled).toBe(false);
    }
    expect(loadConfig({ ...VALID, ANALYTICS_ENABLED: 'true' }).analyticsEnabled).toBe(true);
  });

  it('defaults the backend timeout rather than requiring it', () => {
    expect(loadConfig({ ...VALID, BACKEND_TIMEOUT_MS: undefined }).backendTimeoutMs).toBe(5000);
  });

  it('refuses a timeout that would disable itself', () => {
    // Zero and negative values are the shapes that would silently mean "no
    // ceiling" in a naive implementation. That is the one thing the timeout
    // exists to prevent.
    for (const value of ['0', '-1', 'soon', '1.5', 'Infinity']) {
      expect(() => loadConfig({ ...VALID, BACKEND_TIMEOUT_MS: value }), value).toThrow(ConfigError);
    }
  });

  it('names fields and never values', () => {
    // A configuration value can be a hostname or, in some future, something
    // sensitive. An error that echoes what it was given is how that reaches a
    // response.
    const error = (() => {
      try {
        loadConfig({ ...VALID, SITE_URL: 'https://internal-secret-host.example' });
      } catch (thrown) {
        return thrown as ConfigError;
      }
      return null;
    })();

    // SITE_URL is valid there, so nothing throws at all - which is the
    // point: the assertion below is about the case that does.
    expect(error).toBeNull();

    const invalid = (() => {
      try {
        loadConfig({ ...VALID, SITE_URL: 'internal-secret-host' });
      } catch (thrown) {
        return thrown as ConfigError;
      }
      return null;
    })();

    expect(invalid?.fields).toEqual(['SITE_URL']);
    expect(invalid?.message).not.toContain('internal-secret-host');
  });
});

describe('assertEnvironmentsMatch', () => {
  it('allows each environment to read its own backend', () => {
    for (const environment of ENVIRONMENTS) {
      expect(() => assertEnvironmentsMatch(environment, environment)).not.toThrow();
    }
  });

  /**
   * Every crossing, named individually rather than sampled.
   *
   * The table is small enough to write out. Writing it out is what makes
   * the one permitted exception visible as an exception rather than as a gap.
   */
  const CROSSINGS: readonly [Environment, string, 'allowed' | 'refused'][] = [
    // The exception, and the only one. A developer may deliberately point a
    // local site at staging to reproduce something - a real workflow, reading
    // data that is already disposable.
    ['development', 'staging', 'allowed'],

    // development -> production is refused as firmly as staging -> production.
    // A developer's experiment reading real data over an unaudited binding is
    // the accident this function exists to prevent.
    ['development', 'production', 'refused'],
    ['staging', 'production', 'refused'],
    ['staging', 'development', 'refused'],
    ['production', 'staging', 'refused'],
    ['production', 'development', 'refused'],
  ];

  it.each(CROSSINGS)('%s site reading a %s backend is %s', (site, backend, verdict) => {
    const call = () => {
      assertEnvironmentsMatch(site, backend);
    };
    if (verdict === 'allowed') expect(call).not.toThrow();
    else expect(call).toThrow(ConfigError);
  });

  it('refuses a backend that reports something unrecognised', () => {
    // A backend answering with a value this build does not know is a version
    // skew or something else answering entirely. Neither is a match.
    expect(() => {
      assertEnvironmentsMatch('production', 'prod');
    }).toThrow(ConfigError);
    expect(() => {
      assertEnvironmentsMatch('production', '');
    }).toThrow(ConfigError);
  });
});
