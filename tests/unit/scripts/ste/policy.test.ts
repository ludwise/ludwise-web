import { describe, expect, it } from 'vitest';
import { IMPLEMENTED_EXEMPTION_IDS } from '../../../../scripts/ste/mask.mjs';
import { loadLanguageDocuments, validateConfiguration } from '../../../../scripts/ste/policy.mjs';
import { IMPLEMENTED_RULE_IDS } from '../../../../scripts/ste/rules.mjs';

const documents = loadLanguageDocuments(process.cwd());
const registry = {
  implementedRuleIds: IMPLEMENTED_RULE_IDS,
  implementedExemptionIds: IMPLEMENTED_EXEMPTION_IDS,
};
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const rulesOf = (v: typeof documents) => validateConfiguration(v, registry).map((one) => one.rule);

describe('real policy', () => {
  it('validates', () => expect(validateConfiguration(documents, registry)).toEqual([]));
  it('pins Issue 9', () => {
    expect(documents.policy.standard.issue).toBe('9');
    expect(documents.policy.standard.issueDate).toBe('2025-01-15');
  });
});

describe('normative map', () => {
  it('maps all 53 verified writing rules', () => {
    const map = documents.conformance.standardRuleMap;
    expect(map).toHaveLength(53);
    expect(new Set(map.map((one: { ruleNumber: string }) => one.ruleNumber)).size).toBe(53);
    expect(
      map.every((one: { sourceVerification: string }) => one.sourceVerification === 'verified'),
    ).toBe(true);
    expect(documents.conformance.coverage.completeRuleMap).toBe(true);
  });
  it('uses the verified section names', () =>
    expect(documents.conformance.sections.map((one: { name: string }) => one.name)).toEqual([
      'Words',
      'Multi-word nouns',
      'Verbs',
      'Sentences',
      'Procedural writing',
      'Descriptive writing',
      'Safety instructions',
      'Punctuation and word count',
      'Writing practices',
    ]));
  it('uses the corrected rule references', () => {
    const controls = new Map(
      documents.conformance.rules.map(
        (row: { ludwiseRule: string; steReference: { ruleNumber: string | null } }) => [
          row.ludwiseRule,
          row.steReference.ruleNumber,
        ],
      ),
    );
    expect(controls.get('LW-STE-SENTENCE-LENGTH-PROCEDURAL')).toBe('5.1');
    expect(controls.get('LW-STE-CONTRACTION')).toBe('4.2');
    expect(controls.get('LW-STE-PHRASAL-VERB-RECORDED')).toBe('9.3');
    expect(controls.get('LW-STE-PUNCTUATION-SEMICOLON')).toBe('8.1');
  });
});

describe('validation guards', () => {
  it('rejects a missing normative rule', () => {
    const broken = clone(documents);
    broken.conformance.standardRuleMap = broken.conformance.standardRuleMap.filter(
      (one: { ruleNumber: string }) => one.ruleNumber !== '5.4',
    );
    broken.conformance.coverage.standardRuleMapRows -= 1;
    expect(rulesOf(broken)).toContain('LW-STE-CFG-CONFORMANCE');
  });
  it('rejects an unverified rule', () => {
    const broken = clone(documents);
    broken.conformance.standardRuleMap[0].sourceVerification = 'unverified';
    expect(rulesOf(broken)).toContain('LW-STE-CFG-CONFORMANCE');
  });
  it('rejects the old section 2 title', () => {
    const broken = clone(documents);
    broken.conformance.sections[1].name = 'Noun phrases';
    expect(rulesOf(broken)).toContain('LW-STE-CFG-CONFORMANCE');
  });
  it('rejects the wrong procedural limit', () => {
    const broken = clone(documents);
    broken.policy.limits.proceduralSentenceWords = 21;
    expect(rulesOf(broken)).toContain('LW-STE-CFG-POLICY');
  });
});
