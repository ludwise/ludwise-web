import { describe, expect, it } from 'vitest';

import {
  API_ERROR_CODES,
  GAME_SEARCH_PAGE_SIZE,
  REFUSABLE_FIELDS,
  SALE_PAGE_SIZE,
  SALE_SORTS,
} from '../../../src/lib/api/contract.js';
import { adviseGameSearch, adviseSales } from '../../../src/lib/http/filter-advice.js';
import { failureKindForCode } from '../../../src/lib/api/errors.js';

/**
 * `contract.ts` is mostly interfaces, which the type checker verifies and a
 * unit test cannot add anything to. What it also exports are runtime values -
 * the error code set, the refusable field allowlist, sort names and page
 * sizes - and those are real contract surface: other modules key behaviour on
 * them, and a value drifting out of step with the backend is exactly the kind
 * of change that must fail a build rather than degrade silently in production.
 */

describe('API_ERROR_CODES', () => {
  it('classifies ERR_APP_VALIDATION as rejected, the one code a visitor can fix', () => {
    expect(failureKindForCode('ERR_APP_VALIDATION')).toBe('rejected');
  });

  it('classifies every other fault code as unavailable, never as a guessed kind', () => {
    const faultCodes = API_ERROR_CODES.filter(
      (code) => code !== 'ERR_NOT_FOUND' && code !== 'ERR_APP_VALIDATION',
    );
    for (const code of faultCodes) {
      expect(failureKindForCode(code)).toBe('unavailable');
    }
  });

  it('contains ERR_NOT_FOUND, the one code that is not a fault', () => {
    // failureKindForCode does not classify it at all: the client treats a 404
    // on game detail as an answer (null) before this table is ever consulted.
    expect(API_ERROR_CODES).toContain('ERR_NOT_FOUND');
  });

  it('has no duplicate codes', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
  });
});

describe('REFUSABLE_FIELDS', () => {
  it('is a superset of every field the filter-advice tables know how to word', () => {
    // adviseGameSearch and adviseSales silently drop a field this list does not
    // recognise, so a field present in the advice tables but absent here would
    // never actually be reachable from a real backend rejection.
    const advisedGameFields = [
      'page',
      'marketCode',
      'currencyCode',
      'releaseYearFrom',
      'releaseYearTo',
    ];
    const advisedSalesFields = ['page', 'marketCode', 'currencyCode', 'sort', 'stores'];
    for (const field of [...advisedGameFields, ...advisedSalesFields]) {
      expect(REFUSABLE_FIELDS).toContain(field);
    }
  });

  it('has no duplicate field names', () => {
    expect(new Set(REFUSABLE_FIELDS).size).toBe(REFUSABLE_FIELDS.length);
  });

  it('every field name still produces advice on at least one of the two surfaces', () => {
    // A refusable field with no advice anywhere would surface only the generic
    // "those filters do not go together" heading forever, which is a gap worth
    // catching rather than shipping quietly.
    for (const field of REFUSABLE_FIELDS) {
      const advisedOnGames = adviseGameSearch([field]).length > 0;
      const advisedOnSales = adviseSales([field]).length > 0;
      expect(advisedOnGames || advisedOnSales).toBe(true);
    }
  });
});

describe('SALE_SORTS', () => {
  it('is exactly discount and price, in that order for the default', () => {
    expect(SALE_SORTS).toEqual(['discount', 'price']);
  });
});

describe('page sizes', () => {
  it('are positive integers the backend actually echoes', () => {
    expect(Number.isInteger(GAME_SEARCH_PAGE_SIZE)).toBe(true);
    expect(GAME_SEARCH_PAGE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(SALE_PAGE_SIZE)).toBe(true);
    expect(SALE_PAGE_SIZE).toBeGreaterThan(0);
  });
});
