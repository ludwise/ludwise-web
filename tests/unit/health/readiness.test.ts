import { describe, expect, it, vi } from 'vitest';

import {
  verifyBackendReadiness,
  wantsBackendReadiness,
} from '../../../src/lib/health/readiness.js';

describe('wantsBackendReadiness', () => {
  it('accepts the backend probe only in staging', () => {
    const url = new URL('https://staging.ludwise.com/api/health?check=backend');

    expect(wantsBackendReadiness('staging', url)).toBe(true);
    expect(wantsBackendReadiness('production', url)).toBe(false);
    expect(wantsBackendReadiness('development', url)).toBe(false);
  });

  it('keeps ordinary health requests as liveness checks', () => {
    expect(
      wantsBackendReadiness('staging', new URL('https://staging.ludwise.com/api/health')),
    ).toBe(false);
  });
});

describe('verifyBackendReadiness', () => {
  it('proves both page read paths', async () => {
    const searchGames = vi.fn().mockResolvedValue({});
    const browseSales = vi.fn().mockResolvedValue({});

    await verifyBackendReadiness({ searchGames, browseSales });

    expect(searchGames).toHaveBeenCalledOnce();
    expect(browseSales).toHaveBeenCalledOnce();
  });

  it('fails when either backend read fails', async () => {
    const failure = new Error('backend unavailable');

    await expect(
      verifyBackendReadiness({
        searchGames: vi.fn().mockRejectedValue(failure),
        browseSales: vi.fn(),
      }),
    ).rejects.toBe(failure);
  });
});
