/**
 * The response headers that are the same on every response the Worker produces,
 * and why each one is here.
 *
 * "Every Worker response" is the accurate scope, not every response: under
 * Workers Assets a request matching `dist/client` is served without invoking
 * the Worker, so `/fonts/*.woff2` never passes through. Those are same-origin
 * static files; a committed `public/_headers` is the route if they ever need
 * these.
 *
 * Deliberately absent: a `script-src` policy. Doing it properly means nonces or
 * hashes for the theme script and Astro's hydration script, and a policy
 * carrying `unsafe-inline` says nothing. Astro has first-class CSP support;
 * wiring it is its own change. That covers `script-src` only.
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
   * `base-uri` is the valuable one: a `<base>` tag relativises every script and
   * link on the page, the standard escalation from a partial HTML injection to
   * full script control. `object-src` and `form-action` cost nothing and close
   * a plugin and a form-hijack vector.
   */
  'content-security-policy':
    "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",

  /**
   * HTML varies by the theme cookie and carries a per-request id.
   *
   * Nothing caches it today, but the day a cache rule is added without this, a
   * visitor's request id is served to somebody else - and an id quoted from a
   * cached page sends an operator to a third party's record.
   *
   * Set rather than merged, deliberately; the security-headers test pins that
   * choice and says why merge logic would be unreachable today.
   */
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
