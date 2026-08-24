/**
 * The response headers that are the same on every response the Worker
 * produces, and why each one is here.
 *
 * These became load-bearing with the first HTML page. A JSON endpoint is a poor
 * clickjacking target and sends no referrer worth worrying about; a page that
 * will carry price comparisons and outbound store links is both.
 *
 * "Every Worker response" is the accurate scope, not every response. Under
 * Workers Assets a request matching a file in `dist/client` is served by the
 * asset service without invoking the Worker at all, so `/fonts/*.woff2` never
 * passes through here. Those are same-origin static files with correct content
 * types; if they ever need these headers, a committed `public/_headers` is the
 * route.
 *
 * Note what is deliberately absent: a `script-src` policy. Doing that properly
 * means nonces or hashes for the theme script in the document head and for
 * Astro's island hydration script, and a policy with `unsafe-inline` in it is
 * a policy that says nothing. Astro has first-class CSP support; wiring it is
 * its own change with its own verification, and shipping a policy that only
 * looks strict would be worse than shipping none. That argument covers
 * `script-src` only - the directives that need no nonce are set below.
 */

import type { Environment } from '../config/index.js';

export const SECURITY_HEADERS = Object.freeze({
  // Content sniffing is how a response that is not HTML ends up treated as
  // HTML, which is how a stored value becomes a script.
  'x-content-type-options': 'nosniff',

  // Nothing here is meant to be embedded. X-Frame-Options for the browsers
  // that still only honour it, frame-ancestors for the ones that do it
  // properly - the two are not redundant, they are for different clients.
  //
  // base-uri is the valuable one of the remaining three: a <base> tag
  // relativises every script and link on the page, which is the standard
  // escalation from a partial HTML injection to full script control. object-src
  // and form-action cost nothing and close a plugin and a form-hijack vector.
  'x-frame-options': 'DENY',
  'content-security-policy':
    "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",

  // HTML varies by the theme cookie and carries a per-request id. Nothing
  // caches it today - Cloudflare does not cache a Worker HTML response without
  // a cache rule - but the day someone adds one without this, a visitor's
  // request id is served to somebody else, and an id quoted from a cached page
  // sends an operator to a third party's record. Costs nothing to be right now
  // and impossible to notice later.
  //
  // Set rather than appended, deliberately. Nothing upstream of this produces a
  // Vary to preserve: Astro emits none, the adapter's image endpoints are not
  // served (imageService: 'compile', and nothing imports astro:assets), and a
  // request matching dist/client never invokes the Worker at all - those get
  // their headers from public/_headers. Confirmed against the deployed
  // staging Worker, which returns no Vary on HTML, JSON or 404 responses even
  // when the edge has compressed them. If a Worker response ever does carry
  // one, this has to merge instead, and the test below is what will say so.
  vary: 'cookie',

  // A LUDWISE URL names a game. Sending the full path to a storefront on an
  // outbound click would tell that storefront what the visitor was comparing
  // before they clicked, which is theirs to know only if we choose to say it.
  'referrer-policy': 'strict-origin-when-cross-origin',

  // Denying features the product does not use costs nothing and removes them
  // from any embedded content's reach. interest-cohort is a legacy opt-out
  // kept because it is inert where unsupported and meaningful where it is not.
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
});

/**
 * The indexing rule, which is the one response header that is not the same
 * everywhere.
 *
 * Cloudflare Access is what keeps staging private. This is what keeps it out of
 * a search index anyway, for the paths Access does not cover: a screenshot in a
 * crawled ticket, a link pasted into a public issue, an Access application
 * someone deletes by accident. It is defence in depth and never the defence -
 * a crawler that ignores it is not doing anything wrong, and a stranger reading
 * staging is stopped by Access or by nothing.
 *
 * Production must never receive it. De-indexing the live site is silent,
 * expensive and slow to notice, which is why the production case is asserted as
 * an absence in the tests rather than left implicit.
 */
export const INDEXING_HEADERS = Object.freeze({
  'x-robots-tag': 'noindex, nofollow',
});

/**
 * Applies the headers, rebuilding the response if its headers are immutable.
 *
 * A response served from the ASSETS binding can carry immutable headers - the
 * same case `withCorrelationHeaders` in src/middleware.ts already handles the
 * same way. Throwing there would turn a static asset into a 500.
 *
 * `environment` is optional because this runs in the outermost middleware,
 * which also wraps the 503 returned when configuration fails to validate - the
 * one case where there is no resolved environment to read. Absent, it is
 * treated as not-production: guessing the indexable answer there would publish
 * a deployment whose configuration is broken to a crawler, and the restrictive
 * guess costs nothing.
 */
export function withSecurityHeaders(response: Response, environment?: Environment): Response {
  const applied =
    environment === 'production' ? SECURITY_HEADERS : { ...SECURITY_HEADERS, ...INDEXING_HEADERS };

  try {
    for (const [name, value] of Object.entries(applied)) {
      response.headers.set(name, value);
    }
    return response;
  } catch {
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(applied)) {
      headers.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}
