import { describe, expect, it } from 'vitest';

import { readHeaderSearch } from '../../../src/lib/http/header-search.js';

const at = (path: string) => new URL(path, 'http://localhost:4321');

describe('readHeaderSearch', () => {
  it('fills the field from the search term on the games page', () => {
    expect(readHeaderSearch(at('/games?q=Canonical'), '/games').value).toBe('Canonical');
  });

  it('carries every games filter except the search term', () => {
    const search = readHeaderSearch(
      at('/games?q=Canonical&store=orbit&store=copper&min=100&discounted=true'),
      '/games',
    );

    expect(search.carriedParams).toEqual([
      ['store', 'orbit'],
      ['store', 'copper'],
      ['min', '100'],
      ['discounted', 'true'],
    ]);
  });

  // A new term is a new result set, so it starts on its first page.
  it('does not carry the page', () => {
    expect(readHeaderSearch(at('/games?q=Canonical&page=3'), '/games').carriedParams).toEqual([]);
  });

  // `q` on another route is not a games search, and `/sales` filters do not
  // mean the same thing on `/games`.
  it('starts empty and carries nothing on another route', () => {
    expect(readHeaderSearch(at('/sales?q=Canonical&min=20'), '/games')).toEqual({
      value: undefined,
      carriedParams: [],
    });
  });

  it('starts empty on a game page below the games path', () => {
    expect(readHeaderSearch(at('/games/half-off-demo?q=Canonical'), '/games').value).toBe(
      undefined,
    );
  });
});
