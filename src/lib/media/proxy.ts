/**
 * The media route's answer, built from an injected `fetch`.
 *
 * The visitor's request never reaches this module. `serve` takes a host and a
 * path, and composes the outbound request from constants and configuration. So
 * "forwards nothing from the visitor" is a property of the interface rather
 * than of a filter somebody has to keep complete.
 *
 * This file and `src/lib/api/client.ts` are the only two that call an injected
 * `fetch`, and `tests/architecture/boundaries.test.ts` names both.
 */

import { resolveUpstreamUrl, type MediaTarget, type UpstreamAddress } from './target.js';

export interface MediaProxyOptions {
  /** The platform `fetch`. `src/middleware.ts` resolves it. */
  readonly fetch: typeof fetch;
  /** Which hosts may be reached, and where a development run reads bytes. */
  readonly upstream: UpstreamAddress;
  /** The site's own address, which the outbound user agent names. */
  readonly siteUrl: string;
  /** Overridden only by tests, which have no reason to wait. */
  readonly timeoutMs?: number | undefined;
}

export interface MediaProxy {
  serve(target: MediaTarget): Promise<Response>;
}

/**
 * The ceiling on how long an answer may be held, in seconds.
 *
 * Twenty-four hours, which is the stricter of the two provider documents that
 * address caching (issue ludwise/ludwise-web#80). It applies to the edge cache
 * and to the browser directive alike.
 */
const MAX_AGE_SECONDS = 86_400;

/** How long a missing asset stays missing. Short, so an added asset appears. */
const MISSING_MAX_AGE_SECONDS = 60;

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * How long Cloudflare's edge cache may hold each answer.
 *
 * By status rather than one lifetime for all of them. A flat value holds a 404
 * for as long as it holds a 200, which pins an asset that has not appeared yet.
 */
const EDGE_CACHE_TTL_BY_STATUS = {
  '200-299': MAX_AGE_SECONDS,
  '404': MISSING_MAX_AGE_SECONDS,
  '500-599': 0,
};

/**
 * The response types this route will serve.
 *
 * `image/svg+xml` is absent and must stay absent. An SVG carries script. To
 * serve one from the LUDWISE origin is to put a provider's document inside
 * this origin, rather than a picture on a page.
 */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

export function createMediaProxy(options: MediaProxyOptions): MediaProxy {
  return {
    async serve(target: MediaTarget): Promise<Response> {
      const url = resolveUpstreamUrl(target, options.upstream);
      if (url === null) return missing();

      let answer: Response;
      try {
        answer = await options.fetch(url, requestInit(options));
      } catch {
        // The upstream did not answer. Distinguished from an answer that says
        // no, because only one of the two is worth an operator's attention.
        return unreachable();
      }

      if (!answer.ok) return missing();

      const type = imageType(answer.headers.get('content-type'));
      if (type === null) return missing();

      return new Response(answer.body, {
        status: 200,
        headers: {
          'content-type': type,
          'cache-control': `public, max-age=${String(MAX_AGE_SECONDS)}`,
          'x-content-type-options': 'nosniff',
        },
      });
    },
  };
}

/**
 * The outbound request, composed from constants and configuration alone.
 *
 * `redirect: 'manual'` is load-bearing. A followed redirect is the one way an
 * allow-listed host could send this route to an address the list refuses. A
 * 3xx is not 2xx, so it becomes a 404 like any other refusal.
 */
function requestInit(options: MediaProxyOptions): RequestInit {
  const init: RequestInit & Record<string, unknown> = {
    method: 'GET',
    headers: { accept: 'image/*', 'user-agent': userAgent(options.siteUrl) },
    redirect: 'manual',
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    // Cloudflare's own request option, which the standard type does not carry.
    cf: { cacheTtlByStatus: EDGE_CACHE_TTL_BY_STATUS },
  };
  return init;
}

/**
 * How this Worker names itself to a provider.
 *
 * Stable, and never derived from the visitor. A provider that wants to limit
 * this traffic or write to whoever runs it can then reach a person, instead of
 * blocking an anonymous stranger.
 */
function userAgent(siteUrl: string): string {
  return `LUDWISE-media/1.0 (+${siteUrl})`;
}

/** The media type alone, lowercased, or `null` when it is not one this route serves. */
function imageType(header: string | null): string | null {
  if (header === null) return null;
  const type = header.split(';')[0]?.trim().toLowerCase() ?? '';
  return IMAGE_TYPES.has(type) ? type : null;
}

/**
 * No such picture.
 *
 * Every refusal that is not a transport failure answers this, and none of them
 * says which refusal it was. A body is deliberately absent: a placeholder image
 * would imply a fact nobody stated.
 */
function missing(): Response {
  return new Response(null, {
    status: 404,
    headers: { 'cache-control': `public, max-age=${String(MISSING_MAX_AGE_SECONDS)}` },
  });
}

/** The upstream did not answer. Never cached, because nothing was learned. */
function unreachable(): Response {
  return new Response(null, { status: 502, headers: { 'cache-control': 'no-store' } });
}
