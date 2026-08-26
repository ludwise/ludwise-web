import { describe, expect, it } from 'vitest';
import { IMPLEMENTED_RULE_IDS, runRules } from '../../../../scripts/ste/rules.mjs';

const policy = {
  rollout: { mode: 'audit' },
  limits: { proceduralSentenceWords: 20, descriptiveSentenceWords: 25, paragraphSentences: 6 },
  sentenceBoundary: { abbreviations: ['e.g'] },
  contractions: { words: ["it's"], suffixes: ["n't", "'ll", "'re", "'ve"] },
  spelling: { variants: [{ variant: 'behaviour', preferred: 'behavior' }] },
  punctuation: { alternativeSlash: ['read/write'] },
};
const terminology = {
  terms: [
    {
      conceptId: 'catalog',
      preferredTerm: 'catalog',
      prohibitedSynonyms: [{ term: 'catalogue', unless: [] }],
    },
  ],
  prohibited: [
    { expression: 'wire up', suggestion: 'connect', reason: 'A phrasal verb.' },
    { expression: 'leverage', suggestion: 'use', reason: 'A longer word.' },
  ],
  abbreviations: [
    { abbreviation: 'ADR', expansion: 'architecture decision record', expandOnFirstUse: true },
  ],
  prohibitedAbbreviations: [{ abbreviation: 'config', expansion: 'configuration' }],
  officialNames: ['LUDWISE'],
};
const unit = (text: string, over: Record<string, unknown> = {}) => ({
  kind: 'paragraph',
  prose: null,
  text,
  start: 0,
  ...over,
});
const check = (text: string, over: Record<string, unknown> = {}) =>
  runRules([unit(text, over)], { policy, terminology, defaultProse: 'mixed' }).map(
    (one) => one.rule,
  );
const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ') + '.';

describe('limits and word count', () => {
  it('uses the 25 word descriptive limit', () => {
    expect(check(words(25))).toEqual([]);
    expect(check(words(26))).toEqual(['LW-STE-SENTENCE-LENGTH-DESCRIPTIVE']);
  });
  it('uses the 20 word procedural limit', () => {
    expect(check(words(20), { prose: 'procedural' })).toEqual([]);
    expect(check(words(21), { prose: 'procedural' })).toEqual([
      'LW-STE-SENTENCE-LENGTH-PROCEDURAL',
    ]);
  });
  it('counts parenthetical text once in the containing sentence', () => {
    const prefix = Array.from({ length: 24 }, () => 'word').join(' ');
    expect(check(`${prefix} (many words are inside here).`)).toEqual([]);
  });
  it('checks parenthetical prose separately', () => {
    const inner = Array.from({ length: 26 }, () => 'word').join(' ');
    expect(check(`Stable (${inner}).`)).toEqual(['LW-STE-SENTENCE-LENGTH-DESCRIPTIVE']);
  });
});

describe('prose kind', () => {
  it('blocks mixed list prose in enforcement', () => {
    const found = runRules([unit(words(5), { kind: 'list-item', prose: 'procedural' })], {
      policy: { ...policy, rollout: { mode: 'enforce' } },
      terminology,
      defaultProse: 'mixed',
    });
    expect(found.map((one) => one.rule)).toEqual(['LW-STE-PROSE-KIND-UNRESOLVED']);
  });
});

describe('verified deterministic controls', () => {
  it('reports semicolons for rule 8.1', () =>
    expect(check('Read the file; then stop.')).toEqual(['LW-STE-PUNCTUATION-SEMICOLON']));
  it('reports recorded phrasal verbs separately', () =>
    expect(check('Wire up the binding.')).toEqual(['LW-STE-PHRASAL-VERB-RECORDED']));
  it('keeps project prohibited words separate', () =>
    expect(check('Leverage the adapter.')).toEqual(['LW-STE-TERM-PROHIBITED']));
  it('reports contractions', () =>
    expect(check("It doesn't run.")).toEqual(['LW-STE-CONTRACTION']));
  it('reports spelling variants', () =>
    expect(check('The behaviour is stable.')).toEqual(['LW-STE-SPELLING-VARIANT']));
  it('reports synonyms', () =>
    expect(check('Read the catalogue.')).toEqual(['LW-STE-TERM-PREFERRED']));
});

describe('registry', () => {
  it('contains the corrected controls', () => {
    expect(IMPLEMENTED_RULE_IDS).toContain('LW-STE-PROSE-KIND-UNRESOLVED');
    expect(IMPLEMENTED_RULE_IDS).toContain('LW-STE-PHRASAL-VERB-RECORDED');
    expect(IMPLEMENTED_RULE_IDS).toContain('LW-STE-PUNCTUATION-SEMICOLON');
  });
});
