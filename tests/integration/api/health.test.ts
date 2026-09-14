/**
 * The indexing header of `/api/health`, read from the route handler itself.
 *
 * The middleware adds `x-robots-tag` to every response outside production, so a
 * running development server cannot show what production sends.
 */

import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';

import { GET } from '../../../src/pages/api/health.js';

describe('/api/health', () => {
  it('tells a crawler not to index it, in production too', async () => {
    const response = await GET({
      locals: { config: { environment: 'production' }, requestId: 'test-request' },
      url: new URL('https://ludwise.test/api/health'),
    } as unknown as APIContext);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(response.headers.get('cache-control')).toContain('no-store');
  });
});
