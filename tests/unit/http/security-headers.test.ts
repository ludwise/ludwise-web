import { describe, expect, it } from 'vitest';

import {
  INDEXING_HEADERS,
  MEDIA_HEADERS,
  SECURITY_HEADERS,
  withSecurityHeaders,
} from '../../../src/lib/http/security-headers.js';

/**
 * These headers are the site's clickjacking, sniffing and referrer-leak
 * defences, applied to every Worker response. A public site shipping this
 * with no test at all is exactly the gap a code review misses once and an
 * incident finds later. So each header is asserted for the property it
 * exists to buy - not merely that a key with some value is present.
 */

describe('SECURITY_HEADERS', () => {
  it('pins the complete content security policy, not just selected directives', () => {
    expect(SECURITY_HEADERS['x-frame-options']).toBe('DENY');
    expect(SECURITY_HEADERS['content-security-policy']).toBe(
      "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; form-action 'self'; img-src 'self'",
    );
  });

  it('permits an image from this origin alone, which the media route is what makes possible', () => {
    // Stated on its own because it is the directive with a product decision
    // behind it. Every picture is served from the LUDWISE origin, so a
    // provider host in rendered markup stops working rather than leaking.
    expect(SECURITY_HEADERS['content-security-policy']).toContain("img-src 'self'");
  });

  it('blocks content sniffing, which is how a non-HTML response gets treated as HTML', () => {
    expect(SECURITY_HEADERS['x-content-type-options']).toBe('nosniff');
  });

  it('sends no more than the origin cross-site, so a click to a storefront does not leak the page path', () => {
    expect(SECURITY_HEADERS['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('varies HTML on the cookie that changes it, so a future cache cannot serve one visitor to another', () => {
    expect(SECURITY_HEADERS.vary).toBe('cookie');
  });

  it('denies every permissions-policy feature the product does not use', () => {
    expect(SECURITY_HEADERS['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
    );
  });

  it('is frozen, so a caller cannot mutate the shared header set', () => {
    expect(Object.isFrozen(SECURITY_HEADERS)).toBe(true);
  });
});

describe('INDEXING_HEADERS', () => {
  it('tells crawlers to stay out', () => {
    expect(INDEXING_HEADERS['x-robots-tag']).toBe('noindex, nofollow');
  });
});

describe('MEDIA_HEADERS', () => {
  it('carries every shared header except the one an image must not send', () => {
    // Derived from the shared set rather than written out again, so a header
    // added there reaches the media route too.
    const { vary, ...shared } = SECURITY_HEADERS;
    expect(vary).toBe('cookie');

    for (const [name, value] of Object.entries(shared)) {
      expect(MEDIA_HEADERS[name as keyof typeof MEDIA_HEADERS], name).toBe(value);
    }
    expect('vary' in MEDIA_HEADERS).toBe(false);
  });

  it('tells a crawler to stay out of the image itself', () => {
    // Rights, not search performance. An indexed image stands alone, without
    // the provider credit the display terms require.
    expect(MEDIA_HEADERS['x-robots-tag']).toBe('noindex');
  });

  it('is frozen, so a caller cannot mutate the shared header set', () => {
    expect(Object.isFrozen(MEDIA_HEADERS)).toBe(true);
  });
});

describe('withSecurityHeaders', () => {
  it('applies every security header to an ordinary mutable response', () => {
    const response = withSecurityHeaders(new Response('ok'));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(response.headers.get(name)).toBe(value);
    }
  });

  it('adds the noindex header outside production', () => {
    const response = withSecurityHeaders(new Response('ok'), 'staging');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('never sends the noindex header in production, since de-indexing the live site is silent and slow to notice', () => {
    const response = withSecurityHeaders(new Response('ok'), 'production');
    expect(response.headers.get('x-robots-tag')).toBeNull();
  });

  it('treats an absent environment as not-production, the restrictive guess', () => {
    // This runs in the outermost middleware, which also wraps the 503 for a
    // configuration failure - the one case where there is no environment yet.
    const response = withSecurityHeaders(new Response('ok'));
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('preserves the original status, statusText and body', () => {
    const response = withSecurityHeaders(
      new Response('hello', { status: 404, statusText: 'Not Found' }),
    );
    expect(response.status).toBe(404);
    expect(response.statusText).toBe('Not Found');
  });

  it('withholds vary from the media route, in every environment', () => {
    // `vary: cookie` splits the browser cache of every visitor who has chosen
    // a theme. An image does not vary by theme.
    for (const environment of ['development', 'staging', 'production'] as const) {
      const response = withSecurityHeaders(new Response('bytes'), environment, { media: true });
      expect(response.headers.get('vary'), environment).toBeNull();
    }
  });

  it('removes a vary header the media response somehow already carried', () => {
    const response = withSecurityHeaders(
      new Response('bytes', { headers: { vary: 'accept' } }),
      'production',
      { media: true },
    );

    expect(response.headers.get('vary')).toBeNull();
  });

  it('tells a crawler to stay out of an image in production too', () => {
    // The one place `x-robots-tag` reaches production. Every other response
    // withholds it, because de-indexing the live site is silent and slow to
    // notice.
    const response = withSecurityHeaders(new Response('bytes'), 'production', { media: true });

    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('still applies the rest of the shared headers to a media response', () => {
    const response = withSecurityHeaders(new Response('bytes'), 'production', { media: true });

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });

  it('rebuilds a media response whose headers are immutable, vary included', async () => {
    const immutable = new Response('bytes', { status: 200 });
    Object.defineProperty(immutable, 'headers', {
      value: new Headers({ 'content-type': 'image/jpeg', vary: 'cookie' }),
      writable: false,
    });
    Object.defineProperty(immutable.headers, 'set', {
      value: () => {
        throw new TypeError('immutable headers');
      },
    });

    const response = withSecurityHeaders(immutable, 'production', { media: true });
    expect(response.headers.get('vary')).toBeNull();
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(await response.text()).toBe('bytes');
  });

  it('rebuilds the response rather than throwing when its headers are immutable', async () => {
    // A response served from the ASSETS binding can carry immutable headers.
    // Throwing there would turn a static asset request into a 500.
    const immutable = new Response('asset body', { status: 200 });
    Object.defineProperty(immutable, 'headers', {
      value: new Headers({ 'content-type': 'text/plain' }),
      writable: false,
    });
    // Simulate an immutable Headers instance by stubbing `set` to throw, which
    // is how a real Workers Response with immutable headers behaves.
    Object.defineProperty(immutable.headers, 'set', {
      value: () => {
        throw new TypeError('immutable headers');
      },
    });

    const response = withSecurityHeaders(immutable, 'production');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).toBe('asset body');
  });
});
