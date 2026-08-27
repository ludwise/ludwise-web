/**
 * The one place this site talks to the backend.
 *
 * `tests/architecture/boundaries.test.ts` enforces that rather than convention:
 * a scattered `fetch` is where a timeout is forgotten or a backend error
 * message ends up in a page.
 *
 * It reaches the backend over a service binding to a named `WorkerEntrypoint`
 * (architecture decision record (ADR) 0028), not a hostname - so no CORS handling, API key or rate limiter
 * here, none of which defends an unroutable surface. Binding the *default*
 * entrypoint, as ADR 0024 did, leaves `/v1` reachable on the custom domain and
 * refused by the backend's Access guard.
 *
 * `fetch` is injected, and every read happens during SSR.
 */

import type {
  ApiErrorBody,
  BrowseSalesInput,
  BrowseSalesView,
  GameDetailView,
  GameSearchInput,
  GameSearchView,
} from './contract.js';
import { apiErrorFromBody, LudwiseApiError } from './errors.js';

/**
 * The correlation identifiers this request already has.
 *
 * Forwarded rather than regenerated. Each Worker writes its own log record, so
 * without these the site's record and the backend's record are two halves of a
 * trace that cannot be joined - and joining them is the entire point of
 * spending the logging budget twice (ADR 0024).
 */
export interface Correlation {
  readonly requestId?: string | undefined;
  readonly traceparent?: string | undefined;
}

