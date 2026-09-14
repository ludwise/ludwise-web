/**
 * What a surface has earned the right to explain about its own data.
 *
 * An explanation is a claim. "A price here carries the time LUDWISE read it"
 * is true only where a price and a check time reached the page. A page that
 * could not load, and a catalog that has observed nothing, hold neither. The
 * same words there describe data that does not exist, which `PRODUCT.md` §120
 * forbids as firmly as a fabricated value.
 *
 * A note about stale prices reads the backend word, as the indicator beside
 * it does. Neither reads an age threshold.
 */

import type { PricedFreshness } from './freshness.js';

/** An offer, in the fields an explanation can depend on. */
export interface ExplainableOffer extends PricedFreshness {
  /**
   * Worked out by the backend from the two prices a store supplied.
   *
   * `null` where the store supplied nothing to compare, which is also the
   * answer for every offer that is not discounted.
   */
  readonly discountPercentage: number | null;
}

/** Which explanations the data on one surface supports. */
export interface SurfaceProvenance {
  /** A priced offer carries the time LUDWISE read it. */
  readonly hasCheckTimes: boolean;
  /** The backend calls a priced offer stale. */
  readonly hasStalePrices: boolean;
  /** A discount LUDWISE worked out from two store prices is on screen. */
  readonly hasDerivedDiscounts: boolean;
}

/**
 * Only offers that carry a price count, as in `surfaceFreshness`.
 *
 * Every note explains something a visitor can read beside a price. An offer
 * the store quoted none for puts nothing on screen for them to ask about.
 */
export function surfaceProvenance(offers: readonly ExplainableOffer[]): SurfaceProvenance {
  const priced = offers.filter((offer) => offer.price !== null);

  return {
    hasCheckTimes: priced.some((offer) => offer.observedAtMs !== null),
    hasStalePrices: priced.some((offer) => offer.freshness === 'stale'),
    hasDerivedDiscounts: priced.some((offer) => offer.discountPercentage !== null),
  };
}

/**
 * Whether the surface holds anything an explanation could be about.
 *
 * A stale price is one a surface already has a check time for, so it is not a
 * separate answer here. A surface with no priced offer explains nothing at all.
 */
export function explainsProvenance(provenance: SurfaceProvenance): boolean {
  return provenance.hasCheckTimes || provenance.hasDerivedDiscounts;
}
