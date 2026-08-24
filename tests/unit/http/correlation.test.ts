import { describe, expect, it } from 'vitest';

import {
  REQUEST_ID_HEADER,
  REQUEST_ID_PATTERN,
  TRACEPARENT_HEADER,
  deriveCorrelation,
  formatTraceparent,
  isValidRequestId,
  newRequestId,
  newSpanId,
  newTraceId,
  parseTraceparent,
} from '../../../src/lib/http/correlation.js';

/**
 * A malformed correlation header is a security control, not a style choice.
 * The value is echoed into a response header and into JSON log records, so an
 * unvalidated value permits header splitting and log forging. These tests
 * exercise that boundary directly rather than trusting the regex by reading.
 */

describe('isValidRequestId', () => {
  it.each([
    ['a uuid', '550e8400-e29b-41d4-a716-446655440000'],
    ['a ulid', '01ARZ3NDEKTSV4RRFFQ69G5FAV'],
    ['a nanoid-shaped value', 'V1StGXR8_Z5jdHi6B-myT'],
    ['a minimal 8-character value', 'abcdefgh'],
  ])('accepts %s', (_label, value) => {
    expect(isValidRequestId(value)).toBe(true);
  });

  it.each([
    ['too short', 'abc123'],
    ['too long', 'a'.repeat(65)],
    ['containing a CRLF, which would split a header', 'abc12345\r\nx-evil: 1'],
    ['containing a space', 'abc 12345'],
    ['containing a quote, which would forge a log field', 'abc"12345'],
    ['empty', ''],
  ])('rejects %s', (_label, value) => {
    expect(isValidRequestId(value)).toBe(false);
  });

  it('rejects null and undefined rather than throwing', () => {
    expect(isValidRequestId(null)).toBe(false);
    expect(isValidRequestId(undefined)).toBe(false);
  });

  it('the exported pattern is anchored, so a valid id cannot be hidden inside a longer string', () => {
    expect(REQUEST_ID_PATTERN.test('xx abc12345 xx')).toBe(false);
  });
});

describe('parseTraceparent', () => {
  const VALID = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

  it('parses a valid version-00 header into its three fields', () => {
    expect(parseTraceparent(VALID)).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      parentId: '00f067aa0ba902b7',
      flags: '01',
    });
  });

  it('rejects an all-zero trace id, which the spec defines as invalid', () => {
    // Some misconfigured proxies emit it. Accepting it would place every
    // request in the system into a single trace.
    expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull();
  });

  it('rejects an all-zero parent id', () => {
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01')).toBeNull();
  });

  it('rejects uppercase hex, since the spec mandates lowercase', () => {
    expect(parseTraceparent('00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01')).toBeNull();
  });

  it('rejects a version other than 00', () => {
    expect(parseTraceparent('01-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')).toBeNull();
  });

  it('rejects a header with the wrong number of segments', () => {
    expect(parseTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7')).toBeNull();
  });

  it('rejects null and undefined rather than throwing', () => {
    expect(parseTraceparent(null)).toBeNull();
    expect(parseTraceparent(undefined)).toBeNull();
  });
});

describe('newRequestId, newTraceId, newSpanId', () => {
  it('produce values that satisfy their own validation and length rules', () => {
    expect(isValidRequestId(newRequestId())).toBe(true);
    expect(newTraceId()).toMatch(/^[0-9a-f]{32}$/);
    expect(newSpanId()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produce different values on each call, so two requests are never merged into one trace', () => {
    expect(newRequestId()).not.toBe(newRequestId());
    expect(newTraceId()).not.toBe(newTraceId());
    expect(newSpanId()).not.toBe(newSpanId());
  });
});

describe('formatTraceparent', () => {
  it('renders the version-00 header from a correlation record', () => {
    const formatted = formatTraceparent({
      requestId: 'req-1',
      requestIdSource: 'generated',
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: '01',
      traceSource: 'generated',
    });
    expect(formatted).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01');
  });
});

describe('deriveCorrelation', () => {
  it('generates fresh identifiers when no headers are present', () => {
    const correlation = deriveCorrelation(new Headers());
    expect(correlation.requestIdSource).toBe('generated');
    expect(correlation.traceSource).toBe('generated');
    expect(isValidRequestId(correlation.requestId)).toBe(true);
    expect(correlation.traceFlags).toBe('00');
    expect(correlation.parentSpanId).toBeUndefined();
  });

  it('reuses a valid inbound request id rather than generating a new one', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: 'inbound-req-12345' });
    const correlation = deriveCorrelation(headers);
    expect(correlation.requestId).toBe('inbound-req-12345');
    expect(correlation.requestIdSource).toBe('inbound');
  });

  it('discards a malformed inbound request id rather than rejecting the request', () => {
    // A malformed header is never an error: rejecting the request would let
    // any caller take the site down with a junk header.
    const headers = new Headers({ [REQUEST_ID_HEADER]: 'short' });
    const correlation = deriveCorrelation(headers);
    expect(correlation.requestId).not.toBe('short');
    expect(correlation.requestIdSource).toBe('generated');
    expect(isValidRequestId(correlation.requestId)).toBe(true);
  });

  it('adopts a valid inbound traceparent, carrying its trace and parent span ids', () => {
    const headers = new Headers({
      [TRACEPARENT_HEADER]: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
    const correlation = deriveCorrelation(headers);
    expect(correlation.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(correlation.parentSpanId).toBe('00f067aa0ba902b7');
    expect(correlation.traceFlags).toBe('01');
    expect(correlation.traceSource).toBe('inbound');
    // A fresh span id is minted for this hop regardless; reusing the parent's
    // own span id would make this request indistinguishable from its parent.
    expect(correlation.spanId).not.toBe('00f067aa0ba902b7');
  });

  it('generates a fresh trace when the inbound traceparent is malformed', () => {
    const headers = new Headers({ [TRACEPARENT_HEADER]: 'garbage' });
    const correlation = deriveCorrelation(headers);
    expect(correlation.traceSource).toBe('generated');
    expect(correlation.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(correlation.parentSpanId).toBeUndefined();
  });

  it('treats request id and trace validity independently', () => {
    // A caller can get one right and the other wrong; each is judged on its own.
    const headers = new Headers({
      [REQUEST_ID_HEADER]: 'valid-req-id-99',
      [TRACEPARENT_HEADER]: 'garbage',
    });
    const correlation = deriveCorrelation(headers);
    expect(correlation.requestIdSource).toBe('inbound');
    expect(correlation.traceSource).toBe('generated');
  });
});
