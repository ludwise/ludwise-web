import { describe, expect, it } from 'vitest';

import {
  formatRegionCodes,
  formatRegionLabel,
  formatRegionName,
  regionOptions,
} from '../../../src/lib/formatting/region.js';

const GERMANY = { countryCode: 'DE', marketName: 'Germany', currencyCode: 'EUR' };

describe('formatRegionName', () => {
  it('names the country in the page language, not by its code', () => {
    expect(formatRegionName({ countryCode: 'CZ', marketName: 'Czech market' }, 'en')).toBe(
      'Czechia',
    );
  });

  it('names a country apart from the market it shares', () => {
    // A country is not a market. Two countries can share one (backend record 0044).
    expect(formatRegionName({ countryCode: 'AT', marketName: 'European Union' }, 'en')).toBe(
      'Austria',
    );
  });

  it('uses the market name when the language holds no name for the code', () => {
    expect(formatRegionName({ countryCode: 'XX', marketName: 'Test market' }, 'en')).toBe(
      'Test market',
    );
  });
});

describe('formatRegionLabel', () => {
  it('states the region and the currency it quotes prices in', () => {
    expect(formatRegionLabel(GERMANY, 'en')).toBe('Germany · EUR');
  });
});

describe('formatRegionCodes', () => {
  // The market code, not the country code: two countries can share one market.
  it('states the market code and the currency code', () => {
    expect(formatRegionCodes({ marketCode: 'EU', currencyCode: 'EUR' })).toBe('EU · EUR');
  });
});

describe('regionOptions', () => {
  const view = {
    fallbackCountryCode: 'DE',
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
  };

  it('offers every supported region once, by name, with the currency it is bound to', () => {
    expect(regionOptions(view, 'en')).toEqual([
      { countryCode: 'DE', name: 'Germany', label: 'Germany · EUR', currencyCode: 'EUR' },
      { countryCode: 'JP', name: 'Japan', label: 'Japan · JPY', currencyCode: 'JPY' },
      {
        countryCode: 'GB',
        name: 'United Kingdom',
        label: 'United Kingdom · GBP',
        currencyCode: 'GBP',
      },
      {
        countryCode: 'US',
        name: 'United States',
        label: 'United States · USD',
        currencyCode: 'USD',
      },
    ]);
  });
});
