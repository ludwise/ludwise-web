/**
 * Scalars only.
 *
 * Objects and arrays are excluded so that data minimisation is enforced by the
 * compiler rather than by review discipline. Passing a whole visitor or request
 * object into an analytics event does not type-check, which means each field
 * collected has to be named deliberately. That is the entire point.
 */
export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsProperties = Readonly<Record<string, AnalyticsValue>>;

export interface AnalyticsEvent {
  /** Stable snake_case name, for example search_executed. */
  readonly name: string;
  /**
   * Schema version for this event only. Increase it when a property is added or its
   * meaning changes, so downstream analysis can separate the two shapes instead
   * of silently averaging across a redefinition.
   */
  readonly version: number;
  readonly properties?: AnalyticsProperties;
}

export interface AnalyticsProvider {
  readonly name: string;
  /**
   * Fire and forget.
   *
   * Returns void rather than a promise on purpose: it makes
   * `await analytics.track(...)` impossible to write, so a third-party call can
   * never end up on the critical path of a page render. Implementations must
   * not throw.
   */
  track(event: AnalyticsEvent): void;
  /** Optional, for providers that batch. Must not reject. */
  flush?(): Promise<void>;
}
