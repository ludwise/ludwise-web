import { describe, expect, it, vi } from 'vitest';

import {
  createAnalytics,
  createSafeAnalytics,
  NoOpAnalyticsProvider,
  TestAnalyticsProvider,
  type AnalyticsEvent,
  type AnalyticsProvider,
} from '../../../src/lib/analytics/index.js';
import type { AppConfig } from '../../../src/lib/config/index.js';
import { createLogger } from '../../../src/lib/logging/logger.js';
import { createMemorySink } from '../../../src/lib/logging/sinks.js';

const EVENT: AnalyticsEvent = { name: 'example_action_completed', version: 1 };

/**
 * A whole valid configuration, not a partial one.
 *
 * Typed as `AppConfig` rather than cast, so a field added to the configuration
 * fails here until this fixture acknowledges it. That has already paid for
 * itself once. This file arrived from the backend still carrying its `access`
 * settings, which do not exist in this repository, and the compiler said so.
 */
const CONFIG: AppConfig = Object.freeze({
  environment: 'development',
  siteUrl: 'https://ludwise.test',
  logLevel: 'debug',
  analyticsEnabled: false,
  backendTimeoutMs: 5_000,
});

describe('NoOpAnalyticsProvider', () => {
  it('accepts an event and does nothing', () => {
    const provider = new NoOpAnalyticsProvider();
    expect(provider.track(EVENT)).toBeUndefined();
  });
});

describe('TestAnalyticsProvider', () => {
  it('records events in order and can filter and reset', () => {
    const provider = new TestAnalyticsProvider();
    provider.track(EVENT);
    provider.track({ name: 'other_event', version: 2 });

    expect(provider.names).toEqual(['example_action_completed', 'other_event']);
    expect(provider.byName('other_event')).toHaveLength(1);

    provider.reset();
    expect(provider.events).toHaveLength(0);
  });
});

describe('createSafeAnalytics', () => {
  it('swallows a throwing provider and reports it once', () => {
    const onError = vi.fn();
    const inner = new TestAnalyticsProvider();
    inner.failNext(1);

    const safe = createSafeAnalytics(inner, onError);
    expect(() => {
      safe.track(EVENT);
    }).not.toThrow();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[1]).toBe(EVENT);
  });

  // The handler normally writes a log record. If that path ever threw, an
  // unguarded handler would turn a swallowed analytics failure into a 500.
  it('survives an error handler that itself throws', () => {
    const inner = new TestAnalyticsProvider();
    inner.failNext(1);

    const safe = createSafeAnalytics(inner, () => {
      throw new Error('handler exploded');
    });

    expect(() => {
      safe.track(EVENT);
    }).not.toThrow();
  });

  // On Workers an unhandled rejection is raised against the request context and
  // can fail a response that had already succeeded.
  it('attaches a handler to a provider that returns a rejected promise', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    const rejecting: AnalyticsProvider = {
      name: 'rejecting',
      track: () => Promise.reject(new Error('transport down')) as unknown as void,
    };

    createSafeAnalytics(rejecting).track(EVENT);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });
});

describe('createAnalytics', () => {
  it('returns a no-op provider while analytics is disabled', () => {
    const memory = createMemorySink();
    const logger = createLogger({ sink: memory.sink });
    expect(createAnalytics(CONFIG, logger).name).toBe('noop');
  });

  it('reports a transport failure on the operational channel, not as analytics', () => {
    const memory = createMemorySink();
    const logger = createLogger({ sink: memory.sink, level: 'debug' });
    const failing = new TestAnalyticsProvider();
    failing.failNext(1);

    createSafeAnalytics(failing, (error, event) => {
      logger.warn('analytics.track_failed', 'Analytics event could not be delivered', {
        error,
        error_category: 'analytics_transport',
        analytics_event: event.name,
      });
    }).track(EVENT);

    expect(memory.records[0]?.channel).toBe('operational');
    expect(memory.records[0]?.level).toBe('warn');
  });
});

// The literal restatement of the requirement that analytics failure must never
// become application failure.
describe('analytics failure isolation', () => {
  it('does not change the response of a handler whose analytics call throws', () => {
    const failing = new TestAnalyticsProvider();
    failing.failNext(1);
    const analytics = createSafeAnalytics(failing);

    function handler(): Response {
      analytics.track(EVENT);
      return new Response('ok', { status: 200 });
    }

    const response = handler();
    expect(response.status).toBe(200);
  });
});
