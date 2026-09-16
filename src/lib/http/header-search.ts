/**
 * What the header search field holds on one route.
 *
 * The field submits a native GET form to the games page. Only the games page
 * gives `q` a meaning. So only there does the field start with a value and
 * keep the filters that are already in the address.
 */

/** The search term name that the games page and `/v1/games` both read. */
export const SEARCH_TERM_PARAM = 'q';

export interface HeaderSearch {
  readonly value: string | undefined;
  /** The query pairs the form sends again beside a new term, in address order. */
  readonly carriedParams: readonly (readonly [string, string])[];
}

const NOT_CARRIED = new Set([SEARCH_TERM_PARAM, 'page']);

export function readHeaderSearch(url: URL, gamesPath: string): HeaderSearch {
  if (url.pathname !== gamesPath) return { value: undefined, carriedParams: [] };

  return {
    value: url.searchParams.get(SEARCH_TERM_PARAM) ?? undefined,
    carriedParams: [...url.searchParams].filter(([name]) => !NOT_CARRIED.has(name)),
  };
}
