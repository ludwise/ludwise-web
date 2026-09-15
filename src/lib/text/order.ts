/**
 * Ordering text without asking the visitor's locale.
 *
 * Plain UTF-16 code unit comparison, not `localeCompare`. `localeCompare`
 * orders differently in different locales. Some orders must be the same for
 * every visitor, such as a tie-break between identifiers. With a locale rule,
 * such an order changes with the visitor, and nobody can reproduce the change.
 */
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