export interface ClientOptions {
  /** The service binding's `fetch`, or any function with its shape. */
  readonly fetch: typeof fetch;
  /**
   * The origin to resolve paths against.
   *
   * A service binding ignores the host and dispatches to the bound script, but
   * `fetch` still requires an absolute URL, so this exists to satisfy the URL
   * parser rather than to route anything. It is not a secret and is not a
   * reachable address.
   */
  readonly baseUrl: string;
  readonly correlation?: Correlation | undefined;
  /**
   * How long to wait for the backend before giving up, in milliseconds.
   *
   * A ceiling rather than a target. Without one, a backend that accepts a
   * connection and then stalls holds this Worker's request open until the
   * platform kills it - and the visitor sees a browser timeout rather than the
   * "we could not load this" page this site is able to render. A page that says
   * so quickly is better than a page that eventually says nothing.
   */
  readonly timeoutMs?: number | undefined;
  /** Overridden only by tests, which have no reason to wait between attempts. */
  readonly sleep?: ((ms: number) => Promise<void>) | undefined;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * How many times a read may be attempted in total, and how long to pause.
 *
 * Two attempts, not more, and only for a genuinely transient failure. The
 * bound is the point: an unbounded or long retry chain turns one slow backend
 * into a queue of Workers all waiting, which converts a degraded dependency
 * into an outage of this site as well. One extra attempt covers the case worth
 * covering - a single isolate that went away mid-dispatch - and nothing else.
 *
 * The pause is short and fixed rather than exponential. There is only ever one
 * retry, so a growth factor would be describing a schedule that never runs.
 */
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 120;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Whether a failure is worth a second attempt.
 *
 * Only two are, and both mean the backend did not answer: the binding was
 * unavailable, or it timed out. A rejection is never retried - it would be
 * refused again at double the load. Nor is a 5xx carrying a backend code:
 * `ERR_APP_INFRASTRUCTURE` means the database failed, and the backend is better
 * placed than this client to decide whether to ask it twice.
 *
 * Not method-aware, because every request is a GET. A write must not simply
 * widen this: an unsafe request needs an idempotency key first.
 */
function isRetryable(error: LudwiseApiError): boolean {
  return (
    (error.kind === 'unavailable' || error.kind === 'timeout') &&
    // Only when nothing answered. A 5xx *is* an answer.
    error.status === undefined
  );
}

function headersFor(correlation: Correlation | undefined): Headers {
  const headers = new Headers({ accept: 'application/json' });
  if (correlation?.requestId !== undefined) headers.set('x-request-id', correlation.requestId);
  if (correlation?.traceparent !== undefined) headers.set('traceparent', correlation.traceparent);
  return headers;
}

/** Appends a value only when it was actually supplied. */
function put(params: URLSearchParams, name: string, value: string | number | undefined): void {
  if (value !== undefined) params.set(name, String(value));
}

/**
 * The `/v1/games` query string.
 *
 * The parameter names are the contract, not the field names: a visitor sees
 * exactly these in their address bar, and the backend route reads exactly
 * these. `minPriceMinor` becoming `min` is the mapping, and it is written out
 * here rather than derived so that reading this function tells you what goes on
 * the wire.
 */
function searchParams(input: GameSearchInput): URLSearchParams {
  const params = new URLSearchParams();

  put(params, 'q', input.query);
  put(params, 'page', input.page);
  put(params, 'market', input.marketCode);
  put(params, 'currency', input.currencyCode);
  put(params, 'min', input.minPriceMinor);
  put(params, 'max', input.maxPriceMinor);
  put(params, 'fromYear', input.releaseYearFrom);
  put(params, 'toYear', input.releaseYearTo);

  // Sent as a literal rather than omitted when false. The route reads anything
  // other than 'false' as true, so omitting it would mean "not asked" - a
  // different question from "asked for, and no".
  if (input.discounted !== undefined) {
    params.set('discounted', input.discounted ? 'true' : 'false');
  }

  for (const store of input.stores ?? []) params.append('store', store);

  return params;
}

/**
 * The `/v1/sales` query string.
 *
 * `min` and `max` are whole major units here and minor units on `/v1/games`.
 * The input field names carry the unit for exactly this reason: reusing the
 * parameter name for a different unit would be a hundredfold error in a
 * visitor-facing filter, and the field name is what stops the two being
 * confused at a call site.
 *
 * There is no `q` and no `discounted`, because sales has no name search and
 * the whole page is discounts.
 */
function salesParams(input: BrowseSalesInput): URLSearchParams {
  const params = new URLSearchParams();

  put(params, 'market', input.marketCode);
  put(params, 'currency', input.currencyCode);
  put(params, 'minDiscount', input.minDiscountPercentage);
  put(params, 'min', input.minPriceMajor);
  put(params, 'max', input.maxPriceMajor);
  put(params, 'fromYear', input.releaseYearFrom);
  put(params, 'toYear', input.releaseYearTo);
  put(params, 'sort', input.sort);
  put(params, 'page', input.page);

  for (const store of input.stores ?? []) params.append('store', store);

  return params;
}

interface RequestSpec {
  readonly path: string;
  readonly params?: URLSearchParams | undefined;
  /**
   * A stable name for this read, for logs and error messages.
   *
   * A constant chosen here, never derived from input. It reaches log records,
   * and a value spliced in from a query string would be log forging.
   */
  readonly operation: string;
  /**
   * Whether a 404 is an answer rather than a failure.
   *
   * True only for game detail, where the backend answers 404 for a slug nothing
   * was seeded under. That is "no such game", which is a fact a page renders as
   * a 404 of its own - not a fault to be caught and reported as breakage.
   */
  readonly notFoundIsNull?: boolean | undefined;
}

/**
 * One attempt. Everything about retrying is in `request`, above this.
 *
 * Split out so the retry loop reads as a loop rather than as control flow
 * threaded through error handling, and so the timeout is unambiguously
 * per-attempt: two attempts each get the full budget, which is what "the
 * backend has N milliseconds to answer" should mean.
 */
async function attempt<T>(
  options: ClientOptions,
  spec: RequestSpec,
  signal: AbortSignal | undefined,
): Promise<T | null> {
  const url = new URL(spec.path, options.baseUrl);
  url.search = (spec.params ?? new URLSearchParams()).toString();

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = AbortSignal.timeout(timeoutMs);
  // Composed rather than chosen: a caller may abort (a canceled navigation),
  // and the timeout applies regardless. `AbortSignal.any` is what makes the
  // first of the two to fire win, without either being able to mask the other.
  const composed = signal === undefined ? timeout : AbortSignal.any([signal, timeout]);

  let response: Response;
  try {
    response = await options.fetch(url.toString(), {
      method: 'GET',
      headers: headersFor(options.correlation),
      signal: composed,
    });
  } catch (cause) {
    // Distinguished by which signal fired rather than by inspecting the error,
    // because the thrown value's shape is the runtime's business and matching
    // on its name or message would couple this to one platform's wording.
    const kind = timeout.aborted ? 'timeout' : 'unavailable';
    throw new LudwiseApiError(kind, spec.operation, { cause });
  }

  if (spec.notFoundIsNull === true && response.status === 404) return null;

  if (!response.ok) {
    throw apiErrorFromBody(spec.operation, response.status, await readErrorBody(response));
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    // A 2xx that is not JSON did not come from a route of ours.
    throw new LudwiseApiError('malformed', spec.operation, { status: response.status, cause });
  }

  // The narrowest structural check, not schema validation: every view is a JSON
  // object, so anything else means the backend did not answer. A field-by-field
  // copy would also reject an added field, which ADR 0025 permits.
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new LudwiseApiError('malformed', spec.operation, { status: response.status });
  }

