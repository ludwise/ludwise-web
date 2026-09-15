import { describe, expect, it } from 'vitest';

import type { PricingRegionsView } from '../../../src/lib/api/contract.js';
import { isApiError } from '../../../src/lib/api/errors.js';
import { findPricingRegion, resolveVisitorRegion } from '../../../src/lib/region/visitor-region.js';

/** The four regions the backend seeds, with DE as the fallback (backend record 0044). */
const REGIONS: PricingRegionsView = {
  regions: [
    {
      countryCode: 'DE',
      marketCode: 'DE',
      marketName: 'Germany',
      currencyCode: 'EUR',
      currencyMinorUnit: 2,
    },
    {
      countryCode: 'GB',
      marketCode: 'GB',
      marketName: 'United Kingdom',
      currencyCode: 'GBP',
      currencyMinorUnit: 2,
    },
    {
      countryCode: 'JP',
      marketCode: 'JP',
      marketName: 'Japan',
      currencyCode: 'JPY',
      currencyMinorUnit: 0,
    },
    {
      countryCode: 'US',
      marketCode: 'US',
      marketName: 'United States',
      currencyCode: 'USD',
      currencyMinorUnit: 2,
    },
  ],
  fallbackCountryCode: 'DE',
};

const NO_SIGNALS = { selectedCountryCode: null, detectedCountryCode: null } as const;

describe('resolveVisitorRegion', () => {
  it('uses the manual choice before the detected country', () => {
    const { region } = resolveVisitorRegion(REGIONS, {
      selectedCountryCode: 'US',
      detectedCountryCode: 'JP',
    });

    expect(region).toEqual({
      countryCode: 'US',
      marketCode: 'US',
      marketName: 'United States',
      currencyCode: 'USD',
      source: 'selected',
    });
  });

  it('uses the detected country when there is no manual choice', () => {
    const { region } = resolveVisitorRegion(REGIONS, { ...NO_SIGNALS, detectedCountryCode: 'JP' });

    expect(region.countryCode).toBe('JP');
    expect(region.currencyCode).toBe('JPY');
    expect(region.source).toBe('detected');
  });

  it('uses the fallback region when no country is known', () => {
    const { region, discardSelection } = resolveVisitorRegion(REGIONS, NO_SIGNALS);

    expect(region.countryCode).toBe('DE');
    expect(region.source).toBe('fallback');
    expect(discardSelection).toBe(false);
  });

  it('uses the fallback region when the detected country has no pricing region', () => {
    const { region } = resolveVisitorRegion(REGIONS, { ...NO_SIGNALS, detectedCountryCode: 'CZ' });

    expect(region.countryCode).toBe('DE');
    expect(region.source).toBe('fallback');
  });

  it('discards a manual choice that is no longer supported, and resolves again', () => {
    const resolution = resolveVisitorRegion(REGIONS, {
      selectedCountryCode: 'FR',
      detectedCountryCode: 'GB',
    });

    expect(resolution.region.countryCode).toBe('GB');
    expect(resolution.region.source).toBe('detected');
    expect(resolution.discardSelection).toBe(true);
  });

  it('keeps a manual choice that is still supported', () => {
    const resolution = resolveVisitorRegion(REGIONS, { ...NO_SIGNALS, selectedCountryCode: 'DE' });

    expect(resolution.region.source).toBe('selected');
    expect(resolution.discardSelection).toBe(false);
  });

  it('takes the market and the currency from the contract, never from the country code', () => {
    const shared: PricingRegionsView = {
      regions: [
        {
          countryCode: 'AT',
          marketCode: 'EU',
          marketName: 'European Union',
          currencyCode: 'EUR',
          currencyMinorUnit: 2,
        },
      ],
      fallbackCountryCode: 'AT',
    };

    const { region } = resolveVisitorRegion(shared, { ...NO_SIGNALS, detectedCountryCode: 'AT' });

    expect(region.marketCode).toBe('EU');
    expect(region.currencyCode).toBe('EUR');
  });

  it('treats a contract with no fallback region as malformed rather than guessing one', () => {
    const broken: PricingRegionsView = { ...REGIONS, fallbackCountryCode: 'XX' };

    let thrown: unknown;
    try {
      resolveVisitorRegion(broken, { ...NO_SIGNALS, detectedCountryCode: 'CZ' });
    } catch (error) {
      thrown = error;
    }

    expect(isApiError(thrown)).toBe(true);
    expect((thrown as { kind: string }).kind).toBe('malformed');
  });
});

describe('findPricingRegion', () => {
  it('finds a supported region by its country code', () => {
    expect(findPricingRegion(REGIONS, 'GB')?.currencyCode).toBe('GBP');
  });

  it('answers nothing for a country code with no region', () => {
    expect(findPricingRegion(REGIONS, 'CZ')).toBeUndefined();
  });
});
