import { describe, expect, it } from 'vitest';

import {
  formatObservationTime,
  formatObservationTimestamp,
} from '../../../src/lib/formatting/freshness.js';

const NOW = Date.parse('2026-08-30T12:00:00.000Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ago = (ms: number): number => NOW - ms;

describe('when an observation was made, in words', () => {
  it('names the whole unit a visitor thinks in, largest that fits', () => {
    expect(formatObservationTime(NOW, NOW)).toBe('just now');
    expect(formatObservationTime(ago(59_000), NOW)).toBe('just now');
    expect(formatObservationTime(ago(5 * MINUTE), NOW)).toBe('5 minutes ago');
    expect(formatObservationTime(ago(90 * MINUTE), NOW)).toBe('1 hour ago');
    expect(formatObservationTime(ago(50 * HOUR), NOW)).toBe('2 days ago');
  });

  it('rounds down, so an age is never reported as older than it is', () => {
    expect(formatObservationTime(ago(119 * MINUTE), NOW)).toBe('1 hour ago');
    expect(formatObservationTime(ago(47 * HOUR), NOW)).toBe('1 day ago');
  });

  /**
   * `design/system/guidelines/content-style.md` § Dates and times: relative up
   * to seven days, absolute after. "412 days ago" is a number nobody converts
   * into a date they can act on.
   */
  it('gives a date rather than a relative age once a week has passed', () => {
    expect(formatObservationTime(ago(6 * DAY), NOW)).toBe('6 days ago');
    expect(formatObservationTime(ago(7 * DAY), NOW)).toBe('Aug 23, 2026');
    expect(formatObservationTime(Date.parse('2025-06-15T12:00:00.000Z'), NOW)).toBe('Jun 15, 2025');
  });

  it('reads a timestamp ahead of the clock as the present, never as the future', () => {
    expect(formatObservationTime(NOW + DAY, NOW)).toBe('just now');
  });
});

describe('the exact moment an observation was made', () => {
  /**
   * The timestamp behind every relative age, which
   * `design/system/guidelines/content-style.md` § Dates and times requires to
   * stay reachable. The zone is pinned here because the runtime's own decides
   * it in production.
   */
  it('names the day, the time and the zone', () => {
    expect(formatObservationTimestamp(Date.parse('2026-08-21T15:12:00.000Z'), 'en-US', 'UTC')).toBe(
      'Aug 21, 2026, 3:12 PM UTC',
    );
  });

  it('stays a timestamp however recent the observation is', () => {
    // The relative wording is the other function's job. This one is what a
    // visitor reaches for when "5 minutes ago" is not the answer they want.
    expect(formatObservationTimestamp(NOW, 'en-US', 'UTC')).toBe('Aug 30, 2026, 12:00 PM UTC');
  });
});
