/**
 * The indexing rules and the share metadata in the head of a page.
 *
 * `src/layouts/BaseLayout.astro` renders the result and holds no rule of its
 * own. `tests/unit/seo/page-head.test.ts` states the rules.
 */

import type { MediaPicture } from '../game/media.js';

/**
 * How one page asks a crawler to treat it.
 *
 * A non-production environment can only make the answer more restrictive.
 */
export type PageIndexing =
  /** A real page at its preferred address. */
  | { readonly kind: 'indexable'; readonly canonicalPath: string }
  /** A filtered or paged listing: `noindex, follow`, so a crawler still follows its links. */
  | { readonly kind: 'query-variant'; readonly canonicalPath: string }
  /** An error page, which is never indexed and names no preferred address. */
  | { readonly kind: 'error' };

/** The query-string rule of `/games` and `/sales`. */
export function listingIndexing(url: URL): PageIndexing {
  return url.search === ''
    ? { kind: 'indexable', canonicalPath: url.pathname }
    : { kind: 'query-variant', canonicalPath: `${url.pathname}${url.search}` };
}

export interface PageHeadInput {
  /** The canonical origin, which the runtime configuration supplies. */
  readonly siteUrl: string;
  /** Whether this deployment is meant to be indexed at all. */
  readonly indexableEnvironment: boolean;
  readonly indexing: PageIndexing;
  readonly title: string;
  readonly description?: string | undefined;
  /**
   * The game cover on the media route, which `og:image` names.
   *
   * A page with no cover omits it and gets a text share card. No page gets a
   * fallback picture in its place.
   */
  readonly shareCover?: MediaPicture | null | undefined;
}

/** One meta element. An Open Graph tag uses `property`, and `twitter:card` uses `name`. */
export interface HeadMeta {
  readonly attribute: 'property' | 'name';
  readonly key: string;
  readonly content: string;
}

export interface PageHead {
  /** The absolute canonical URL, or `null` where the page names no preferred address. */
  readonly canonical: string | null;
  /** The robots meta value, or `null` where the page sends no robots element. */
  readonly robots: string | null;
  readonly meta: readonly HeadMeta[];
}

const SITE_NAME = 'LUDWISE';

export function pageHead(input: PageHeadInput): PageHead {
  const { indexing } = input;
  const canonical =
    indexing.kind === 'error' ? null : new URL(indexing.canonicalPath, input.siteUrl).href;

  return {
    canonical,
    robots: robotsValue(input.indexableEnvironment, indexing),
    meta: shareMeta(input, canonical),
  };
}

/**
 * The Open Graph tags and the `twitter:card` type.
 *
 * `og:type` is `website` on every page, a game page included, because the
 * `product` type expects price and availability properties. No tag states the
 * dimensions or the alternative text of the cover, because the media contract
 * holds neither.
 */
function shareMeta(input: PageHeadInput, canonical: string | null): HeadMeta[] {
  const coverPath = input.shareCover?.src ?? null;
  const image = coverPath === null ? null : new URL(coverPath, input.siteUrl).href;

  return [
    property('og:title', input.title),
    ...(input.description ? [property('og:description', input.description)] : []),
    ...(canonical === null ? [] : [property('og:url', canonical)]),
    property('og:type', 'website'),
    property('og:site_name', SITE_NAME),
    ...(image === null ? [] : [property('og:image', image)]),
    {
      attribute: 'name',
      key: 'twitter:card',
      content: image === null ? 'summary' : 'summary_large_image',
    },
  ];
}

function property(key: string, content: string): HeadMeta {
  return { attribute: 'property', key, content };
}

function robotsValue(indexableEnvironment: boolean, indexing: PageIndexing): string | null {
  if (!indexableEnvironment) return 'noindex,nofollow';
  switch (indexing.kind) {
    case 'indexable':
      return null;
    case 'query-variant':
      return 'noindex, follow';
    case 'error':
      return 'noindex';
  }
}
