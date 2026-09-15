import { describe, expect, it } from 'vitest';

import { readCountryCode } from '../../../src/lib/region/country-code.js';
import {
  clearRegionCookie,
  readRegionCookie,
  REGION_COOKIE_NAME,
  serializeRegionCookie,
} from '../../../src/lib/region/region-cookie.js';

/**
 * The saved region is caller-controlled. It reaches a backend query string and
 * a rendered page, so the reader answers only with a well-formed country code
 * or with null. It never answers with what it was given.
 */

describe('readCountryCode', () => {
  it.each(['DE', 'US', 'XX'])('accepts the well-formed code %s', (code) => {
    expect(readCountryCode(code)).toBe(code);
  });

  it.each([
    ['a lower-case code', 'de'],
    ['a code with a digit, as the edge sends for Tor', 'T1'],
    ['a three-letter code', 'DEU'],
    ['an empty value', ''],
    ['a query-breaking value', 'DE&market=JP'],
    ['a value that is not text', 42],
    ['no value', undefined],
    ['null', null],
  ])('refuses %s', (_label, value) => {
    expect(readCountryCode(value)).toBeNull();
  });
});

describe('readRegionCookie', () => {
  it('reads the saved region among other cookies', () => {
    expect(readRegionCookie(`theme=dark; ${REGION_COOKIE_NAME}=JP; other=1`)).toBe('JP');
  });

  it('answers null when no region was saved', () => {
    expect(readRegionCookie(null)).toBeNull();
    expect(readRegionCookie('')).toBeNull();
    expect(readRegionCookie('theme=dark')).toBeNull();
  });

  it('matches the whole cookie name only', () => {
    expect(readRegionCookie('old_region=JP')).toBeNull();
  });

  it('answers null for a saved value that is not a country code', () => {
    expect(readRegionCookie(`${REGION_COOKIE_NAME}=jp`)).toBeNull();
    expect(readRegionCookie(`${REGION_COOKIE_NAME}="><script>`)).toBeNull();
  });
});

describe('serializeRegionCookie', () => {
  it('saves the region identifier and nothing derived from it', () => {
    const cookie = serializeRegionCookie('JP', { secure: true });

    expect(cookie.startsWith(`${REGION_COOKIE_NAME}=JP;`)).toBe(true);
    expect(cookie).not.toContain('JPY');
  });

  it('survives a closed browser, stays first-party, and stays out of page scripts', () => {
    const cookie = serializeRegionCookie('JP', { secure: true });

    expect(cookie).toContain('Path=/');
    expect(cookie).toMatch(/Max-Age=\d{7,}/u);
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
  });

  it('omits Secure on plain http, where a browser would drop the cookie', () => {
    expect(serializeRegionCookie('JP', { secure: false })).not.toContain('Secure');
  });
});

describe('clearRegionCookie', () => {
  it('expires the saved region at once', () => {
    const cookie = clearRegionCookie({ secure: false });

    expect(cookie.startsWith(`${REGION_COOKIE_NAME}=;`)).toBe(true);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Path=/');
  });
});
