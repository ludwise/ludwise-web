import { describe, expect, it } from 'vitest';

import {
  pathForPage,
  pathWithFiltersCleared,
  pathWithoutFilter,
} from '../../../src/lib/http/sales-filter-links.js';

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

describe('pathWithFiltersCleared', () => {
  // Sort is an order rather than a filter, so it excludes nothing.
  it('keeps the order, and drops every filter', () => {
    expect(
      pathWithFiltersCleared(params('sort=price&store=orbit&minDiscount=40&min=20&max=50')),
    ).toBe('/sales?sort=price');
  });

  it('returns the bare path when no order was chosen', () => {
    expect(pathWithFiltersCleared(params('minDiscount=99&fromYear=2015'))).toBe('/sales');
  });

  it('resets the page, so clearing filters lands on the first result', () => {
    expect(pathWithFiltersCleared(params('sort=price&page=4'))).toBe('/sales?sort=price');
  });

  it('carries no market or currency, which the visitor region sets', () => {
    expect(pathWithFiltersCleared(params('market=DE&currency=EUR&minDiscount=40'))).toBe('/sales');
  });
});
