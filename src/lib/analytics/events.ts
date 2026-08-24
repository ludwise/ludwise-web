/**
 * The product event catalogue.
 *
 * Every event here has an entry in docs/analytics/event-governance.md stating
 * the product question it answers, why each property is needed, its privacy
 * class and its retention. An event without that entry does not belong in this
 * file - if the purpose line is hard to write, the event is not ready.
 *
 * Deliberately tiny. PRODUCT.md section 102 asks for product events rather
 * than raw personal information, and a catalogue that grows ahead of the
 * product is a catalogue of speculation nobody can later interpret.
 */

import type { AnalyticsEvent } from './types.js';

export const ANALYTICS_EVENTS = Object.freeze({
  PAGE_VIEW: 'page_view',
} as const);

/**
 * Structurally what `routeTemplate` in src/lib/http/route.ts returns, declared
 * here rather than imported so this module stays ignorant of HTTP.
 */
export interface PageViewInput {
  readonly route: string;
  /**
   * Where the route came from. Only a framework-supplied pattern is bounded;
   * a sanitised pathname is whatever the visitor asked for, minus four shapes.
   */
  readonly source: 'pattern' | 'sanitized';
}

/**
 * A page was rendered, or `null` when it cannot be described safely.
 *
 * `route` must be a route template - `/games/[slug]`, never the URL the
 * visitor actually requested. That distinction is the whole reason this event
 * is safe to collect: docs/analytics/privacy-principles.md forbids full URLs
 * and arbitrary paths, both of which routinely carry values a visitor did not
 * choose to send.
 *
 * So the guarantee is enforced here rather than promised. `routeTemplate`
 * falls back to `sanitizePathname`, which collapses only digits, UUIDs, long
 * hex and over-long segments - `/invite/team-alpha` and
 * `/u/name@example.test` both survive it intact. That fallback is right for an
 * operational log, where the extra detail is diagnostic and retention is
 * short, and wrong for analytics. A sanitised route therefore produces no
 * event at all: losing a count is recoverable, collecting a path is not.
 *
 * There is no referrer, no user agent, no viewport, no session identifier and
 * no visitor identifier. Each would need its own justification, and none is
 * needed to answer "is this page used at all", which is the only question
 * this event exists to answer.
 */
export function pageViewEvent(input: PageViewInput): AnalyticsEvent | null {
  if (input.source !== 'pattern') return null;

  return {
    name: ANALYTICS_EVENTS.PAGE_VIEW,
    version: 1,
    properties: { route: input.route },
  };
}
