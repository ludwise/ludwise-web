/**
 * What to tell a visitor about each filter the backend refused.
 *
 * Keyed by field name, which is the half of a rejection that crosses the wire.
 * The other half - the backend's own `reason` - deliberately does not: those
 * strings say things like "expected a safe integer greater than or equal to 1",
 * which names an internal expectation and is written for whoever reads the
 * logs. Turning that into a sentence a person can act on is a presentation
 * decision, so it is made here.
 *
 * That split is also why these sentences live in one module rather than beside
 * each page. `marketCode` and `currencyCode` are refused together and share one
 * sentence; `/games` and `/sales` word the same rule slightly differently
 * because their controls differ. Both facts are easier to keep true in one
 * table than in two.
 *
 * ## Why unknown fields are dropped rather than shown
 *
 * A field the backend names and this table does not know is a version skew: a
 * newer backend refusing something this build has no control for. Rendering the
 * raw field name would show a visitor an internal identifier and tell them
 * nothing about what to do. Dropping it leaves the generic "those filters do
 * not go together" heading, which is true and actionable. The field name is
 * still logged, so the skew is visible to an operator.
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
