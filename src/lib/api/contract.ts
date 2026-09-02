/**
 * The wire shapes LUDWISE's backend answers with, and the authoritative
 * statement of that contract (architecture decision record 0025).
 *
 * It lives here, not in the backend, because the public repository must build
 * without the private one. The backend vendors it into `tests/contract/` and
 * proves conformance at compile time.
 *
 * This file may know these shapes, the query parameter names, the error codes a
 * failure may carry, and the page sizes echoed back - nothing else. Evolution is
 * additive, so either side may deploy first. `T | null` is "looked, no value".
 * `?:` is "this deployment predates the field". Neither is ever a fabricated
 * default (`PRODUCT.md` §120).
 */

/** Every money value carries its own exponent. See `MoneyView`. */
export interface MoneyView {
  /**
   * The amount in the currency's smallest unit, as an integer.
   *
   * Minor units rather than a decimal, because a price is exact and a float is
   * not. The exponent travels with it rather than being looked up. This is
   * because "every currency has two decimals" is false. JPY has none and KWD
   * has three. A renderer that assumed otherwise would be wrong by a factor
   * of a hundred or a thousand on real data.
   */
  readonly amountMinor: number;
  readonly currencyCode: string;
  /** The number of decimal places this currency uses. Zero is a real answer. */
  readonly minorUnit: number;
}

// ---------------------------------------------------------------------------
// GET /v1/games
// ---------------------------------------------------------------------------

export interface GameSummaryView {
  /** The canonical LUDWISE identifier. Stable across provider changes. */
  readonly id: string;
  /** The canonical slug, which is what `/games/[slug]` is addressed by. */
  readonly slug: string;
  readonly title: string;
  /** ISO 8601 date, or `null` where no release date is known. */
  readonly releaseDate: string | null;
}

export interface StoreFacetView {
  readonly slug: string;
  readonly name: string;
}

export interface CurrencyFacetView {
  readonly code: string;
  readonly minorUnit: number;
}

export interface MarketFacetView {
  readonly code: string;
  readonly name: string;
  /** The currencies this market is actually priced in. Never a global list. */
  readonly currencies: readonly CurrencyFacetView[];
}

/**
 * What the filter form may offer.
 *
 * Derived from the catalog rather than declared, so the form cannot offer a
 * combination that matches nothing. That derivation is the backend's, and the
 * frontend renders it without re-deriving anything.
 */
export interface GameSearchFacetsView {
  readonly stores: readonly StoreFacetView[];
  readonly markets: readonly MarketFacetView[];
}

export interface GameSearchView {
  readonly games: readonly GameSummaryView[];
  /** Total matches, not the length of `games`. */
  readonly resultCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly facets: GameSearchFacetsView;
}

// ---------------------------------------------------------------------------
// GET /v1/games/:slug
// ---------------------------------------------------------------------------

export interface GameMetadataView {
  readonly summary: string | null;
  readonly developer: string | null;
  readonly publisher: string | null;
  readonly releaseDate: string | null;
  /** Added additively. Older backends may omit this property during rollout. */
  readonly genres?: readonly string[];
  /** Added additively. Older backends may omit this property during rollout. */
  readonly platforms?: readonly string[];
}

export interface MarketView {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly countryCode: string | null;
}

export interface OfferView {
  readonly id: string;
  readonly storeName: string;
  readonly storeSlug: string;
  readonly storePageUrl: string | null;
  readonly offerUrl: string | null;
  readonly kind: string;
  readonly editionLabel: string | null;
  /**
   * `null` means no availability was recorded, which is a third answer
   * distinct from either 'available' or 'unavailable' and must render as such.
   */
  readonly availability: 'available' | 'unavailable' | 'unknown' | null;
  readonly price: MoneyView | null;
  /** What the price is discounted from. `null` when there is nothing to compare. */
  readonly referencePrice: MoneyView | null;
  /**
   * Computed by the backend, never by the frontend.
   *
   * Whether an offer is a sale, and by how much, is a domain decision. It
   * depends on availability, on both prices being present, and on the currency
   * exponent being known. A frontend recomputing it from `price` and
   * `referencePrice` would be a second implementation of that rule. The two
   * would disagree the first time either changed.
   */
  readonly discountPercentage: number | null;
  readonly discountEndsAtMs: number | null;
  readonly sourceName: string | null;
  /**
   * When this price was last observed, in epoch milliseconds.
   *
   * The interface renders freshness from this rather than implying a price is
   * current. It is what makes a cached response honest about its own age.
   */
  readonly observedAtMs: number | null;
}

