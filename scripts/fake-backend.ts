/**
 * A stand-in for the backend, replaying its recorded responses from
 * `tests/fixtures/corpus/`. The site cannot render `/games` or `/sales` without
 * something answering `/v1`. The real backend is a private repository this
 * one is built not to need.
 *
 * The recordings are real: the backend's own `tests/contract/corpus.test.ts`
 * fails if its routes stop producing exactly those bytes (architecture decision
 * record 0025). They are deterministic, need no credentials in CI, and cover
 * the unavailable and malformed cases a working service cannot produce.
 *
 * Not a second implementation. It replays the recording matching a request and
 * answers 501 where there is none. A fake that improvised would let a
 * suite pass against behavior the real backend does not have.
 */

import { createServer } from 'node:http';
import { appendFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORPUS = resolve(root, 'tests', 'fixtures', 'corpus');

/**
 * Bytes for the image addresses the recordings carry.
 *
 * A separate directory from the corpus, which holds recordings alone. The file
 * path below this one mirrors the upstream path of the address it answers, so
 * two profiles of one picture stay two files.
 *
 * These are generated pictures rather than provider bytes, and
 * tests/fixtures/media has the note that says so.
 */
const MEDIA = resolve(root, 'tests', 'fixtures', 'media');

/** The image types these fixtures come in, by file extension. */
const IMAGE_TYPES: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
};

/**
 * Where unmatched requests are recorded.
 *
 * A file is used as well as stderr. In Playwright the fake's output is
 * interleaved with the site's and the runner's. That makes it effectively
 * unreadable. "Which requests does the corpus not cover" is the one question a
 * missing recording raises. It must be answerable in one look. Gitignored.
 */
const MISSES = resolve(root, 'corpus-misses.log');

/**
 * How this instance behaves.
 *
 * This is chosen by an environment variable rather than by a control endpoint.
 * The reason is that a control endpoint is a way for one test to change another
 * test's backend halfway through a parallel run.
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
 * The key is the request itself - path plus normalized query - so adding a
 * corpus case makes it reachable without editing a routing table. That matters.
 * A table would be a third place the set of covered requests lives, after the
 * backend's `CASES` and the files themselves. The two would drift.
 *
 * `game-detail` cases key on their slug, which is read from the recording
 * rather than from the filename. The backend chose that slug. Parsing it out of
 * `game-detail-canonical.json` would be inferring it from a naming convention
 * nobody promised to keep.
 */
const byRequest = new Map<string, Recorded>();
const byDetailSlug = new Map<string, Recorded>();
let absentDetail: Recorded | undefined;

interface Fixture {
  readonly file: string;
  readonly contentType: string;
}

/**
 * The image path of a recorded address, and the file that answers it.
 *
 * Keyed by the path alone, because the media route strips the host before it
 * asks. `src/middleware.ts` points a development run at this server, so the
 * route reads these bytes rather than reaching a provider.
 */
const byImagePath = new Map<string, Fixture>();

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
 * The corpus filenames encode the case name rather than the URL. The URLs
 * thus live here, copied from the backend's `CASES`. That case list is the
 * only place they are authoritative. A name here with no file, or a file with
 * no name here, fails at startup rather than at the first request that needs it.
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
const DETAIL_CASES = [
  'game-detail',
  'game-detail-canonical',
  'game-detail-no-offers',
  'game-detail-promoted-cover',
  'game-detail-states',
];
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

  loadImages(loaded);
}

/**
 * Every image address the recordings carry, mapped onto committed bytes.
 *
 * An address with no fixture fails at startup rather than at the first request
 * that needs it. Without the bytes the media route answers 404, the page still
 * renders its designed empty frame, and a measurement of image weight silently
 * measures nothing.
 */
