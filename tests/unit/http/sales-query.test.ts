import { describe, expect, it } from 'vitest';

import { toBrowseSalesInput } from '../../../src/lib/http/sales-query.js';

const read = (query: string) => toBrowseSalesInput(new URLSearchParams(query));

describe('toBrowseSalesInput', () => {
  it('reads a filled-in form as the filters it names', () => {
    // min/max are whole units of whatever currency the resolved context uses:
    // 500 here is 500 euros, not 500 cents. This boundary does not know the
    // currency and does not convert. browseSales does, once it does.
    expect(
      read(
        'market=DE&currency=EUR&store=orbit&store=copper&minDiscount=40&min=500&max=6000&fromYear=2015&toYear=2026&sort=price&page=2',
      ),
    ).toEqual({
      marketCode: 'DE',
      currencyCode: 'EUR',
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
   * visitor asked for nothing - not that they asked for zero. `Number('')` is
   * 0, and a parser that let that through would turn "Apply filters" on an
   * empty form into a request the page itself had just made impossible.
   */
  it('treats an untouched form as no filters at all', () => {
    expect(
      read('market=&currency=&store=&minDiscount=&min=&max=&fromYear=&toYear=&sort=&page='),
    ).toEqual({
      marketCode: undefined,
      currencyCode: undefined,
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
      marketCode: undefined,
      currencyCode: undefined,
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

  it('keeps a market without its currency, so the pairing rule can refuse it', () => {
    expect(read('market=DE')).toMatchObject({ marketCode: 'DE', currencyCode: undefined });
    expect(read('currency=EUR')).toMatchObject({ marketCode: undefined, currencyCode: 'EUR' });
  });

  it('does not upper-case a market a visitor typed in lower case', () => {
    // Correcting it here would hide a malformed link rather than report it,
    // and the use case is where the shape of a market code is decided.
    expect(read('market=de&currency=eur')).toMatchObject({
      marketCode: 'de',
      currencyCode: 'eur',
    });
  });

  it('drops blank repeated store values and keeps the rest', () => {
    expect(read('store=orbit&store=&store=%20copper%20').stores).toEqual(['orbit', 'copper']);
  });

  /**
   * The market/currency select the filter form renders is one control
   * offering only the pairs that actually hold a sale (#2's fix for a
   * visitor being able to submit an impossible pair), so its one submitted
   * value carries both codes together, joined by `|`. `market`/`currency`
   * stay readable separately - a direct link still names them that way,
   * and `pair` is this parser's problem to translate, not a second public
   * contract.
   */
  it('reads a combined market/currency pair as both codes', () => {
    expect(read('pair=JP|JPY')).toMatchObject({ marketCode: 'JP', currencyCode: 'JPY' });
  });

  it('prefers a combined pair over separately named market and currency', () => {
    expect(read('pair=JP|JPY&market=DE&currency=EUR')).toMatchObject({
      marketCode: 'JP',
      currencyCode: 'JPY',
    });
  });

  it('ignores a pair with no separator, falling back to market and currency', () => {
    expect(read('pair=JPJPY')).toMatchObject({ marketCode: undefined, currencyCode: undefined });
    expect(read('pair=JPJPY&market=DE&currency=EUR')).toMatchObject({
      marketCode: 'DE',
      currencyCode: 'EUR',
    });
  });

  it('ignores a pair with an empty side', () => {
    expect(read('pair=|JPY')).toMatchObject({ marketCode: undefined, currencyCode: undefined });
    expect(read('pair=JP|')).toMatchObject({ marketCode: undefined, currencyCode: undefined });
  });
});
