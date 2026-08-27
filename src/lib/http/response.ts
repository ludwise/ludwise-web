/**
 * Questions about a response that more than one caller asks.
 */

const HTML_CONTENT_TYPE = 'text/html';

/**
 * Whether a response is a page a visitor actually read.
 *
 * Narrower than "the content type is HTML", on purpose. A redirect is not a
 * page anyone read. An error page is a failure rather than a visit.
 * Counting either inflates the denominator of every funnel measured against
 * page views, and does it in a way that looks like traffic growth.
 *
 * Assets, endpoints and 204s are excluded by the content type alone.
 */
export function isDocumentResponse(response: Response): boolean {
  if (!response.ok) return false;

  const contentType = response.headers.get('content-type');
  return contentType !== null && contentType.toLowerCase().startsWith(HTML_CONTENT_TYPE);
}

/**
 * A JSON response, with the headers every JSON surface here already sends.
 *
 * The same three headers `toErrorResponse` sets, so a success and a failure
 * from the same route are indistinguishable in everything except the body.
 * That is the point: a caller parses one thing. `no-store` because caching
 * stays off in the first cut of the read contract (architecture decision record 0025), so the migration
 * is provably behavior-preserving rather than provably faster.
 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
