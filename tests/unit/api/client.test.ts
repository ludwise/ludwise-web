/**
 * The client's behavior when things go wrong, which is most of what it is for.
 *
 * The happy path is four lines of `fetch` and `json()`. Everything else in
 * `client.ts` exists for a failure. Every one of those failures has a
 * rendering consequence. A timeout must not look like an empty catalog, and a
 * rejection must not be retried. A malformed response must not be trusted, and
 * nothing the backend said may reach a page.
 *
 * `fetch` is injected, so none of this needs a network, a server or a fake
 * transport library. A function that returns a `Response` is the whole harness.
 */

import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../../../src/lib/api/client.js';
import { isApiError, LudwiseApiError } from '../../../src/lib/api/errors.js';

const BASE = 'https://backend.invalid';

/** A JSON response, as the backend would send one. */
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

/** The narrowest valid search view, so tests assert on what they changed. */
const SEARCH_VIEW = {
  games: [],
  resultCount: 0,
  page: 1,
  pageSize: 24,
  pageCount: 0,
  facets: { stores: [], markets: [] },
};

function clientOver(
  fetchImpl: typeof fetch,
  overrides: { timeoutMs?: number } = {},
): ReturnType<typeof createApiClient> {
  return createApiClient({
    fetch: fetchImpl,
    baseUrl: BASE,
    // Tests never wait. A real delay here would add a fixed cost to every retry
    // case for no assertion it makes possible.
    sleep: async () => {},
    ...overrides,
  });
}

/** Captures what the client asked for, and answers with whatever is supplied. */
function recording(...responses: (Response | (() => Response | Promise<Response>))[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  let index = 0;

  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return typeof next === 'function' ? await next() : next!;
  }) as unknown as typeof fetch;

  return { calls, fetchImpl };
}

