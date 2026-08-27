import { describe, expect, it } from 'vitest';

import { adviseGameSearch, adviseSales } from '../../../src/lib/http/filter-advice.js';

/**
 * These tables turn the backend's field names into sentences a visitor can
 * act on. The backend's own `reason` string is deliberately not shown - see
 * the module header - so what matters here is that every refusable field maps
 * to something, that shared causes are deduplicated, and that a field this
 * build does not recognize is dropped rather than leaking an internal name.
 */

describe('adviseGameSearch', () => {
  it('advises on a single refused field', () => {
    expect(adviseGameSearch(['page'])).toEqual(['Page numbers start at 1.']);
  });

  it('deduplicates when two fields share one sentence', () => {
    // A market without its currency is refused on both sides by the backend.
    expect(adviseGameSearch(['marketCode', 'currencyCode'])).toEqual([
      'Choose a market and a currency together, or leave both on Any.',
    ]);
  });

  it('orders sentences by the table rather than by the order fields were refused in', () => {
    // The backend may validate releaseYearFrom before marketCode or the other
    // way around; the sentence order must not depend on that.
    const forward = adviseGameSearch(['releaseYearFrom', 'marketCode']);
    const backward = adviseGameSearch(['marketCode', 'releaseYearFrom']);
    expect(forward).toEqual(backward);
  });

  it('drops a field this build does not know about, rather than showing its raw name', () => {
    // A newer backend refusing something this build has no control for is a
    // version skew. Showing the raw field name would tell a visitor nothing.
    expect(adviseGameSearch(['someFutureField'])).toEqual([]);
  });

  it('mixes a known and an unknown field, keeping only the known one', () => {
    expect(adviseGameSearch(['page', 'someFutureField'])).toEqual(['Page numbers start at 1.']);
  });

  it('returns an empty list for no refused fields', () => {
    expect(adviseGameSearch([])).toEqual([]);
  });

  it('a sales-only field produces no advice here, because /games has no such control', () => {
    expect(adviseGameSearch(['stores'])).toEqual([]);
  });
});

describe('adviseSales', () => {
  it('advises on a single refused field', () => {
    expect(adviseSales(['sort'])).toEqual(['Choose one of the listed orders.']);
  });

  it('deduplicates minPriceMajor and maxPriceMajor into one sentence', () => {
    expect(adviseSales(['minPriceMajor', 'maxPriceMajor'])).toEqual([
      'Enter prices as whole numbers, with the lowest no higher than the highest.',
    ]);
  });

  it("words the market/currency rule differently from /games, since /games's controls differ", () => {
    expect(adviseSales(['marketCode'])).toEqual(['Choose a market and a currency together.']);
    expect(adviseGameSearch(['marketCode'])).toEqual([
      'Choose a market and a currency together, or leave both on Any.',
    ]);
  });

  it('advises on the sales-only fields sort and stores', () => {
    expect(adviseSales(['stores'])).toEqual(['Choose 50 stores at most.']);
  });

  it('drops a field this build does not know about', () => {
    expect(adviseSales(['someFutureField'])).toEqual([]);
  });

  it('returns an empty list for no refused fields', () => {
    expect(adviseSales([])).toEqual([]);
  });
});