function loadImages(loaded: ReadonlyMap<string, Recorded>): void {
  for (const recorded of loaded.values()) {
    for (const address of imageUrls(recorded.body)) {
      // The whole path, not its last segment. A promoted cover is one picture
      // at two profiles, so `t_cover_big/x.jpg` and `t_1080p/x.jpg` differ in
      // size and must not share one file.
      const { pathname } = new URL(address);
      const file = resolve(MEDIA, `.${pathname}`);
      const contentType = IMAGE_TYPES[extname(pathname).toLowerCase()];

      if (contentType === undefined) {
        throw new Error(`corpus carries an image type nothing serves: ${pathname}`);
      }
      if (!existsSync(file)) {
        throw new Error(`tests/fixtures/media is missing bytes for ${pathname}`);
      }

      byImagePath.set(pathname, { file, contentType });
    }
  }
}

interface RecordedImage {
  readonly url?: string;
}

/**
 * Read from the contract's own media shape rather than by searching for
 * anything that looks like an address. A video is not proxied and must not
 * appear here.
 */
function imageUrls(body: unknown): string[] {
  const media = (
    body as {
      media?: {
        cover?: RecordedImage | null;
        hero?: RecordedImage | null;
        screenshots?: readonly RecordedImage[];
      };
    }
  ).media;

  if (media === undefined) return [];
  return [
    media.cover?.url,
    media.hero?.url,
    ...(media.screenshots ?? []).map((one) => one.url),
  ].filter((address): address is string => typeof address === 'string');
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
 * would be a second place the shape lives. The first field added to the
 * contract would then leave it stale in a way nothing detects.
 *
 * This state is worth a mode of its own because the interface says different
 * words for it. The sentence "No games are on sale right now" is a claim about
 * the market. It is only true once LUDWISE has observed prices and found none
 * discounted. The truth here is "LUDWISE has not collected any prices yet", and
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
 * and would pin nothing. The site forwards its own. Echoing it back is what
 * lets the suites assert that one id travels the whole way. That id reaches a
 * failure page a visitor could quote.
 */
function withRequestId(body: unknown, requestId: string | undefined): unknown {
  return JSON.parse(
    JSON.stringify(body).replaceAll('<request-id>', requestId ?? 'fake-request-id'),
  ) as unknown;
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://localhost:${String(PORT)}`);

  // Answered in every mode, including the ones that refuse everything else: a
  // runner asking whether the process is listening, not whether the backend is
  // healthy. In the `/__` prefix so it can never collide with a `/v1` path.
  if (url.pathname === '/__ready') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ mode: MODE }));
    return;
  }

  if (MODE === 'unavailable') {
    // Destroyed rather than answered with a 503, deliberately. A 503 is the
    // backend telling us something. This is the backend not being there, which
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
    const image = byImagePath.get(url.pathname);
    if (image !== undefined) {
      const bytes = readFileSync(image.file);
      response.writeHead(200, {
        'content-type': image.contentType,
        'content-length': bytes.byteLength,
        // The media route decides how long its own answer may be held. This
        // server must not be the thing that decides it.
        'cache-control': 'no-store',
      });
      response.end(bytes);
      return;
    }

    const recorded = answer(url);

    if (recorded === undefined) {
      // 501 rather than 404: a 404 would be a claim about the catalog, and
      // this is a claim about the fixture set. The fix is a case added to the
      // backend's corpus, not a cleverer server.
      const request_ = `${url.pathname}${url.search}`;
      response.writeHead(501, { 'content-type': 'application/json; charset=utf-8' });
      response.end(
        JSON.stringify({
          status: 'error',
          code: 'ERR_FAKE_NO_RECORDING',
          request_id: 'fake-request-id',
        }),
      );

      // Appended to a file as well. In Playwright the fake's stderr is interleaved
      // with two other processes. "Which requests does the corpus not cover" has to be
      // answerable in one look.
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
      `${String(byRequest.size + byDetailSlug.size + 1)} recordings, ` +
      `${String(byImagePath.size)} images\n`,
  );
});