  return body as T;
}

/**
 * Reads a failure body without ever trusting it.
 *
 * Returns `undefined` rather than throwing when the body is unreadable: the
 * response is already a failure, and failing to parse the explanation of a
 * failure must not replace it with a different failure. The caller then reports
 * an unclassified backend error, which is the honest answer.
 *
 * `Partial<ApiErrorBody>` is a claim about shape and not about content, which
 * is why `apiErrorFromBody` still checks the type of every field it reads. The
 * declared type says which fields are worth looking for; it does not promise
 * any of them is there or is a string.
 */
async function readErrorBody(response: Response): Promise<Partial<ApiErrorBody> | undefined> {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? body : undefined;
  } catch {
    // Not JSON. Nothing to learn, and its text is not ours to pass on.
    return undefined;
  }
}

async function request<T>(
  options: ClientOptions,
  spec: RequestSpec,
  signal?: AbortSignal,
): Promise<T | null> {
  const sleep = options.sleep ?? defaultSleep;

  for (let remaining = MAX_ATTEMPTS; ; remaining -= 1) {
    try {
      return await attempt<T>(options, spec, signal);
    } catch (error) {
      const last = remaining <= 1;
      if (last || !(error instanceof LudwiseApiError) || !isRetryable(error)) throw error;
      // A caller who aborted does not want another attempt made on their behalf.
      if (signal?.aborted === true) throw error;
      await sleep(RETRY_DELAY_MS);
    }
  }
}

/**
 * A read whose only "no answer" is a failure.
 *
 * Two entry points rather than one returning `T | null` that every call site
 * casts away, because a cast cannot distinguish "the caller already knows this
 * is not null" from "the null is real". Here the type carries the difference:
 * this cannot return null, and `getGameDetail` calls `request` directly
 * because it can.
 */
async function requireOne<T>(
  options: ClientOptions,
  spec: RequestSpec,
  signal: AbortSignal | undefined,
): Promise<T> {
  const answer = await request<T>(options, { ...spec, notFoundIsNull: false }, signal);
  if (answer === null) {
    // Unreachable while `notFoundIsNull` is false, and asserted rather than
    // cast away so that a future change which sets it cannot silently hand a
    // page a null it does not expect.
    throw new LudwiseApiError('malformed', spec.operation);
  }
  return answer;
}

/** The reads this site makes. Nothing else may be requested of the backend. */
export interface LudwiseApi {
  searchGames(input?: GameSearchInput, signal?: AbortSignal): Promise<GameSearchView>;
  /** `null` when no game carries that slug, which is an answer rather than a fault. */
  getGameDetail(slug: string, signal?: AbortSignal): Promise<GameDetailView | null>;
  browseSales(input?: BrowseSalesInput, signal?: AbortSignal): Promise<BrowseSalesView>;
}

/**
 * Builds the client.
 *
 * An explicit allowlist of three operations rather than a general "call the
 * backend" function, and that is a security boundary rather than an interface
 * preference. A client that could be handed a path would be a proxy, and a
 * proxy reachable from a page is how `/ops` and internal routes become
 * publicly reachable through the front door. There is no path parameter here
 * and there must never be one.
 *
 * Constructing it costs nothing and touches nothing, so middleware can install
 * it on every request including the health probe.
 */
export function createApiClient(options: ClientOptions): LudwiseApi {
  return {
    searchGames(input: GameSearchInput = {}, signal?: AbortSignal): Promise<GameSearchView> {
      return requireOne<GameSearchView>(
        options,
        { path: '/v1/games', params: searchParams(input), operation: 'games.search' },
        signal,
      );
    },

    getGameDetail(slug: string, signal?: AbortSignal): Promise<GameDetailView | null> {
      return request<GameDetailView>(
        options,
        {
          path: `/v1/games/${encodeURIComponent(slug)}`,
          operation: 'games.detail',
          notFoundIsNull: true,
        },
        signal,
      );
    },

    browseSales(input: BrowseSalesInput = {}, signal?: AbortSignal): Promise<BrowseSalesView> {
      return requireOne<BrowseSalesView>(
        options,
        { path: '/v1/sales', params: salesParams(input), operation: 'sales.browse' },
        signal,
      );
    },
  };
}
