import { describe, expect, it } from 'vitest';
import { loadLanguageDocuments } from '../../../../scripts/ste/policy.mjs';
import { formatMatrix, formatText, summarize } from '../../../../scripts/ste/report.mjs';

const documents = loadLanguageDocuments(process.cwd());
const result = { diagnostics: [], filesChecked: 1, unitsChecked: 2, unsupportedUnits: 0 };

describe('report', () => {
  it('separates full mapping from partial machine support', () => {
    const summary = summarize(result, documents, 'repository');
    expect(summary.coverage.knownWritingRules).toBe(53);
    expect(summary.coverage.mappedWritingRules).toBe(53);
    expect(summary.coverage.standardPartial).toBeGreaterThan(0);
    expect(summary.coverage.standardNone).toBeGreaterThan(0);
  });
  it('does not claim full conformance for a green checker', () => {
    const text = formatText(result, summarize(result, documents, 'repository'));
    expect(text).toContain('implemented checks only');
    expect(text).toContain('standard-rule map includes all 53 writing rules');
    expect(text).toContain('Normative machine coverage is partial');
  });
  it('prints verified rule mappings', () => {
    const matrix = formatMatrix(documents);
    expect(matrix).toContain('Access to the normative source: verified');
    expect(matrix).toContain('5.1  section 5');
    expect(matrix).toContain('LW-STE-PUNCTUATION-SEMICOLON');
  });
});
