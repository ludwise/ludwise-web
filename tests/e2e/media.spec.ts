import { expect, test } from '@playwright/test';

/**
 * The media route, answered by the real engine.
 *
 * The unit suite proves what the module decides. This proves the route exists,
 * that the framework matches its path, and that the headers survive the
 * middleware chain. `scripts/fake-backend.ts` stands in for the upstream host,
 * so the bytes are the committed fixture rather than a provider's.
 *
 * The host is the one the deployed allow-list names. A test that invented a
 * host would prove the route works for a value no deployment carries.
 */

const UPSTREAM_HOST = 'images.igdb.com';
const COVER = `/media/${UPSTREAM_HOST}/igdb/image/upload/t_cover_big/demo-cover.jpg`;

test.describe('the media route', () => {
  test('serves an allow-listed upstream image as image bytes', async ({ request }) => {
    const response = await request.get(COVER);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('image/jpeg');
    // The committed fixture is a real picture, so a byte count proves bytes
    // moved rather than an empty 200 having been assembled.
    expect((await response.body()).byteLength).toBeGreaterThan(1000);
  });

  test('lets the answer be cached for a day, and never marks it immutable', async ({ request }) => {
    const headers = (await request.get(COVER)).headers();

    expect(headers['cache-control']).toBe('public, max-age=86400');
    expect(headers['cache-control']).not.toContain('immutable');
  });

  test('never varies on the cookie, which would split the cache by theme', async ({ request }) => {
    // Stated as an absence of `cookie` rather than of the whole header. Vite's
    // development server adds `Vary: Origin` after the Worker has answered, so
    // an empty-header assertion would test the runner rather than the route.
    expect((await request.get(COVER)).headers()['vary'] ?? '').not.toContain('cookie');
  });

  test('tells a crawler to stay out, and refuses to be sniffed', async ({ request }) => {
    const headers = (await request.get(COVER)).headers();

    expect(headers['x-robots-tag']).toContain('noindex');
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  test('answers 404 for a host that only ends with an allow-listed one', async ({ request }) => {
    // The case a suffix test cannot tell apart from the real host. Anyone can
    // register the domain that holds this name.
    const response = await request.get(
      `/media/${UPSTREAM_HOST}.attacker.test/igdb/image/upload/t_cover_big/demo-cover.jpg`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(404);
    expect((await response.body()).byteLength).toBe(0);
  });

  test('answers 404 for a path the upstream does not have', async ({ request }) => {
    const response = await request.get(`/media/${UPSTREAM_HOST}/igdb/image/upload/nothing.jpg`, {
      maxRedirects: 0,
    });

    expect(response.status()).toBe(404);
    expect((await response.body()).byteLength).toBe(0);
  });

  test('never redirects the browser to the upstream address', async ({ request }) => {
    // A redirect would hand the browser the provider host and undo the whole
    // reason these bytes are same-origin.
    for (const path of [COVER, `/media/attacker.test/a.jpg`]) {
      const response = await request.get(path, { maxRedirects: 0 });

      expect([200, 404, 502], path).toContain(response.status());
      expect(response.headers()['location'], path).toBeUndefined();
    }
  });
});
