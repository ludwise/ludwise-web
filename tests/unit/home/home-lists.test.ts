/**
 * The two home lists own their state independently (ludwise-web#123). A read
 * that fails takes down its own section and never the other one.
 */

import { describe, expect, it } from 'vitest';

import type { CurrentDiscountsView, RecentlyAddedView } from '../../../src/lib/api/contract.js';
import { LudwiseApiError } from '../../../src/lib/api/errors.js';
import { homeResponseStatus, readHomeLists } from '../../../src/lib/home/home-lists.js';
import type { VisitorRegion } from '../../../src/lib/region/visitor-region.js';

const JAPAN: VisitorRegion = {
  countryCode: 'JP',
  marketCode: 'JP',
  marketName: 'Japan',
  currencyCode: 'JPY',
  source: 'selected',
};

const DISCOUNTS: CurrentDiscountsView = {
  context: null,
  games: [],
  limit: 8,
  freshness: null,
  hasAnyOfferData: false,
};

const RECENT: RecentlyAddedView = { context: null, games: [], limit: 8, freshness: null };

const unavailable = (operation: string) => new LudwiseApiError('unavailable', operation);

describe('readHomeLists', () => {
  it('reads both lists in the pair of the active region', async () => {
    const pairs: unknown[] = [];

    const lists = await readHomeLists({
      resolveRegion: async () => JAPAN,
      api: {
        listCurrentDiscounts: async (input) => (pairs.push(input), DISCOUNTS),
        listRecentlyAdded: async (input) => (pairs.push(input), RECENT),
      },
    });

    expect(pairs).toEqual([
      { marketCode: 'JP', currencyCode: 'JPY' },
      { marketCode: 'JP', currencyCode: 'JPY' },
    ]);
    expect(lists).toEqual({
      region: JAPAN,
      currentDiscounts: { status: 'loaded', view: DISCOUNTS },
      recentlyAdded: { status: 'loaded', view: RECENT },
    });
  });

  it('keeps the other list when one read fails', async () => {
    const failure = unavailable('home.current-discounts');

    const lists = await readHomeLists({
      resolveRegion: async () => JAPAN,
      api: {
        listCurrentDiscounts: async () => Promise.reject(failure),
        listRecentlyAdded: async () => RECENT,
      },
    });

    expect(lists.currentDiscounts).toEqual({ status: 'failed', error: failure });
    expect(lists.recentlyAdded).toEqual({ status: 'loaded', view: RECENT });
  });

  it('fails both lists and reads neither when the region cannot be resolved', async () => {
    const failure = unavailable('pricing-regions.list');
    let reads = 0;

    const lists = await readHomeLists({
      resolveRegion: async () => Promise.reject(failure),
      api: {
        listCurrentDiscounts: async () => (reads++, DISCOUNTS),
        listRecentlyAdded: async () => (reads++, RECENT),
      },
    });

    expect(reads).toBe(0);
    expect(lists).toEqual({
      region: null,
      currentDiscounts: { status: 'failed', error: failure },
      recentlyAdded: { status: 'failed', error: failure },
    });
  });

  it('lets a failure that is not a backend failure reach the page', async () => {
    const defect = new TypeError('not a backend failure');

    await expect(
      readHomeLists({
        resolveRegion: async () => JAPAN,
        api: {
          listCurrentDiscounts: async () => DISCOUNTS,
          listRecentlyAdded: async () => Promise.reject(defect),
        },
      }),
    ).rejects.toBe(defect);
  });
});

describe('homeResponseStatus', () => {
  const failed = { status: 'failed', error: unavailable('home.recently-added') } as const;

  it('is 200 while one list loaded', () => {
    expect(
      homeResponseStatus({
        region: JAPAN,
        currentDiscounts: { status: 'loaded', view: DISCOUNTS },
        recentlyAdded: failed,
      }),
    ).toBe(200);
  });

  it('is 503 when no list loaded', () => {
    expect(
      homeResponseStatus({ region: null, currentDiscounts: failed, recentlyAdded: failed }),
    ).toBe(503);
  });
});