describe('the request it sends', () => {
  it('maps input field names onto the query parameters a visitor can see', async () => {
    const { calls, fetchImpl } = recording(json(SEARCH_VIEW));

    await clientOver(fetchImpl).searchGames({
      query: 'orbit',
      page: 2,
      marketCode: 'DE',
      currencyCode: 'EUR',
      minPriceMinor: 500,
      maxPriceMinor: 9900,
      releaseYearFrom: 2020,
      releaseYearTo: 2024,
      stores: ['orbit', 'copper'],
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v1/games');
    // `minPriceMinor` travels as `min`, which is what /sales uses for whole
    // major units. The field name carries the unit precisely so these two
    // cannot be confused at a call site.
    expect(url.searchParams.get('min')).toBe('500');
    expect(url.searchParams.get('max')).toBe('9900');
    expect(url.searchParams.get('q')).toBe('orbit');
    expect(url.searchParams.get('market')).toBe('DE');
    // Repeated rather than joined, because the backend reads it with getAll.
    expect(url.searchParams.getAll('store')).toEqual(['orbit', 'copper']);
  });

  it('sends discounted=false as a literal rather than omitting it', async () => {
    // Omitting it would mean "not asked", which is a different question from
    // "asked for, and no". The backend reads anything but 'false' as true.
    const { calls, fetchImpl } = recording(json(SEARCH_VIEW));
    await clientOver(fetchImpl).searchGames({ discounted: false });
    expect(new URL(calls[0]!.url).searchParams.get('discounted')).toBe('false');
  });

  it('omits every filter that was not supplied', async () => {
    const { calls, fetchImpl } = recording(json(SEARCH_VIEW));
    await clientOver(fetchImpl).searchGames({});
    expect(new URL(calls[0]!.url).search).toBe('');
  });

  it('forwards the correlation identifiers it was given', async () => {
    // Without these, the site's log record and the backend's are two halves of
    // a trace that cannot be joined. That spends the logging budget twice for
    // less than it buys (architecture decision record (ADR) 0024).
    const { calls, fetchImpl } = recording(json(SEARCH_VIEW));

    await createApiClient({
      fetch: fetchImpl,
      baseUrl: BASE,
      correlation: {
        requestId: 'req-abc12345',
        traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      },
    }).searchGames();

    const headers = new Headers(calls[0]!.init?.headers);
    expect(headers.get('x-request-id')).toBe('req-abc12345');
    expect(headers.get('traceparent')).toBe(
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    );
  });

  it('escapes a slug rather than splicing it into the path', async () => {
    // A slug is caller-controlled and lands in a URL path. Unescaped, `../`
    // walks out of /v1/games and reaches a route the allowlist never named.
    const { calls, fetchImpl } = recording(json(null, 404));
    await clientOver(fetchImpl).getGameDetail('../ops/api/logs');
    expect(new URL(calls[0]!.url).pathname).toBe('/v1/games/..%2Fops%2Fapi%2Flogs');
  });
});

describe('what a failed read becomes', () => {
  it('a refused request is a rejection carrying the fields, and is not retried', async () => {
    const { calls, fetchImpl } = recording(
      json(
        {
          status: 'error',
          code: 'ERR_APP_VALIDATION',
          request_id: 'req-1',
          fields: ['marketCode', 'currencyCode'],
          data: SEARCH_VIEW,
        },
        400,
      ),
    );

    const error = await clientOver(fetchImpl)
      .searchGames({ marketCode: 'de' })
      .catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    expect((error as LudwiseApiError).kind).toBe('rejected');
    expect((error as LudwiseApiError).isRejection).toBe(true);
    expect((error as LudwiseApiError).fields).toEqual(['marketCode', 'currencyCode']);
    // The rebuilt view rides along, so the page can redraw its filter form
    // without a second round trip.
    expect((error as LudwiseApiError).data).toEqual(SEARCH_VIEW);
    // Retrying a rejection refuses it again while doubling the load.
    expect(calls).toHaveLength(1);
  });

  it('an unreachable binding is unavailable, and is retried exactly once', async () => {
    let attempts = 0;
    const fetchImpl = (async () => {
      attempts += 1;
      throw new TypeError('network error');
    }) as unknown as typeof fetch;

    const error = await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e);

    expect((error as LudwiseApiError).kind).toBe('unavailable');
    // Two, not more. An unbounded retry chain turns one slow backend into a
    // queue of Workers all waiting. That is how a degraded dependency becomes
    // an outage of this site as well.
    expect(attempts).toBe(2);
  });

  it('recovers when the second attempt succeeds', async () => {
    // The case the retry exists for: a single isolate that went away
    // mid-dispatch. Without this the retry would be untested in the one
    // direction that matters.
    let attempts = 0;
    const fetchImpl = (async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('network error');
      return json(SEARCH_VIEW);
    }) as unknown as typeof fetch;

    await expect(clientOver(fetchImpl).searchGames()).resolves.toEqual(SEARCH_VIEW);
    expect(attempts).toBe(2);
  });

  it('a 5xx carrying a backend code is not retried', async () => {
    // ERR_APP_INFRASTRUCTURE means the backend reached its database and the
    // database failed. Retrying immediately adds load to a dependency that is
    // already struggling, which is how a brief blip becomes a sustained one.
    const { calls, fetchImpl } = recording(
      json({ status: 'error', code: 'ERR_APP_INFRASTRUCTURE', request_id: 'req-2' }, 503),
    );

    const error = await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e);

    expect((error as LudwiseApiError).kind).toBe('unavailable');
    expect((error as LudwiseApiError).code).toBe('ERR_APP_INFRASTRUCTURE');
    expect((error as LudwiseApiError).requestId).toBe('req-2');
    expect(calls).toHaveLength(1);
  });

  it('a slow backend times out rather than holding the request open', async () => {
    // Without a ceiling, a backend that accepts and then stalls holds this
    // Worker open until the platform kills it. The visitor then sees a browser
    // timeout rather than the page this site can render.
    const fetchImpl = (async (_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      })) as unknown as typeof fetch;

    const error = await clientOver(fetchImpl, { timeoutMs: 10 })
      .searchGames()
      .catch((e: unknown) => e);

    expect((error as LudwiseApiError).kind).toBe('timeout');
  });

  it('a caller who aborts gets no further attempts on their behalf', async () => {
    const controller = new AbortController();
    let attempts = 0;
    const fetchImpl = (async () => {
      attempts += 1;
      controller.abort();
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;

    await clientOver(fetchImpl)
      .searchGames({}, controller.signal)
      .catch(() => undefined);

    expect(attempts).toBe(1);
  });
});

