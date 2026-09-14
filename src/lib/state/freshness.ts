/**
 * The one presentation path for the freshness word the backend sends.
 *
 * The backend owns the word (`OfferView.freshness`, architecture decision
 * record 0042 in `ludwise-backend`). This module renders it and never computes
 * one from an age. `src/lib/formatting/freshness.ts` owns the phrase for the age.
 */

import type { DataFreshness, OfferView } from '../api/contract.js';
import { formatCheckedPhrase } from '../formatting/freshness.js';

/**
 * What the indicator beside one price shows.
 *
 * `unavailable` comes from the availability field, not from the word.
 * `not_provided` means the response carried no word, so nothing is claimed.
 */
export type OfferFreshnessState = DataFreshness | 'unavailable' | 'not_provided';

/** One offer, in the fields its freshness indicator reads. */
export interface OfferFreshnessInput {
  readonly availability: OfferView['availability'];
  readonly freshness: DataFreshness | undefined;
  readonly observedAtMs: number | null;
  readonly storeName: string;
}

export interface OfferFreshnessView {
  readonly state: OfferFreshnessState;
  /** Read before the phrase. Only a stale offer carries one. */
  readonly warning: string | null;
  readonly phrase: string;
  /** The instant behind the phrase, for the exact timestamp. */
  readonly observedAtMs: number | null;
}

export function offerFreshnessView(input: OfferFreshnessInput, nowMs: number): OfferFreshnessView {
  const { availability, freshness, observedAtMs, storeName } = input;
  const view = (state: OfferFreshnessState, phrase: string, warning: string | null = null) => ({
    state,
    warning,
    phrase,
    observedAtMs,
  });
  const checkedPhrase =
    observedAtMs === null ? 'Check time not provided' : formatCheckedPhrase(observedAtMs, nowMs);

  if (availability === 'unavailable')
    return view('unavailable', `${storeName} temporarily unavailable`);

  switch (freshness) {
    case 'never_verified':
      return view('never_verified', 'Not checked yet');
    case 'stale':
      return view('stale', checkedPhrase, 'Price may be out of date');
    case 'recently_verified':
      return view('recently_verified', checkedPhrase);
    case undefined:
      return view('not_provided', 'Freshness not provided');
  }
}

/**
 * An offer, in the fields a page's freshness reads.
 *
 * Structural, so both the game-detail and the sales offer satisfy it.
 */
export interface PricedFreshness {
  readonly price: OfferView['price'];
  readonly freshness?: DataFreshness | undefined;
  readonly observedAtMs: number | null;
}

/** What a page of offers says about its own prices. */
export interface SurfaceFreshness {
  /** `null` when no priced offer on the page carries a word. */
  readonly word: DataFreshness | null;
  /** The oldest instant among the stale priced offers, for the page warning. */
  readonly oldestStaleObservedAtMs: number | null;
}

/**
 * The page word, composed from the words on its priced offers.
 *
 * `stale` outranks `never_verified`, which outranks `recently_verified`. The
 * backend uses this rule for a home list word (`summarizeDataFreshness`).
 * Record 0042 sets it for a page, so one stale priced offer makes the page warn.
 */
export function surfaceFreshness(offers: readonly PricedFreshness[]): SurfaceFreshness {
  const worded = offers.filter(
    (offer): offer is PricedFreshness & { freshness: DataFreshness } =>
      offer.price !== null && offer.freshness !== undefined,
  );
  const words = new Set(worded.map((offer) => offer.freshness));
  const staleInstants = worded
    .filter((offer) => offer.freshness === 'stale')
    .map((offer) => offer.observedAtMs)
    .filter((instant): instant is number => instant !== null);

  const word: DataFreshness | null = words.has('stale')
    ? 'stale'
    : words.has('never_verified')
      ? 'never_verified'
      : words.has('recently_verified')
        ? 'recently_verified'
        : null;

  return {
    word,
    oldestStaleObservedAtMs: staleInstants.length === 0 ? null : Math.min(...staleInstants),
  };
}
