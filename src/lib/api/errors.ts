/**
 * What can go wrong when this site asks the backend for something, and how each
 * one is meant to be rendered.
 *
 * The distinction this module enforces is *unavailable* versus *empty*. They
 * reach a page as similar absences and mean opposite things, and rendering the
 * first as the second tells a visitor no game is on sale when the truth is that
 * we failed to ask - a false claim about the market. So a failed read throws
 * rather than returning an empty view.
 *
 * A `LudwiseApiError` carries a closed-set `code` and a `requestId`, and
 * nothing else off the wire. Should a message ever appear there it must not be
 * rendered: the response may have come from something in front of the backend.
 * `cause` exists for logs, and `toLogContext` is the only sanctioned way out.
 */

import type { ApiErrorBody } from './contract.js';

/**
 * Why a read failed, in the terms a page needs to choose what to render.
 *
 * Deliberately coarser than HTTP status codes, because a page makes exactly
 * four decisions and finer distinctions would be information no renderer uses.
 *
 * - `rejected`   the request was refused; show which filters and let the visitor fix them
 * - `unavailable` the backend could not answer; say so, do not say "empty"
 * - `timeout`    the backend did not answer in time; same, with a different log line
 * - `malformed`  something answered, but not with the contract; treat as unavailable
 *
 * `malformed` is separate from `unavailable` only because they need different
 * investigations - one is an outage, the other is a version skew or something
 * in front of the backend answering. A visitor sees the same page for both.
 */
export type ApiFailureKind = 'rejected' | 'unavailable' | 'timeout' | 'malformed';

export interface LudwiseApiErrorOptions {
  readonly code?: string | undefined;
  readonly requestId?: string | undefined;
  readonly status?: number | undefined;
  /** Which of the caller's fields were refused. Only ever set for `rejected`. */
  readonly fields?: readonly string[] | undefined;
  /** The view the backend rebuilt after refusing, if it sent one. */
  readonly data?: unknown;
  readonly cause?: unknown;
}

export class LudwiseApiError extends Error {
  readonly kind: ApiFailureKind;
  /** The backend's stable code, or a local one when the backend never answered. */
  readonly code: string;
  /**
   * The correlation id this request carried.
   *
   * Shown to visitors on failure pages, deliberately: it is the one value that
   * lets somebody reporting a problem be found in the logs, and it identifies a
   * request rather than a person.
   */
  readonly requestId: string | undefined;
  readonly status: number | undefined;
  readonly fields: readonly string[];
  readonly data: unknown;

  constructor(kind: ApiFailureKind, operation: string, options: LudwiseApiErrorOptions = {}) {
    // Kind and operation only, neither of them caller or backend data, so this
    // message is safe wherever it ends up - which is what lets the rest of the
    // codebase stop asking whether an error is safe to print.
    super(`${kind}: ${operation}`, { cause: options.cause });
    this.name = 'LudwiseApiError';
    this.kind = kind;
    this.code = options.code ?? LOCAL_CODES[kind];
    this.requestId = options.requestId;
    this.status = options.status;
    this.fields = options.fields ?? [];
    this.data = options.data;
  }

  /** Whether a visitor can fix this by changing their filters. */
  get isRejection(): boolean {
    return this.kind === 'rejected';
  }
}

/**
 * Codes for failures that never reached the backend, so carry none of its own.
 *
 * Prefixed `ERR_WEB_` rather than reusing the backend's `ERR_APP_` codes,
 * because they mean something different and an operator reading a log needs to
 * tell them apart: `ERR_APP_INFRASTRUCTURE` means the backend told us its
 * dependency failed, `ERR_WEB_UNAVAILABLE` means the backend told us nothing.
 */
const LOCAL_CODES: Readonly<Record<ApiFailureKind, string>> = {
  rejected: 'ERR_WEB_REJECTED',
  unavailable: 'ERR_WEB_UNAVAILABLE',
  timeout: 'ERR_WEB_TIMEOUT',
  malformed: 'ERR_WEB_MALFORMED',
};

/**
 * Which failure kind a backend error code stands for.
 *
 * Keyed on the code rather than the HTTP status, because the code is the part
 * the contract promises is stable. Two codes are free to share a status later
 * without this table noticing, and a status is free to change without a client
 * misclassifying the failure.
 *
 * An unrecognised code is `unavailable` rather than a guess: it means the
 * response did not come from the backend's own error path, and inventing a
 * classification for it would put a fabricated diagnosis into a log.
 */
const KIND_BY_CODE: ReadonlyMap<string, ApiFailureKind> = new Map([
  ['ERR_APP_VALIDATION', 'rejected' as const],
  ['ERR_APP_INFRASTRUCTURE', 'unavailable' as const],
  ['ERR_APP_INTERNAL', 'unavailable' as const],
  ['ERR_CONFIG_INVALID', 'unavailable' as const],
]);

export function failureKindForCode(code: string | undefined): ApiFailureKind {
  return code === undefined ? 'unavailable' : (KIND_BY_CODE.get(code) ?? 'unavailable');
}

/**
 * A failure built from a body the backend sent.
 *
 * Every field is read defensively rather than the body being cast. This parses
 * a response from another service, and "it came from us" is a deployment
 * assumption rather than a proof - a version skew, a proxy, or an error page
 * from something in front of the backend all arrive here looking like a
 * response. Anything unexpected is dropped rather than propagated.
 */
export function apiErrorFromBody(
  operation: string,
  status: number,
  body: Partial<ApiErrorBody> | undefined,
): LudwiseApiError {
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const fields = Array.isArray(body?.fields)
    ? body.fields.filter((field): field is string => typeof field === 'string')
    : undefined;

  return new LudwiseApiError(failureKindForCode(code), operation, {
    code,
    requestId: typeof body?.request_id === 'string' ? body.request_id : undefined,
    status,
    fields,
    data: body?.data,
  });
}

/**
 * The parts of a failure that are safe to log, and only those.
 *
 * Named as a function rather than left to each call site, because "log the
 * error" is the single easiest way to write a secret into a log file: `cause`
 * may hold a whole `Response`, a URL with a query string a visitor typed, or
 * text from something upstream. None of that is here.
 *
 * Note what is absent: the message (derived, but no reason to duplicate), the
 * cause, the response body, and any query value. The route template and
 * duration are added by the caller, which is the only place that knows them.
 */
export function toLogContext(error: LudwiseApiError): Record<string, unknown> {
  return {
    error_kind: error.kind,
    error_code: error.code,
    ...(error.status === undefined ? {} : { status: error.status }),
    ...(error.requestId === undefined ? {} : { request_id: error.requestId }),
    // Field *names* only, which are query parameter names a visitor can see in
    // their own address bar. Never the values they were rejected for.
    ...(error.fields.length === 0 ? {} : { refused_fields: [...error.fields] }),
  };
}

/**
 * Whether an unknown thrown value is one of ours.
 *
 * `instanceof` rather than a duck-typed check, and it is safe here because
 * there is exactly one module realm: this is not a library being loaded twice.
 */
export function isApiError(error: unknown): error is LudwiseApiError {
  return error instanceof LudwiseApiError;
}
