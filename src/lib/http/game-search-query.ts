/**
 * Where a `/games` query string becomes game search input.
 *
 * The rules for reading a submitted GET form live in query-params.ts, which
 * `/sales` reads through as well. A blank means not supplied, and a malformed
 * value is carried through to be refused out loud.
 */

import { optionalInteger, optionalText, repeatedText } from './query-params.js';
import type { GameSearchInput } from '../api/contract.js';

/** Reads the filters a visitor asked for. Range and pairing rules belong to the use case. */
export function toGameSearchInput(params: URLSearchParams): GameSearchInput {
  const discounted = optionalText(params, 'discounted');

  return {
    query: optionalText(params, 'q'),
    page: optionalInteger(params, 'page'),
    stores: repeatedText(params, 'store'),
    marketCode: optionalText(params, 'market'),
    currencyCode: optionalText(params, 'currency'),
    minPriceMinor: optionalInteger(params, 'min'),
    maxPriceMinor: optionalInteger(params, 'max'),
    discounted: discounted === undefined ? undefined : discounted !== 'false',
    releaseYearFrom: optionalInteger(params, 'fromYear'),
    releaseYearTo: optionalInteger(params, 'toYear'),
  };
}
