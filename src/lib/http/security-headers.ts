/**
 * The response headers the Worker sends, and why each one is here.
 *
 * They are the same on every response but one. `MEDIA_HEADERS` below is that
 * exception, with the reason for each difference.
 *
 * The accurate scope is every Worker response, not every response. Workers
 * Assets serves a request matching `dist/client` without invoking the Worker,
 * so `/fonts/*.woff2` never passes through. `public/_headers` is the route if
 * those ever need these.
 *
 * Deliberately absent: a `script-src` policy. Doing it properly means nonces
 * or hashes, and a policy carrying `unsafe-inline` says nothing. Wiring
 * Astro's own support for it is its own change.
 */

import type { Environment } from '../config/index.js';

export const SECURITY_HEADERS = Object.freeze({
  // Content sniffing is how a response that is not HTML ends up treated as
  // HTML, which is how a stored value becomes a script.
  'x-content-type-options': 'nosniff',

  /**
   * Nothing here is meant to be embedded. Paired with `frame-ancestors` below
   * rather than replaced by it: the two are for different clients, not
   * redundant.
   */
  'x-frame-options': 'DENY',
  /**
   * `base-uri` is the valuable one. A `<base>` tag relativises every script and
   * link on the page. That is the standard escalation from a partial HTML
   * injection to full script control. `object-src` and `form-action` cost
   * nothing and close a plugin and a form-hijack vector.
   *
   * `img-src 'self'` is what the media route buys. Every picture is served
   * from this origin, so a provider host written into markup stops working
   * rather than reaching a visitor's browser unnoticed.
   */
  'content-security-policy':
    "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'; img-src 'self'",

  /**
   * HTML varies by the theme cookie and carries a per-request id.
   *
   * Nothing caches it today. The day a cache rule is added without this, a
   * visitor's request id is served to somebody else. An id quoted from a
   * cached page sends an operator to a third party's record.
   *
   * Set rather than merged, deliberately. The security-headers test pins that
   * choice and says why merge logic would be unreachable today. `MEDIA_HEADERS`
   * withholds this header, and that route carries no request id either.
   */
  vary: 'cookie',

  // A LUDWISE URL names a game. Sending the full path to a storefront on an
  // outbound click would tell it what the visitor was comparing before they
  // clicked. That is theirs to know only if we choose to say it.
  'referrer-policy': 'strict-origin-when-cross-origin',

  // Denying features the product does not use costs nothing and removes them
  // from any embedded content's reach. `interest-cohort` is a legacy opt-out
  // kept because it is inert where unsupported and meaningful where it is not.
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
});

/**
 * The indexing rule, which is the one response header that is not the same
 * everywhere.
 *
 * Cloudflare Access is what keeps staging private. This is what keeps it out of
 * a search index anyway. It covers the paths Access does not cover. Examples are
 * a screenshot in a crawled ticket, a link pasted into a public issue, and an
 * Access application someone deletes by accident. It is defense in depth and
 * never the defense. A crawler that ignores it is not doing anything wrong. A
 * stranger reading staging is stopped by Access or by nothing.
 *
 * Production must never receive it. De-indexing the live site is silent,
 * expensive and slow to notice. That is why the production case is asserted as
 * an absence in the tests rather than left implicit.
 */
export const INDEXING_HEADERS = Object.freeze({
  'x-robots-tag': 'noindex, nofollow',
});

/**
 * The media route's headers, which differ from the shared set in two ways.
 *
 * `vary` is withheld. HTML varies by the theme cookie, and an image does not.
 * That header would split the browser cache by the theme a visitor chose.
 *
 * `x-robots-tag` is sent in every environment, production included, which no
 * other response does. The reason is rights rather than search performance. An
 * indexed image stands alone, without the provider credit its display terms
 * require.
 *
 * Derived from the shared set, so a header added above reaches this one too.
 * `withSecurityHeaders` also deletes `vary` from the response, because the
 * framework can set one on a response this constant never built.
 */
export const MEDIA_HEADERS = Object.freeze({
  ...withoutVary(SECURITY_HEADERS),
  'x-robots-tag': 'noindex',
});

function withoutVary(headers: Readonly<Record<string, string>>): Record<string, string> {
  const copy = { ...headers };
  delete copy['vary'];
  return copy;
}

/** Which response is being answered, where that changes the headers. */
export interface HeaderScope {
  /** The media route, which is publicly cacheable and carries no visitor state. */
  readonly media?: boolean | undefined;
}

/**
 * Applies the headers, rebuilding the response if its headers are immutable.
 *
 * A response served from the ASSETS binding can carry immutable headers - the
 * same case `withCorrelationHeaders` in src/middleware.ts already handles the
 * same way. Throwing there would turn a static asset into a 500.
 *
 * `environment` is optional because this runs in the outermost middleware. That
 * middleware also wraps the 503 returned when configuration fails to validate.
 * That is the one case where there is no resolved environment to read. Absent,
 * it is treated as not-production. Guessing the indexable answer there would
 * publish a deployment whose configuration is broken to a crawler. The
 * restrictive guess costs nothing.
 */
export function withSecurityHeaders(
  response: Response,
  environment?: Environment,
  scope: HeaderScope = {},
): Response {
  const media = scope.media === true;
  const applied = media
    ? MEDIA_HEADERS
    : environment === 'production'
      ? SECURITY_HEADERS
      : { ...SECURITY_HEADERS, ...INDEXING_HEADERS };

  try {
    writeHeaders(response.headers, applied, media);
    return response;
  } catch {
    const headers = new Headers(response.headers);
    writeHeaders(headers, applied, media);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

/**
 * Writes each header, and optionally removes `vary`.
 *
 * Removed rather than merely left unset. `MEDIA_HEADERS` carries no `vary`, but
 * the framework can put one on a response before this runs. The media route's
 * guarantee is that none reaches the browser at all.
 */
function writeHeaders(
  headers: Headers,
  applied: Readonly<Record<string, string>>,
  dropVary: boolean,
): void {
  for (const [name, value] of Object.entries(applied)) {
    headers.set(name, value);
  }
  if (dropVary) headers.delete('vary');
}