describe('what it refuses to trust', () => {
  it('a 200 that is not JSON is malformed rather than an answer', async () => {
    const fetchImpl = (async () =>
      new Response('<html>gateway error</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })) as unknown as typeof fetch;

    const error = await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e);

    expect((error as LudwiseApiError).kind).toBe('malformed');
  });

  it.each([
    ['a JSON string', '"not a view"'],
    ['a JSON array', '[]'],
    ['a JSON null', 'null'],
  ])('%s is malformed rather than an answer', async (_label, body) => {
    // Each is valid JSON and none is a view. A client that cast the body would
    // hand a page something it will crash on while rendering. That produces a
    // 500 with no useful log rather than the failure state this site has.
    const fetchImpl = (async () =>
      new Response(body, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;

    const error = await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e);

    expect((error as LudwiseApiError).kind).toBe('malformed');
  });

  it('accepts a response carrying a field this build does not know', async () => {
    // The contract evolves additively (ADR 0025), so an unknown field must not
    // be an error. Otherwise every backend deploy that adds one would have to
    // be simultaneous with a frontend deploy.
    const fetchImpl = (async () =>
      json({ ...SEARCH_VIEW, somethingNewer: true })) as unknown as typeof fetch;

    await expect(clientOver(fetchImpl).searchGames()).resolves.toMatchObject({ resultCount: 0 });
  });

  it('an unreadable failure body still produces a classified failure', async () => {
    // The response is already a failure. Failing to parse the explanation of a
    // failure must not replace it with a different one.
    const fetchImpl = (async () =>
      new Response('502 Bad Gateway', { status: 502 })) as unknown as typeof fetch;

    const error = await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e);

    expect((error as LudwiseApiError).kind).toBe('unavailable');
    expect((error as LudwiseApiError).status).toBe(502);
  });

  it('drops a non-string in the fields array rather than passing it on', async () => {
    const fetchImpl = (async () =>
      json(
        { status: 'error', code: 'ERR_APP_VALIDATION', request_id: 'r', fields: ['page', 7, null] },
        400,
      )) as unknown as typeof fetch;

    const error = await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e);

    expect((error as LudwiseApiError).fields).toEqual(['page']);
  });

  it('an unrecognised error code is unavailable rather than a guess', async () => {
    // It means the response did not come from the backend's own error path.
    // Something in front of it answered. Inventing a classification would put
    // a fabricated diagnosis into a log.
    const fetchImpl = (async () =>
      json(
        { status: 'error', code: 'ERR_SOMETHING_ELSE', request_id: 'r' },
        418,
      )) as unknown as typeof fetch;

    const error = await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e);

    expect((error as LudwiseApiError).kind).toBe('unavailable');
  });
});

describe('an absent game is an answer rather than a failure', () => {
  it('404 on game detail is null', async () => {
    const fetchImpl = (async () =>
      json(
        { status: 'error', code: 'ERR_NOT_FOUND', request_id: 'r' },
        404,
      )) as unknown as typeof fetch;

    await expect(clientOver(fetchImpl).getGameDetail('no-such-game')).resolves.toBeNull();
  });

  it('but a 404 on a list read is not', async () => {
    // A missing slug is a fact about the catalog. A 404 from /v1/games means
    // the route itself is gone, which is a deployment fault. Returning an
    // empty catalog for it would tell a visitor there are no games.
    const fetchImpl = (async () => json({}, 404)) as unknown as typeof fetch;

    const error = await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e);

    expect(isApiError(error)).toBe(true);
    expect((error as LudwiseApiError).kind).toBe('unavailable');
  });
});

