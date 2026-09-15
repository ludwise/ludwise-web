/**
 * The supported pricing regions, held for one isolate.
 *
 * Every rendered page shows the region control, so without this cache every
 * page would cost one more backend read. The backend changes the region set
 * only by a migration, and it holds its own copy for 60 seconds.
 *
 * When a new read fails, the last regions this isolate read stay usable for a
 * bounded time. They are regions the backend already validated. Past that
 * bound, the failure reaches the page.
 */

import type { PricingRegionsView } from '../api/contract.js';

export interface PricingRegionCacheOptions {
  readonly now: () => number;
  /** How long a read answers without asking the backend again. */
  readonly freshForMs: number;
  /** How long a read may stand in for a failed one. */
  readonly usableForMs: number;
}

export interface PricingRegionCache {
  /** The regions, from memory or from `load`. It throws what `load` threw when no usable copy exists. */
  read(load: () => Promise<PricingRegionsView>): Promise<PricingRegionsView>;
}

export const REGION_CACHE_FRESH_MS = 60_000;
export const REGION_CACHE_USABLE_MS = 60 * 60_000;

export function createPricingRegionCache(options: PricingRegionCacheOptions): PricingRegionCache {
  let held: { readonly view: PricingRegionsView; readonly readAtMs: number } | undefined;

  const ageOf = (entry: { readonly readAtMs: number }): number => options.now() - entry.readAtMs;

  return {
    async read(load) {
      if (held !== undefined && ageOf(held) < options.freshForMs) return held.view;

      try {
        const view = await load();
        held = { view, readAtMs: options.now() };
        return view;
      } catch (error) {
        if (held !== undefined && ageOf(held) < options.usableForMs) return held.view;
        throw error;
      }
    },
  };
}
