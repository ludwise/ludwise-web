/**
 * The response headers that are the same on every response the Worker produces,
 * and why each one is here.
 *
 * The accurate scope is every Worker response, not every response. Under
 * Workers Assets a request matching `dist/client` is served without invoking
 * the Worker, so `/fonts/*.woff2` never passes through. Those are same-origin
 * static files. A committed `public/_headers` is the route if they ever need
 * these.
 *
 * Deliberately absent: a `script-src` policy. Doing it properly means nonces or
 * hashes for the theme script and Astro's hydration script, and a policy
 * carrying `unsafe-inline` says nothing. Astro has first-class CSP support.
 * Wiring it is its own change. That covers `script-src` only.
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
   */
  'content-security-policy':
    "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'",

  /**
   * HTML varies by the theme cookie and carries a per-request id.
   *
   * Nothing caches it today. The day a cache rule is added without this, a
   * visitor's request id is served to somebody else. An id quoted from a
   * cached page sends an operator to a third party's record.
   *
   * Set rather than merged, deliberately. The security-headers test pins that
   * choice and says why merge logic would be unreachable today.
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
