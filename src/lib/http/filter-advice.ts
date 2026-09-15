/**
 * What to tell a visitor about each filter the backend refused.
 *
 * Keyed by field name, the half of a rejection that crosses the wire. The backend's `reason`
 * deliberately does not cross the wire. Those strings name internal expectations for whoever
 * reads the logs, so wording one for a person is a presentation decision made here.
 *
 * One table for each page. `marketCode` and `currencyCode` are refused together and share one
 * sentence. The visitor region is the only source of the pair, so that sentence points to the
 * region control. An unknown field
 * is dropped rather than shown, because it means a newer backend refused something this build
 * has no control for. It is still logged, so the skew reaches an operator.
 */

/**
 * The pair comes from the region list this Worker holds. A refusal means that list and the
 * backend disagree, so saving a region again reads the list again.
 */
const REGION_ADVICE = "LUDWISE couldn't use your region. Choose your region again.";

/** Advice for `/games`, keyed by the field names `/v1/games` may refuse. */
const GAME_SEARCH_ADVICE: Readonly<Record<string, string>> = {
  page: 'Page numbers start at 1.',
  marketCode: REGION_ADVICE,
  currencyCode: REGION_ADVICE,
  minPriceMinor: 'Enter prices as whole numbers, with the lowest no higher than the highest.',
  maxPriceMinor: 'Enter prices as whole numbers, with the lowest no higher than the highest.',
  releaseYearFrom: 'Enter release years between 1 and 9999, with the earliest one first.',
  releaseYearTo: 'Enter release years between 1 and 9999, with the earliest one first.',
};

/** Advice for `/sales`, keyed by the field names `/v1/sales` may refuse. */
const SALES_ADVICE: Readonly<Record<string, string>> = {
  page: 'Page numbers start at 1.',
  marketCode: REGION_ADVICE,
  currencyCode: REGION_ADVICE,
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
 * Deduplicated because one mistake produces several fields by design. A market without its
 * currency is refused on both sides. Two fields sharing one sentence would otherwise print it
 * twice.
 *
 * Order follows the table rather than the response. So the same mistake reads
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
