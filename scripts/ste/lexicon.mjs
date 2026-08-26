/**
 * The attachment point for a controlled dictionary.
 *
 * ASD-STE100 approves about 900 words, each with one meaning and one part of
 * speech. LUDWISE holds no permission to a machine-readable copy of that list
 * and will not scrape one, so no adapter is registered. This module makes the
 * absence a reported state rather than a silence, and gives a licensed source
 * one place to attach.
 */

/** The two questions an adapter must answer about one word. */
export const LEXICON_CONTRACT = ['approves(word)', 'partsOfSpeech(word)'];

const adapters = new Map();

export const registerLexiconAdapter = (name, factory) => {
  adapters.set(name, factory);
};

export const knownLexiconSources = () => [...adapters.keys()];

export const loadLexicon = (policy) => {
  const declared = policy.lexicon ?? {};
  const source = declared.source ?? null;

  if (source === null) {
    return {
      loaded: false,
      source: null,
      reason: declared.reason ?? 'No lexicon source is declared.',
    };
  }

  const factory = adapters.get(source);
  if (factory === undefined) {
    return {
      loaded: false,
      source,
      reason: `No adapter is registered for the lexicon source "${source}".`,
    };
  }

  return { loaded: true, source, ...factory(declared) };
};
