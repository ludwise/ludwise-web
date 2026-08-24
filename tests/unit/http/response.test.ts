import { describe, expect, it } from 'vitest';

import { isDocumentResponse, jsonResponse } from '../../../src/lib/http/response.js';

describe('isDocumentResponse', () => {
  it('is true for a successful HTML response', () => {
    const response = new Response('<html></html>', {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
    expect(isDocumentResponse(response)).toBe(true);
  });

  it('is false for a failed response, even with an HTML content type', () => {
    // An error page is a failure rather than a visit. Counting it inflates the
    // denominator of every funnel measured against page views.
    const response = new Response('<html>error</html>', {
      status: 500,
      headers: { 'content-type': 'text/html' },
    });
    expect(isDocumentResponse(response)).toBe(false);
  });

  it('is false for a redirect', () => {
    const response = new Response(null, {
      status: 302,
      headers: { location: '/elsewhere' },
    });
    expect(isDocumentResponse(response)).toBe(false);
  });

  it('is false for a JSON response', () => {
    const response = new Response('{}', { headers: { 'content-type': 'application/json' } });
    expect(isDocumentResponse(response)).toBe(false);
  });

  it('is false for a 204 with no content type', () => {
    const response = new Response(null, { status: 204 });
    expect(isDocumentResponse(response)).toBe(false);
  });

  it('matches the content type case-insensitively', () => {
    const response = new Response('<html></html>', {
      headers: { 'content-type': 'TEXT/HTML; charset=utf-8' },
    });
    expect(isDocumentResponse(response)).toBe(true);
  });
});

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
