/**
 * The two price-bearing lists of the home page, read in the active region.
 *
 * Each list owns its state (ludwise-web#123). A failed read fails its own list
 * and never the other one. `tests/unit/home/home-lists.test.ts` states the rules.
 */

import type { LudwiseApi } from '../api/client.js';
import type { CurrentDiscountsView, RecentlyAddedView } from '../api/contract.js';
import { isApiError, type LudwiseApiError } from '../api/errors.js';
import type { PricingPair, VisitorRegion } from '../region/visitor-region.js';

interface FailedList {
  readonly status: 'failed';
  readonly error: LudwiseApiError;
}

export type HomeListOutcome<View> = { readonly status: 'loaded'; readonly view: View } | FailedList;

export interface HomeLists {
  /** `null` when the region could not be resolved. Then both lists failed. */
  readonly region: VisitorRegion | null;
  readonly currentDiscounts: HomeListOutcome<CurrentDiscountsView>;
  readonly recentlyAdded: HomeListOutcome<RecentlyAddedView>;
}

export interface HomeListPorts {
  readonly resolveRegion: () => Promise<VisitorRegion>;
  readonly api: Pick<LudwiseApi, 'listCurrentDiscounts' | 'listRecentlyAdded'>;
}

/**
 * Reads both lists at the same time, in the pair of the active region.
 *
 * No list is read without a resolved region. When the region fails, both
 * lists fail with that error.
 *
 * @throws The first failure that is not a `LudwiseApiError`.
 */
export async function readHomeLists(ports: HomeListPorts): Promise<HomeLists> {
  let region: VisitorRegion;
  try {
    region = await ports.resolveRegion();
  } catch (error) {
    const failed = failure(error);
    return { region: null, currentDiscounts: failed, recentlyAdded: failed };
  }

  const pair: PricingPair = { marketCode: region.marketCode, currencyCode: region.currencyCode };
  const [currentDiscounts, recentlyAdded] = await Promise.all([
    outcomeOf(ports.api.listCurrentDiscounts(pair)),
    outcomeOf(ports.api.listRecentlyAdded(pair)),
  ]);

  return { region, currentDiscounts, recentlyAdded };
}

/** 503 when no list loaded, and 200 when at least one list loaded. */
export function homeResponseStatus(lists: HomeLists): 200 | 503 {
  const loaded = [lists.currentDiscounts, lists.recentlyAdded].some(
    (outcome) => outcome.status === 'loaded',
  );
  return loaded ? 200 : 503;
}

async function outcomeOf<View>(read: Promise<View>): Promise<HomeListOutcome<View>> {
  try {
    return { status: 'loaded', view: await read };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): FailedList {
  if (!isApiError(error)) throw error;
  return { status: 'failed', error };
}
