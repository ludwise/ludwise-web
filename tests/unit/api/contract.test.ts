import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  API_ERROR_CODES,
  GAME_SEARCH_PAGE_SIZE,
  MEDIA_IMAGE_KINDS,
  MEDIA_IMAGE_PROFILES,
  REFUSABLE_FIELDS,
  SALE_PAGE_SIZE,
  SALE_SORTS,
  type GameDetailView,
} from '../../../src/lib/api/contract.js';
import { adviseGameSearch, adviseSales } from '../../../src/lib/http/filter-advice.js';
import { failureKindForCode } from '../../../src/lib/api/errors.js';

/**
 * `contract.ts` is mostly interfaces, which the type checker verifies and a
 * unit test cannot add anything to. It also exports runtime values. Those are
 * the error code set, the refusable field allowlist, sort names and page
 * sizes. Those values are real contract surface, because other modules key
 * behavior on them. A value can drift out of step with the backend. That is
 * exactly the kind of change that must fail a build rather than degrade
 * silently in production.
 */

describe('API_ERROR_CODES', () => {
  it('classifies ERR_APP_VALIDATION as rejected, the one code a visitor can fix', () => {
    expect(failureKindForCode('ERR_APP_VALIDATION')).toBe('rejected');
  });

  it('classifies every other fault code as unavailable, never as a guessed kind', () => {
    const faultCodes = API_ERROR_CODES.filter(
      (code) => code !== 'ERR_NOT_FOUND' && code !== 'ERR_APP_VALIDATION',
    );
    for (const code of faultCodes) {
      expect(failureKindForCode(code)).toBe('unavailable');
    }
  });

  it('contains ERR_NOT_FOUND, the one code that is not a fault', () => {
    // failureKindForCode does not classify it at all: the client treats a 404
    // on game detail as an answer (null) before this table is ever consulted.
    expect(API_ERROR_CODES).toContain('ERR_NOT_FOUND');
  });

  it('has no duplicate codes', () => {
    expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
  });
});

describe('REFUSABLE_FIELDS', () => {
  it('is a superset of every field the filter-advice tables know how to word', () => {
    // adviseGameSearch and adviseSales silently drop a field this list does not
    // recognize. So a field present in the advice tables but absent here would
    // never actually be reachable from a real backend rejection.
    const advisedGameFields = [
      'page',
      'marketCode',
      'currencyCode',
      'releaseYearFrom',
      'releaseYearTo',
    ];
    const advisedSalesFields = ['page', 'marketCode', 'currencyCode', 'sort', 'stores'];
    for (const field of [...advisedGameFields, ...advisedSalesFields]) {
      expect(REFUSABLE_FIELDS).toContain(field);
    }
  });

  it('has no duplicate field names', () => {
    expect(new Set(REFUSABLE_FIELDS).size).toBe(REFUSABLE_FIELDS.length);
  });

  it('every field name still produces advice on at least one of the two surfaces', () => {
    // A refusable field with no advice anywhere would surface only the generic
    // "those filters do not go together" heading forever, which is a gap worth
    // catching rather than shipping quietly.
    for (const field of REFUSABLE_FIELDS) {
      const advisedOnGames = adviseGameSearch([field]).length > 0;
      const advisedOnSales = adviseSales([field]).length > 0;
      expect(advisedOnGames || advisedOnSales).toBe(true);
    }
  });
});

describe('SALE_SORTS', () => {
  it('is exactly discount and price, in that order for the default', () => {
    expect(SALE_SORTS).toEqual(['discount', 'price']);
  });
});

describe('page sizes', () => {
  it('are positive integers the backend actually echoes', () => {
    expect(Number.isInteger(GAME_SEARCH_PAGE_SIZE)).toBe(true);
    expect(GAME_SEARCH_PAGE_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(SALE_PAGE_SIZE)).toBe(true);
    expect(SALE_PAGE_SIZE).toBeGreaterThan(0);
  });
});

