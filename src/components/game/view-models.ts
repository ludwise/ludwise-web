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
import type { MoneyView } from '../../lib/api/contract.js';

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
export interface FreshnessView {
  availability: AvailabilityView;
  observedAtMs: number | null;
  storeName: string;
  /** SSR test time. Production callers omit it. */
  nowMs?: number | undefined;
}
