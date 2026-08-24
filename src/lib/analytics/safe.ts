import type { AnalyticsEvent, AnalyticsProvider } from './types.js';

/**
 * Wraps a provider so that analytics failure can never become request failure.
 *
 * PRODUCT.md treats analytics as strictly optional: an outage in a measurement
 * transport must not make the product unavailable.
 */
export function createSafeAnalytics(
  inner: AnalyticsProvider,
  onError?: (error: unknown, event: AnalyticsEvent) => void,
): AnalyticsProvider {
  return Object.freeze({
    name: inner.name,

    track(event: AnalyticsEvent): void {
      try {
        const result: unknown = inner.track(event);

        // The interface says void, but a JavaScript implementation can still
        // return a promise. On Workers an unhandled rejection is raised against
        // the request context and can fail a response that had already
        // succeeded, so it is attached to a no-op handler here.
        if (
          result !== null &&
          typeof result === 'object' &&
          typeof (result as PromiseLike<unknown>).then === 'function'
        ) {
          void (result as Promise<unknown>).catch(() => {
            // Deliberately ignored.
          });
        }
      } catch (error) {
        // The error handler is itself guarded. It normally writes a log record,
        // and if that path were ever to throw, an unguarded call here would turn
        // a swallowed analytics failure into a 500. The handler must be at least
        // as safe as the thing it is handling.
        try {
          onError?.(error, event);
        } catch {
          // Nothing left to do.
        }
      }
    },
  });
}