/**
 * The media a game detail may carry, which is published additively.
 *
 * Two closed vocabularies and one optional property. This suite states three
 * things the type alone cannot. The vocabularies are the ones a renderer may
 * switch on. A response that omits `media` is still a valid detail view. The
 * recorded corpus carries the full shape and the empty one.
 *
 * Nothing here renders anything. How a gallery or a player looks is #53.
 */
const corpus = (name: string): GameDetailView =>
  (
    JSON.parse(readFileSync(resolve('tests/fixtures/corpus', `${name}.json`), 'utf8')) as {
      readonly body: GameDetailView;
    }
  ).body;

describe('the media vocabularies', () => {
  it('are the profiles the backend resolves an address for', () => {
    // A profile is what an image is for. It is never a size word, because the
    // backend decides which variant answers each one behind the contract.
    expect(MEDIA_IMAGE_PROFILES).toEqual(['cover', 'hero', 'gallery']);
  });

  it('are the kinds a picture may actually be', () => {
    expect(MEDIA_IMAGE_KINDS).toEqual(['cover', 'hero', 'artwork', 'screenshot', 'logo']);
  });

  it('have no duplicate members', () => {
    expect(new Set(MEDIA_IMAGE_PROFILES).size).toBe(MEDIA_IMAGE_PROFILES.length);
    expect(new Set(MEDIA_IMAGE_KINDS).size).toBe(MEDIA_IMAGE_KINDS.length);
  });
});

describe('a detail view is valid with media and without it', () => {
  /**
   * A response from a backend that predates media.
   *
   * Annotated rather than inferred, so the object is checked against the
   * contract. `pnpm run typecheck:tests` is what enforces it. A `media` made
   * required would fail here, which states the additive rule as a build error
   * rather than as a comment.
   */
  const withoutMedia: GameDetailView = {
    id: 'g1',
    slug: 'older-backend',
    title: 'Older Backend',
    metadata: null,
    metadataProvenance: [],
    offerGroups: [],
  };

  const withEmptyMedia: GameDetailView = {
    ...withoutMedia,
    media: { cover: null, hero: null, screenshots: [], videos: [] },
  };

  it('reads an omitted media object as a deployment that predates the field', () => {
    // The distinction the optional property exists for. Absent is not empty,
    // and a page must not report "no pictures" on the strength of a rollout.
    expect(withoutMedia.media).toBeUndefined();
    expect('media' in withoutMedia).toBe(false);
  });

  it('reads a present empty media object as a game with no pictures', () => {
    expect(withEmptyMedia.media).toEqual({
      cover: null,
      hero: null,
      screenshots: [],
      videos: [],
    });
  });
});

describe('the recorded corpus carries the media contract', () => {
  it('records a game with a cover, a hero, screenshots and a video', () => {
    // The evidence that this repository holds a real recording rather than a
    // plausible one. Without it the corpus could be copied from the wrong
    // commit and every type assertion above would still pass.
    const media = corpus('game-detail-canonical').media;

    expect(media?.cover?.url).toMatch(/^https:\/\//u);
    expect(media?.hero?.url).toMatch(/^https:\/\//u);
    expect(media?.screenshots.length).toBeGreaterThan(0);
    expect(media?.videos[0]?.url).toMatch(/^https:\/\//u);
    // Both addresses, so a page never builds the second from the first.
    expect(media?.videos[0]?.embedUrl).toMatch(/^https:\/\//u);
  });

  it('records the profiles and kinds this contract publishes', () => {
    const media = corpus('game-detail-canonical').media;
    const images = [media?.cover, media?.hero, ...(media?.screenshots ?? [])].filter(
      (image) => image !== null && image !== undefined,
    );

    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(MEDIA_IMAGE_PROFILES).toContain(image.profile);
      expect(MEDIA_IMAGE_KINDS).toContain(image.sourceKind);
      expect(Object.keys(image.provenance).sort()).toEqual([
        'observedAtMs',
        'providerName',
        'providerSlug',
      ]);
    }
  });

  it('records the empty media shape on a game that holds none', () => {
    expect(corpus('game-detail-no-offers').media).toEqual({
      cover: null,
      hero: null,
      screenshots: [],
      videos: [],
    });
  });
});
