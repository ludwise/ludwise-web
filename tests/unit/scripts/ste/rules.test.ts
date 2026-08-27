import { describe, expect, it } from 'vitest';

import { IMPLEMENTED_RULE_IDS, runRules } from '../../../../scripts/ste/rules.mjs';

const policy = {
  rollout: { mode: 'audit' },
  limits: { proceduralSentenceWords: 20, descriptiveSentenceWords: 25, paragraphSentences: 6 },
  sentenceBoundary: { abbreviations: ['e.g', 'i.e', 'etc'] },
  contractions: { words: ["it's", "let's"], suffixes: ["n't", "'ll", "'re", "'ve"] },
  spelling: { variants: [{ variant: 'behaviour', preferred: 'behavior' }] },
  punctuation: { alternativeSlash: ['read/write'] },
  causalSince: { patterns: ['sentence-initial', 'after-comma'] },
};

const terminology = {
  terms: [
    {
      conceptId: 'catalog',
      preferredTerm: 'catalog',
      prohibitedSynonyms: [{ term: 'catalogue', unless: [] }],
    },
    {
      conceptId: 'visitor',
      preferredTerm: 'visitor',
      prohibitedSynonyms: [{ term: 'user', unless: ['user agent'] }],
    },
  ],
  prohibited: [
    { expression: 'wire up', suggestion: 'connect', reason: 'A phrasal verb.' },
    { expression: 'leverage', suggestion: 'use', reason: 'A longer word.' },
    {
      expression: 'should',
      suggestion: 'must',
      reason: 'Not an approved word.',
      unlessExactly: ['SHOULD'],
    },
  ],
  abbreviations: [
    { abbreviation: 'ADR', expansion: 'architecture decision record', expandOnFirstUse: true },
    {
      abbreviation: 'API',
      expansion: 'application programming interface',
      expandOnFirstUse: false,
    },
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

const check = (text: string, over: Record<string, unknown> = {}): string[] =>
  runRules([unit(text, over)], { policy, terminology, defaultProse: 'mixed' }).map(
    (one) => one.rule,
  );

const words = (count: number): string =>
  Array.from({ length: count }, () => 'word').join(' ') + '.';

describe('sentence length', () => {
  it('uses 25 words for descriptive prose', () => {
    expect(check(words(25))).toEqual([]);
    expect(check(words(26))).toEqual(['LW-STE-SENTENCE-LENGTH-DESCRIPTIVE']);
  });

  it('uses 20 words for explicitly procedural prose', () => {
    expect(check(words(20), { prose: 'procedural' })).toEqual([]);
    expect(check(words(21), { prose: 'procedural' })).toEqual([
      'LW-STE-SENTENCE-LENGTH-PROCEDURAL',
    ]);
  });

  it('uses the Issue 9 parenthetical count for the containing sentence', () => {
    const prefix = Array.from({ length: 24 }, () => 'word').join(' ');
    expect(check(`${prefix} (this parenthetical text has many words).`)).toEqual([]);
  });

  it('measures parenthetical prose as a separate sentence', () => {
    const inner = Array.from({ length: 26 }, () => 'word').join(' ');
    expect(check(`The value is stable (${inner}).`)).toEqual([
      'LW-STE-SENTENCE-LENGTH-DESCRIPTIVE',
    ]);
  });

  it('counts a number and a supported unit as one word', () => {
    const prefix = Array.from({ length: 23 }, () => 'word').join(' ');
    expect(check(`${prefix} 20 ms.`)).toEqual([]);
  });
});

describe('prose kind', () => {
  it('does not make an ordered Markdown item normative in enforcement mode', () => {
    const enforcingPolicy = { ...policy, rollout: { mode: 'enforce' } };
    const found = runRules([unit(words(5), { kind: 'list-item', prose: 'procedural' })], {
      policy: enforcingPolicy,
      terminology,
      defaultProse: 'mixed',
    });
    expect(found.map((one) => one.rule)).toEqual(['LW-STE-PROSE-KIND-UNRESOLVED']);
  });

  it('accepts an explicit procedural classification in enforcement mode', () => {
    const enforcingPolicy = { ...policy, rollout: { mode: 'enforce' } };
    const found = runRules([unit(words(20))], {
      policy: enforcingPolicy,
      terminology,
      defaultProse: 'procedural',
    });
    expect(found).toEqual([]);
  });
});

describe('paragraph length', () => {
  it('limits descriptive paragraphs to six sentences', () => {
    expect(check('A. B. C. D. E. F.')).toEqual([]);
    expect(check('A. B. C. D. E. F. G.')).toEqual(['LW-STE-PARAGRAPH-SENTENCES']);
  });
});

describe('words and terminology', () => {
  it('reports contractions but not possessives', () => {
    expect(check("The checker doesn't run.")).toEqual(['LW-STE-CONTRACTION']);
    expect(check("The policy's owner reviews it.")).toEqual([]);
  });

  it('reports recorded synonyms and respects an allowed phrase', () => {
    expect(check('Read the catalogue now.')).toEqual(['LW-STE-TERM-PREFERRED']);
    expect(check('The user agent sends a header.')).toEqual([]);
  });

  it('separates rule 9.3 phrasal verbs from LUDWISE prohibited expressions', () => {
    expect(check('Wire up the binding.')).toEqual(['LW-STE-PHRASAL-VERB-RECORDED']);
    expect(check('Leverage the adapter.')).toEqual(['LW-STE-TERM-PROHIBITED']);
  });

  it('reports configured spelling variants', () => {
    expect(check('The behaviour is stable.')).toEqual(['LW-STE-SPELLING-VARIANT']);
    expect(check('The behavior is stable.')).toEqual([]);
  });
});

describe('abbreviations', () => {
  it('reports a prohibited abbreviation', () => {
    expect(check('Read the config first.')).toEqual(['LW-STE-ABBREVIATION-PROHIBITED']);
  });

  it('requires expansion only when the policy says so', () => {
    expect(check('The ADR records it.')).toEqual(['LW-STE-ABBREVIATION-EXPANSION']);
    expect(check('The API answers.')).toEqual([]);
  });
});

describe('punctuation', () => {
  it('reports the semicolon prohibited by Issue 9 rule 8.1', () => {
    expect(check('Read the file; then close it.')).toEqual(['LW-STE-PUNCTUATION-SEMICOLON']);
    expect(check('Run `const x = 1;` now.')).toEqual([]);
  });

  it('keeps the LUDWISE alternative-slash rule separate', () => {
    expect(check('The read/write split is clear.')).toEqual([
      'LW-STE-PUNCTUATION-ALTERNATIVE-SLASH',
    ]);
    expect(check('Open docs/language/policy.json now.')).toEqual([]);
  });
});

describe('the causal since rule', () => {
  /**
   * Issue 9 approves "since" for time and asks for "because" when the clause
   * gives a reason. The rule reads clause shape, because no word list tells
   * the two meanings apart.
   */
  it('reports a reason that opens a sentence', () => {
    expect(check('Since the file is missing, the check fails.')).toEqual(['LW-STE-CAUSAL-SINCE']);
  });

  it('reports a reason that follows a comma', () => {
    expect(check('The check fails, since the file is missing.')).toEqual(['LW-STE-CAUSAL-SINCE']);
  });

  it('leaves the approved temporal meaning alone', () => {
    expect(check('Lowest price observed by LUDWISE since May 2026.')).toEqual([]);
    expect(check('It reads every commit since the last release.')).toEqual([]);
  });
});

describe('an exact-case exemption', () => {
  it('separates a defined requirement level from the ordinary word', () => {
    // PRODUCT.md defines SHOULD as a requirement level. The lower-case word
    // is ordinary prose and Issue 9 does not approve it.
    expect(check('A SHOULD requirement is strongly preferred.')).toEqual([]);
    expect(check('The value should be stable.')).toEqual(['LW-STE-TERM-PROHIBITED']);
  });
});

describe('the rule registry', () => {
  it('contains the new deterministic controls without duplicates', () => {
    expect(IMPLEMENTED_RULE_IDS).toContain('LW-STE-PROSE-KIND-UNRESOLVED');
    expect(IMPLEMENTED_RULE_IDS).toContain('LW-STE-PHRASAL-VERB-RECORDED');
    expect(IMPLEMENTED_RULE_IDS).toContain('LW-STE-PUNCTUATION-SEMICOLON');
    expect(new Set(IMPLEMENTED_RULE_IDS).size).toBe(IMPLEMENTED_RULE_IDS.length);
  });
});
