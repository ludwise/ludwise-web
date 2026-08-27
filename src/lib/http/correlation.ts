export const REQUEST_ID_HEADER = 'x-request-id';
export const TRACEPARENT_HEADER = 'traceparent';

/**
 * Accepted shape for an inbound request id.
 *
 * This is a security control, not a style preference. The value is echoed into
 * a response header and embedded into JSON log records. So an unvalidated value
 * permits header splitting via CRLF and log forging via escaped quotes. That
 * would let a caller fabricate entries in the record used to investigate them.
 *
 * The character set is a superset of every identifier actually seen in the
 * wild: UUID, ULID, nanoid, Cloudflare ray id and OpenTelemetry span id. The
 * lower bound rejects degenerate values that collide across callers. The upper
 * bound caps log growth.
 */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * W3C Trace Context, version 00 only.
 *
 * The negative lookaheads reject all-zero trace and parent ids, which the
 * specification defines as invalid and which some misconfigured proxies emit.
 * Accepting them would place every request in the system into a single trace.
 * Hex must be lowercase. The specification mandates it.
 */
export const TRACEPARENT_PATTERN =
  /^00-(?!0{32})([0-9a-f]{32})-(?!0{16})([0-9a-f]{16})-([0-9a-f]{2})$/;

export interface TraceParent {
  readonly traceId: string;
  readonly parentId: string;
  readonly flags: string;
}

export interface Correlation {
  readonly requestId: string;
  /** Whether the id came from the caller or was generated here. */
  readonly requestIdSource: 'inbound' | 'generated';
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly traceFlags: string;
  readonly traceSource: 'inbound' | 'generated';
}

export function isValidRequestId(value: string | null | undefined): boolean {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

export function parseTraceparent(value: string | null | undefined): TraceParent | null {
  if (typeof value !== 'string') return null;
  const match = TRACEPARENT_PATTERN.exec(value);
  if (!match) return null;
  const [, traceId, parentId, flags] = match;
  if (!traceId || !parentId || !flags) return null;
  return { traceId, parentId, flags };
}

// crypto.randomUUID is a global in Workers with no import and no flag, and in
// Node 19 and later. The same call thus works in production, in development, and
// under Vitest. It returns lowercase hex, which Trace Context requires.
export function newRequestId(): string {
  return crypto.randomUUID();
}

export function newTraceId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export function newSpanId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 16);
}

export function formatTraceparent(correlation: Correlation): string {
  return `00-${correlation.traceId}-${correlation.spanId}-${correlation.traceFlags}`;
}

/**
 * Derives correlation identifiers for one request.
 *
 * A malformed inbound header is never an error. Rejecting the request would let
 * any caller take the site down with a junk header. So the invalid value is
 * discarded and a fresh identifier is generated instead. The source field
 * records which happened, because an inbound id is caller-controlled and must
 * be treated as such during an investigation.
 */
export function deriveCorrelation(headers: Headers): Correlation {
  const inboundRequestId = headers.get(REQUEST_ID_HEADER);
  const requestIdIsValid = isValidRequestId(inboundRequestId);

  const inboundTrace = parseTraceparent(headers.get(TRACEPARENT_HEADER));

  const base = {
    requestId: requestIdIsValid && inboundRequestId ? inboundRequestId : newRequestId(),
    requestIdSource: requestIdIsValid ? ('inbound' as const) : ('generated' as const),
    spanId: newSpanId(),
  };

  if (inboundTrace) {
    return {
      ...base,
      traceId: inboundTrace.traceId,
      parentSpanId: inboundTrace.parentId,
      traceFlags: inboundTrace.flags,
      traceSource: 'inbound',
    };
  }

  return {
    ...base,
    traceId: newTraceId(),
    traceFlags: '00',
    traceSource: 'generated',
  };
}
