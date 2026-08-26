import { describe, expect, it } from 'vitest';

import {
  LEXICON_CONTRACT,
  knownLexiconSources,
  loadLexicon,
  registerLexiconAdapter,
} from '../../../../scripts/ste/lexicon.mjs';

/**
 * The attachment point for a controlled dictionary.
 *
 * LUDWISE holds no permission to a machine-readable copy of the approved word
 * list. This module makes the absence a reported state rather than a silence.
 * It also gives a licensed source one place to attach.
 */

describe('loadLexicon', () => {
  it('reports that no dictionary is loaded, and why', () => {
    const found = loadLexicon({ lexicon: { source: null, reason: 'No license.' } });
    expect(found.loaded).toBe(false);
    expect(found.reason).toBe('No license.');
  });

  it('reports the absence even when the policy records no lexicon at all', () => {
    expect(loadLexicon({}).loaded).toBe(false);
  });

  it('refuses a source that no adapter serves', () => {
    const found = loadLexicon({ lexicon: { source: 'invented' } });
    expect(found.loaded).toBe(false);
    expect(found.reason).toContain('invented');
  });

  it('loads a registered adapter', () => {
    registerLexiconAdapter('test-source', () => ({
      approves: (word: string) => word === 'open',
      partsOfSpeech: () => ['verb'],
    }));

    const found = loadLexicon({ lexicon: { source: 'test-source' } });
    expect(found.loaded).toBe(true);
    expect(knownLexiconSources()).toContain('test-source');
  });

  it('states the two questions an adapter must answer', () => {
    expect(LEXICON_CONTRACT).toEqual(['approves(word)', 'partsOfSpeech(word)']);
  });
});
