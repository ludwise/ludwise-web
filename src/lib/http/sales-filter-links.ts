/**
 * Building the links a `/sales` filter chip or pagination control points to.
 *
 * Pulled out of `sales.astro`. Each pairing rule encoded here is one line a test can fail on
 * its own. It is not logic a future edit to the page can silently drop unnoticed.
 *
 * Four pairing rules are encoded here.
 * Market and currency travel together.
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
    if (name === 'market' || name === 'currency') {
      next.delete('market');
      next.delete('currency');
      // Price bounds are amounts in the currency being removed, so keeping
      // them would silently reinterpret them in another one.
      next.delete('min');
      next.delete('max');
    }
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
