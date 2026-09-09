/**
 * What a surface has earned the right to explain about its own data.
 *
 * An explanation is a claim. "A price here carries the time LUDWISE read it"
 * is true only where a price and a check time reached the page. A page that
 * could not load, and a catalog that has observed nothing, hold neither. The
 * same words there describe data that does not exist, which `PRODUCT.md` §120
 * forbids as firmly as a fabricated value.
 *
 * `freshness.ts` owns the age boundaries and this module reads them. A note
 * about old prices must fire on the boundary the indicator beside it uses.
 */

import { ageLevel, observationAgeMs, type PricedObservation } from './freshness.js';

/** An offer, in the three fields an explanation can depend on. */
export interface ExplainableOffer extends PricedObservation {
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
  /** A priced offer carries no such time, so the surface renders an absence. */
  readonly hasUntimedPrices: boolean;
  /** A check time is old enough that the price may have changed since. */
  readonly hasOldCheckTimes: boolean;
  /** A discount LUDWISE worked out from two store prices is on screen. */
  readonly hasDerivedDiscounts: boolean;
}

/**
 * Only offers that carry a price count, as in `surfaceFreshness`.
 *
 * Every note explains something a visitor can read beside a price. An offer
 * the store quoted none for puts nothing on screen for them to ask about.
 */
export function surfaceProvenance(
  offers: readonly ExplainableOffer[],
  nowMs: number,
): SurfaceProvenance {
  const priced = offers.filter((offer) => offer.price !== null);
  const ages = priced.map((offer) => observationAgeMs(offer.observedAtMs, nowMs));

  return {
    hasCheckTimes: ages.some((age) => age !== null),
    hasUntimedPrices: ages.some((age) => age === null),
    hasOldCheckTimes: ages.some((age) => age !== null && ageLevel(age) === 'stale'),
    hasDerivedDiscounts: priced.some((offer) => offer.discountPercentage !== null),
  };
}

/**
 * Whether the surface holds anything an explanation could be about.
 *
 * An old check time is one a surface already has, so it is not a separate
 * answer here. A surface with no priced offer explains nothing at all.
 */
export function explainsProvenance(provenance: SurfaceProvenance): boolean {
  return provenance.hasCheckTimes || provenance.hasUntimedPrices || provenance.hasDerivedDiscounts;
}
