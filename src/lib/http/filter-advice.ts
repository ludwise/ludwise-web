/**
 * What to tell a visitor about each filter the backend refused.
 *
 * Keyed by field name, the half of a rejection that crosses the wire. The
 * backend's `reason` deliberately does not: those strings name internal
 * expectations for whoever reads the logs, so wording one for a person is a
 * presentation decision made here.
 *
 * One table rather than one per page: `marketCode` and `currencyCode` are
 * refused together and share a sentence, while `/games` and `/sales` word the
 * same rule differently. An unknown field is dropped rather than shown - it
 * means a newer backend refused something this build has no control for - and
 * still logged, so the skew reaches an operator.
 */

/** Advice for `/games`, keyed by the field names `/v1/games` may refuse. */
const GAME_SEARCH_ADVICE: Readonly<Record<string, string>> = {
  page: 'Page numbers start at 1.',
  marketCode: 'Choose a market and a currency together, or leave both on Any.',
  currencyCode: 'Choose a market and a currency together, or leave both on Any.',
  minPriceMinor: 'Enter prices as whole numbers, with the lowest no higher than the highest.',
  maxPriceMinor: 'Enter prices as whole numbers, with the lowest no higher than the highest.',
  releaseYearFrom: 'Enter release years between 1 and 9999, with the earliest one first.',
  releaseYearTo: 'Enter release years between 1 and 9999, with the earliest one first.',
};

/** Advice for `/sales`, keyed by the field names `/v1/sales` may refuse. */
const SALES_ADVICE: Readonly<Record<string, string>> = {
  page: 'Page numbers start at 1.',
  marketCode: 'Choose a market and a currency together.',
  currencyCode: 'Choose a market and a currency together.',
  minDiscountPercentage: 'Enter a smallest discount between 1 and 100.',
  minPriceMajor: 'Enter prices as whole numbers, with the lowest no higher than the highest.',
  maxPriceMajor: 'Enter prices as whole numbers, with the lowest no higher than the highest.',
  releaseYearFrom: 'Enter release years between 1 and 9999, with the earliest one first.',
  releaseYearTo: 'Enter release years between 1 and 9999, with the earliest one first.',
  sort: 'Choose one of the listed orders.',
  stores: 'Choose 50 stores at most.',
};

/**
 * The sentences to show for a set of refused fields, without repeats.
 *
 * Deduplicated because one mistake produces several fields by design - a market
 * without its currency is refused on both sides - and two fields sharing one
 * sentence would otherwise print it twice.
 *
 * Order follows the table rather than the response, so the same mistake reads
 * the same way every time regardless of the order the backend happened to
 * validate in.
 */
function adviseFrom(
  table: Readonly<Record<string, string>>,
  fields: readonly string[],
): readonly string[] {
  const refused = new Set(fields);
  return Object.entries(table)
    .filter(([field]) => refused.has(field))
    .map(([, advice]) => advice)
    .filter((advice, index, all) => all.indexOf(advice) === index);
}

export const adviseGameSearch = (fields: readonly string[]): readonly string[] =>
  adviseFrom(GAME_SEARCH_ADVICE, fields);

export const adviseSales = (fields: readonly string[]): readonly string[] =>
  adviseFrom(SALES_ADVICE, fields);
