import { describe, expect, it } from 'vitest';

import {
  regionPagePath,
  returnPathAfterRegionChange,
  safeReturnPath,
} from '../../../src/lib/region/return-path.js';

/**
 * Where a region change sends the visitor back to. The value arrives in a
 * form a third party can also build, so anything that could leave this origin
 * becomes the home page.
 */

describe('safeReturnPath', () => {
  it('keeps the path and the query of the page the visitor was on', () => {
    expect(safeReturnPath('/sales?sort=price&store=vertex-store')).toBe(
      '/sales?sort=price&store=vertex-store',
    );
  });

  it('keeps a plain path', () => {
    expect(safeReturnPath('/games/canonical-demo')).toBe('/games/canonical-demo');
  });

  it('drops a fragment, which the server never receives anyway', () => {
    expect(safeReturnPath('/games#offers')).toBe('/games');
  });

  it.each([
    ['an absolute address', 'https://example.com/sales'],
    ['a protocol-relative address', '//example.com/sales'],
    ['a backslash the browser reads as a slash', '/\\example.com'],
    ['a scheme', 'javascript:alert(1)'],
    ['a relative path', 'sales'],
    ['an empty value', ''],
    ['no value', null],
    ['a value that is not text', 12],
  ])('answers the home page for %s', (_label, value) => {
    expect(safeReturnPath(value)).toBe('/');
  });

  it('answers the home page for the region page itself, so the visitor is not left on it', () => {
    expect(safeReturnPath('/region?return=%2Fsales')).toBe('/');
  });
});

describe('returnPathAfterRegionChange', () => {
  it('keeps every filter when the currency stays the same', () => {
    expect(
      returnPathAfterRegionChange('/sales?store=orbit&min=20&max=50&sort=price', {
        currencyChanged: false,
      }),
    ).toBe('/sales?store=orbit&min=20&max=50&sort=price');
  });

  it('drops the price bounds when the currency changes, because they are amounts in the old one', () => {
    expect(
      returnPathAfterRegionChange('/sales?store=orbit&min=20&max=50&sort=price', {
        currencyChanged: true,
      }),
    ).toBe('/sales?store=orbit&sort=price');
  });

  it('returns to the first page, because the results change with the region', () => {
    expect(
      returnPathAfterRegionChange('/sales?page=3&sort=price', { currencyChanged: false }),
    ).toBe('/sales?sort=price');
  });

  it('keeps a path with no query as it is', () => {
    expect(returnPathAfterRegionChange('/games/canonical-demo', { currencyChanged: true })).toBe(
      '/games/canonical-demo',
    );
  });

  it('still refuses an address that leaves this origin', () => {
    expect(returnPathAfterRegionChange('//example.com/sales', { currencyChanged: false })).toBe(
      '/',
    );
  });
});

describe('regionPagePath', () => {
  it('names the page to return to after a save, with its query', () => {
    expect(regionPagePath('/sales?sort=price')).toBe('/region?return=%2Fsales%3Fsort%3Dprice');
  });
});
