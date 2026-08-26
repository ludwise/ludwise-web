import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadLanguageDocuments } from '../../scripts/ste/policy.mjs';

/**
 * The language check has to stay wired to the thing that runs it.
 *
 * The rollout plan says that branch protection will require a check by name,
 * and that no workflow edit is needed to turn enforcement on. Both claims rest
 * on couplings that nothing else asserts.
 */

const documents = loadLanguageDocuments(process.cwd());
const workflow = readFileSync('.github/workflows/verify.yml', 'utf8');
const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};

describe('the language job', () => {
  it('is named exactly what the policy says branch protection must require', () => {
    expect(workflow).toContain(`name: ${documents.policy.rollout.enforcementCheckName}`);
  });

  it('runs the gating check, so the enforcement switch needs no workflow edit', () => {
    expect(workflow).toContain('pnpm run check:ste');
  });

  it('runs the checker tests before the prose check', () => {
    expect(workflow.indexOf('vitest run tests/unit/scripts/ste')).toBeLessThan(
      workflow.indexOf('run: pnpm run check:ste'),
    );
  });
});

describe('the developer commands', () => {
  it('exist under the names the checker documentation gives', () => {
    for (const name of ['check:ste', 'check:ste:audit', 'check:ste:report']) {
      expect(manifest.scripts[name]).toBeTruthy();
    }
  });

  it('are part of the aggregate check', () => {
    expect(manifest.scripts.check).toContain('check:ste');
  });
});

describe('the rollout state', () => {
  it('is one of the two modes the policy declares', () => {
    expect(documents.policy.rollout.modes).toContain(documents.policy.rollout.mode);
  });

  it('names an enforced path set only while the rollout is in audit mode', () => {
    if (documents.policy.rollout.mode === 'audit') {
      expect(documents.policy.rollout.enforcedPaths.length).toBeGreaterThan(0);
    }
  });
});
