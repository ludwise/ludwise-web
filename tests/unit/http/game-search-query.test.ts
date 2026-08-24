import { describe, expect, it } from 'vitest';

import { toGameSearchInput } from '../../../src/lib/http/game-search-query.js';

function inputFor(query: string) {
  return toGameSearchInput(new URLSearchParams(query));
}

describe('toGameSearchInput', () => {
  it('treats every blank control a submitted filter form sends as no filter at all', () => {
    // Exactly what the /games form produces when nothing is filled in.
    expect(inputFor('q=&market=&currency=&min=&max=&fromYear=&toYear=')).toEqual({
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

  it('treats a whitespace-only value as blank', () => {
    const input = inputFor('q=%20%20&market=%20&min=%20%20');

    expect(input.query).toBeUndefined();
    expect(input.marketCode).toBeUndefined();
    expect(input.minPriceMinor).toBeUndefined();
  });

  it('reads a filled-in form as the filters it names', () => {
    const input = inputFor(
      'q=Canonical&page=2&store=orbit-market&store=copper-shop&market=EU&currency=EUR' +
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

  it('keeps a malformed number malformed so the use case still refuses it', () => {
    const input = inputFor('page=one&min=12.5&max=1e3&fromYear=0x7e4');

    expect(input.page).toBeNaN();
    expect(input.minPriceMinor).toBeNaN();
    expect(input.maxPriceMinor).toBeNaN();
    expect(input.releaseYearFrom).toBeNaN();
  });

  it('keeps an out-of-range number so the use case rejects it rather than the parser', () => {
    const input = inputFor('page=0&min=-5&fromYear=0');

    expect(input.page).toBe(0);
    expect(input.minPriceMinor).toBe(-5);
    expect(input.releaseYearFrom).toBe(0);
  });

  it('drops blank repeated store values and keeps the rest', () => {
    expect(inputFor('store=&store=orbit-market&store=%20').stores).toEqual(['orbit-market']);
  });

  it('reads the discount checkbox as present, absent, or explicitly off', () => {
    expect(inputFor('discounted=true').discounted).toBe(true);
    expect(inputFor('discounted=on').discounted).toBe(true);
    expect(inputFor('discounted=false').discounted).toBe(false);
    expect(inputFor('discounted=').discounted).toBeUndefined();
    expect(inputFor('').discounted).toBeUndefined();
  });

  it('trims a query without altering what the visitor typed inside it', () => {
    expect(inputFor('q=%20%20Half%20%20Life%20%20').query).toBe('Half  Life');
  });
});
