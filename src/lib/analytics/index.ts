import type { AppConfig } from '../config/index.js';
import { EVENTS } from '../logging/events.js';
import type { Logger } from '../logging/types.js';
import { noopAnalytics } from './noop.js';
import { createSafeAnalytics } from './safe.js';
import type { AnalyticsProvider } from './types.js';

export { NoOpAnalyticsProvider, noopAnalytics } from './noop.js';
export { TestAnalyticsProvider } from './test.js';
export { createSafeAnalytics } from './safe.js';
export type {
  AnalyticsEvent,
  AnalyticsProperties,
  AnalyticsProvider,
  AnalyticsValue,
} from './types.js';

/**
 * Builds the analytics transport for this environment.
 *
 * Returns a no-op today in every case. No analytics vendor has been chosen, and
 * choosing one is a deliberate decision rather than a bootstrap side effect. The
 * signature exists so that selecting a vendor later changes this one function
 * and nothing at the call sites.
 *
 * Failures are logged on the operational channel, never as analytics. An
 * analytics transport failure is an operational fact about the system. It is
 * not a measurement of what a visitor did.
 */
export function createAnalytics(config: AppConfig, logger: Logger): AnalyticsProvider {
  if (!config.analyticsEnabled) return noopAnalytics;

  return createSafeAnalytics(noopAnalytics, (error, event) => {
    // The event name and version are safe to log. The properties are not
    // duplicated into operational logs, which would widen exposure and split
    // the same data across two different retention policies.
    logger.warn(EVENTS.ANALYTICS_TRACK_FAILED, 'Analytics event could not be delivered', {
      error,
      error_category: 'analytics_transport',
      analytics_event: event.name,
      analytics_event_version: event.version,
    });
  });
}
