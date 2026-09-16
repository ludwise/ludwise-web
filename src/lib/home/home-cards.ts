/**
 * What a home list renders from the `/v1/home/*` contract.
 *
 * The page holds the markup, and this module holds the decisions.
 * `tests/unit/home/home-cards.test.ts` states the rules.
 */

import type { GameCardView } from '../../components/game/view-models.js';
import type { DataFreshness, HomeGameView } from '../api/contract.js';
import { mediaRouteAddress } from '../game/media.js';
import { surfaceFreshness, type SurfaceFreshness } from '../state/freshness.js';
import { surfaceProvenance, type SurfaceProvenance } from '../state/provenance.js';

export function homeGameCard(game: HomeGameView): GameCardView {
  return {
    title: game.title,
    href: `/games/${game.slug}`,
    artworkSrc: game.artwork === null ? null : mediaRouteAddress(game.artwork.url),
    offer: game.offer,
  };
}

/** One home list, in the fields its notices read. */
export interface HomeListInput {
  readonly freshness: DataFreshness | null;
  readonly games: readonly HomeGameView[];
}

/**
 * The freshness notice of one home list. The word is the one the backend gave
 * the list (record 0042). Only the oldest stale instant comes from the offers.
 */
export function homeListFreshness(view: HomeListInput): SurfaceFreshness {
  return {
    word: view.freshness,
    oldestStaleObservedAtMs: surfaceFreshness(offersOf(view)).oldestStaleObservedAtMs,
  };
}

/** The notes that one home list has earned. */
export function homeListProvenance(view: HomeListInput): SurfaceProvenance {
  return surfaceProvenance(offersOf(view));
}

function offersOf(view: HomeListInput) {
  return view.games.flatMap((game) => (game.offer === null ? [] : [game.offer]));
}
