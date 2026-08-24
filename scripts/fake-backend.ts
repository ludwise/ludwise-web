/**
 * A stand-in for the backend, serving the backend's own recorded responses.
 *
 * The site cannot render `/games` or `/sales` without something answering
 * `/v1`, and the real backend is a private repository this one is built not to
 * need. So the responses are replayed from `tests/fixtures/corpus/` instead,
 * and the arrangement is better than a live dependency rather than a
 * compromise:
 *
 * - **The fixtures are real.** Every file there was generated from the
 *   backend's actual routes against its actual fixtures, and the backend's
 *   `tests/contract/corpus.test.ts` fails if its routes stop producing exactly
 *   those bytes (ADR 0025). So a suite that renders them is evidence about the
 *   real contract, not about shapes somebody invented here.
 * - **It is deterministic.** A real backend's catalogue changes as ingestion
 *   runs, so an assertion about what is on the page would be an assertion about
 *   what Steam was selling that morning.
 * - **The failure states are reachable.** "The backend is unavailable" and "the
 *   backend answered with something that is not a view" are two of the most
 *   important things this site does, and neither can be produced on demand from
 *   a service that is working correctly.
 * - **It runs in CI with no credentials and no private access**, which is what
 *   lets this repository's CI prove something on its own.
 *
 * ## What it is not
 *
 * Not a second implementation of the backend. It matches a request to a
 * recording and replays it; it does not filter, rank or paginate. A request
 * with no recording answers 501 rather than guessing, because a fake that
 * improvised would let a suite pass against behaviour the real backend does not
 * have - which is the one failure mode a fixture-based fake exists to avoid.
 */

