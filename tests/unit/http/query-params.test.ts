import { describe, expect, it } from 'vitest';

import { optionalInteger, optionalText, repeatedText } from '../../../src/lib/http/query-params.js';

const params = (query: string) => new URLSearchParams(query);

describe('optionalText', () => {
  it('reads a value the visitor supplied', () => {
    expect(optionalText(params('market=DE'), 'market')).toBe('DE');
  });

  // A GET form submits every control it contains, so an untouched select
  // arrives as `market=` rather than not at all.
  it('treats a blank control as no filter', () => {
    expect(optionalText(params('market='), 'market')).toBeUndefined();
  });

  it('treats a whitespace-only value as blank', () => {
    expect(optionalText(params('market=%20%20'), 'market')).toBeUndefined();
  });

  it('reports nothing for a parameter that is absent', () => {
    expect(optionalText(params(''), 'market')).toBeUndefined();
  });

  it('trims the surrounding whitespace without altering the value', () => {
    expect(optionalText(params('sort=%20discount%20'), 'sort')).toBe('discount');
  });
});

describe('optionalInteger', () => {
  it('reads a decimal integer', () => {
    expect(optionalInteger(params('page=3'), 'page')).toBe(3);
    expect(optionalInteger(params('min=0'), 'min')).toBe(0);
    expect(optionalInteger(params('min=-5'), 'min')).toBe(-5);
  });

  it('treats a blank control as no filter', () => {
    expect(optionalInteger(params('page='), 'page')).toBeUndefined();
  });

  /**
   * `Number` reads '0x10' as 16, '1e3' as 1000 and ' 12 ' as 12, none of which
   * a number input can produce. Carrying the malformed value through as NaN is
   * what makes the use case refuse it out loud. The parser does not quietly
   * invent a filter the visitor can see in the address bar and not in the
   * results.
   */
  // Not '%2B1': a leading sign is a decimal integer, and a bare '+' in a
  // query string decodes to a space. So both are values a form can produce.
  it.each(['one', '12.5', '1e3', '0x7e4', '1_000', '--1', '3px'])(
    'keeps %s malformed so the use case refuses it',
    (value) => {
      expect(optionalInteger(params(`page=${value}`), 'page')).toBeNaN();
    },
  );

  it('keeps an out-of-range number rather than clamping it', () => {
    expect(optionalInteger(params('page=0'), 'page')).toBe(0);
    expect(optionalInteger(params('toYear=99999'), 'toYear')).toBe(99_999);
  });
});

describe('repeatedText', () => {
  it('collects every value supplied', () => {
    expect(repeatedText(params('store=orbit&store=copper'), 'store')).toEqual(['orbit', 'copper']);
  });

  it('drops blanks and trims the rest', () => {
    expect(repeatedText(params('store=&store=%20orbit%20&store='), 'store')).toEqual(['orbit']);
  });

  it('reports an empty list when none was supplied', () => {
    expect(repeatedText(params(''), 'store')).toEqual([]);
  });
});