/**
 * Offers grouped by the market and currency they are quoted in.
 *
 * Grouped rather than flat because prices in different currencies are not
 * comparable, and there is no conversion anywhere in LUDWISE. A single sorted
 * list would be ordering by nothing. Both fields are nullable: an offer whose
 * market was never recorded still exists and still renders.
 */
export interface OfferGroupView {
  readonly market: MarketView | null;
  readonly currency: { readonly code: string; readonly minorUnit: number } | null;
  /** Ordered by the backend. Available priced offers first, cheapest first. */
  readonly offers: readonly OfferView[];
}

export interface ProvenanceView {
  readonly field: string;
  readonly sourceName: string;
  readonly method: 'direct' | 'derived';
  readonly observedAtMs: number;
}

/**
 * What an image is for, in LUDWISE's words.
 *
 * A purpose rather than a measurement. No source's size vocabulary appears
 * here, and none may. Which variant of an image answers `cover` is a decision
 * the backend makes behind this contract. A renderer keys layout on this, and
 * never on a pixel count it was not given.
 */
export const MEDIA_IMAGE_PROFILES = ['cover', 'hero', 'gallery'] as const;

export type MediaImageProfile = (typeof MEDIA_IMAGE_PROFILES)[number];

/**
 * What the picture actually is, whatever slot it fills.
 *
 * The backend may put a cover in the hero slot when nothing wider exists.
 * `sourceKind` is how a renderer knows, so it can frame an upscaled cover
 * differently from a real wide image rather than stretch one.
 *
 * `logo` is part of this vocabulary and is not selected into any slot today.
 * A per-game logo is not something the current metadata source supplies.
 */
export const MEDIA_IMAGE_KINDS = ['cover', 'hero', 'artwork', 'screenshot', 'logo'] as const;

export type MediaImageKind = (typeof MEDIA_IMAGE_KINDS)[number];

/**
 * Which source a picture or a video came from, and when it was seen.
 *
 * Separate from `metadataProvenance`, deliberately. That list says which
 * source a canonical scalar field was projected from. Media is not one of
 * those fields. So it carries its own attribution on the item instead.
 * Attribution is also an obligation some sources place on showing their
 * images, and a renderer needs the name to satisfy it.
 */
export interface MediaProvenanceView {
  readonly providerSlug: string;
  readonly providerName: string;
  readonly observedAtMs: number;
}

export interface MediaImageView {
  /** A public https address. Never a template and never an identifier. */
  readonly url: string;
  readonly profile: MediaImageProfile;
  readonly sourceKind: MediaImageKind;
  readonly provenance: MediaProvenanceView;
}

export interface MediaVideoView {
  /** Where a visitor opens the video. */
  readonly url: string;
  /**
   * Where a page plays it without sending the visitor away.
   *
   * `null` when the source publishes a page for a video and permits no player
   * for it. The video is still listed, because a link a visitor can open is
   * worth more than a player a client may leave out.
   */
  readonly embedUrl: string | null;
  /** As the source stated it. `null` when the source stated none. */
  readonly title: string | null;
  readonly provenance: MediaProvenanceView;
}

