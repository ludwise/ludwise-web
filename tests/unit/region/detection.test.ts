import { describe, expect, it } from 'vitest';

import { detectCountryCode, TEST_COUNTRY_HEADER } from '../../../src/lib/region/detection.js';

/** A request as the Cloudflare edge hands one to the Worker, with its `cf` metadata. */
function edgeRequest(cf: unknown, headers: Record<string, string> = {}): Request {
  const request = new Request('https://ludwise.com/sales', { headers });
  Object.defineProperty(request, 'cf', { value: cf });
  return request;
}

describe('detectCountryCode', () => {
  it('reads the country the edge assigned to the request', () => {
    expect(detectCountryCode(edgeRequest({ country: 'JP', city: 'Tokyo' }), 'production')).toBe(
      'JP',
    );
  });

  it('reads nothing but the country code, so no finer location is used', () => {
    const request = edgeRequest({ country: 'JP', latitude: '35.6', longitude: '139.7' });

    expect(detectCountryCode(request, 'production')).toBe('JP');
  });

  it.each([
    ['no edge metadata', undefined],
    ['metadata without a country', {}],
    ['the code for an unknown country', { country: 'T1' }],
    ['a value that is not text', { country: 7 }],
  ])('answers null for %s', (_label, cf) => {
    expect(detectCountryCode(edgeRequest(cf), 'staging')).toBeNull();
  });

  it('ignores the caller-controlled country header, which anyone can send', () => {
    const request = edgeRequest(undefined, { 'cf-ipcountry': 'JP', [TEST_COUNTRY_HEADER]: 'JP' });

    expect(detectCountryCode(request, 'production')).toBeNull();
  });

  it('reads the test header alone in development, where the edge metadata is the developer machine', () => {
    const request = edgeRequest({ country: 'US' }, { [TEST_COUNTRY_HEADER]: 'JP' });

    expect(detectCountryCode(request, 'development')).toBe('JP');
    expect(detectCountryCode(edgeRequest({ country: 'US' }), 'development')).toBeNull();
  });
});
