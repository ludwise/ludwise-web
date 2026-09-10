/**
 * Which upstream address a media request is permitted to name.
 *
 * The route's path carries an upstream host and an upstream path, both written
 * by whoever made the request. So this module is the security boundary of the
 * whole feature: everything it returns is fetched, and everything it refuses is
 * a 404. `tests/architecture/boundaries.test.ts` states the rule it enforces.
 *
 * A host is admitted on an exact allow-list match. A suffix test is refused
 * outright, because `images.example.test.attacker.test` passes one.
 */

/**
 * The path prefix the media route answers.
 *
 * Read by `src/middleware.ts`, which gives a media response its own headers,
 * and by `src/lib/http/route.ts`, which keeps the upstream address out of a
 * log record.
 */
export const MEDIA_PATH_PREFIX = '/media/';

/** An upstream image, as the route's own path names it. */
export interface MediaTarget {
  /** The first path segment: the upstream host, before any allow-list check. */
  readonly host: string;
  /** Everything after the host, with no leading slash. */
  readonly path: string;
}

export interface UpstreamAddress {
  readonly allowedHosts: readonly string[];
  /**
   * Development only. Where the bytes come from instead of the upstream host.
   *
   * It replaces the origin and never the allow-list, so a host the list
   * refuses is still refused. `src/middleware.ts` resolves it, and checks the
   * environment before it reads the setting.
   */
  readonly originOverride?: string | undefined;
}

/**
 * The characters a provider image path segment may hold.
 *
 * An allow-list rather than an escaping pass. A segment that needs escaping is
 * refused, so there is no encoding round trip that could disagree with itself.
 */
const SEGMENT = /^[A-Za-z0-9._~-]+$/u;

/** Longer than any provider address, and short enough to bound the work. */
const MAX_PATH_LENGTH = 512;

export function isMediaPath(pathname: string): boolean {
  return pathname.startsWith(MEDIA_PATH_PREFIX);
}

/**
 * The address to fetch, or `null` when this target may not be fetched at all.
 *
 * `null` is the route's 404. It never distinguishes a refused host from a
 * refused path. The caller learns nothing useful from the difference, and a
 * prober learns which hosts are on the list.
 */
export function resolveUpstreamUrl(target: MediaTarget, address: UpstreamAddress): string | null {
  const host = target.host.toLowerCase();
  if (!address.allowedHosts.includes(host)) return null;
  if (!isSafeUpstreamPath(target.path)) return null;

  const origin = (address.originOverride ?? `https://${host}`).replace(/\/+$/u, '');
  return `${origin}/${target.path}`;
}

function isSafeUpstreamPath(path: string): boolean {
  if (path === '' || path.length > MAX_PATH_LENGTH) return false;
  return path
    .split('/')
    .every((segment) => segment !== '.' && segment !== '..' && SEGMENT.test(segment));
}