describe('nothing the backend said reaches a caller', () => {
  it('carries no message, body or upstream text', async () => {
    // The response may have come from something in front of the backend rather
    // than the backend itself. Text of unknown origin has no business
    // anywhere a page could render it.
    const fetchImpl = (async () =>
      json(
        {
          status: 'error',
          code: 'ERR_APP_INFRASTRUCTURE',
          request_id: 'req-9',
          message: 'D1_ERROR: no such column: canonical_titel',
        },
        503,
      )) as unknown as typeof fetch;

    const error = (await clientOver(fetchImpl)
      .searchGames()
      .catch((e: unknown) => e)) as LudwiseApiError;

    expect(error.message).not.toContain('D1_ERROR');
    expect(error.message).not.toContain('canonical_titel');
    expect(JSON.stringify({ ...error })).not.toContain('D1_ERROR');
  });
});

describe('the operations it will perform', () => {
  it('are three, and none takes a path', () => {
    // The allowlist as an object shape. A client that could be handed a path
    // would be a proxy. A proxy reachable from a page is how /ops and
    // internal routes become publicly reachable through the front door.
    const client = clientOver(vi.fn() as unknown as typeof fetch);
    expect(Object.keys(client).sort()).toEqual(['browseSales', 'getGameDetail', 'searchGames']);
  });
});

/** The narrowest valid sales view, so tests assert on what they changed. */
const SALES_VIEW = {
  context: null,
  games: [],
  resultCount: 0,
  contextCount: 0,
  page: 1,
  pageSize: 24,
  pageCount: 0,
  rangeStart: 0,
  rangeEnd: 0,
  sort: 'discount',
  facets: { stores: [], contexts: [] },
  hasAnyOfferData: false,
};

describe('browseSales', () => {
  it('maps input field names onto /v1/sales query parameters, using whole major units', async () => {
    const { calls, fetchImpl } = recording(json(SALES_VIEW));

    await clientOver(fetchImpl).browseSales({
      marketCode: 'DE',
      currencyCode: 'EUR',
      minDiscountPercentage: 25,
      minPriceMajor: 5,
      maxPriceMajor: 99,
      releaseYearFrom: 2020,
      releaseYearTo: 2024,
      sort: 'price',
      page: 2,
      stores: ['orbit'],
    });

    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/v1/sales');
    // Unlike /v1/games, min/max here are whole major units. The parameter name
    // is the same as games but the unit differs, distinguished only by the
    // field name at the call site.
    expect(url.searchParams.get('min')).toBe('5');
    expect(url.searchParams.get('max')).toBe('99');
    expect(url.searchParams.get('minDiscount')).toBe('25');
    expect(url.searchParams.get('sort')).toBe('price');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.getAll('store')).toEqual(['orbit']);
    // /v1/sales has no name search and no discounted toggle: the whole page
    // is discounts.
    expect(url.searchParams.has('q')).toBe(false);
    expect(url.searchParams.has('discounted')).toBe(false);
  });

  it('omits every filter that was not supplied', async () => {
    const { calls, fetchImpl } = recording(json(SALES_VIEW));
    await clientOver(fetchImpl).browseSales({});
    expect(new URL(calls[0]!.url).search).toBe('');
  });

  it('resolves with the view the backend answered', async () => {
    const { fetchImpl } = recording(json(SALES_VIEW));
    await expect(clientOver(fetchImpl).browseSales()).resolves.toEqual(SALES_VIEW);
  });

  it('a 404 on /v1/sales is a failure, not an empty result, because the route itself is gone', async () => {
    const fetchImpl = (async () => json({}, 404)) as unknown as typeof fetch;
    const error = await clientOver(fetchImpl)
      .browseSales()
      .catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
  });
});
