import { describe, expect, it } from 'vitest';

import type { MoneyView } from '../../../src/lib/api/contract.js';
import {
  FRESHNESS_DAY_MS,
  FRESHNESS_HOUR_MS,
  freshnessLevel,
  surfaceFreshness,
} from '../../../src/lib/state/freshness.js';

const NOW = Date.parse('2026-08-30T12:00:00.000Z');
const ago = (ms: number): number => NOW - ms;

const PRICE: MoneyView = { amountMinor: 1299, currencyCode: 'EUR', minorUnit: 2 };
const priced = (observedAtMs: number | null) => ({ price: PRICE, observedAtMs });
const unpriced = (observedAtMs: number | null) => ({ price: null, observedAtMs });

describe('the freshness of one observation', () => {
  it('reads an unavailable offer as unavailable whatever its age', () => {
    expect(freshnessLevel({ availability: 'unavailable', observedAtMs: NOW, nowMs: NOW })).toBe(
      'unavailable',
    );
    expect(
      freshnessLevel({
        availability: 'unavailable',
        observedAtMs: ago(30 * FRESHNESS_DAY_MS),
        nowMs: NOW,
      }),
    ).toBe('unavailable');
  });

  it('reads a missing timestamp as unknown rather than as old', () => {
    expect(freshnessLevel({ availability: 'available', observedAtMs: null, nowMs: NOW })).toBe(
      'unknown',
    );
  });

  it('separates the first hour, the first day, and everything older', () => {
    expect(
      freshnessLevel({ availability: 'available', observedAtMs: ago(59 * 60_000), nowMs: NOW }),
    ).toBe('fresh');
    expect(
      freshnessLevel({
        availability: 'available',
        observedAtMs: ago(FRESHNESS_HOUR_MS),
        nowMs: NOW,
      }),
    ).toBe('aging');
    expect(
      freshnessLevel({
        availability: 'available',
        observedAtMs: ago(FRESHNESS_DAY_MS),
        nowMs: NOW,
      }),
    ).toBe('stale');
  });

  it('clamps an observation dated in the future rather than reporting a negative age', () => {
    expect(
      freshnessLevel({
        availability: 'available',
        observedAtMs: NOW + FRESHNESS_DAY_MS,
        nowMs: NOW,
      }),
    ).toBe('fresh');
  });
});

describe('the freshness of a whole surface', () => {
  it('claims nothing about a surface that carries no offer at all', () => {
    expect(surfaceFreshness([], NOW)).toEqual({
      level: 'unknown',
      newestObservedAtMs: null,
      observedCount: 0,
      total: 0,
    });
  });

  it('stays unknown when every priced offer is missing its time', () => {
    expect(surfaceFreshness([priced(null), priced(null)], NOW)).toEqual({
      level: 'unknown',
      newestObservedAtMs: null,
      observedCount: 0,
      total: 2,
    });
  });

  it('reports the newest observation, so one old row does not age the whole surface', () => {
    const newest = ago(5 * 60_000);

    expect(surfaceFreshness([priced(ago(30 * FRESHNESS_DAY_MS)), priced(newest)], NOW)).toEqual({
      level: 'fresh',
      newestObservedAtMs: newest,
      observedCount: 2,
      total: 2,
    });
  });

  it('calls the surface stale only when even its newest priced observation is stale', () => {
    const newest = ago(2 * FRESHNESS_DAY_MS);

    expect(
      surfaceFreshness([priced(ago(9 * FRESHNESS_DAY_MS)), priced(newest), priced(null)], NOW),
    ).toEqual({
      level: 'stale',
      newestObservedAtMs: newest,
      observedCount: 2,
      total: 3,
    });
  });

  /**
   * The defect this rule exists for. A store read minutes ago that quoted no
   * price would otherwise be the page's newest fact. It would then suppress the
   * warning over a page whose every actual price is a year old.
   */
  it('ignores an offer the store quoted no price for, however recently it was read', () => {
    const oldPrice = ago(400 * FRESHNESS_DAY_MS);

    expect(surfaceFreshness([unpriced(ago(60_000)), priced(oldPrice)], NOW)).toEqual({
      level: 'stale',
      newestObservedAtMs: oldPrice,
      observedCount: 1,
      total: 1,
    });
  });

  it('claims nothing about a surface whose every offer is unpriced', () => {
    expect(surfaceFreshness([unpriced(ago(60_000))], NOW)).toEqual({
      level: 'unknown',
      newestObservedAtMs: null,
      observedCount: 0,
      total: 0,
    });
  });
});
