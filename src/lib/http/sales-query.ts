/**
 * Where a `/sales` query string becomes sales browsing input.
 *
 * Parameter names match `/games` wherever they mean the same thing, so the
 * link-building helpers transfer unchanged. `min` and `max` are the exception:
 * minor units on `/games`, whole major units here, which
 * `BrowseSalesInput.minPriceMajor` carries in its own name.
 *
 * No `q` - title search lives at `/games`, and answering it here would mean a
 * second relevance ranking. No `discounted`, because the page is discounts.
 * Nothing here corrects a value; see query-params.ts on blank versus malformed.
 */

import { optionalInteger, optionalText, repeatedText } from './query-params.js';
import type { BrowseSalesInput } from '../api/contract.js';

/**
 * Joins a combined `pair` value's two sides. Kept out of query-params.ts: no
 * other boundary needs it. Exported so the page builds an option value with
 * the identical separator this function splits on, rather than a second
 * literal that could drift from this one.
 */
export const PAIR_SEPARATOR = '|';

/**
 * Reads a combined `market|currency` value, as the filter form's one
 * market/currency control submits it (#2: a single control offering only
 * the pairs that hold a sale, so a visitor cannot submit a market and a
 * currency that were never paired). `undefined` for anything that is not
 * exactly two non-empty sides - not a value to guess at a meaning for -
 * which falls the caller back to `market` / `currency` read separately.
 */
function readPair(
  params: URLSearchParams,
): { marketCode: string; currencyCode: string } | undefined {
  const value = optionalText(params, 'pair');
  if (value === undefined) return undefined;

  const sides = value.split(PAIR_SEPARATOR);
  if (sides.length !== 2 || sides[0] === '' || sides[1] === '') return undefined;
  return { marketCode: sides[0]!, currencyCode: sides[1]! };
}

/**
 * Reads the filters a visitor asked for. Range and pairing rules belong to the
 * use case.
 *
 * `min` and `max` are whole units of whichever currency the resolved context
 * turns out to use - what a visitor typed into "Lowest price" - not minor
 * units. `browseSales` converts them once it knows that currency's exponent;
 * this boundary has no way to know it and does not try.
 */
export function toBrowseSalesInput(params: URLSearchParams): BrowseSalesInput {
  const pair = readPair(params);

  return {
    marketCode: pair?.marketCode ?? optionalText(params, 'market'),
    currencyCode: pair?.currencyCode ?? optionalText(params, 'currency'),
    stores: repeatedText(params, 'store'),
    minDiscountPercentage: optionalInteger(params, 'minDiscount'),
    minPriceMajor: optionalInteger(params, 'min'),
    maxPriceMajor: optionalInteger(params, 'max'),
    releaseYearFrom: optionalInteger(params, 'fromYear'),
    releaseYearTo: optionalInteger(params, 'toYear'),
    sort: optionalText(params, 'sort'),
    page: optionalInteger(params, 'page'),
  };
}
