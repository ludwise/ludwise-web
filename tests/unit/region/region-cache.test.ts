import { describe, expect, it } from 'vitest';

import type { PricingRegionsView } from '../../../src/lib/api/contract.js';
import { LudwiseApiError } from '../../../src/lib/api/errors.js';
import { createPricingRegionCache } from '../../../src/lib/region/region-cache.js';

const FIRST: PricingRegionsView = {
  regions: [
    {
      countryCode: 'DE',
      marketCode: 'DE',
      marketName: 'Germany',
      currencyCode: 'EUR',
      currencyMinorUnit: 2,
    },
  ],
  fallbackCountryCode: 'DE',
};
const SECOND: PricingRegionsView = { ...FIRST, fallbackCountryCode: 'DE', regions: [] };

const FRESH_MS = 60_000;
const USABLE_MS = 3_600_000;

function harness() {
  let nowMs = 1_000_000;
  const cache = createPricingRegionCache({
    now: () => nowMs,
    freshForMs: FRESH_MS,
    usableForMs: USABLE_MS,
  });
  let loads = 0;
  return {
    cache,
    advance: (ms: number) => {
      nowMs += ms;
    },
    loads: () => loads,
    answer: (view: PricingRegionsView) => async () => {
      loads += 1;
      return view;
    },
    fail: async (): Promise<PricingRegionsView> => {
      loads += 1;
      throw new LudwiseApiError('unavailable', 'pricing-regions.list');
    },
  };
}

describe('createPricingRegionCache', () => {
  it('reads the regions once while they are fresh', async () => {
    const h = harness();

    await h.cache.read(h.answer(FIRST));
    h.advance(FRESH_MS - 1);
    const second = await h.cache.read(h.answer(SECOND));

    expect(second).toBe(FIRST);
    expect(h.loads()).toBe(1);
  });

  it('reads them again once they are no longer fresh', async () => {
    const h = harness();

    await h.cache.read(h.answer(FIRST));
    h.advance(FRESH_MS);
    const second = await h.cache.read(h.answer(SECOND));

    expect(second).toBe(SECOND);
    expect(h.loads()).toBe(2);
  });

  it('keeps the last regions it read when a later read fails', async () => {
    const h = harness();

    await h.cache.read(h.answer(FIRST));
    h.advance(USABLE_MS - 1);

    await expect(h.cache.read(h.fail)).resolves.toBe(FIRST);
  });

  it('fails when the last regions it read are too old to use', async () => {
    const h = harness();

    await h.cache.read(h.answer(FIRST));
    h.advance(USABLE_MS);

    await expect(h.cache.read(h.fail)).rejects.toBeInstanceOf(LudwiseApiError);
  });

  it('fails when it has never read the regions', async () => {
    const h = harness();

    await expect(h.cache.read(h.fail)).rejects.toBeInstanceOf(LudwiseApiError);
  });

  it('does not extend the age of old regions when it reuses them', async () => {
    const h = harness();

    await h.cache.read(h.answer(FIRST));
    h.advance(USABLE_MS - 10);
    await h.cache.read(h.fail);
    h.advance(10);

    await expect(h.cache.read(h.fail)).rejects.toBeInstanceOf(LudwiseApiError);
  });
});