import { createServer } from 'node:http';
import { appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = resolve(root, 'tests', 'fixtures', 'corpus');

/**
 * Where unmatched requests are recorded.
 *
 * A file as well as stderr, because under Playwright the fake's output is
 * interleaved with the site's and the runner's and is effectively unreadable.
 * "Which requests does the corpus not cover" is the one question a missing
 * recording raises, and it should be answerable in one look. Gitignored.
 */
const MISSES = resolve(root, 'corpus-misses.log');

/**
 * How this instance should behave.
 *
 * Chosen by an environment variable rather than by a control endpoint, because
 * a control endpoint is a way for one test to change another test's backend
 * halfway through a parallel run.
 */
const MODE = process.env['LUDWISE_FAKE_BACKEND_MODE'] ?? 'populated';
const PORT = Number(process.env['LUDWISE_FAKE_BACKEND_PORT'] ?? '8788');

interface Recorded {
  readonly status: number;
  readonly body: unknown;
}

/**
 * Which recording answers which request.
 *
 * The key is the request itself - path plus normalised query - so adding a
 * corpus case makes it reachable without editing a routing table. That matters:
 * a table would be a third place the set of covered requests lives, after the
 * backend's `CASES` and the files themselves, and the two would drift.
 *
 * `game-detail` cases key on their slug, which is read from the recording
 * rather than from the filename. The backend chose that slug; parsing it out of
 * `game-detail-canonical.json` would be inferring it from a naming convention
 * nobody promised to keep.
 */
const byRequest = new Map<string, Recorded>();
const byDetailSlug = new Map<string, Recorded>();
let absentDetail: Recorded | undefined;

/**
 * A request key: the path, then its parameters in a fixed order.
 *
 * Sorted, so `?a=1&b=2` and `?b=2&a=1` are the same request - they are, and a
 * client is free to order them either way. Repeated values are kept in the
 * order they were sent, because `store=a&store=b` is a list rather than a set.
 */
function keyFor(path: string, params: URLSearchParams): string {
  const sorted = [...params.entries()].sort(([leftKey], [rightKey]) =>
    leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0,
  );
  return `${path}?${new URLSearchParams(sorted).toString()}`;
}

/**
 * The request a recording answers, recovered from the backend's own case list.
 *
 * The corpus filenames encode the case name rather than the URL, so the URLs
 * live here - copied from the backend's `CASES`, which is the only place they
 * are authoritative. A name here with no file, or a file with no name here,
 * fails at startup rather than at the first request that needs it.
 */
const CASE_URLS: Readonly<Record<string, string>> = {
  games: '/v1/games',
  'games-search': '/v1/games?q=half',
  'games-search-canonical': '/v1/games?q=Canonical',
  'games-search-no-results': '/v1/games?q=not-a-real-canonical-game',
  'games-filtered':
    '/v1/games?store=orbit-market&market=EU&currency=EUR&min=1000&max=1500&discounted=true&fromYear=2025&toYear=2025',
  'games-market-eu': '/v1/games?market=EU&currency=EUR',
  'games-market-only': '/v1/games?market=EU',
  'games-search-full-title': '/v1/games?q=Canonical+Demo+Game',
  'games-store-only': '/v1/games?store=orbit-market',
  'games-rejected': '/v1/games?market=de',
  sales: '/v1/sales',
  'sales-by-price': '/v1/sales?sort=price',
  'sales-de-by-price': '/v1/sales?market=DE&currency=EUR&sort=price',
  'sales-jp': '/v1/sales?market=JP&currency=JPY',
  'sales-us-empty': '/v1/sales?market=US&currency=USD',
  'sales-store': '/v1/sales?store=vertex-store',
  'sales-min-discount': '/v1/sales?minDiscount=1',
  'sales-min-discount-99': '/v1/sales?minDiscount=99',
  'sales-page-999': '/v1/sales?page=999',
  'sales-page-1': '/v1/sales?page=1',
  'sales-min-price-70': '/v1/sales?market=DE&currency=EUR&min=70',
  'sales-rejected-page': '/v1/sales?minDiscount=0&page=0',
  'sales-rejected': '/v1/sales?market=de',
};

/** Case names whose recording is a game detail, keyed by the slug it carries. */
const DETAIL_CASES = ['game-detail', 'game-detail-canonical', 'game-detail-no-offers'];
const ABSENT_CASE = 'game-detail-absent';

function load(): void {
  const files = readdirSync(CORPUS).filter((name) => name.endsWith('.json'));
  const loaded = new Map<string, Recorded>();
  for (const file of files) {
    loaded.set(
      file.replace(/\.json$/u, ''),
      JSON.parse(readFileSync(resolve(CORPUS, file), 'utf8')) as Recorded,
    );
  }

  for (const [name, url] of Object.entries(CASE_URLS)) {
    const recorded = loaded.get(name);
    if (recorded === undefined) throw new Error(`corpus is missing ${name}.json`);
    const parsed = new URL(url, 'http://fake');
    byRequest.set(keyFor(parsed.pathname, parsed.searchParams), recorded);
  }

  for (const name of DETAIL_CASES) {
    const recorded = loaded.get(name);
    if (recorded === undefined) throw new Error(`corpus is missing ${name}.json`);
    const { slug } = recorded.body as { slug: string };
    byDetailSlug.set(slug, recorded);
  }

  absentDetail = loaded.get(ABSENT_CASE);
  if (absentDetail === undefined) throw new Error(`corpus is missing ${ABSENT_CASE}.json`);

  // Every file accounted for. A recording nobody serves is a case the interface
  // is not actually being tested against, which is worth knowing about.
  const known = new Set([...Object.keys(CASE_URLS), ...DETAIL_CASES, ABSENT_CASE]);
  const orphans = [...loaded.keys()].filter((name) => !known.has(name));
  if (orphans.length > 0) {
    throw new Error(`corpus files nothing serves: ${orphans.join(', ')}`);
  }
}

load();

/** A recording, or `undefined` when nothing was recorded for this request. */
function answer(url: URL): Recorded | undefined {
  if (MODE === 'empty') return emptyAnswer(url);

  if (url.pathname.startsWith('/v1/games/')) {
    const slug = decodeURIComponent(url.pathname.slice('/v1/games/'.length));
    return byDetailSlug.get(slug) ?? absentDetail;
  }
  return byRequest.get(keyFor(url.pathname, url.searchParams));
}

/**
 * What a backend that has ingested nothing answers.
 *
 * Derived from a real recording rather than written out, so it carries every
 * field the contract has with the contents emptied. A hand-written empty view
 * would be a second place the shape lives, and the first field added to the
 * contract would leave it stale in a way nothing detects.
 *
 * This state is worth a mode of its own because the interface says different
 * words for it. "No games are on sale right now" is a claim about the market
 * and is only true once LUDWISE has observed prices and found none discounted;
 * "LUDWISE has not collected any prices yet" is the truth here, and
 * `hasAnyOfferData: false` is what tells the page which to render.
 */
function emptyAnswer(url: URL): Recorded | undefined {
  if (url.pathname.startsWith('/v1/games/')) return absentDetail;

  if (url.pathname === '/v1/games') {
    return emptied(byRequest.get('/v1/games?')!, { facets: { stores: [], markets: [] } });
  }

  if (url.pathname === '/v1/sales') {
    return emptied(byRequest.get('/v1/sales?')!, {
      context: null,
      contextCount: 0,
      rangeStart: 0,
      rangeEnd: 0,
      facets: { stores: [], contexts: [] },
      hasAnyOfferData: false,
    });
  }

  return undefined;
}

function emptied(recorded: Recorded, overrides: Record<string, unknown>): Recorded {
  return {
    status: 200,
    body: {
      ...(recorded.body as Record<string, unknown>),
      games: [],
      resultCount: 0,
      pageCount: 0,
      page: 1,
      ...overrides,
    },
  };
}

/**
 * The request id, put back.
 *
 * The corpus records `<request-id>` because a real one differs on every request
 * and would pin nothing. The site forwards its own, and echoing it back is what
 * lets the suites assert that one id travels the whole way and reaches a
 * failure page a visitor could quote.
 */
function withRequestId(body: unknown, requestId: string | undefined): unknown {
  return JSON.parse(
    JSON.stringify(body).replaceAll('<request-id>', requestId ?? 'fake-request-id'),
  ) as unknown;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${String(PORT)}`);

  // Answered in every mode, including the ones that refuse everything else.
  // This is how a test runner learns the process is listening, which is a
  // different question from whether the backend is healthy - and the only
  // question worth asking when the point of the mode is that it is not. Under
  // `/__` so it can never collide with a `/v1` path.
  if (url.pathname === '/__ready') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ mode: MODE }));
    return;
  }

  if (MODE === 'unavailable') {
    // Destroyed rather than answered with a 503, deliberately. A 503 is the
    // backend telling us something; this is the backend not being there, which
    // is a different code path in the client and the one a real outage takes.
    request.socket.destroy();
    return;
  }

  if (MODE === 'malformed') {
    // Valid JSON, wrong shape. This is the version-skew case: something
    // answered, and it was not a view.
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end('"this is not a view"');
    return;
  }

  const send = () => {
    const recorded = answer(url);

    if (recorded === undefined) {
      // 501 rather than 404, and rather than a guess. A 404 would be a claim
      // about the catalogue; this is a claim about the fixture set, and the fix
      // is to add a case to the backend's corpus rather than to make this
      // server cleverer.
      const request_ = `${url.pathname}${url.search}`;
      response.writeHead(501, { 'content-type': 'application/json; charset=utf-8' });
      response.end(
        JSON.stringify({
          status: 'error',
          code: 'ERR_FAKE_NO_RECORDING',
          request_id: 'fake-request-id',
        }),
      );

      // Appended to a file as well as written to stderr. Under Playwright the
      // fake's stderr is interleaved with two other processes' output and is
      // effectively unreadable; a file is what makes "which requests does the
      // corpus not cover" answerable in one look, which is the whole question
      // a missing recording raises.
      process.stderr.write(`no recording for ${request_}\n`);
      appendFileSync(MISSES, `${request_}\n`);
      return;
    }

    const requestId = request.headers['x-request-id'];
    response.writeHead(recorded.status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(
      JSON.stringify(
        withRequestId(recorded.body, typeof requestId === 'string' ? requestId : undefined),
      ),
    );
  };

  if (MODE === 'slow') {
    // Longer than any timeout the site is configured with, so the client's own
    // ceiling is what ends the request rather than this server.
    setTimeout(send, 60_000);
    return;
  }

  send();
});

server.listen(PORT, () => {
  process.stdout.write(
    `fake backend listening on ${String(PORT)} in ${MODE} mode, ` +
      `${String(byRequest.size + byDetailSlug.size + 1)} recordings\n`,
  );
});
