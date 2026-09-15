/**
 * Where a region change sends the visitor back to.
 *
 * The value arrives in a form, and a third party can build that form. So the
 * answer is a path on this origin or the home page, and never an address that
 * leaves the site.
 */

/** The page that saves a region. A return to it would leave the visitor on the form. */
export const REGION_PATH = '/region';

const HOME_PATH = '/';

/** Any origin that no real request can have. Only a relative path resolves onto it. */
const PROBE_ORIGIN = 'https://return-path.invalid';

/** The path and query of `value`, or `/` when `value` is not a path on this origin. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return HOME_PATH;

  let url: URL;
  try {
    url = new URL(value, PROBE_ORIGIN);
  } catch {
    return HOME_PATH;
  }

  // `//host` and `/\host` both resolve to another origin.
  if (url.origin !== PROBE_ORIGIN) return HOME_PATH;
  if (url.pathname === REGION_PATH) return HOME_PATH;

  return `${url.pathname}${url.search}`;
}

/** The region page, with the page to return to after a save. */
export function regionPagePath(returnTo: string): string {
  return `${REGION_PATH}?${new URLSearchParams({ return: returnTo }).toString()}`;
}

/** Filters that name an amount in one currency. */
const PRICE_BOUNDS = ['min', 'max'] as const;

/**
 * The safe return path after a region change.
 *
 * It drops the page number, because the results change with the region. When
 * the currency changes, it also drops the price bounds. Those are amounts in
 * the old currency, and another currency would read them as different prices.
 */
export function returnPathAfterRegionChange(
  value: unknown,
  change: { readonly currencyChanged: boolean },
): string {
  const path = safeReturnPath(value);
  const url = new URL(path, PROBE_ORIGIN);

  url.searchParams.delete('page');
  if (change.currencyChanged) {
    for (const bound of PRICE_BOUNDS) url.searchParams.delete(bound);
  }

  const query = url.searchParams.toString();
  return query === '' ? url.pathname : `${url.pathname}?${query}`;
}
