import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';

/**
 * The gate has one definition of a limit, and the repository has one browser.
 *
 * A Lighthouse threshold restated in a workflow file or in a document is a
 * second definition. The two drift, and the one a reader believes is then a
 * coin toss. `lighthouse.config.json` is the only place a limit is written, and
 * these assertions keep it that way.
 */

const read = (path: string): string => readFileSync(path, 'utf8');

const config = JSON.parse(read('lighthouse.config.json')) as {
  categories: Record<string, number>;
  metrics: Record<string, number>;
  budgets: Record<string, number>;
  theme: string;
  deterministic: { skipAudits: string[] };
};

const WORKFLOW = '.github/workflows/lighthouse.yml';
const GATE_DOC = 'docs/operations/lighthouse-gate.md';

/** The name that branch protection has to require. */
const REQUIRED_CHECK = 'Lighthouse / Lighthouse';

describe('the Lighthouse gate defines each limit once', () => {
  const limits = [
    ...Object.values(config.categories),
    ...Object.values(config.metrics),
    ...Object.values(config.budgets),
  ];

  it('has limits to check, so this rule is not guarding an empty set', () => {
    expect(limits.length).toBeGreaterThan(0);
  });

  for (const path of [WORKFLOW, GATE_DOC]) {
    it(`restates no limit in ${path}`, () => {
      const source = read(path);
      const restated = limits.filter((limit) =>
        new RegExp(`(?<![\\w.])${String(limit).replace('.', '\\.')}(?![\\w.])`, 'u').test(source),
      );

      expect(restated).toEqual([]);
    });
  }

  it('reads the committed configuration rather than a default of its own', () => {
    expect(read('scripts/lighthouse/config.mjs')).toContain('lighthouse.config.json');
    expect(read('scripts/lighthouse.mjs')).not.toMatch(/threshold\s*=/u);
  });
});

describe('every skipped audit carries a recorded reason', () => {
  it('skips at least one audit, so this rule is not guarding an empty set', () => {
    expect(config.deterministic.skipAudits.length).toBeGreaterThan(0);
  });

  it('names each skipped audit in the operations document', () => {
    const doc = read(GATE_DOC);
    const undocumented = config.deterministic.skipAudits.filter(
      (audit) => !doc.includes(`\`${audit}\``),
    );

    expect(undocumented).toEqual([]);
  });
});

describe('the Lighthouse gate runs where it must', () => {
  it('runs on every pull request', () => {
    expect(read('.github/workflows/ci.yml')).toContain('uses: ./.github/workflows/lighthouse.yml');
  });

  it('blocks a production deploy', () => {
    const workflow = read('.github/workflows/deploy-production.yml');

    expect(workflow).toContain('uses: ./.github/workflows/lighthouse.yml');
    expect(workflow).toMatch(/needs:\s*\[[^\]]*lighthouse[^\]]*\]/u);
  });

  it('names the job that branch protection requires', () => {
    const [workflowName, jobName] = REQUIRED_CHECK.split(' / ');

    expect(read(WORKFLOW)).toContain(`name: ${String(workflowName)}`);
    expect(read(WORKFLOW)).toContain(`name: ${String(jobName)}`);
    expect(read(GATE_DOC)).toContain(REQUIRED_CHECK);
  });

  it('uploads every report, whether the gate passed or failed', () => {
    expect(read(WORKFLOW)).toMatch(/if: always\(\)[\s\S]*upload-artifact/u);
  });
});

describe('the Lighthouse gate pins what it measures with', () => {
  const manifest = JSON.parse(read('package.json')) as {
    devDependencies: Record<string, string>;
  };

  it('pins the lighthouse version exactly', () => {
    expect(manifest.devDependencies.lighthouse).toMatch(/^\d+\.\d+\.\d+$/u);
  });

  it('drives the browser that Playwright already pins', () => {
    expect(read('scripts/lighthouse/measure.mjs')).toContain("from '@playwright/test'");
    expect(read(WORKFLOW)).toContain('playwright install --with-deps chromium');
  });

  // The script cannot import the TypeScript module that owns this name, so the
  // two copies are compared here rather than left to drift.
  it('pins the theme with the cookie name that the site reads', () => {
    expect(read('scripts/lighthouse/measure.mjs')).toContain(
      `const THEME_COOKIE_NAME = '${THEME_COOKIE_NAME}'`,
    );
  });
});