/**
 * The pictures and videos one game may show.
 *
 * No role is inferred. Nothing here says which video is a trailer, because the
 * stored fact does not establish one. A guess would be a claim about the
 * publisher's intent that nobody made.
 *
 * The empty state is deliberate and is the same shape every time: `cover` and
 * `hero` are `null`, and both lists are `[]`. A game LUDWISE holds no picture
 * for is a normal game.
 */
export interface GameMediaView {
  readonly cover: MediaImageView | null;
  readonly hero: MediaImageView | null;
  readonly screenshots: readonly MediaImageView[];
  readonly videos: readonly MediaVideoView[];
}

export interface GameDetailView {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly metadata: GameMetadataView | null;
  readonly metadataProvenance: readonly ProvenanceView[];
  readonly offerGroups: readonly OfferGroupView[];
  /**
   * Added additively. Older backends may omit this property during rollout.
   *
   * `?:` rather than `GameMediaView | null`, and the two say different things.
   * A backend that carries the field always sends the whole object, empty or
   * not. Absence thus means "this deployment predates media" and never "this
   * game has none". A client renders the second from `cover === null` and
   * empty lists, which is a state it can trust.
   */
  readonly media?: GameMediaView;
}

// ---------------------------------------------------------------------------
// GET /v1/sales
// ---------------------------------------------------------------------------

export const SALE_SORTS = ['discount', 'price'] as const;
export type SaleSort = (typeof SALE_SORTS)[number];

export interface SaleOfferView {
  readonly storeSlug: string;
  readonly storeName: string;
  readonly editionLabel: string | null;
  readonly price: MoneyView;
  readonly referencePrice: MoneyView;
  readonly discountPercentage: number;
  readonly observedAtMs: number;
}

export interface SaleGameView {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly releaseDate: string | null;
  /** The one offer that represents this game. Chosen by the backend. */
  readonly offer: SaleOfferView;
  readonly storeCount: number;
}

/** A market and currency pair prices are quoted in. */
export interface SaleContextView {
  readonly marketCode: string;
  readonly marketName: string;
  readonly currencyCode: string;
  readonly currencyMinorUnit: number;
  /** Games on sale in this pair before any filter. */
  readonly gameCount: number;
}

export interface SaleFacetsView {
  readonly stores: readonly StoreFacetView[];
  readonly contexts: readonly SaleContextView[];
}

export interface BrowseSalesView {
  /** `null` when nothing is on sale anywhere. See `hasAnyOfferData`. */
  readonly context: SaleContextView | null;
  readonly games: readonly SaleGameView[];
  /** Games left after filtering. */
  readonly resultCount: number;
  /** Games on sale in this pair before filtering, so a filter can say what it excluded. */
  readonly contextCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  /** 1-based inclusive positions of this page within the results, or 0 when empty. */
  readonly rangeStart: number;
  readonly rangeEnd: number;
  readonly sort: SaleSort;
  readonly facets: SaleFacetsView;
  /**
   * Whether LUDWISE has recorded any offer at all, anywhere.
   *
   * Meaningful only when `context` is `null`, and it exists to keep one
   * sentence honest. "No game is on sale right now" and "LUDWISE has not
   * collected any prices yet" render the same empty view. They mean entirely
   * different things. Claiming the first when the second is true is a
   * fabricated claim about the market.
   */
  readonly hasAnyOfferData: boolean;
}

// ---------------------------------------------------------------------------
// Failures
// ---------------------------------------------------------------------------

/**
 * The codes a failure may carry.
 *
 * Stable by contract: the human-readable wording around them is free to change
 * and these are not. A client keys behavior on the code, never on a message,
 * and there is no message on the wire to key on anyway.
 *
 * `ERR_NOT_FOUND` accompanies a 404 and is the one code that is not a fault -
 * it means the slug names no game, which is an answer.
 */
