/**
 * The prop shapes the game primitives pass to each other.
 *
 * `design/system/components/game.md` types GameRow's `price` as `PriceProps`
 * and its `freshness` as `FreshnessIndicatorProps`. Those are the props of two
 * sibling components, which this repository states against the wire contract.
 * The shapes live here rather than beside each caller, so a change to Price or
 * FreshnessIndicator reaches every row at once.
 *
 * An `.astro` component cannot export its `Props` interface, which is why this
 * is a plain module and not a re-export.
 */
import type { DataFreshness, MoneyView } from '../../lib/api/contract.js';
import type { OfferFreshnessInput } from '../../lib/state/freshness.js';

/** Whether a store currently sells the offer. `null` is a third answer. */
export type AvailabilityView = 'available' | 'unavailable' | 'unknown' | null;

/** The props of Price.astro. */
export interface PriceView {
  price: MoneyView | null;
  referencePrice: MoneyView | null;
  discountPercentage: number | null;
  availability: AvailabilityView;
}

/** The props of FreshnessIndicator.astro. */
export interface FreshnessView extends OfferFreshnessInput {
  /** SSR test time. Production callers omit it. */
  nowMs?: number | undefined;
}

/** The one offer a GameCard shows. Structural, so a sale and a home offer satisfy it. */
export interface GameCardOffer {
  price: MoneyView;
  referencePrice: MoneyView | null;
  discountPercentage: number | null;
  /** Named only when the offer is not the plain base game. */
  editionLabel: string | null;
  observedAtMs: number;
  /** The backend's word for this offer. `undefined` when the response carried none. */
  freshness?: DataFreshness | undefined;
  storeName: string;
}

/** The props of GameCard.astro. */
export interface GameCardView {
  title: string;
  /** The canonical game page. Always internal. The card never links to a store. */
  href: string;
  /**
   * A LUDWISE media address. `null` draws the missing-artwork frame. `undefined`
   * draws no frame, for a surface whose contract carries no artwork.
   */
  artworkSrc?: string | null | undefined;
  /** `null` when the game holds no offer in the active region. */
  offer: GameCardOffer | null;
  /** How many stores hold a qualifying offer. Omitted where the contract does not say. */
  storeCount?: number | undefined;
  /** Reduced-precision RFC 3339, so the year is the leading four characters. */
  releaseDate?: string | null | undefined;
}
