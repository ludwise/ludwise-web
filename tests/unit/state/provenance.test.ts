import { describe, expect, it } from 'vitest';

import type { MoneyView } from '../../../src/lib/api/contract.js';
import {
  explainsProvenance,
  surfaceProvenance,
  type ExplainableOffer,
} from '../../../src/lib/state/provenance.js';

const NOW = Date.parse('2026-08-30T12:00:00.000Z');
const DAY = 24 * 60 * 60_000;

const PRICE: MoneyView = { amountMinor: 1299, currencyCode: 'EUR', minorUnit: 2 };

const offer = (fields: Partial<ExplainableOffer> = {}): ExplainableOffer => ({
  price: PRICE,
  observedAtMs: NOW,
  freshness: 'recently_verified',
  discountPercentage: null,
  ...fields,
});

describe('what a surface may explain', () => {
  it('explains a check time only where a price carries one', () => {
    expect(surfaceProvenance([offer()]).hasCheckTimes).toBe(true);
    expect(surfaceProvenance([offer({ observedAtMs: null })]).hasCheckTimes).toBe(false);
  });

  it('explains a stale price only where the backend called one stale', () => {
    // The age alone decides nothing. A price read 400 days ago that the
    // backend still calls recently verified earns no note, and the reverse.
    expect(surfaceProvenance([offer({ observedAtMs: NOW - 400 * DAY })]).hasStalePrices).toBe(
      false,
    );
    expect(surfaceProvenance([offer({ freshness: 'stale' })]).hasStalePrices).toBe(true);
  });

  it('explains a derived discount only where one is on screen', () => {
    expect(surfaceProvenance([offer({ discountPercentage: 35 })]).hasDerivedDiscounts).toBe(true);
    expect(surfaceProvenance([offer()]).hasDerivedDiscounts).toBe(false);
  });

  it('ignores an offer the store quoted no price for', () => {
    // Nothing about it reaches the page beside a price, so it supports no
    // sentence about one. `surfaceFreshness` reads its surface the same way.
    const unpriced = offer({ price: null, freshness: 'stale', discountPercentage: 40 });

    expect(surfaceProvenance([unpriced])).toEqual({
      hasCheckTimes: false,
      hasStalePrices: false,
      hasDerivedDiscounts: false,
    });
  });

  it('answers every question at once for a mixed page', () => {
    expect(
      surfaceProvenance([
        offer({ discountPercentage: 20 }),
        offer({ freshness: 'stale', observedAtMs: NOW - 9 * DAY }),
      ]),
    ).toEqual({
      hasCheckTimes: true,
      hasStalePrices: true,
      hasDerivedDiscounts: true,
    });
  });
});

describe('whether a surface explains anything at all', () => {
  it('explains nothing when it holds no priced offer', () => {
    // The rule the empty and degraded suites rest on. A page that observed
    // nothing must not describe how to read observations.
    expect(explainsProvenance(surfaceProvenance([]))).toBe(false);
    expect(explainsProvenance(surfaceProvenance([offer({ price: null })]))).toBe(false);
  });

  it('explains something as soon as one price reaches the page', () => {
    expect(explainsProvenance(surfaceProvenance([offer()]))).toBe(true);
    expect(explainsProvenance(surfaceProvenance([offer({ discountPercentage: 10 })]))).toBe(true);
  });
});
