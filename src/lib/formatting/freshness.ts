/**
 * How an instant turns into words. Nothing here judges whether a price is
 * current: the backend owns that word (`OfferView.freshness`).
 */

export const FRESHNESS_MINUTE_MS = 60 * 1000;
export const FRESHNESS_HOUR_MS = 60 * FRESHNESS_MINUTE_MS;
export const FRESHNESS_DAY_MS = 24 * FRESHNESS_HOUR_MS;
/** Where content style turns a relative age into a date. It is not the freshness horizon. */
export const FRESHNESS_WEEK_MS = 7 * FRESHNESS_DAY_MS;

/**
 * The age of an observation, or `null` where none was recorded.
 *
 * Clamped at zero. A timestamp ahead of the clock is skew between two machines,
 * and a negative age would render as a price observed in the future.
 */
export function observationAgeMs(observedAtMs: number | null, nowMs: number): number | null {
  return observedAtMs === null ? null : Math.max(0, nowMs - observedAtMs);
}

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

function counted(count: number, unit: 'hour' | 'day', locale: string): string {
  const plural = new Intl.PluralRules(locale).select(count) === 'one' ? '' : 's';
  return `${String(count)} ${unit}${plural}`;
}

/**
 * When one price was checked, in the form
 * `design/system/guidelines/content-style.md` § Freshness gives for the unit.
 * A date replaces the age after seven days, as in `formatObservationTime`.
 */
export function formatCheckedPhrase(observedAtMs: number, nowMs: number, locale = 'en-US'): string {
  const ageMs = observationAgeMs(observedAtMs, nowMs) ?? 0;

  if (ageMs < FRESHNESS_MINUTE_MS) return 'Updated just now';
  if (ageMs < FRESHNESS_HOUR_MS) {
    return `Updated ${String(Math.floor(ageMs / FRESHNESS_MINUTE_MS))} min ago`;
  }
  if (ageMs < FRESHNESS_DAY_MS) {
    return `Checked ${counted(Math.floor(ageMs / FRESHNESS_HOUR_MS), 'hour', locale)} ago`;
  }
  if (ageMs < FRESHNESS_WEEK_MS) {
    return `Last checked ${counted(Math.floor(ageMs / FRESHNESS_DAY_MS), 'day', locale)} ago`;
  }
  return `Last checked ${formatObservationTime(observedAtMs, nowMs, locale)}`;
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
