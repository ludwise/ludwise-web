import type { AnalyticsEvent, AnalyticsProvider } from './types.js';

/**
 * Discards every event.
 *
 * The default everywhere: no analytics vendor has been selected, and local
 * development must never emit into a real dataset.
 */
export class NoOpAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'noop';

  track(_event: AnalyticsEvent): void {
    // Intentionally empty.
  }
}

export const noopAnalytics: AnalyticsProvider = Object.freeze(new NoOpAnalyticsProvider());
