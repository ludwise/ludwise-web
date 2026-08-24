import { describe, expect, it } from 'vitest';

import { routeTemplate, sanitizePathname } from '../../../src/lib/http/route.js';

describe('sanitizePathname', () => {
  it('leaves a low-cardinality path alone', () => {
    expect(sanitizePathname('/games/sales')).toBe('/games/sales');
  });

  // Without this, a crawler walking 50k URLs creates 50k route values and every
  // dashboard grouped by route becomes unusable.
  it.each([
    ['numeric ids', '/games/12345', '/games/:num'],
    ['UUIDs', '/games/550e8400-e29b-41d4-a716-446655440000', '/games/:id'],
    ['long hex', '/t/4bf92f3577b34da6a3ce929d0e0e4736', '/t/:id'],
    ['overlong segments', `/s/${'x'.repeat(60)}`, '/s/:long'],
  ])('collapses %s', (_label, input, expected) => {
    expect(sanitizePathname(input)).toBe(expected);
  });

  it('caps the number of segments', () => {
    expect(sanitizePathname('/a/b/c/d/e/f/g/h/i/j')).toBe('/a/b/c/d/e/f/g/h/:rest');
  });

  it('normalises the root path', () => {
    expect(sanitizePathname('/')).toBe('/');
  });
});

describe('routeTemplate', () => {
  it('prefers the framework route pattern when one matched', () => {
    expect(
      routeTemplate({
        routePattern: '/games/[slug]',
        url: new URL('https://ludwise.test/games/half-life'),
      }),
    ).toEqual({ route: '/games/[slug]', source: 'pattern' });
  });

  // Unmatched requests have no pattern, and those are exactly the ones most
  // worth seeing in the logs.
  it('falls back to a sanitised pathname when no pattern matched', () => {
    expect(
      routeTemplate({
        routePattern: undefined,
        url: new URL('https://ludwise.test/unknown/98765'),
      }),
    ).toEqual({ route: '/unknown/:num', source: 'sanitized' });
  });

  it('never carries a query string into the route', () => {
    const { route } = routeTemplate({
      routePattern: undefined,
      url: new URL('https://ludwise.test/search?q=secret+term&token=abc'),
    });
    expect(route).toBe('/search');
    expect(route).not.toContain('secret');
  });
});
