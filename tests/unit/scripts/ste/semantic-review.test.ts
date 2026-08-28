import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkFiles } from '../../../../scripts/ste/check.mjs';
import { loadLanguageDocuments } from '../../../../scripts/ste/policy.mjs';
import {
  formatJson,
  formatMarkdown,
  formatText,
  summarize,
} from '../../../../scripts/ste/report.mjs';

const real = loadLanguageDocuments(process.cwd());

const documents = {
  ...real,
  policy: {
    ...real.policy,
    rollout: { ...real.policy.rollout, mode: 'audit' },
    classification: [
      {
        id: 'runtime-strings',
        paths: ['dynamic.ts'],
        unit: 'strings',
        class: 'STE-DERIVED',
        reason: 'Fixture.',
      },
      {
        id: 'unclassified',
        paths: ['**'],
        unit: 'prose',
        class: 'STE-EXEMPT',
        catchAll: true,
        reason: 'Not ours.',
      },
    ],
  },
};

const run = () => {
  const root = mkdtempSync(join(tmpdir(), 'ste-semantic-review-'));
  writeFileSync(
    join(root, 'dynamic.ts'),
    'const count = 1;\nconst message = `Showing ${count} games.`;\n',
  );
  return checkFiles({ rootDir: root, files: ['dynamic.ts'], documents });
};

describe('semantic review findings', () => {
  it('identifies each runtime-composed visitor string', () => {
    const result = run();

    expect(result.reviewRequiredUnits).toBe(1);
    expect(result.semanticReviews).toHaveLength(1);
    expect(result.semanticReviews[0]).toMatchObject({
      file: 'dynamic.ts',
      line: 2,
      contentClass: 'STE-DERIVED',
      unit: 'strings',
      kind: 'string',
      text: 'Showing games.',
      reason: 'runtime-composed-visitor-text',
    });
    expect(result.semanticReviews[0]?.column).toBeGreaterThan(0);
    expect(result.diagnostics).toEqual([]);
  });

  it('lists the findings in text, Markdown, and JSON reports', () => {
    const result = run();
    const summary = summarize(result, documents, 'repository');

    const text = formatText(result, summary);
    expect(text).toContain('Semantic review findings:');
    expect(text).toContain('dynamic.ts:2:');
    expect(text).toContain('runtime-composed-visitor-text');
    expect(text).toContain('Showing games.');

    const markdown = formatMarkdown(result, summary);
    expect(markdown).toContain('Semantic review findings:');
    expect(markdown).toContain('`dynamic.ts:2:');

    const json = JSON.parse(formatJson(result, summary));
    expect(json.semanticReviews).toHaveLength(1);
    expect(json.semanticReviews[0].reason).toBe('runtime-composed-visitor-text');
  });
});
