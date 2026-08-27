import { mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { checkFiles, enforcedFiles } from '../../../../scripts/ste/check.mjs';
import { loadLanguageDocuments } from '../../../../scripts/ste/policy.mjs';

/**
 * The whole pipeline over real files.
 *
 * The fixtures are ordinary files in the repository, so the classification
 * table has to be replaced here. Under the real table they are exempt, which
 * is what keeps a deliberate violation out of the repository audit.
 */

const real = loadLanguageDocuments(process.cwd());

const documents = {
  ...real,
  policy: {
    ...real.policy,
    rollout: { ...real.policy.rollout, mode: 'audit' },
    classification: [
      {
        id: 'fixture-prose',
        paths: ['tests/fixtures/ste/*.md'],
        unit: 'prose',
        class: 'STE-STRICT',
        prose: 'mixed',
        reason: 'Fixture.',
      },
      {
        id: 'fixture-comments',
        paths: ['tests/fixtures/ste/*.ts'],
        unit: 'comments',
        class: 'STE-STRICT',
        prose: 'mixed',
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

const rulesFor = (file: string): string[] => {
  const result = checkFiles({ rootDir: process.cwd(), files: [file], documents });
  return result.diagnostics.map((found) => found.rule);
};

describe('checkFiles', () => {
  it('finds nothing in the compliant fixture', () => {
    expect(rulesFor('tests/fixtures/ste/compliant.md')).toEqual([]);
  });

  it('finds nothing in the machine syntax fixture', () => {
    expect(rulesFor('tests/fixtures/ste/exempt-syntax.md')).toEqual([]);
  });

  it('finds every planted violation in the violation fixture', () => {
    const found = new Set(rulesFor('tests/fixtures/ste/violations.md'));
    expect(found).toContain('LW-STE-CONTRACTION');
    expect(found).toContain('LW-STE-TERM-PREFERRED');
    expect(found).toContain('LW-STE-SPELLING-VARIANT');
    expect(found).toContain('LW-STE-SENTENCE-LENGTH-DESCRIPTIVE');
    expect(found).toContain('LW-STE-SENTENCE-LENGTH-PROCEDURAL');
    expect(found).toContain('LW-STE-PARAGRAPH-SENTENCES');
    expect(found).toContain('LW-STE-PUNCTUATION-ALTERNATIVE-SLASH');
    expect(found).toContain('LW-STE-ABBREVIATION-PROHIBITED');
    expect(found).toContain('LW-STE-ABBREVIATION-EXPANSION');
  });

  it('checks the comments of a source file and not its strings', () => {
    const found = rulesFor('tests/fixtures/ste/comments.ts');
    expect(found).toEqual(['LW-STE-CONTRACTION', 'LW-STE-SPELLING-VARIANT']);
  });

  it('reports a line and a column that point at the text', () => {
    const result = checkFiles({
      rootDir: process.cwd(),
      files: ['tests/fixtures/ste/violations.md'],
      documents,
    });
    const first = result.diagnostics[0];
    expect(first?.line).toBeGreaterThan(0);
    expect(first?.column).toBeGreaterThan(0);
    expect(first?.file).toBe('tests/fixtures/ste/violations.md');
  });

  it('counts the files and the units that it read', () => {
    const result = checkFiles({
      rootDir: process.cwd(),
      files: ['tests/fixtures/ste/compliant.md'],
      documents,
    });
    expect(result.filesChecked).toBe(1);
    expect(result.unitsChecked).toBeGreaterThan(0);
  });

  it('skips a file that the table exempts', () => {
    const result = checkFiles({ rootDir: process.cwd(), files: ['package.json'], documents });
    expect(result.diagnostics).toEqual([]);
    expect(result.filesChecked).toBe(0);
  });

  it('reads a visitor string as its own unit, under the derived rule set', () => {
    const derived = {
      ...documents,
      policy: {
        ...documents.policy,
        classification: [
          {
            id: 'fixture-strings',
            paths: ['tests/fixtures/ste/*.ts'],
            unit: 'strings',
            class: 'STE-DERIVED',
            reason: 'Fixture.',
          },
          ...documents.policy.classification,
        ],
      },
    };
    const result = checkFiles({
      rootDir: process.cwd(),
      files: ['tests/fixtures/ste/comments.ts'],
      documents: derived,
    });
    expect(result.unsupportedUnits).toBe(0);
    expect(result.diagnostics.map((one) => one.rule)).toContain('LW-STE-ABBREVIATION-PROHIBITED');
    const spelling = result.diagnostics.filter(
      (one) => one.unit === 'strings' && one.rule === 'LW-STE-SPELLING-VARIANT',
    );
    expect(spelling).toEqual([]);
  });

  it('counts runtime-composed visitor text for semantic review', () => {
    const root = mkdtempSync(join(tmpdir(), 'ste-runtime-'));
    writeFileSync(
      join(root, 'dynamic.ts'),
      'const count = 1;\nconst message = `Showing ${count} games.`;\n',
    );
    const result = checkFiles({
      rootDir: root,
      files: ['dynamic.ts'],
      documents: {
        ...documents,
        policy: {
          ...documents.policy,
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
      },
    });
    expect(result.unsupportedUnits).toBe(0);
    expect(result.reviewRequiredUnits).toBe(1);
  });

  it('applies a central exception instead of an inline suppression', () => {
    const result = checkFiles({
      rootDir: process.cwd(),
      files: ['tests/fixtures/ste/violations.md'],
      documents: {
        ...documents,
        exceptions: {
          ...documents.exceptions,
          exceptions: [
            {
              id: 'fixture-contraction',
              scope: { paths: ['tests/fixtures/ste/violations.md'] },
              rules: ['LW-STE-CONTRACTION'],
              reason: 'The fixture holds a contraction on purpose.',
              owner: 'LUDWISE architecture',
            },
          ],
        },
      },
    });
    expect(result.diagnostics.map((one) => one.rule)).not.toContain('LW-STE-CONTRACTION');
  });
});

describe('checkFiles, on the prose kind that enforcement requires', () => {
  const root = mkdtempSync(join(tmpdir(), 'ste-kind-'));

  const enforcing = (extra: Record<string, unknown> = {}) => ({
    ...documents,
    policy: {
      ...documents.policy,
      rollout: { ...documents.policy.rollout, mode: 'enforce' },
      classification: [
        { id: 'probe', paths: ['*.md'], unit: 'prose', class: 'STE-STRICT', reason: 'Probe.' },
        {
          id: 'unclassified',
          paths: ['**'],
          unit: 'prose',
          class: 'STE-EXEMPT',
          catchAll: true,
          reason: 'x',
        },
      ],
      ...extra,
    },
  });

  const rulesIn = (name: string, body: string): string[] => {
    writeFileSync(join(root, name), body);
    return checkFiles({ rootDir: root, files: [name], documents: enforcing() }).diagnostics.map(
      (one) => one.rule,
    );
  };

  it('fails closed when a document declares no prose kind', () => {
    expect(rulesIn('undeclared.md', 'The value is stable.\n')).toContain(
      'LW-STE-PROSE-KIND-UNRESOLVED',
    );
  });

  it('accepts a document that declares its kind in front matter', () => {
    expect(
      rulesIn('declared.md', '---\nste-prose: descriptive\n---\n\nThe value is stable.\n'),
    ).toEqual([]);
  });

  it('applies the 20-word limit to a document that declares a procedure', () => {
    const long = `${Array.from({ length: 22 }, () => 'word').join(' ')}.`;
    expect(rulesIn('steps.md', `---\nste-prose: procedural\n---\n\n${long}\n`)).toEqual([
      'LW-STE-SENTENCE-LENGTH-PROCEDURAL',
    ]);
  });

  it('lets a section declaration override the document kind', () => {
    const long = `${Array.from({ length: 22 }, () => 'word').join(' ')}.`;
    const source = `---\nste-prose: procedural\n---\n\n## Reference <!-- ste-prose: descriptive -->\n\n${long}\n`;
    expect(rulesIn('mixed.md', source)).toEqual([]);
  });
});

describe('enforcedFiles', () => {
  const files = ['docs/language/checker.md', 'README.md', 'scripts/ste/cli.mjs'];
  const auditPolicy = { ...real.policy, rollout: { ...real.policy.rollout, mode: 'audit' } };

  it('keeps only the declared paths while the rollout is in audit mode', () => {
    expect(enforcedFiles(files, auditPolicy)).toEqual([
      'docs/language/checker.md',
      'scripts/ste/cli.mjs',
    ]);
  });

  it('keeps every file once the rollout mode changes to enforcement', () => {
    const enforcing = { ...real.policy, rollout: { ...real.policy.rollout, mode: 'enforce' } };
    expect(enforcedFiles(files, enforcing)).toEqual(files);
  });
});

describe('checkFiles, on files that must not stop the run', () => {
  const root = mkdtempSync(join(tmpdir(), 'ste-check-'));

  const fixturePolicy = (paths: readonly string[], unit: string) => ({
    ...documents,
    policy: {
      ...documents.policy,
      classification: [
        { id: 'probe', paths, unit, class: 'STE-STRICT', prose: 'mixed', reason: 'Probe.' },
        {
          id: 'unclassified',
          paths: ['**'],
          unit: 'prose',
          class: 'STE-EXEMPT',
          catchAll: true,
          reason: 'x',
        },
      ],
    },
  });

  it('reports a symbolic link rather than reading outside the repository', () => {
    try {
      symlinkSync('/etc/passwd', join(root, 'link.md'));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (process.platform === 'win32' && (code === 'EPERM' || code === 'EACCES')) return;
      throw error;
    }
    const result = checkFiles({
      rootDir: root,
      files: ['link.md'],
      documents: fixturePolicy(['*.md'], 'prose'),
    });
    expect(result.diagnostics.map((one) => one.rule)).toEqual(['LW-STE-FILE-UNREADABLE']);
    expect(result.diagnostics[0]?.message).toContain('symbolic link');
  });

  it('reports a missing file rather than passing over it in silence', () => {
    const result = checkFiles({
      rootDir: root,
      files: ['absent.md'],
      documents: fixturePolicy(['*.md'], 'prose'),
    });
    expect(result.diagnostics.map((one) => one.rule)).toEqual(['LW-STE-FILE-UNREADABLE']);
  });

  it('isolates a source file that the parser cannot walk', () => {
    writeFileSync(join(root, 'deep.mjs'), `const a = ${'('.repeat(20000)}1${')'.repeat(20000)};\n`);
    const result = checkFiles({
      rootDir: root,
      files: ['deep.mjs'],
      documents: fixturePolicy(['*.mjs'], 'comments'),
    });
    expect(result.diagnostics.map((one) => one.rule)).toEqual(['LW-STE-FILE-UNREADABLE']);
  });
});
