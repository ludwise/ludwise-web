/**
 * The one pricing region a visitor reads prices in.
 *
 * The backend owns which regions exist and which market and currency each one
 * selects (backend record 0044). This module only chooses among them. It never
 * pairs a market with a currency itself, and it never converts a price.
 */

import type { PricingRegionsView, PricingRegionView } from '../api/contract.js';
import { LudwiseApiError } from '../api/errors.js';

/** Why this region is active. */
export type RegionSource = 'selected' | 'detected' | 'fallback';

export interface VisitorRegion {
  readonly countryCode: string;
  readonly marketCode: string;
  readonly marketName: string;
  readonly currencyCode: string;
  readonly source: RegionSource;
}

/** The market and currency pair a price-bearing read sends. */
export type PricingPair = Pick<VisitorRegion, 'marketCode' | 'currencyCode'>;

/** What this request knows about the visitor, each value as a country code or `null`. */
export interface RegionSignals {
  /** The region the visitor saved. */
  readonly selectedCountryCode: string | null;
  /** The country the edge reported for this request. */
  readonly detectedCountryCode: string | null;
}

/** What a page renders for the region: the active region and every region a visitor may choose. */
export interface VisitorRegionContext {
  readonly region: VisitorRegion;
  readonly regions: PricingRegionsView;
}

export interface RegionResolution {
  readonly region: VisitorRegion;
  /** True when the saved region is no longer supported, so the saved value must go. */
  readonly discardSelection: boolean;
}

/** The name a resolution failure carries in a log. */
const RESOLVE_OPERATION = 'visitor-region.resolve';

export function findPricingRegion(
  view: PricingRegionsView,
  countryCode: string | null,
): PricingRegionView | undefined {
  return countryCode === null
    ? undefined
    : view.regions.find((region) => region.countryCode === countryCode);
}

function asVisitorRegion(region: PricingRegionView, source: RegionSource): VisitorRegion {
  return {
    countryCode: region.countryCode,
    marketCode: region.marketCode,
    marketName: region.marketName,
    currencyCode: region.currencyCode,
    source,
  };
}

/**
 * Resolves the active region in a fixed order: the saved choice, then the
 * detected country, then the fallback region.
 *
 * @throws {LudwiseApiError} `malformed` when the contract names a fallback
 *   region that it does not list. A guessed pair would show prices for a
 *   region nobody chose.
 */
export function resolveVisitorRegion(
  view: PricingRegionsView,
  signals: RegionSignals,
): RegionResolution {
  const selected = findPricingRegion(view, signals.selectedCountryCode);
  const discardSelection = signals.selectedCountryCode !== null && selected === undefined;
  if (selected !== undefined) {
    return { region: asVisitorRegion(selected, 'selected'), discardSelection };
  }

  const detected = findPricingRegion(view, signals.detectedCountryCode);
  if (detected !== undefined) {
    return { region: asVisitorRegion(detected, 'detected'), discardSelection };
  }

  const fallback = findPricingRegion(view, view.fallbackCountryCode);
  if (fallback === undefined) {
    throw new LudwiseApiError('malformed', RESOLVE_OPERATION);
  }
  return { region: asVisitorRegion(fallback, 'fallback'), discardSelection };
}
