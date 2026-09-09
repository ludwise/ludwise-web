/**
 * The sentences the interface uses to explain its own data.
 *
 * One list for every suite. Issue #15 requires the same wording on the game,
 * offer and sales surfaces. The empty and degraded suites assert the absence
 * of exactly what the populated suites assert the presence of. A rewrite that
 * reaches one surface and not the others fails here.
 *
 * Each entry is the whole paragraph. Playwright normalizes whitespace, so a
 * sentence the template wraps over several lines still matches.
 */

/** The disclosure a visitor opens to reach the notes. */
export const DATA_NOTES_SUMMARY = 'How to read these prices';

/** Every note, keyed by the condition in `src/lib/state/provenance.ts`. */
export const DATA_NOTES = {
  checkTimes:
    'A price here carries the time LUDWISE last read it at the store. That is not the time the store last changed it.',
  untimedPrices:
    'Not provided means the source did not say when it read the price. LUDWISE does not guess one.',
  oldCheckTimes:
    'A price LUDWISE read more than a day ago may be out of date. Open the store page to see what it costs now.',
  derivedDiscounts:
    'The store gives both the current price and the regular price. LUDWISE works out the discount from the two.',
  noHistory:
    'LUDWISE keeps no record of earlier prices, so nothing here tells you how a price compares with the past.',
} as const;

/** What crediting a provider means, in the block that credits them. */
export const DATA_SOURCES_LEAD =
  "LUDWISE read this page's data from these providers. A provider is where the data came from, not the store that sells the game.";

/** Every sentence that describes data a surface received. */
export const PROVENANCE_EXPLANATIONS: readonly string[] = [
  DATA_NOTES_SUMMARY,
  ...Object.values(DATA_NOTES),
  DATA_SOURCES_LEAD,
];
