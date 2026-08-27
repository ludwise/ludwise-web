import { describe, expect, it } from 'vitest';

import { pathForPage, pathWithoutFilter } from '../../../src/lib/http/sales-filter-links.js';

const params = (query: string) => new URLSearchParams(query);

describe('pathWithoutFilter', () => {
  it('removes the named filter and keeps the rest', () => {
    expect(pathWithoutFilter(params('minDiscount=40&fromYear=2015'), 'minDiscount')).toBe(
      '/sales?fromYear=2015',
    );
  });

  it('returns the bare path when nothing is left', () => {
    expect(pathWithoutFilter(params('minDiscount=40'), 'minDiscount')).toBe('/sales');
  });

  it('removes only the matching value from a repeated store filter', () => {
    const result = pathWithoutFilter(params('store=orbit&store=copper'), 'store', 'orbit');
    expect(result).toBe('/sales?store=copper');
  });

  it('resets to page 1 whenever a filter is removed', () => {
    expect(pathWithoutFilter(params('minDiscount=40&page=3'), 'minDiscount')).toBe('/sales');
  });

  /**
   * Price bounds are amounts in the currency being removed. Keeping them
   * would silently reinterpret them in another one - #7's regression.
   */
  it('drops the price bounds when the market changes', () => {
    expect(pathWithoutFilter(params('market=DE&currency=EUR&min=20&max=50'), 'market')).toBe(
      '/sales',
    );
  });

  it('drops the price bounds when the currency changes', () => {
    expect(pathWithoutFilter(params('market=DE&currency=EUR&min=20&max=50'), 'currency')).toBe(
      '/sales',
    );
  });

  it('removes both market and currency together, never one alone', () => {
    expect(pathWithoutFilter(params('market=DE&currency=EUR&minDiscount=40'), 'market')).toBe(
      '/sales?minDiscount=40',
    );
    expect(pathWithoutFilter(params('market=DE&currency=EUR&minDiscount=40'), 'currency')).toBe(
      '/sales?minDiscount=40',
    );
  });

  // The minimum and maximum price are one filter with two edges. Removing
  // one without the other would leave a bound the visitor never asked for on
  // its own.
  it('removes the maximum together with the minimum', () => {
    expect(pathWithoutFilter(params('min=20&max=50'), 'min')).toBe('/sales');
  });

  it('leaves the maximum alone when a different filter is removed', () => {
    expect(pathWithoutFilter(params('min=20&max=50&minDiscount=40'), 'minDiscount')).toBe(
      '/sales?min=20&max=50',
    );
  });

  // Same pairing rule for the release-year range.
  it('removes the latest release year together with the earliest', () => {
    expect(pathWithoutFilter(params('fromYear=2015&toYear=2026'), 'fromYear')).toBe('/sales');
  });

  it('leaves an unrelated filter untouched', () => {
    expect(pathWithoutFilter(params('minDiscount=40&fromYear=2015'), 'fromYear')).toBe(
      '/sales?minDiscount=40',
    );
  });
});

describe('pathForPage', () => {
  it('sets the requested page and keeps every other filter', () => {
    expect(pathForPage(params('minDiscount=40'), 3)).toBe('/sales?minDiscount=40&page=3');
  });

  it('replaces an existing page number rather than appending a second one', () => {
    expect(pathForPage(params('page=1'), 2)).toBe('/sales?page=2');
  });
});