export const API_ERROR_CODES = [
  'ERR_APP_VALIDATION',
  'ERR_APP_INFRASTRUCTURE',
  'ERR_APP_INTERNAL',
  'ERR_CONFIG_INVALID',
  'ERR_NOT_FOUND',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/**
 * The body every failure answers with.
 *
 * One shape for the whole surface, so a client parses one thing. Note what is
 * absent and stays absent: no message, no operation name, no stack, no SQL, no
 * upstream response, and no `issues` list. Those exist for whoever reads the
 * backend's logs. `requestId` is here precisely so a visitor can quote one
 * value that lets an operator find all of it.
 */
export interface ApiErrorBody {
  readonly status: 'error';
  readonly code: string;
  readonly request_id: string;
  /**
   * Which of the caller's fields were refused, on a 400.
   *
   * An allowlist intersection computed by the backend - only names that are
   * part of this contract survive it. Every one is a query parameter or the
   * form control it maps to. So knowing it tells a reader nothing they could
   * not have learned from the URL they typed.
   *
   * The *reason* each was refused is deliberately not here. Those strings name
   * the backend's internal expectations and are written for a log reader. The
   * visitor-facing sentences live in this repository, keyed by field name,
   * because how to phrase advice to a person is a presentation decision.
   */
  readonly fields?: readonly string[];
  /**
   * The view rebuilt after a rejection, so a filter form can be redrawn
   * without a second round trip.
   *
   * Typed as `unknown` rather than a union of the view types, because which
   * view it is depends on which endpoint answered. A client already knows
   * that from the call it made. Narrowing happens at the call site, where the
   * expected type is known, rather than through a discriminant nobody would
   * read twice.
   */
  readonly data?: unknown;
}

/** The field names a 400 may name. Mirrors the backend's allowlist exactly. */
export const REFUSABLE_FIELDS = [
  'currencyCode',
  'marketCode',
  'maxPriceMajor',
  'maxPriceMinor',
  'minDiscountPercentage',
  'minPriceMajor',
  'minPriceMinor',
  'page',
  'releaseYearFrom',
  'releaseYearTo',
  'sort',
  'stores',
] as const;

export type RefusableField = (typeof REFUSABLE_FIELDS)[number];

// ---------------------------------------------------------------------------
// Request inputs
// ---------------------------------------------------------------------------

/**
 * The filters `/v1/games` accepts.
 *
 * Field names, not parameter names: `minPriceMinor` is sent as `min`. The
 * mapping lives in `client.ts`, and the split exists because `/v1/sales` uses
 * the same `min` parameter for whole major units. Carrying the unit in the
 * field name is what stops one being read as the other. Reading one as the
 * other would be a hundredfold error in a visitor-facing price filter.
 */
export interface GameSearchInput {
  readonly query?: string | undefined;
  readonly page?: number | undefined;
  readonly stores?: readonly string[] | undefined;
  readonly marketCode?: string | undefined;
  readonly currencyCode?: string | undefined;
  readonly minPriceMinor?: number | undefined;
  readonly maxPriceMinor?: number | undefined;
  readonly discounted?: boolean | undefined;
  readonly releaseYearFrom?: number | undefined;
  readonly releaseYearTo?: number | undefined;
}

/** The filters `/v1/sales` accepts. `min`/`max` are whole major units here. */
export interface BrowseSalesInput {
  readonly marketCode?: string | undefined;
  readonly currencyCode?: string | undefined;
  readonly stores?: readonly string[] | undefined;
  readonly minDiscountPercentage?: number | undefined;
  readonly minPriceMajor?: number | undefined;
  readonly maxPriceMajor?: number | undefined;
  readonly releaseYearFrom?: number | undefined;
  readonly releaseYearTo?: number | undefined;
  readonly sort?: string | undefined;
  readonly page?: number | undefined;
}

/**
 * The page sizes the backend uses.
 *
 * Mirrored here so a client can reason about a page before it has one. It is
 * also echoed on every response as `pageSize`, so it is never guessed at when a
 * real answer is available. If these ever disagree, the response wins.
 */
export const GAME_SEARCH_PAGE_SIZE = 24;
export const SALE_PAGE_SIZE = 24;
