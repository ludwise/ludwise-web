import { describe, expect, it } from 'vitest';

import {
  CIRCULAR_MARKER,
  isDeniedKey,
  MAX_DEPTH_MARKER,
  normalizeKey,
  redact,
  REDACTED,
} from '../../../src/lib/logging/redact.js';

describe('normalizeKey', () => {
  it('collapses separators and case so one denylist entry covers every spelling', () => {
    // Strips separators and case. The leading X is retained. What matters is
    // that the result contains 'apikey', which is how isDeniedKey matches.
    expect(normalizeKey('X-Api-Key')).toBe('xapikey');
    expect(normalizeKey('api_key')).toBe('apikey');
    expect(normalizeKey('steam.api.key')).toBe('steamapikey');
  });
});

describe('isDeniedKey', () => {
  it.each([
    'authorization',
    'Authorization',
    'AUTHORIZATION',
    'X-Api-Key',
    'apiKey',
    'api_key',
    'steamApiKey',
    'set-cookie',
    'setCookie',
    'refreshTokenHash',
    'userEmail',
    'clientSecret',
  ])('denies %s', (key) => {
    expect(isDeniedKey(key)).toBe(true);
  });

  it.each(['status', 'route', 'duration_ms', 'gameId', 'market'])('allows %s', (key) => {
    expect(isDeniedKey(key)).toBe(false);
  });
});

describe('redact', () => {
  it('redacts denied keys at the top level, nested, and inside arrays', () => {
    const output = redact({
      password: 'hunter2',
      nested: { authorization: 'Basic abc' },
      list: [{ apiKey: 'k-1' }],
      route: '/games',
    }) as Record<string, unknown>;

    expect(output['password']).toBe(REDACTED);
    expect((output['nested'] as Record<string, unknown>)['authorization']).toBe(REDACTED);
    expect(((output['list'] as unknown[])[0] as Record<string, unknown>)['apiKey']).toBe(REDACTED);
    expect(output['route']).toBe('/games');
  });

  it('caps depth instead of recursing without bound', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: 'too deep' } } } } } } };
    expect(JSON.stringify(redact(deep, { maxDepth: 3 }))).toContain(MAX_DEPTH_MARKER);
  });

  it('detects cycles rather than throwing', () => {
    const cyclic: Record<string, unknown> = { name: 'root' };
    cyclic['self'] = cyclic;
    expect(JSON.stringify(redact(cyclic))).toContain(CIRCULAR_MARKER);
  });

  it('caps breadth and says how much was dropped', () => {
    const wide: Record<string, number> = {};
    for (let i = 0; i < 100; i += 1) wide[`key${String(i)}`] = i;
    const output = redact(wide, { maxKeys: 10 }) as Record<string, unknown>;
    expect(Object.keys(output)).toHaveLength(11);
    expect(output['...']).toBe('[+90 more]');
  });

  it('truncates long strings', () => {
    const output = redact({ note: 'x'.repeat(5000) }, { maxStringLength: 100 }) as Record<
      string,
      unknown
    >;
    expect(String(output['note'])).toHaveLength(100 + '...[truncated]'.length);
  });

  it('preserves an Error and follows its cause chain', () => {
    const error = new Error('outer', { cause: new Error('inner') });
    const output = redact({ error }) as Record<string, unknown>;
    const serialised = output['error'] as Record<string, unknown>;
    expect(serialised['name']).toBe('Error');
    expect(serialised['message']).toBe('outer');
    expect((serialised['cause'] as Record<string, unknown>)['message']).toBe('inner');
  });

  it('emits only a size for Map and Set, never their contents', () => {
    const output = JSON.stringify(
      redact({
        map: new Map([['token', 'super-secret']]),
        set: new Set(['super-secret']),
      }),
    );
    expect(output).not.toContain('super-secret');
    expect(output).toContain('[Map size=1]');
    expect(output).toContain('[Set size=1]');
  });

  it('does not attempt to serialise platform objects', () => {
    const output = redact({ req: new Request('https://ludwise.test/') }) as Record<string, unknown>;
    expect(output['req']).toBe('[unserializable:Request]');
  });

  it('handles BigInt, which JSON.stringify throws on', () => {
    const output = redact({ big: BigInt(42) }) as Record<string, unknown>;
    expect(output['big']).toBe('42');
  });

  // Credentials routinely arrive with innocent key names.
  it('redacts values that look like credentials regardless of their key', () => {
    const output = redact({
      value: 'Bearer abc123def456',
      header: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig',
    }) as Record<string, unknown>;
    expect(output['value']).toBe(REDACTED);
    expect(output['header']).toBe(REDACTED);
  });

  it('produces output that always survives JSON.stringify', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    const hostile = {
      cyclic,
      big: BigInt(1),
      fn: () => 'nope',
      undef: undefined,
      req: new Request('https://ludwise.test/'),
      deep: { a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } },
      when: new Date('2026-01-01T00:00:00.000Z'),
      inf: Number.POSITIVE_INFINITY,
    };
    expect(() => JSON.stringify(redact(hostile))).not.toThrow();
  });
});
