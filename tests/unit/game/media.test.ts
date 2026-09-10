/**
 * What the game page renders from the canonical media contract.
 *
 * Vitest cannot render an `.astro` file, so every media decision the page makes
 * lives in this module and is stated here. The page holds the markup alone.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type {
  GameDetailView,
  GameMediaView,
  MediaImageKind,
  MediaImageView,
  MediaVideoView,
} from '../../../src/lib/api/contract.js';
import { mediaForRendering, mediaRouteAddress } from '../../../src/lib/game/media.js';

const UPSTREAM = 'https://images.example.test/provider/image/upload/t_cover_big/demo.jpg';
const PROXIED = '/media/images.example.test/provider/image/upload/t_cover_big/demo.jpg';

function corpusMedia(name: string): GameMediaView {
  const recording = JSON.parse(
    readFileSync(resolve(`tests/fixtures/corpus/${name}.json`), 'utf8'),
  ) as { readonly body: GameDetailView };
  const media = recording.body.media;
  if (media === undefined) throw new Error(`${name} carries no media`);
  return media;
}

function image(url: string, sourceKind: MediaImageKind): MediaImageView {
  return {
    url,
    profile: sourceKind === 'screenshot' ? 'gallery' : sourceKind === 'cover' ? 'cover' : 'hero',
    sourceKind,
    provenance: { providerSlug: 'demo', providerName: 'Demo', observedAtMs: 1 },
  };
}

function video(title: string | null): MediaVideoView {
  return {
    url: `https://videos.example.test/watch/${title ?? 'untitled'}`,
    embedUrl: 'https://videos.example.test/embed/never-read-by-the-page',
    title,
    provenance: { providerSlug: 'demo', providerName: 'Demo', observedAtMs: 1 },
  };
}

function media(parts: Partial<GameMediaView>): GameMediaView {
  return { cover: null, hero: null, screenshots: [], videos: [], ...parts };
}

describe('mediaRouteAddress', () => {
  it('names the upstream host as the first segment of the LUDWISE route', () => {
    expect(mediaRouteAddress(UPSTREAM)).toBe(PROXIED);
  });

  it('refuses a scheme other than https, because the route fetches https alone', () => {
    for (const url of [
      'http://images.example.test/a.jpg',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)',
      '//images.example.test/a.jpg',
      'not an address',
      '',
    ]) {
      expect(mediaRouteAddress(url), url).toBeNull();
    }
  });

  it('refuses an address with no path, because there is no image to ask for', () => {
    expect(mediaRouteAddress('https://images.example.test')).toBeNull();
    expect(mediaRouteAddress('https://images.example.test/')).toBeNull();
  });

  it('refuses a query and a fragment, which the route cannot carry', () => {
    // Dropping either would ask the upstream for a different resource, at an
    // address that says it asked for this one.
    expect(mediaRouteAddress(`${UPSTREAM}?size=large`)).toBeNull();
    expect(mediaRouteAddress(`${UPSTREAM}#top`)).toBeNull();
  });

  it('refuses a port and a credential, which the first segment cannot hold', () => {
    // Written as the two halves separately. A whole credential pair in a URL
    // is what `scripts/audit-public.mjs` blocks from this public repository.
    expect(mediaRouteAddress('https://images.example.test:8443/a.jpg')).toBeNull();
    expect(mediaRouteAddress('https://reader@images.example.test/a.jpg')).toBeNull();
    expect(mediaRouteAddress('https://:opensesame@images.example.test/a.jpg')).toBeNull();
  });
});

describe('the hero band', () => {
  it('renders a landscape picture, eagerly, above the identity block', () => {
    const view = mediaForRendering(media({ hero: image(UPSTREAM, 'artwork') }));

    expect(view.heroBand).toEqual({ src: PROXIED, eager: true });
  });

  it('accepts a source hero as well as an artwork', () => {
    expect(mediaForRendering(media({ hero: image(UPSTREAM, 'hero') })).heroBand).not.toBeNull();
  });

  it('shows no band for a hero the backend promoted from a cover', () => {
    // Cropping portrait key art to 8:3 keeps a thin middle strip and upscales
    // it across the page. The identity block frames it at its own ratio.
    const view = mediaForRendering(media({ hero: image(UPSTREAM, 'cover') }));

    expect(view.heroBand).toBeNull();
    expect(view.cover).toEqual({ src: PROXIED, eager: true });
  });

  it('shows no band for a kind that fills neither slot', () => {
    for (const kind of ['screenshot', 'logo'] as const) {
      const view = mediaForRendering(media({ hero: image(UPSTREAM, kind) }));

      expect(view.heroBand, kind).toBeNull();
      expect(view.cover, kind).toBeNull();
    }
  });

  it('keeps the frame of a band whose address the route cannot express', () => {
    // The contract says the picture exists. Only its address is unusable, so
    // the frame renders the placeholder, as a picture that fails to load does.
    const view = mediaForRendering(
      media({ hero: image('http://images.example.test/a.jpg', 'artwork') }),
    );

    expect(view.heroBand).toEqual({ src: null, eager: true });
  });
});

describe('the cover', () => {
  it('renders beside the title at its own ratio, under a band', () => {
    const view = mediaForRendering(
      media({
        cover: image(UPSTREAM, 'cover'),
        hero: image('https://images.example.test/wide.jpg', 'artwork'),
      }),
    );

    expect(view.cover).toEqual({ src: PROXIED, eager: false });
    expect(view.heroBand).toEqual({ src: '/media/images.example.test/wide.jpg', eager: true });
  });

  it('loads eagerly when it is the one picture above the fold', () => {
    expect(mediaForRendering(media({ cover: image(UPSTREAM, 'cover') })).cover).toEqual({
      src: PROXIED,
      eager: true,
    });
  });

  it('prefers the cover slot over a hero that repeats it', () => {
    // A promoted cover is the same picture at a second image profile. Rendering
    // both would print one picture twice.
    const view = mediaForRendering(
      media({
        cover: image(UPSTREAM, 'cover'),
        hero: image('https://images.example.test/repeat.jpg', 'cover'),
      }),
    );

    expect(view.cover).toEqual({ src: PROXIED, eager: true });
    expect(view.heroBand).toBeNull();
  });
});

describe('the screenshot gallery', () => {
  const shots = [
    image('https://images.example.test/one.jpg', 'screenshot'),
    image('https://images.example.test/two.jpg', 'screenshot'),
  ];

  it('states the count in its heading and keeps every member lazy', () => {
    const gallery = mediaForRendering(media({ screenshots: shots })).gallery;

    expect(gallery?.heading).toBe('2 screenshots');
    expect(gallery?.pictures).toEqual([
      { src: '/media/images.example.test/one.jpg', eager: false },
      { src: '/media/images.example.test/two.jpg', eager: false },
    ]);
  });

  it('says screenshot rather than screenshots for one', () => {
    expect(mediaForRendering(media({ screenshots: [shots[0]!] })).gallery?.heading).toBe(
      '1 screenshot',
    );
  });

  it('caps nothing, because the contract decides how many there are', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      image(`https://images.example.test/shot-${String(index)}.jpg`, 'screenshot'),
    );

    expect(mediaForRendering(media({ screenshots: many })).gallery?.pictures).toHaveLength(12);
  });

  it('drops no member, so the stated count stays true', () => {
    // The heading is the text alternative for the set a visitor sees. A member
    // whose address is unusable keeps its frame and stays in the count.
    const view = mediaForRendering(
      media({
        screenshots: [shots[0]!, image('http://images.example.test/two.jpg', 'screenshot')],
      }),
    );

    expect(view.gallery?.heading).toBe('2 screenshots');
    expect(view.gallery?.pictures).toEqual([
      { src: '/media/images.example.test/one.jpg', eager: false },
      { src: null, eager: false },
    ]);
  });

  it('renders no section when the contract supplies no screenshot', () => {
    expect(mediaForRendering(media({})).gallery).toBeNull();
  });
});

describe('the video list', () => {
  it('states the count and links to the address a visitor opens', () => {
    const videos = mediaForRendering(media({ videos: [video('In motion'), video('Behind it')] }));

    expect(videos.videos?.heading).toBe('2 videos');
    expect(videos.videos?.links).toEqual([
      { href: 'https://videos.example.test/watch/In motion', label: 'In motion' },
      { href: 'https://videos.example.test/watch/Behind it', label: 'Behind it' },
    ]);
  });

  it('says video rather than videos for one', () => {
    expect(mediaForRendering(media({ videos: [video('Only')] })).videos?.heading).toBe('1 video');
  });

  it('labels one untitled video without a number nobody can use', () => {
    const view = mediaForRendering(media({ videos: [video('Named'), video(null)] }));

    expect(view.videos?.links.map((link) => link.label)).toEqual(['Named', 'Video']);
  });

  it('numbers untitled videos by their position, once more than one appears', () => {
    const view = mediaForRendering(media({ videos: [video(null), video('Named'), video(null)] }));

    expect(view.videos?.links.map((link) => link.label)).toEqual(['Video 1', 'Named', 'Video 3']);
  });

  it('never reads the embed address, because the page renders no player', () => {
    const view = mediaForRendering(media({ videos: [video('In motion')] }));

    expect(JSON.stringify(view)).not.toContain('never-read-by-the-page');
  });

  it('renders no section when the contract supplies no video', () => {
    expect(mediaForRendering(media({})).videos).toBeNull();
  });
});

describe('a game with no media', () => {
  it('renders nothing at all when the deployment predates media', () => {
    expect(mediaForRendering(undefined)).toEqual({
      heroBand: null,
      cover: null,
      gallery: null,
      videos: null,
    });
  });

  it('renders nothing at all when the game carries none', () => {
    expect(mediaForRendering(corpusMedia('game-detail-no-offers'))).toEqual({
      heroBand: null,
      cover: null,
      gallery: null,
      videos: null,
    });
  });
});

describe('the recorded backend answers', () => {
  it('gives the canonical game a band, a cover, a gallery and a video', () => {
    const view = mediaForRendering(corpusMedia('game-detail-canonical'));

    expect(view.heroBand).toEqual({
      src: '/media/images.igdb.com/igdb/image/upload/t_1080p/demo-artwork.jpg',
      eager: true,
    });
    expect(view.cover).toEqual({
      src: '/media/images.igdb.com/igdb/image/upload/t_cover_big/demo-cover.jpg',
      eager: false,
    });
    expect(view.gallery?.heading).toBe('2 screenshots');
    expect(view.videos?.links).toEqual([
      {
        href: 'https://www.youtube.com/watch?v=demo-000001',
        label: 'Canonical Demo Game in motion',
      },
    ]);
  });

  it('gives the promoted-cover game one eager cover and no band', () => {
    const view = mediaForRendering(corpusMedia('game-detail-promoted-cover'));

    expect(view.heroBand).toBeNull();
    expect(view.cover).toEqual({
      src: '/media/images.igdb.com/igdb/image/upload/t_cover_big/demo-cover-only.jpg',
      eager: true,
    });
  });
});
