import { describe, expect, it } from 'vitest';

import { ANALYTICS_EVENTS, pageViewEvent } from '../../../src/lib/analytics/events.js';
import { isDocumentResponse } from '../../../src/lib/http/response.js';

/**
 * The first product event, and the shape every later one has to answer to.
 *
 * docs/analytics/privacy-principles.md forbids full URLs, raw query strings
 * and anything a visitor typed. A page view is only safe because it carries a
 * route template - `/games/[slug]`, not `/games/half-life?utm_source=…` - so
 * the assertions here are mostly about what the event does NOT contain.
 */

describe('pageViewEvent', () => {
  it('carries the route and nothing else', () => {
    const event = pageViewEvent({ route: '/games/[slug]', source: 'pattern' });

    expect(event).toEqual({
      name: ANALYTICS_EVENTS.PAGE_VIEW,
      version: 1,
      properties: { route: '/games/[slug]' },
    });
  });

  it('names the event in the documented convention', () => {
    // snake_case, noun then verb, past tense - docs/analytics/README.md.
    expect(ANALYTICS_EVENTS.PAGE_VIEW).toBe('page_view');
  });

  describe('refuses to build an event from anything but a route template', () => {
    it.each([
      ['a path that survived sanitising intact', '/invite/team-alpha'],
      ['a path carrying something personal', '/u/john.smith@example.test'],
      ['a path carrying a token', '/reset/abc-def-token'],
    ])('%s', (_label, route) => {
      // sanitizePathname is right for an operational log, where the extra
      // detail is diagnostic and retention short. privacy-principles.md rules
      // out full URLs and arbitrary paths for analytics.
      expect(pageViewEvent({ route, source: 'sanitized' })).toBeNull();
    });

    it('even when the sanitised path looks harmless', () => {
      // The guarantee is structural, not a judgement about a given path. A
      // rule that held only for paths someone thought looked risky would be
      // no guarantee at all.
      expect(pageViewEvent({ route: '/games', source: 'sanitized' })).toBeNull();
    });
  });
});

describe('isDocumentResponse', () => {
  it.each([
    ['a plain html response', 'text/html'],
    ['html with a charset', 'text/html; charset=utf-8'],
    ['html with unusual casing', 'TEXT/HTML; charset=UTF-8'],
  ])('recognises %s', (_label, contentType) => {
    expect(
      isDocumentResponse(new Response('<p>x</p>', { headers: { 'content-type': contentType } })),
    ).toBe(true);
  });

  it.each([
    ['a json endpoint', 'application/json; charset=utf-8'],
    ['a stylesheet', 'text/css'],
    ['a font', 'font/woff2'],
    ['an image', 'image/avif'],
  ])('does not count %s as a page view', (_label, contentType) => {
    expect(
      isDocumentResponse(new Response('x', { headers: { 'content-type': contentType } })),
    ).toBe(false);
  });

  it('does not count a response with no content type', () => {
    const response = new Response(null, { status: 204 });
    response.headers.delete('content-type');

    expect(isDocumentResponse(response)).toBe(false);
  });

  it.each([
    ['a redirect', 302],
    ['a not-found page', 404],
    ['a server failure page', 500],
  ])('does not count %s as a page view even when it renders html', (_label, status) => {
    // A redirect is not a page anyone read. An error page is a failure -
    // counting either inflates the denominator of every funnel measured
    // against page views.
    const response = new Response('<p>x</p>', {
      status,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });

    expect(isDocumentResponse(response)).toBe(false);
  });
});
