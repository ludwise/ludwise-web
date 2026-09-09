import {
  FRESHNESS_DAY_MS,
  FRESHNESS_HOUR_MS,
  FRESHNESS_MINUTE_MS,
  FRESHNESS_WEEK_MS,
  observationAgeMs,
} from '../state/freshness.js';

/**
 * When an observation was made, for a sentence about a whole surface.
 *
 * Relative within seven days and absolute after, which
 * `design/system/guidelines/content-style.md` § Dates and times fixes for the
 * whole product. Relative ages round down, so the phrase never claims data is
 * older than it is.
 */
export function formatObservationTime(
  observedAtMs: number,
  nowMs: number,
  locale = 'en-US',
): string {
  const ageMs = observationAgeMs(observedAtMs, nowMs) ?? 0;

  if (ageMs >= FRESHNESS_WEEK_MS) {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(observedAtMs));
  }

  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
  if (ageMs < FRESHNESS_MINUTE_MS) return 'just now';
  if (ageMs < FRESHNESS_HOUR_MS) {
    return relative.format(-Math.floor(ageMs / FRESHNESS_MINUTE_MS), 'minute');
  }
  if (ageMs < FRESHNESS_DAY_MS) {
    return relative.format(-Math.floor(ageMs / FRESHNESS_HOUR_MS), 'hour');
  }
  return relative.format(-Math.floor(ageMs / FRESHNESS_DAY_MS), 'day');
}

/**
 * The exact moment an observation was made.
 *
 * Content style requires that the exact timestamp stays reachable from the
 * relative wording. One function states it, so a row and the disclosure behind
 * it never present the same moment two different ways.
 *
 * `timeZone` pins the zone for a test. Production callers omit it and get the
 * runtime's own, which is what names a zone a reader recognizes.
 */
export function formatObservationTimestamp(
  observedAtMs: number,
  locale = 'en-US',
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(new Date(observedAtMs));
}
