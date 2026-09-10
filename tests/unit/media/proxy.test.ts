/**
 * The media route's whole answer, asserted against a fetch that is not a network.
 *
 * Three properties matter more than the rest and each is named on its own. The
 * outbound request carries nothing that came from the visitor. The response
 * `content-type` is pinned to an image type rather than passed through. And no
 * answer is ever a redirect to the upstream address. Such a redirect hands the
 * browser the provider host, and undoes the reason this route exists.
 */

import { describe, expect, it, vi } from 'vitest';

import { createMediaProxy, type MediaProxyOptions } from '../../../src/lib/media/proxy.js';
import type { MediaTarget } from '../../../src/lib/media/target.js';

const TARGET: MediaTarget = { host: 'images.example.test', path: 'upload/cover/demo.jpg' };
const UPSTREAM = 'https://images.example.test/upload/cover/demo.jpg';

const BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function imageResponse(type = 'image/jpeg', status = 200): Response {
  return new Response(BYTES, { status, headers: { 'content-type': type } });
}

function proxyOver(
  fetchImpl: MediaProxyOptions['fetch'],
  overrides: Partial<MediaProxyOptions> = {},
) {
  return createMediaProxy({
    fetch: fetchImpl,
    upstream: { allowedHosts: ['images.example.test'] },
    siteUrl: 'https://ludwise.test',
    ...overrides,
  });
}

/** A fetch that answers once and records how it was called. */
function stub(response: Response | (() => Promise<Response>)) {
  return vi.fn(async () =>
    typeof response === 'function' ? await response() : response,
  ) as unknown as MediaProxyOptions['fetch'] & ReturnType<typeof vi.fn>;
}

