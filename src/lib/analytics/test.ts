import type { AnalyticsEvent, AnalyticsProvider } from './types.js';

/**
 * Records events in memory so tests can assert on instrumentation without
 * sending anything anywhere.
 */
export class TestAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'test';
  private readonly recorded: AnalyticsEvent[] = [];
  private failures = 0;

  get events(): readonly AnalyticsEvent[] {
    return this.recorded;
  }

  get names(): readonly string[] {
    return this.recorded.map((event) => event.name);
  }

  track(event: AnalyticsEvent): void {
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('TestAnalyticsProvider: simulated transport failure');
    }
    this.recorded.push(event);
  }

  byName(name: string): readonly AnalyticsEvent[] {
    return this.recorded.filter((event) => event.name === name);
  }

  /** Makes the next N track calls throw, to exercise caller fail-safety. */
  failNext(count = 1): void {
    this.failures = count;
  }

  reset(): void {
    this.recorded.length = 0;
    this.failures = 0;
  }
}
