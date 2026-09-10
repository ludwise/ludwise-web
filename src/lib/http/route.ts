import { isMediaPath } from '../media/target.js';

const MAX_SEGMENTS = 8;
const LONG_SEGMENT_LENGTH = 48;
const UUID_LIKE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const HEX_LIKE = /^[0-9a-fA-F]{16,}$/;
const NUMERIC = /^\d+$/;

/**
 * What the media route records, in place of the path it was asked for.
 *
 * That path carries an upstream host and an upstream path. Collapsing it
 * segment by segment would leave the address in a log record, and this site
 * records no address at all. So the whole tail goes.
 */
const MEDIA_ROUTE = '/media/:host/:path';

export interface RouteInfo {
  readonly route: string;
  readonly source: 'pattern' | 'sanitized';
}

/**
 * Collapses high-cardinality path segments.
 *
 * Without this a crawler walking fifty thousand URLs produces fifty thousand
 * distinct route values. That makes every dashboard grouped by route useless.
 * It also inflates metric cardinality without adding information.
 */
export function sanitizePathname(pathname: string): string {
  if (isMediaPath(pathname)) return MEDIA_ROUTE;

  const segments = pathname.split('/').filter((segment) => segment.length > 0);
  const mapped = segments.slice(0, MAX_SEGMENTS).map((segment) => {
    if (NUMERIC.test(segment)) return ':num';
    if (UUID_LIKE.test(segment) || HEX_LIKE.test(segment)) return ':id';
    if (segment.length > LONG_SEGMENT_LENGTH) return ':long';
    return segment;
  });
  if (segments.length > MAX_SEGMENTS) mapped.push(':rest');
  return '/' + mapped.join('/');
}

/**
 * Prefers the framework route pattern, for example /games/[slug].
 *
 * The pattern is absent for unmatched requests, which are exactly the ones most
 * worth seeing. So the sanitised pathname is the fallback rather than an error.
 */
export function routeTemplate(input: { routePattern?: string | undefined; url: URL }): RouteInfo {
  if (input.routePattern && input.routePattern.length > 0) {
    return { route: input.routePattern, source: 'pattern' };
  }
  return { route: sanitizePathname(input.url.pathname), source: 'sanitized' };
}
