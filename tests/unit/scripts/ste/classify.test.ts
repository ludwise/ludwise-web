import { describe, expect, it } from 'vitest';

import { classify, classificationCoverage } from '../../../../scripts/ste/classify.mjs';

/**
 * Which content class a path belongs to.
 *
 * The table is ordered and the first match wins for each unit. A specific
 * rule must be able to sit in front of a general one. The last rule is the
 * catch-all, and a file that only it matches is reported rather than ignored.
 */

const policy = {
  proseBearingExtensions: ['.md', '.ts'],
  classification: [
    {
      id: 'changelog',
      paths: ['CHANGELOG.md'],
      unit: 'prose',
      class: 'STE-EXEMPT',
      reason: 'Generated.',
    },
    {
      id: 'root-docs',
      paths: ['*.md'],
      unit: 'prose',
      class: 'STE-STRICT',
      prose: 'mixed',
      reason: 'Prose.',
    },
    {
      id: 'src-comments',
      paths: ['src/**/*.ts'],
      unit: 'comments',
      class: 'STE-STRICT',
      prose: 'mixed',
      reason: 'Comments.',
    },
    {
      id: 'src-strings',
      paths: ['src/**/*.ts'],
      unit: 'strings',
      class: 'STE-DERIVED',
      reason: 'Visitor text.',
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
};

describe('classify', () => {
  it('picks the first matching rule for a unit', () => {
    expect(classify('README.md', policy).assignments).toEqual([
      { unit: 'prose', contentClass: 'STE-STRICT', prose: 'mixed', ruleId: 'root-docs' },
    ]);
  });

  it('lets a specific rule win over a general one', () => {
    expect(classify('CHANGELOG.md', policy).assignments[0]?.ruleId).toBe('changelog');
  });

  it('gives one file a class for each unit it declares', () => {
    const assignments = classify('src/a.ts', policy).assignments;
    expect(assignments.map((one) => `${one.unit}:${one.contentClass}`)).toEqual([
      'comments:STE-STRICT',
      'strings:STE-DERIVED',
    ]);
  });

  it('falls through to the catch-all for anything else', () => {
    const assignment = classify('public/logo.svg', policy).assignments[0];
    expect(assignment?.contentClass).toBe('STE-EXEMPT');
    expect(assignment?.ruleId).toBe('unclassified');
  });

  it('reports whether the file reached the catch-all', () => {
    expect(classify('public/logo.svg', policy).catchAllOnly).toBe(true);
    expect(classify('README.md', policy).catchAllOnly).toBe(false);
  });
});

describe('classificationCoverage', () => {
  it('says nothing when every prose bearing file has a real rule', () => {
    expect(classificationCoverage(['README.md', 'src/a.ts'], policy)).toEqual([]);
  });

  it('reports a prose bearing file that only the catch-all matched', () => {
    const found = classificationCoverage(['tools/a.ts'], policy);
    expect(found).toHaveLength(1);
    expect(found[0]?.rule).toBe('LW-STE-CFG-CLASSIFICATION-COVERAGE');
    expect(found[0]?.file).toBe('tools/a.ts');
  });

  it('does not report a file that cannot carry prose', () => {
    expect(classificationCoverage(['public/logo.svg'], policy)).toEqual([]);
  });
});
