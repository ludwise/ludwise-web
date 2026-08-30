import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { GameDetailView } from '../../../src/lib/api/contract.js';
import { offersForRendering, type OfferRenderInput } from '../../../src/lib/game/offer-order.js';

interface AffiliateMetadata {
  readonly relationship: 'none' | 'affiliate';
  readonly partner: string | null;
}

const detail = JSON.parse(
  readFileSync(resolve('tests/fixtures/corpus/game-detail-canonical.json'), 'utf8'),
) as { readonly body: GameDetailView };
const group = detail.body.offerGroups.find(
  (candidate) => candidate.market?.code === 'EU' && candidate.currency?.code === 'EUR',
);

if (group === undefined) throw new Error('canonical fixture has no EU/EUR offer group');
const offerGroup = group;

function input(monetization: AffiliateMetadata): OfferRenderInput<AffiliateMetadata> {
  return { monetization, offers: offerGroup.offers };
}

describe('factual offer rendering order', () => {
  it('does not change when affiliate metadata changes', () => {
    const withoutAffiliate = offersForRendering(input({ partner: null, relationship: 'none' }));
    const withAffiliate = offersForRendering(
      input({ partner: 'example-partner', relationship: 'affiliate' }),
    );

    expect(withAffiliate).toEqual(withoutAffiliate);
    expect(withAffiliate.map((offer) => offer.id)).toEqual(
      offerGroup.offers.map((offer) => offer.id),
    );
  });
});
