/**
 * Questions about a response that more than one caller asks.
 */

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
