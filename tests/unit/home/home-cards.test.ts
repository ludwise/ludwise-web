/**
 * What a home list renders from the `/v1/home/*` contract. Vitest cannot render
 * an `.astro` file, so the decisions live in `src/lib/home/home-cards.ts`.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type {
  HomeGameView,
  HomeOfferView,
  RecentlyAddedView,
} from '../../../src/lib/api/contract.js';
import {
  homeGameCard,
  homeListFreshness,
  homeListProvenance,
} from '../../../src/lib/home/home-cards.js';

const OFFER: HomeOfferView = {
  storeSlug: 'aurora-market',
  storeName: 'Aurora Market',
  editionLabel: null,
  price: { amountMinor: 2999, currencyCode: 'EUR', minorUnit: 2 },
  referencePrice: { amountMinor: 5999, currencyCode: 'EUR', minorUnit: 2 },
  discountPercentage: 50,
  observedAtMs: 1_750_000_000_000,
  freshness: 'recently_verified',
};

function game(overrides: Partial<HomeGameView> = {}): HomeGameView {
  return {
    id: 'g1',
    slug: 'half-off-demo',
    title: 'Half Off Demo Game',
    artwork: null,
    offer: OFFER,
    ...overrides,
  };
}

function recording(name: string): RecentlyAddedView {
  const file = resolve(`tests/fixtures/corpus/${name}.json`);
  return (JSON.parse(readFileSync(file, 'utf8')) as { body: RecentlyAddedView }).body;
}

describe('homeGameCard', () => {
  it('links to the canonical game page and carries the offer with its store and freshness', () => {
    expect(homeGameCard(game())).toEqual({
      title: 'Half Off Demo Game',
      href: '/games/half-off-demo',
      artworkSrc: null,
      offer: OFFER,
    });
  });

  it('keeps a game that holds no offer in the region, with no price', () => {
    expect(homeGameCard(game({ offer: null })).offer).toBeNull();
  });

  it('serves the recorded artwork from the LUDWISE origin', () => {
    const withArtwork = recording('home-recently-added-de').games.find(
      (item) => item.artwork !== null,
    );

    expect(homeGameCard(withArtwork!).artworkSrc).toBe(
      '/media/images.igdb.com/igdb/image/upload/t_1080p/demo-cover-only.jpg',
    );
  });

  it('draws the missing-artwork frame when the route cannot carry the address', () => {
    const artwork = recording('home-recently-added-de').games.find(
      (item) => item.artwork !== null,
    )!.artwork!;

    const card = homeGameCard(game({ artwork: { ...artwork, url: 'http://insecure.test/a.jpg' } }));

    expect(card.artworkSrc).toBeNull();
  });
});

describe('homeListFreshness', () => {
  it('takes the word the backend gave the list, not one composed from the offers', () => {
    const view = {
      freshness: 'recently_verified' as const,
      games: [game({ offer: { ...OFFER, freshness: 'stale' } })],
    };

    expect(homeListFreshness(view).word).toBe('recently_verified');
  });

  it('dates a stale list by its oldest stale price', () => {
    const view = {
      freshness: 'stale' as const,
      games: [
        game({ offer: { ...OFFER, freshness: 'stale', observedAtMs: 300 } }),
        game({ offer: { ...OFFER, freshness: 'stale', observedAtMs: 100 } }),
        game({ offer: { ...OFFER, freshness: 'recently_verified', observedAtMs: 50 } }),
        game({ offer: null }),
      ],
    };

    expect(homeListFreshness(view)).toEqual({ word: 'stale', oldestStaleObservedAtMs: 100 });
  });

  it('claims nothing for a list that shows no offer', () => {
    expect(homeListFreshness({ freshness: null, games: [game({ offer: null })] })).toEqual({
      word: null,
      oldestStaleObservedAtMs: null,
    });
  });
});

describe('homeListProvenance', () => {
  it('explains only what the priced offers of the list carry', () => {
    const view = {
      freshness: 'stale' as const,
      games: [game({ offer: { ...OFFER, freshness: 'stale', discountPercentage: null } })],
    };

    expect(homeListProvenance(view)).toEqual({
      hasCheckTimes: true,
      hasStalePrices: true,
      hasDerivedDiscounts: false,
    });
  });

  it('earns no note for a list that shows no offer', () => {
    expect(homeListProvenance({ freshness: null, games: [game({ offer: null })] })).toEqual({
      hasCheckTimes: false,
      hasStalePrices: false,
      hasDerivedDiscounts: false,
    });
  });
});
