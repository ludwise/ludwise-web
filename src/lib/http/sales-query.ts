/**
 * Where a `/sales` query string becomes sales browsing input.
 *
 * Parameter names match `/games` wherever they mean the same thing, so the
 * link-building helpers transfer unchanged. `min` and `max` are the exception:
 * minor units on `/games`, whole major units here, which
 * `BrowseSalesInput.minPriceMajor` carries in its own name.
 *
 * No `q` - name search lives at `/games`, and answering it here would mean a
 * second relevance ranking. No `discounted`, because the page is discounts.
 * Nothing here corrects a value. See query-params.ts on blank versus malformed.
 */

import { optionalInteger, optionalText, repeatedText } from './query-params.js';
import type { BrowseSalesInput } from '../api/contract.js';
import type { PricingPair } from '../region/visitor-region.js';

/** The `/sales` filters a visitor can set. The market and the currency are not among them. */
export type SalesFilters = Omit<BrowseSalesInput, 'marketCode' | 'currencyCode'>;

/**
 * Reads the filters a visitor asked for. Range rules belong to the use case.
 *
 * `min` and `max` are whole units of the region's currency, as a visitor types
 * them into "Lowest price". They are not minor units. `browseSales` converts
 * them once it knows that currency's exponent.
 */
export function readSalesFilters(params: URLSearchParams): SalesFilters {
  return {
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

/** The `/v1/sales` input: the visitor's filters, in the visitor region's pair. */
export function toBrowseSalesInput(filters: SalesFilters, pair: PricingPair): BrowseSalesInput {
  return { ...filters, marketCode: pair.marketCode, currencyCode: pair.currencyCode };
}
