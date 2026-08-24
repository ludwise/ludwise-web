/**
 * Ordering text without asking the visitor's locale.
 *
 * Plain UTF-16 code unit comparison, not `localeCompare`. That is deliberate
 * and it is not a performance choice: `localeCompare` orders differently in
 * different locales, and `/sales` renders two lists derived from the same data
 * - the market/currency select and the sale list itself. Sorting one with a
 * locale-dependent rule and the other with anything else lets them disagree for
 * some visitors and not others, which is a bug nobody can reproduce.
 *
 * The backend orders the data it sends with the identical rule. This function
 * exists because the page adds one entry to that list - the pair the visitor
 * asked for, when it holds no sale - and has to slot it in without breaking the
 * order the backend established.
 */
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
