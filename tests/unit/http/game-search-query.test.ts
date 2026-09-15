import { describe, expect, it } from 'vitest';

import {
  readGameSearchFilters,
  toGameSearchInput,
} from '../../../src/lib/http/game-search-query.js';

const REGION = { marketCode: 'EU', currencyCode: 'EUR' } as const;

let regionReads = 0;

function inputFor(query: string) {
  return toGameSearchInput(readGameSearchFilters(new URLSearchParams(query)), async () => {
    regionReads += 1;
    return REGION;
  });
}

describe('toGameSearchInput', () => {
  it('treats every blank control a submitted filter form sends as no filter at all', async () => {
    // Exactly what the /games form produces when nothing is filled in.
    expect(await inputFor('q=&min=&max=&fromYear=&toYear=')).toEqual({
      query: undefined,
      page: undefined,
      stores: [],
      marketCode: undefined,
      currencyCode: undefined,
      minPriceMinor: undefined,
      maxPriceMinor: undefined,
      discounted: undefined,
      releaseYearFrom: undefined,
      releaseYearTo: undefined,
    });
  });

  it('treats a whitespace-only value as blank', async () => {
    const input = await inputFor('q=%20%20&min=%20%20');

    expect(input.query).toBeUndefined();
    expect(input.minPriceMinor).toBeUndefined();
  });

  it('reads a filled-in form as the filters it names', async () => {
    const input = await inputFor(
      'q=Canonical&page=2&store=orbit-market&store=copper-shop' +
        '&min=1000&max=1500&discounted=true&fromYear=2020&toYear=2025',
    );

    expect(input).toEqual({
      query: 'Canonical',
      page: 2,
      stores: ['orbit-market', 'copper-shop'],
      marketCode: 'EU',
      currencyCode: 'EUR',
      minPriceMinor: 1000,
      maxPriceMinor: 1500,
      discounted: true,
      releaseYearFrom: 2020,
      releaseYearTo: 2025,
    });
  });

  it('keeps a malformed number malformed so the use case still refuses it', async () => {
    const input = await inputFor('page=one&min=12.5&max=1e3&fromYear=0x7e4');

    expect(input.page).toBeNaN();
    expect(input.minPriceMinor).toBeNaN();
    expect(input.maxPriceMinor).toBeNaN();
    expect(input.releaseYearFrom).toBeNaN();
  });

  it('keeps an out-of-range number so the use case rejects it rather than the parser', async () => {
    const input = await inputFor('page=0&min=-5&fromYear=0');

    expect(input.page).toBe(0);
    expect(input.minPriceMinor).toBe(-5);
    expect(input.releaseYearFrom).toBe(0);
  });

  /**
   * `/v1/games` returns no price, and it reads a pair as a filter on which games
   * hold an offer in that pair. So the pair travels only with a filter that
   * names a price, and then it is always the visitor region's pair.
   */
  it.each(['min=100', 'max=900', 'discounted=true'])(
    'sends the region pair with the price filter %s',
    async (query) => {
      expect(await inputFor(query)).toMatchObject({ marketCode: 'EU', currencyCode: 'EUR' });
    },
  );

  it('reads no region when no filter names a price, so a region failure cannot block search', async () => {
    regionReads = 0;
    await inputFor('q=Canonical&store=orbit-market');
    expect(regionReads).toBe(0);
    await inputFor('min=100');
    expect(regionReads).toBe(1);
  });

  it('sends no pair when no filter names a price, so the whole catalogue stays searchable', async () => {
    expect(await inputFor('q=Canonical&store=orbit-market&fromYear=2020')).toMatchObject({
      marketCode: undefined,
      currencyCode: undefined,
    });
    expect(await inputFor('discounted=false')).toMatchObject({ marketCode: undefined });
  });

  it('never reads the market or the currency from the query', async () => {
    expect(await inputFor('market=JP&currency=JPY')).toMatchObject({
      marketCode: undefined,
      currencyCode: undefined,
    });
    expect(await inputFor('market=JP&currency=JPY&min=100')).toMatchObject({
      marketCode: 'EU',
      currencyCode: 'EUR',
    });
  });

  it('drops blank repeated store values and keeps the rest', async () => {
    expect((await inputFor('store=&store=orbit-market&store=%20')).stores).toEqual([
      'orbit-market',
    ]);
  });

  it('reads the discount checkbox as present, absent, or explicitly off', async () => {
    expect((await inputFor('discounted=true')).discounted).toBe(true);
    expect((await inputFor('discounted=on')).discounted).toBe(true);
    expect((await inputFor('discounted=false')).discounted).toBe(false);
    expect((await inputFor('discounted=')).discounted).toBeUndefined();
    expect((await inputFor('')).discounted).toBeUndefined();
  });

  it('trims a query without altering what the visitor typed inside it', async () => {
    expect((await inputFor('q=%20%20Half%20%20Life%20%20')).query).toBe('Half  Life');
  });
});