describe('the outbound request', () => {
  it('asks the allow-listed host for the path the route was given', async () => {
    const fetchImpl = stub(imageResponse());
    await proxyOver(fetchImpl).serve(TARGET);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(UPSTREAM);
    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
  });

  it('forwards nothing from the visitor', async () => {
    // Structural rather than a filter: the visitor's request never reaches this
    // module at all. `serve` takes a host and a path and builds the rest.
    const fetchImpl = stub(imageResponse());
    await proxyOver(fetchImpl).serve(TARGET);

    const headers = new Headers((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers);
    expect([...headers.keys()].sort()).toEqual(['accept', 'user-agent']);
    expect(headers.get('accept')).toBe('image/*');
  });

  it('names LUDWISE and the site address, so a provider can reach the operator', async () => {
    const fetchImpl = stub(imageResponse());
    await proxyOver(fetchImpl).serve(TARGET);

    const headers = new Headers((fetchImpl.mock.calls[0]?.[1] as RequestInit).headers);
    expect(headers.get('user-agent')).toContain('LUDWISE');
    expect(headers.get('user-agent')).toContain('https://ludwise.test');
  });

  it('does not follow a redirect, which is how an allow-listed host leaves the list', async () => {
    const fetchImpl = stub(imageResponse());
    await proxyOver(fetchImpl).serve(TARGET);

    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).redirect).toBe('manual');
  });

  it('gives the edge cache a lifetime for each status rather than one for all', async () => {
    // A flat lifetime holds a 404 for as long as it holds a 200, which pins an
    // asset that has not appeared yet.
    const fetchImpl = stub(imageResponse());
    await proxyOver(fetchImpl).serve(TARGET);

    const init = fetchImpl.mock.calls[0]?.[1] as { cf?: { cacheTtlByStatus?: unknown } };
    expect(init.cf?.cacheTtlByStatus).toEqual({ '200-299': 86_400, '404': 60, '500-599': 0 });
  });

  it('carries a deadline, so a stalled upstream cannot hold the request open', async () => {
    const fetchImpl = stub(imageResponse());
    await proxyOver(fetchImpl).serve(TARGET);

    expect((fetchImpl.mock.calls[0]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('is never made at all for a host the allow-list refuses', async () => {
    const fetchImpl = stub(imageResponse());
    const response = await proxyOver(fetchImpl).serve({
      host: 'images.example.test.attacker.test',
      path: 'upload/cover/demo.jpg',
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });

  it('goes to the development origin when one is configured', async () => {
    const fetchImpl = stub(imageResponse());
    await proxyOver(fetchImpl, {
      upstream: { allowedHosts: ['images.example.test'], originOverride: 'http://localhost:8788' },
    }).serve(TARGET);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://localhost:8788/upload/cover/demo.jpg');
  });
});

describe('a served image', () => {
  it('answers 200 with the upstream bytes', async () => {
    const response = await proxyOver(stub(imageResponse())).serve(TARGET);

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(BYTES);
  });

  it('may be cached for a day, and is never immutable', async () => {
    // `immutable` and a one-day ceiling contradict each other: the first says
    // the bytes never change, the second says stop trusting them tomorrow.
    const response = await proxyOver(stub(imageResponse())).serve(TARGET);

    expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
    expect(response.headers.get('cache-control')).not.toContain('immutable');
  });

  it('pins the content type rather than passing the upstream value through', async () => {
    const response = await proxyOver(stub(imageResponse('IMAGE/JPEG; charset=binary'))).serve(
      TARGET,
    );

    expect(response.headers.get('content-type')).toBe('image/jpeg');
  });

  it('carries nosniff beside the pinned type', async () => {
    const response = await proxyOver(stub(imageResponse())).serve(TARGET);

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('carries no vary header, which would split the cache by theme', async () => {
    const response = await proxyOver(stub(imageResponse())).serve(TARGET);

    expect(response.headers.get('vary')).toBeNull();
  });

  it('accepts each image type the route serves', async () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']) {
      const response = await proxyOver(stub(imageResponse(type))).serve(TARGET);
      expect(response.status, type).toBe(200);
      expect(response.headers.get('content-type'), type).toBe(type);
    }
  });
});

describe('a refused answer', () => {
  it('answers 404 for a content type that is not an image', async () => {
    // Without this pin the route serves whatever an upstream path returns, on
    // the LUDWISE origin.
    for (const type of ['text/html', 'application/json', 'image/svg+xml', 'text/plain']) {
      const response = await proxyOver(stub(imageResponse(type))).serve(TARGET);
      expect(response.status, type).toBe(404);
    }
  });

  it('answers 404 when the upstream states no content type at all', async () => {
    const response = await proxyOver(stub(new Response(BYTES, { status: 200 }))).serve(TARGET);

    expect(response.status).toBe(404);
  });

  it('answers 404 for any upstream status that is not 2xx', async () => {
    for (const status of [301, 302, 400, 403, 404, 429, 500, 503]) {
      const upstream = new Response(status === 301 || status === 302 ? null : BYTES, {
        status,
        headers: { 'content-type': 'image/jpeg', location: 'https://attacker.test/x.jpg' },
      });
      const response = await proxyOver(stub(upstream)).serve(TARGET);

      expect(response.status, String(status)).toBe(404);
      expect(response.headers.get('location'), String(status)).toBeNull();
    }
  });

  it('answers 502 when the upstream cannot be reached', async () => {
    const response = await proxyOver(
      stub(() => Promise.reject(new Error('connection refused'))),
    ).serve(TARGET);

    expect(response.status).toBe(502);
  });

  it('answers 502 when the upstream does not answer in time', async () => {
    const proxy = proxyOver(
      ((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        })) as MediaProxyOptions['fetch'],
      { timeoutMs: 5 },
    );

    const response = await proxy.serve(TARGET);
    expect(response.status).toBe(502);
  });

  it('carries no body, whichever refusal it is', async () => {
    // A placeholder image would imply a fact nobody stated. An error page would
    // be HTML served where the caller asked for a picture.
    const refusals = [
      await proxyOver(stub(imageResponse('text/html'))).serve(TARGET),
      await proxyOver(stub(imageResponse('image/jpeg', 500))).serve(TARGET),
      await proxyOver(stub(() => Promise.reject(new Error('down')))).serve(TARGET),
    ];

    for (const response of refusals) {
      expect(response.body).toBeNull();
      expect(await response.text()).toBe('');
    }
  });

  it('lets a 404 be cached briefly and a 502 not at all', async () => {
    const missing = await proxyOver(stub(imageResponse('image/jpeg', 404))).serve(TARGET);
    const broken = await proxyOver(stub(() => Promise.reject(new Error('down')))).serve(TARGET);

    expect(missing.headers.get('cache-control')).toBe('public, max-age=60');
    expect(broken.headers.get('cache-control')).toBe('no-store');
  });

  it('never redirects, whatever happens', async () => {
    const answers = [
      await proxyOver(stub(imageResponse())).serve(TARGET),
      await proxyOver(stub(imageResponse('image/jpeg', 302))).serve(TARGET),
      await proxyOver(stub(imageResponse())).serve({ host: 'attacker.test', path: 'a.jpg' }),
    ];

    for (const response of answers) {
      // A redirect to the upstream address gives the browser the provider host
      // and cancels the decision this route implements.
      expect([200, 404, 502]).toContain(response.status);
      expect(response.headers.get('location')).toBeNull();
    }
  });
});
