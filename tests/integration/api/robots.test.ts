/**
 * The two `robots.txt` bodies, read from the route handler itself.
 *
 * `tests/e2e/shell.spec.ts` reads the development body from a running server.
 * The production body cannot be served there, so this suite calls the handler
 * with each environment.
 */

import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';

import type { AppConfig, Environment } from '../../../src/lib/config/index.js';
import { GET } from '../../../src/pages/robots.txt.js';

const SITE_URL = 'https://ludwise.test';

async function robotsFor(environment: Environment): Promise<Response> {
  const config: Pick<AppConfig, 'environment' | 'siteUrl'> = { environment, siteUrl: SITE_URL };
  return await GET({ locals: { config } } as unknown as APIContext);
}

const lines = (body: string): string[] => body.split('\n').filter((line) => line !== '');

describe('robots.txt', () => {
  it('differs between production and staging by the Sitemap line and the crawl rule', async () => {
    const production = lines(await (await robotsFor('production')).text());
    const staging = lines(await (await robotsFor('staging')).text());

    expect(production).toEqual(['User-agent: *', 'Allow: /', `Sitemap: ${SITE_URL}/sitemap.xml`]);
    expect(staging).toEqual(['User-agent: *', 'Disallow: /']);
    expect(staging.some((line) => line.startsWith('Sitemap:'))).toBe(false);
  });

  it('offers no sitemap outside production', async () => {
    const development = await (await robotsFor('development')).text();

    expect(development).not.toContain('Sitemap:');
  });

  it('is cacheable for an hour in every environment', async () => {
    for (const environment of ['development', 'staging', 'production'] as const) {
      const response = await robotsFor(environment);

      expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
      expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    }
  });
});
