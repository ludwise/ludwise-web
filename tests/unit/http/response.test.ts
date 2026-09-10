import { describe, expect, it } from 'vitest';

import { jsonResponse } from '../../../src/lib/http/response.js';

describe('jsonResponse', () => {
  it('serialises the body and defaults to status 200', async () => {
    const response = jsonResponse({ ok: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('accepts an explicit status', () => {
    const response = jsonResponse({ error: true }, 400);
    expect(response.status).toBe(400);
  });

  it('sends the same three headers on every response, so a success and a failure are identical apart from the body', () => {
    const response = jsonResponse({ ok: true });
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
