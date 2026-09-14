import { describe, expect, it } from 'vitest';

import { listingIndexing, pageHead, type PageHeadInput } from '../../../src/lib/seo/page-head.js';

const PAGE: PageHeadInput = {
  siteUrl: 'https://ludwise.test',
  indexableEnvironment: true,
  indexing: { kind: 'indexable', canonicalPath: '/games' },
  title: 'Games — LUDWISE',
  description: 'Search the LUDWISE game catalogue.',
};

describe('listingIndexing', () => {
  it('keeps a listing with no query string indexable, at its pathname', () => {
    expect(listingIndexing(new URL('https://ludwise.test/games'))).toEqual({
      kind: 'indexable',
      canonicalPath: '/games',
    });
  });

  it('makes a listing with a query string a variant that keeps its query string', () => {
    expect(listingIndexing(new URL('https://ludwise.test/sales?store=orbit&page=2'))).toEqual({
      kind: 'query-variant',
      canonicalPath: '/sales?store=orbit&page=2',
    });
  });

  it('treats a bare question mark as no query string', () => {
    expect(listingIndexing(new URL('https://ludwise.test/games?'))).toEqual({
      kind: 'indexable',
      canonicalPath: '/games',
    });
  });
});

describe('pageHead indexing', () => {
  it('sends no robots value and a canonical URL on the configured origin for an indexable page', () => {
    const head = pageHead(PAGE);

    expect(head.robots).toBeNull();
    expect(head.canonical).toBe('https://ludwise.test/games');
  });

  it('sends noindex, follow for a query variant, whose canonical URL keeps the query string', () => {
    const head = pageHead({
      ...PAGE,
      indexing: { kind: 'query-variant', canonicalPath: '/games?q=orbit&page=2' },
    });

    expect(head.robots).toBe('noindex, follow');
    expect(head.canonical).toBe('https://ludwise.test/games?q=orbit&page=2');
  });

  it('sends noindex and no canonical URL for an error page', () => {
    const head = pageHead({ ...PAGE, indexing: { kind: 'error' } });

    expect(head.robots).toBe('noindex');
    expect(head.canonical).toBeNull();
  });

  it('refuses indexing and link following outside production, whatever the page asks', () => {
    for (const indexing of [
      { kind: 'indexable', canonicalPath: '/games' },
      { kind: 'query-variant', canonicalPath: '/games?q=orbit' },
      { kind: 'error' },
    ] as const) {
      expect(pageHead({ ...PAGE, indexableEnvironment: false, indexing }).robots).toBe(
        'noindex,nofollow',
      );
    }
  });

  it('sends no canonical URL for an error page outside production either', () => {
    const head = pageHead({ ...PAGE, indexableEnvironment: false, indexing: { kind: 'error' } });

    expect(head.canonical).toBeNull();
  });
});

describe('pageHead share metadata', () => {
  const keys = (input: PageHeadInput): string[] => pageHead(input).meta.map((tag) => tag.key);
  const content = (input: PageHeadInput, key: string): string | undefined =>
    pageHead(input).meta.find((tag) => tag.key === key)?.content;

  it('sends the five Open Graph tags and a text card on a page with no image', () => {
    expect(pageHead(PAGE).meta).toEqual([
      { attribute: 'property', key: 'og:title', content: 'Games — LUDWISE' },
      {
        attribute: 'property',
        key: 'og:description',
        content: 'Search the LUDWISE game catalogue.',
      },
      { attribute: 'property', key: 'og:url', content: 'https://ludwise.test/games' },
      { attribute: 'property', key: 'og:type', content: 'website' },
      { attribute: 'property', key: 'og:site_name', content: 'LUDWISE' },
      { attribute: 'name', key: 'twitter:card', content: 'summary' },
    ]);
  });

  it('sends og:image on the configured origin and a large image card where a cover exists', () => {
    const game: PageHeadInput = {
      ...PAGE,
      indexing: { kind: 'indexable', canonicalPath: '/games/orbit' },
      shareCover: { src: '/media/images.example.test/t_cover_big/orbit.jpg', eager: true },
    };

    expect(content(game, 'og:image')).toBe(
      'https://ludwise.test/media/images.example.test/t_cover_big/orbit.jpg',
    );
    expect(content(game, 'twitter:card')).toBe('summary_large_image');
    expect(content(game, 'og:type')).toBe('website');
  });

  it('sends no image dimensions and no image alternative text', () => {
    const game: PageHeadInput = {
      ...PAGE,
      shareCover: { src: '/media/images.example.test/orbit.jpg', eager: true },
    };

    expect(keys(game)).toContain('og:image');
    expect(keys(game).filter((key) => /^(og|twitter):image:/u.test(key))).toEqual([]);
  });

  it('sends a text card where the cover has no address that the media route can carry', () => {
    const game: PageHeadInput = { ...PAGE, shareCover: { src: null, eager: true } };

    expect(keys(game)).not.toContain('og:image');
    expect(content(game, 'twitter:card')).toBe('summary');
  });

  it('sends no og:description where the page has no description', () => {
    expect(keys({ ...PAGE, description: undefined })).not.toContain('og:description');
  });

  it('sends no og:url on an error page, which names no preferred address', () => {
    expect(keys({ ...PAGE, indexing: { kind: 'error' } })).not.toContain('og:url');
  });
});
