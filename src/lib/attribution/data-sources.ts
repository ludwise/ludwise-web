/**
 * Which providers a game page must credit, from the provenance it carried.
 *
 * The page credits what it received, so a game with no offers credits no
 * offer source. The group identifiers are stable and the labels are not here:
 * visitor text belongs in the template that renders it.
 */
import type { GameDetailView, GameMediaView } from '../api/contract.js';
import { providerCredit, type ProviderCredit } from './providers.js';

export type DataSourceGroupId = 'gameInformation' | 'imagesAndVideo' | 'offersAndPrices';

export interface DataSourceGroup {
  readonly id: DataSourceGroupId;
  readonly credits: readonly ProviderCredit[];
}

/** One credit per provider, in the order the page first carried it. */
const credits = (names: readonly string[]): readonly ProviderCredit[] => {
  const seen = new Map<string, ProviderCredit>();
  for (const name of names) {
    const credit = providerCredit(name);
    const key = credit.url ?? name.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, credit);
  }
  return [...seen.values()];
};

/** Every picture and video the page carried, in the order a reader meets them. */
const mediaSourceNames = (media: GameMediaView | undefined): readonly string[] =>
  media === undefined
    ? []
    : [media.cover, media.hero, ...media.screenshots, ...media.videos]
        .filter((item) => item !== null)
        .map((item) => item.provenance.providerName);

/**
 * The source of each offer, and never the store that sells it.
 *
 * `storeName` names the seller. `sourceName` names where LUDWISE read the
 * price. Crediting the seller would credit a party that supplied nothing.
 */
const offerSourceNames = (view: GameDetailView): readonly string[] =>
  view.offerGroups
    .flatMap((group) => group.offers)
    .map((offer) => offer.sourceName)
    .filter((name) => name !== null);

export function dataSourceGroups(view: GameDetailView): readonly DataSourceGroup[] {
  const groups: readonly DataSourceGroup[] = [
    {
      id: 'gameInformation',
      credits: credits(view.metadataProvenance.map((item) => item.sourceName)),
    },
    { id: 'imagesAndVideo', credits: credits(mediaSourceNames(view.media)) },
    { id: 'offersAndPrices', credits: credits(offerSourceNames(view)) },
  ];

  return groups.filter((group) => group.credits.length > 0);
}
