/**
 * How a pricing region reads on a page.
 *
 * The backend sends a country code and a market name. The country name comes
 * from the locale data of the runtime, because a country is not a market. Two
 * countries can share one market (backend record 0044).
 */

import type { PricingRegionView } from '../api/contract.js';

type NamedRegion = Pick<PricingRegionView, 'countryCode' | 'marketName'>;

/** The country name in `locale`, or the market name when the locale data holds none. */
export function formatRegionName(region: NamedRegion, locale: string): string {
  let name: string | undefined;
  try {
    name = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' }).of(
      region.countryCode,
    );
  } catch {
    name = undefined;
  }
  return name === undefined || name === region.countryCode ? region.marketName : name;
}

/** The compact statement of the active region, for example "Germany · EUR". */
export function formatRegionLabel(
  region: NamedRegion & Pick<PricingRegionView, 'currencyCode'>,
  locale: string,
): string {
  return `${formatRegionName(region, locale)} · ${region.currencyCode}`;
}

/** The codes of the market and currency that a region binds, for example "DE · EUR". */
export function formatRegionCodes(
  region: Pick<PricingRegionView, 'marketCode' | 'currencyCode'>,
): string {
  return `${region.marketCode} · ${region.currencyCode}`;
}

/** One choice in a region selector. */
export interface RegionOption {
  readonly countryCode: string;
  readonly name: string;
  /** The name and the currency that the region binds, for example "Japan · JPY". */
  readonly label: string;
  readonly currencyCode: string;
}

/** Every supported region, ordered by its name in `locale`. */
export function regionOptions(
  view: { readonly regions: readonly PricingRegionView[] },
  locale: string,
): RegionOption[] {
  const collator = new Intl.Collator([locale]);
  return view.regions
    .map((region) => ({
      countryCode: region.countryCode,
      name: formatRegionName(region, locale),
      label: formatRegionLabel(region, locale),
      currencyCode: region.currencyCode,
    }))
    .sort((left, right) => collator.compare(left.name, right.name));
}
