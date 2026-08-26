import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetConfigCache } from '../../../src/lib/config/read.js';
import {
  auditLogger,
  operationalLogger,
  resetLoggerCache,
  securityLogger,
} from '../../../src/lib/logging/index.js';
import { prettySink } from '../../../src/lib/logging/sinks.js';
import type { LogRecord } from '../../../src/lib/logging/types.js';

/**
 * process.env is typed from wrangler's generated bindings, and that generation
 * is environment-dependent: locally .dev.vars supplies SITE_URL so it widens to
 * string, while CI has no .dev.vars and gets a literal union of the three values
 * configured in wrangler.jsonc. A test assigning a synthetic hostname therefore
 * type-checks locally and fails in CI - which is how this was found. Writing
 * through one widened alias keeps the tests honest about setting arbitrary
 * values, and keeps the two environments agreeing.
 */
const mutableEnv = process.env as Record<string, string | undefined>;

describe('channel loggers', () => {
  beforeEach(() => {
    resetLoggerCache();
    resetConfigCache();
    mutableEnv['ENVIRONMENT'] = 'production';
    mutableEnv['SITE_URL'] = 'https://ludwise.test';
    mutableEnv['LOG_LEVEL'] = 'debug';
  });

  afterEach(() => {
    delete mutableEnv['LOG_LEVEL'];
  });

  // PRODUCT.md section 103 requires operational telemetry, security logs and
  // audit records to stay conceptually distinct. Binding the channel at
  // construction is what makes that structural rather than a naming convention.
  it('keeps the three telemetry concerns distinct', () => {
    expect(operationalLogger().channel).toBe('operational');
    expect(securityLogger().channel).toBe('security');
    expect(auditLogger().channel).toBe('audit');
  });

  it('takes its level and environment from validated configuration', () => {
    expect(operationalLogger().level).toBe('debug');
  });

  it('memoises per channel, so construction cost is paid once per isolate', () => {
    expect(operationalLogger()).toBe(operationalLogger());
    expect(operationalLogger()).not.toBe(securityLogger());
  });

  // Logging is how an invalid configuration gets reported, so it has to keep
  // working when configuration is the thing that is broken.
  it('still produces a usable logger when configuration is invalid', () => {
    resetLoggerCache();
    resetConfigCache();
    delete mutableEnv['SITE_URL'];

    expect(() => operationalLogger()).not.toThrow();
    expect(operationalLogger().channel).toBe('operational');

    mutableEnv['SITE_URL'] = 'https://ludwise.test';
  });
});

describe('prettySink', () => {
  const record: LogRecord = {
    timestamp: '2026-01-01T12:00:00.000Z',
    level: 'info',
    channel: 'operational',
    event: 'http.request.completed',
    message: 'GET /api/health -> 200',
    service: 'ludwise-web',
    environment: 'development',
    version: '0.0.0-test',
    git_commit: 'testsha',
    build_id: 'test-run',
    request_id: 'c51e9488-e3ff-4dc2-bad3-a4130734378f',
    duration_ms: 2,
    context: { route: '/api/health' },
  };

  it('writes a single readable line to the console method matching the level', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    prettySink(record);

    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]?.[0] as string;
    expect(line).toContain('12:00:00.000');
    expect(line).toContain('INFO');
    expect(line).toContain('http.request.completed');
    expect(line).toContain('req=c51e9488');
    expect(line).toContain('/api/health');

    spy.mockRestore();
  });

  it('routes an error record to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    prettySink({
      ...record,
      level: 'error',
      error: { category: 'x', type: 'Error', message: 'b' },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
