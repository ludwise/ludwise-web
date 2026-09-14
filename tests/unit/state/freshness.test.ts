import { describe, expect, it } from 'vitest';

import type { MoneyView } from '../../../src/lib/api/contract.js';
import {
  offerFreshnessView,
  surfaceFreshness,
  type OfferFreshnessInput,
  type PricedFreshness,
} from '../../../src/lib/state/freshness.js';

const NOW = Date.parse('2026-08-30T12:00:00.000Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const ago = (ms: number): number => NOW - ms;

const offer = (fields: Partial<OfferFreshnessInput> = {}): OfferFreshnessInput => ({
  availability: 'available',
  freshness: 'recently_verified',
  observedAtMs: ago(8 * MINUTE),
  storeName: 'Copper Shop',
  ...fields,
});

describe('the freshness of one offer, as a visitor reads it', () => {
  it('renders a recently verified offer with the phrase for its age', () => {
    expect(offerFreshnessView(offer(), NOW)).toEqual({
      state: 'recently_verified',
      warning: null,
      phrase: 'Updated 8 min ago',
      observedAtMs: ago(8 * MINUTE),
    });
  });

  it('keeps the backend word when the age alone would read as old', () => {
    // Ten days is past the content-style date flip. The word still decides:
    // the web client holds no horizon of its own.
    expect(offerFreshnessView(offer({ observedAtMs: ago(10 * DAY) }), NOW)).toMatchObject({
      state: 'recently_verified',
      warning: null,
      phrase: 'Last checked Aug 20, 2026',
    });
  });

  it('warns on a stale offer however recent its instant looks', () => {
    expect(
      offerFreshnessView(offer({ freshness: 'stale', observedAtMs: ago(5 * MINUTE) }), NOW),
    ).toEqual({
      state: 'stale',
      warning: 'Price may be out of date',
      phrase: 'Updated 5 min ago',
      observedAtMs: ago(5 * MINUTE),
    });
  });

  it('keeps an offer LUDWISE never verified apart from a stale one', () => {
    expect(
      offerFreshnessView(offer({ freshness: 'never_verified', observedAtMs: null }), NOW),
    ).toEqual({
      state: 'never_verified',
      warning: null,
      phrase: 'Not checked yet',
      observedAtMs: null,
    });
  });

  it('reads availability before freshness for an offer the store does not sell', () => {
    expect(
      offerFreshnessView(offer({ availability: 'unavailable', freshness: 'stale' }), NOW),
    ).toMatchObject({
      state: 'unavailable',
      warning: null,
      phrase: 'Copper Shop temporarily unavailable',
    });
  });

  it('claims no verification when the backend sent no word', () => {
    // "Updated 8 min ago" would read as a check the backend did not vouch for.
    // The instant stays reachable as the exact timestamp.
    expect(offerFreshnessView(offer({ freshness: undefined }), NOW)).toEqual({
      state: 'not_provided',
      warning: null,
      phrase: 'Freshness not provided',
      observedAtMs: ago(8 * MINUTE),
    });
    expect(
      offerFreshnessView(offer({ freshness: undefined, observedAtMs: null }), NOW),
    ).toMatchObject({ state: 'not_provided', phrase: 'Freshness not provided' });
  });
});

const PRICE: MoneyView = { amountMinor: 1299, currencyCode: 'EUR', minorUnit: 2 };
const priced = (fields: Partial<PricedFreshness> = {}): PricedFreshness => ({
  price: PRICE,
  freshness: 'recently_verified',
  observedAtMs: ago(5 * MINUTE),
  ...fields,
});

describe('the freshness of a whole page of offers', () => {
  it('states no word for a page that shows no priced offer', () => {
    expect(surfaceFreshness([])).toEqual({ word: null, oldestStaleObservedAtMs: null });
    expect(surfaceFreshness([priced({ price: null, freshness: 'stale' })])).toEqual({
      word: null,
      oldestStaleObservedAtMs: null,
    });
  });

  it('reads as recently verified when every priced offer is', () => {
    expect(surfaceFreshness([priced(), priced()])).toEqual({
      word: 'recently_verified',
      oldestStaleObservedAtMs: null,
    });
  });

  it('warns when any priced offer is stale, even beside one checked minutes ago', () => {
    expect(
      surfaceFreshness([
        priced(),
        priced({ freshness: 'stale', observedAtMs: ago(9 * DAY) }),
        priced({ freshness: 'stale', observedAtMs: ago(12 * DAY) }),
      ]),
    ).toEqual({ word: 'stale', oldestStaleObservedAtMs: ago(12 * DAY) });
  });

  it('lets stale outrank never verified, as the backend list word does', () => {
    expect(
      surfaceFreshness([
        priced({ freshness: 'never_verified', observedAtMs: null }),
        priced({ freshness: 'stale', observedAtMs: ago(9 * DAY) }),
      ]).word,
    ).toBe('stale');
    expect(
      surfaceFreshness([priced(), priced({ freshness: 'never_verified', observedAtMs: null })])
        .word,
    ).toBe('never_verified');
  });

  it('ignores a priced offer that carries no word rather than guessing one', () => {
    expect(
      surfaceFreshness([priced({ freshness: undefined, observedAtMs: ago(400 * DAY) })]),
    ).toEqual({ word: null, oldestStaleObservedAtMs: null });
  });
});
