import { describe, expect, it } from 'vitest';

import type { MoneyView } from '../../../src/lib/api/contract.js';
import { FRESHNESS_DAY_MS, FRESHNESS_HOUR_MS } from '../../../src/lib/state/freshness.js';
import {
  explainsProvenance,
  surfaceProvenance,
  type ExplainableOffer,
} from '../../../src/lib/state/provenance.js';

const NOW = Date.parse('2026-08-30T12:00:00.000Z');
const ago = (ms: number): number => NOW - ms;

const PRICE: MoneyView = { amountMinor: 1299, currencyCode: 'EUR', minorUnit: 2 };

const offer = (fields: Partial<ExplainableOffer> = {}): ExplainableOffer => ({
  price: PRICE,
  observedAtMs: NOW,
  discountPercentage: null,
  ...fields,
});

describe('what a surface may explain', () => {
  it('explains a check time only where a price carries one', () => {
    expect(surfaceProvenance([offer()], NOW).hasCheckTimes).toBe(true);
    expect(surfaceProvenance([offer({ observedAtMs: null })], NOW).hasCheckTimes).toBe(false);
  });

  it('separates a missing check time from an old one', () => {
    // Two different sentences. One says a source reported nothing, the other
    // that it reported a moment that has since passed. Either read as the
    // other tells a visitor something that did not happen.
    const untimed = surfaceProvenance([offer({ observedAtMs: null })], NOW);
    const old = surfaceProvenance([offer({ observedAtMs: ago(FRESHNESS_DAY_MS) })], NOW);

    expect(untimed).toMatchObject({ hasUntimedPrices: true, hasOldCheckTimes: false });
    expect(old).toMatchObject({ hasUntimedPrices: false, hasOldCheckTimes: true });
  });

  it('reads an old check time on the boundary the indicator uses', () => {
    expect(
      surfaceProvenance([offer({ observedAtMs: ago(23 * FRESHNESS_HOUR_MS) })], NOW)
        .hasOldCheckTimes,
    ).toBe(false);
    expect(
      surfaceProvenance([offer({ observedAtMs: ago(FRESHNESS_DAY_MS) })], NOW).hasOldCheckTimes,
    ).toBe(true);
  });

  it('explains a derived discount only where one is on screen', () => {
    expect(surfaceProvenance([offer({ discountPercentage: 35 })], NOW).hasDerivedDiscounts).toBe(
      true,
    );
    expect(surfaceProvenance([offer()], NOW).hasDerivedDiscounts).toBe(false);
  });

  it('ignores an offer the store quoted no price for', () => {
    // Nothing about it reaches the page beside a price, so it supports no
    // sentence about one. `surfaceFreshness` reads its surface the same way.
    const unpriced = offer({ price: null, observedAtMs: null, discountPercentage: 40 });

    expect(surfaceProvenance([unpriced], NOW)).toEqual({
      hasCheckTimes: false,
      hasUntimedPrices: false,
      hasOldCheckTimes: false,
      hasDerivedDiscounts: false,
    });
  });

  it('answers every question at once for a mixed page', () => {
    expect(
      surfaceProvenance(
        [
          offer({ observedAtMs: ago(5 * 60_000), discountPercentage: 20 }),
          offer({ observedAtMs: ago(3 * FRESHNESS_DAY_MS) }),
          offer({ observedAtMs: null }),
        ],
        NOW,
      ),
    ).toEqual({
      hasCheckTimes: true,
      hasUntimedPrices: true,
      hasOldCheckTimes: true,
      hasDerivedDiscounts: true,
    });
  });
});

describe('whether a surface explains anything at all', () => {
  it('explains nothing when it holds no priced offer', () => {
    // The rule the empty and degraded suites rest on. A page that observed
    // nothing must not describe how to read observations.
    expect(explainsProvenance(surfaceProvenance([], NOW))).toBe(false);
    expect(explainsProvenance(surfaceProvenance([offer({ price: null })], NOW))).toBe(false);
  });

  it('explains something as soon as one price reaches the page', () => {
    expect(explainsProvenance(surfaceProvenance([offer()], NOW))).toBe(true);
    expect(explainsProvenance(surfaceProvenance([offer({ observedAtMs: null })], NOW))).toBe(true);
  });
});
