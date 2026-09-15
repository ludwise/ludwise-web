/**
 * Building the links a `/sales` filter chip or pagination control points to.
 *
 * Pulled out of `sales.astro`. Each pairing rule encoded here is one line a test can fail on
 * its own. It is not logic a future edit to the page can silently drop unnoticed.
 *
 * Three pairing rules are encoded here.
 * A price bound's minimum and maximum travel together.
 * A release-year range's two ends travel together.
 * Removing any filter resets the page.
 *
 * Pure functions over a `URLSearchParams`, with no Astro dependency, so they
 * run in plain Vitest.
 */

function pathWithQuery(next: URLSearchParams): string {
  const query = next.toString();
  return query === '' ? '/sales' : `/sales?${query}`;
}

/**
 * The link a "remove this filter" chip points to: every current filter,
 * minus the named one and whatever else the same removal implies.
 *
 * `value` narrows a repeatable filter (only `store` today) to the one
 * instance being removed, leaving the others in place. Without it the whole
 * named filter is dropped.
 */
export function pathWithoutFilter(params: URLSearchParams, name: string, value?: string): string {
  const next = new URLSearchParams(params);

  if (name === 'store' && value !== undefined) {
    next.delete('store');
    for (const store of params.getAll('store')) {
      if (store !== value) next.append('store', store);
    }
  } else {
    next.delete(name);
    if (name === 'min') next.delete('max');
    if (name === 'fromYear') next.delete('toYear');
  }

  next.delete('page');
  return pathWithQuery(next);
}

/** The link one pagination control points to: every current filter, on the requested page. */
export function pathForPage(params: URLSearchParams, page: number): string {
  const next = new URLSearchParams(params);
  next.set('page', String(page));
  return pathWithQuery(next);
}

/**
 * The link a "remove every filter" control points to.
 *
 * The sort order survives it. Sort is an order rather than a filter, so it
 * excludes nothing. The market and the currency are not in the query at all,
 * because the visitor region sets them.
 */
export function pathWithFiltersCleared(params: URLSearchParams): string {
  const next = new URLSearchParams();
  const sort = params.get('sort');
  if (sort !== null) next.set('sort', sort);
  return pathWithQuery(next);
}
