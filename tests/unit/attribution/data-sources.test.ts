import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GameDetailView } from '../../../src/lib/api/contract.js';
import { dataSourceGroups } from '../../../src/lib/attribution/data-sources.js';

const view = (parts: Partial<GameDetailView>): GameDetailView => ({
  id: 'game-id',
  slug: 'game-slug',
  title: 'Game',
  metadata: null,
  metadataProvenance: [],
  offerGroups: [],
  ...parts,
});

const provenance = (sourceName: string) =>
  ({ field: 'summary', sourceName, method: 'direct', observedAtMs: 1 }) as const;

const mediaProvenance = (providerName: string) =>
  ({ providerSlug: providerName.toLowerCase(), providerName, observedAtMs: 1 }) as const;

const image = (providerName: string) =>
  ({
    url: 'https://media.example.test/image.jpg',
    profile: 'cover',
    sourceKind: 'cover',
    provenance: mediaProvenance(providerName),
  }) as const;

const video = (providerName: string) =>
  ({
    url: 'https://video.example.test/watch',
    embedUrl: null,
    title: null,
    provenance: mediaProvenance(providerName),
  }) as const;

const offer = (sourceName: string | null) =>
  ({
    id: 'offer-id',
    storeName: 'Orbit Market',
    storeSlug: 'orbit-market',
    storePageUrl: null,
    offerUrl: null,
    kind: 'base_game',
    editionLabel: null,
    availability: 'available',
    price: null,
    referencePrice: null,
    discountPercentage: null,
    discountEndsAtMs: null,
    sourceName,
    observedAtMs: 1,
  }) as const;

const offerGroup = (...offers: readonly ReturnType<typeof offer>[]) =>
  ({ market: null, currency: null, offers }) as const;

describe('the data sources a game page carried', () => {
  it('credits every source behind the game information', () => {
    const groups = dataSourceGroups(
      view({ metadataProvenance: [provenance('IGDB'), provenance('Orbit Source')] }),
    );

    expect(groups).toEqual([
      {
        id: 'gameInformation',
        credits: [
          { name: 'IGDB', url: 'https://www.igdb.com/' },
          { name: 'Orbit Source', url: null },
        ],
      },
    ]);
  });

  it('names one provider once, whatever it credited', () => {
    // The canonical fixture carries five metadata fields from one source. A
    // credit repeated per field reads as five providers.
    const groups = dataSourceGroups(
      view({
        metadataProvenance: [provenance('IGDB'), provenance('igdb'), provenance('IGDB')],
      }),
    );

    expect(groups[0]?.credits).toEqual([{ name: 'IGDB', url: 'https://www.igdb.com/' }]);
  });

  it('credits every source behind the images and the video', () => {
    const groups = dataSourceGroups(
      view({
        media: {
          cover: image('IGDB'),
          hero: null,
          screenshots: [image('Orbit Source')],
          videos: [video('Delta Source')],
        },
      }),
    );

    expect(groups.find((group) => group.id === 'imagesAndVideo')?.credits).toEqual([
      { name: 'IGDB', url: 'https://www.igdb.com/' },
      { name: 'Orbit Source', url: null },
      { name: 'Delta Source', url: null },
    ]);
  });

  it('credits every source behind the offers and the prices', () => {
    const groups = dataSourceGroups(
      view({ offerGroups: [offerGroup(offer('Steam'), offer('Orbit Source'))] }),
    );

    expect(groups).toEqual([
      {
        id: 'offersAndPrices',
        credits: [
          { name: 'Steam', url: 'https://store.steampowered.com/' },
          { name: 'Orbit Source', url: null },
        ],
      },
    ]);
  });

  it('credits no source for an offer that recorded none', () => {
    // A null source is the backend saying it does not know. A credit invented
    // from the store name would be an attribution nobody recorded.
    expect(dataSourceGroups(view({ offerGroups: [offerGroup(offer(null))] }))).toEqual([]);
  });

  it('reads a recorded response in one fixed group order', () => {
    const detail = JSON.parse(
      readFileSync(resolve('tests/fixtures/corpus/game-detail-canonical.json'), 'utf8'),
    ) as { readonly body: GameDetailView };

    expect(dataSourceGroups(detail.body)).toEqual([
      { id: 'gameInformation', credits: [{ name: 'Orbit Source', url: null }] },
      { id: 'imagesAndVideo', credits: [{ name: 'IGDB', url: 'https://www.igdb.com/' }] },
      {
        id: 'offersAndPrices',
        credits: [
          { name: 'Orbit Source', url: null },
          { name: 'Copper Source', url: null },
        ],
      },
    ]);
  });
});
