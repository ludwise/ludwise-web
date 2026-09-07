/**
 * How old the data on a surface is, and the one place that decides.
 *
 * `freshnessLevel` answers for a single observation, which is what a row or a
 * card shows. `surfaceFreshness` answers for a whole page, which is what
 * decides whether the page may present itself as current.
 *
 * The second question is the one this module exists for. `PRODUCT.md` §55
 * requires that a visitor is not misled into thinking stale data was freshly
 * verified. A per-row age alone leaves that to be worked out row by row.
 */

import type { MoneyView, OfferView } from '../api/contract.js';

/** The contract's availability, so this module needs nothing from a component. */
type Availability = OfferView['availability'];

/**
 * Where an observation sits between just made and too old to trust.
 *
 * `unknown` is not a degree of age. It means no observation time was recorded,
 * which is a third answer and never renders as "old".
 *
 * `unavailable` belongs to one offer rather than to a surface. A store that
 * does not sell an offer has no price whose age is worth reporting.
 */
export type FreshnessLevel = 'fresh' | 'aging' | 'stale' | 'unknown' | 'unavailable';

/** The levels an observation with a known time can carry. */
export type AgeLevel = Extract<FreshnessLevel, 'fresh' | 'aging' | 'stale'>;

export const FRESHNESS_MINUTE_MS = 60 * 1000;
export const FRESHNESS_HOUR_MS = 60 * FRESHNESS_MINUTE_MS;
export const FRESHNESS_DAY_MS = 24 * FRESHNESS_HOUR_MS;
export const FRESHNESS_WEEK_MS = 7 * FRESHNESS_DAY_MS;

export interface ObservationInput {
  readonly availability: Availability;
  readonly observedAtMs: number | null;
  readonly nowMs: number;
}

/**
 * The age of an observation, or `null` where none was recorded.
 *
 * Clamped at zero. A timestamp ahead of the clock is skew between two machines,
 * and a negative age would render as a price observed in the future.
 */
export function observationAgeMs(observedAtMs: number | null, nowMs: number): number | null {
  return observedAtMs === null ? null : Math.max(0, nowMs - observedAtMs);
}

export function ageLevel(ageMs: number): AgeLevel {
  if (ageMs < FRESHNESS_HOUR_MS) return 'fresh';
  if (ageMs < FRESHNESS_DAY_MS) return 'aging';
  return 'stale';
}

export function freshnessLevel(input: ObservationInput): FreshnessLevel {
  if (input.availability === 'unavailable') return 'unavailable';

  const ageMs = observationAgeMs(input.observedAtMs, input.nowMs);
  return ageMs === null ? 'unknown' : ageLevel(ageMs);
}

/**
 * An offer, in the two fields a surface's currency claim depends on.
 *
 * Structural, so both the game-detail and the sales offer satisfy it.
 */
export interface PricedObservation {
  readonly price: MoneyView | null;
  readonly observedAtMs: number | null;
}

/** What a page of offers lets a surface claim about its own currency. */
export interface SurfaceFreshness {
  /** The level of the newest priced observation. `unknown` when there is none. */
  readonly level: AgeLevel | 'unknown';
  readonly newestObservedAtMs: number | null;
  /** Priced offers carrying an observation time. */
  readonly observedCount: number;
  /** Priced offers on the surface, timed or not. */
  readonly total: number;
}

/**
 * The freshness of a page of offers.
 *
 * Two rules, and both are about what the sentence above the results claims.
 *
 * Only offers that carry a price count. "The newest price here was checked X"
 * is a claim about prices. An offer the store quoted none for holds no price
 * whose age could support it.
 *
 * Of those, the newest wins rather than the oldest. `tests/e2e/game-detail.spec.ts`
 * pins that against a fixture holding a two-day-old offer beside a five-minute-old one.
 */
export function surfaceFreshness(
  offers: readonly PricedObservation[],
  nowMs: number,
): SurfaceFreshness {
  const priced = offers.filter((offer) => offer.price !== null);
  const observed = priced
    .map((offer) => offer.observedAtMs)
    .filter((value): value is number => value !== null);
  const newestObservedAtMs = observed.length === 0 ? null : Math.max(...observed);
  const newestAgeMs = observationAgeMs(newestObservedAtMs, nowMs);

  return {
    level: newestAgeMs === null ? 'unknown' : ageLevel(newestAgeMs),
    newestObservedAtMs,
    observedCount: observed.length,
    total: priced.length,
  };
}
