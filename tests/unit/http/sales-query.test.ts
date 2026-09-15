import { describe, expect, it } from 'vitest';

import { readSalesFilters, toBrowseSalesInput } from '../../../src/lib/http/sales-query.js';

const REGION = { marketCode: 'JP', currencyCode: 'JPY' } as const;
const read = (query: string) =>
  toBrowseSalesInput(readSalesFilters(new URLSearchParams(query)), REGION);

describe('toBrowseSalesInput', () => {
  it('reads a filled-in form as the filters it names', () => {
    // min/max are whole units of the region's currency: 500 here is 500 yen.
    // It is not a count of a minor unit. This boundary does not know the
    // currency and does not convert. browseSales does, once it does.
    expect(
      read(
        'store=orbit&store=copper&minDiscount=40&min=500&max=6000&fromYear=2015&toYear=2026&sort=price&page=2',
      ),
    ).toEqual({
      marketCode: 'JP',
      currencyCode: 'JPY',
      stores: ['orbit', 'copper'],
      minDiscountPercentage: 40,
      minPriceMajor: 500,
      maxPriceMajor: 6000,
      releaseYearFrom: 2015,
      releaseYearTo: 2026,
      sort: 'price',
      page: 2,
    });
  });

  /**
   * The whole form submitted untouched. Every control is blank, which means the
   * visitor asked for nothing - not that they asked for zero. `Number('')` is 0.
   * A parser that let that through would turn "Apply filters" on an empty form
   * into a request the page itself had just made impossible.
   */
  it('treats an untouched form as no filters at all', () => {
    expect(read('store=&minDiscount=&min=&max=&fromYear=&toYear=&sort=&page=')).toEqual({
      marketCode: 'JP',
      currencyCode: 'JPY',
      stores: [],
      minDiscountPercentage: undefined,
      minPriceMajor: undefined,
      maxPriceMajor: undefined,
      releaseYearFrom: undefined,
      releaseYearTo: undefined,
      sort: undefined,
      page: undefined,
    });
  });

  it('reads an empty query string as no filters', () => {
    expect(read('')).toEqual({
      marketCode: 'JP',
      currencyCode: 'JPY',
      stores: [],
      minDiscountPercentage: undefined,
      minPriceMajor: undefined,
      maxPriceMajor: undefined,
      releaseYearFrom: undefined,
      releaseYearTo: undefined,
      sort: undefined,
      page: undefined,
    });
  });

  it('carries a malformed number through so the use case refuses it', () => {
    const input = read('page=one&min=12.5&max=1e3&minDiscount=0x2&fromYear=%20');
    expect(input.page).toBeNaN();
    expect(input.minPriceMajor).toBeNaN();
    expect(input.maxPriceMajor).toBeNaN();
    expect(input.minDiscountPercentage).toBeNaN();
    // Whitespace is blank, not malformed.
    expect(input.releaseYearFrom).toBeUndefined();
  });

  // Membership belongs to the use case, which owns the list of orders it
  // supports. The parser's job is to report what was asked for.
  it('passes an unsupported sort through rather than silently defaulting', () => {
    expect(read('sort=rating').sort).toBe('rating');
  });

  /**
   * The visitor region is the only source of the pair (ludwise-web#135). A
   * market or a currency in the address bar is not a page-level filter.
   */
  it('reads the market and the currency from the region, never from the query', () => {
    expect(read('market=DE&currency=EUR&pair=US|USD')).toMatchObject({
      marketCode: 'JP',
      currencyCode: 'JPY',
    });
  });

  it('drops blank repeated store values and keeps the rest', () => {
    expect(read('store=orbit&store=&store=%20copper%20').stores).toEqual(['orbit', 'copper']);
  });
});
