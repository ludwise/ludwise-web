/**
 * Where a `/games` query string becomes game search input.
 *
 * The rules for reading a submitted GET form live in query-params.ts, which
 * `/sales` reads through as well. A blank means not supplied, and a malformed
 * value is carried through to be refused out loud.
 */

import { optionalInteger, optionalText, repeatedText } from './query-params.js';
import type { GameSearchInput } from '../api/contract.js';
import type { PricingPair } from '../region/visitor-region.js';

/** The `/games` search and filters a visitor can set. The market and the currency are not among them. */
export type GameSearchFilters = Omit<GameSearchInput, 'marketCode' | 'currencyCode'>;

/** Reads the search and filters a visitor asked for. Range rules belong to the use case. */
export function readGameSearchFilters(params: URLSearchParams): GameSearchFilters {
  const discounted = optionalText(params, 'discounted');

  return {
    query: optionalText(params, 'q'),
    page: optionalInteger(params, 'page'),
    stores: repeatedText(params, 'store'),
    minPriceMinor: optionalInteger(params, 'min'),
    maxPriceMinor: optionalInteger(params, 'max'),
    discounted: discounted === undefined ? undefined : discounted !== 'false',
    releaseYearFrom: optionalInteger(params, 'fromYear'),
    releaseYearTo: optionalInteger(params, 'toYear'),
  };
}

/** Whether a filter names a price, which only a pricing pair gives a meaning. */
function namesAPrice(filters: GameSearchFilters): boolean {
  return (
    filters.minPriceMinor !== undefined ||
    filters.maxPriceMinor !== undefined ||
    filters.discounted === true
  );
}

/**
 * The `/v1/games` input: the visitor's search, and the visitor region's pair
 * when a filter names a price.
 *
 * `/v1/games` returns no price, and it reads a pair as a filter on which games
 * hold an offer in that pair. With no price filter, a pair would hide every
 * game with no offer in the region. `readPair` runs only when a filter names a
 * price, so a search with no price filter never waits for the region.
 */
export async function toGameSearchInput(
  filters: GameSearchFilters,
  readPair: () => Promise<PricingPair>,
): Promise<GameSearchInput> {
  const pricing = namesAPrice(filters) ? await readPair() : undefined;

  return {
    ...filters,
    marketCode: pricing?.marketCode,
    currencyCode: pricing?.currencyCode,
  };
}
