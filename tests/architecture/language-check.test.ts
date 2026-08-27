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

describe('the recorded terminology conflicts', () => {
  /**
   * terminology.md tabulates what terminology.json records, and the two drifted.
   * The table listed four conflicts as open, and a `provider-boundary` that the
   * data has never held, while every conflict in the data was resolved. A reader
   * checking whether phase 2 still owed a decision would have been told yes by
   * one file and no by the other.
   */
  const conflicts = (
    documents.terminology as { conflicts: { id: string; status: string; resolution: unknown }[] }
  ).conflicts;
  const prose = readFileSync('docs/language/terminology.md', 'utf8');

  it('are each tabulated in the prose that describes them', () => {
    for (const conflict of conflicts) {
      expect(prose, `${conflict.id} is recorded but not tabulated`).toContain(`\`${conflict.id}\``);
    }
  });

  it('are the only conflicts the prose claims exist', () => {
    // The section, not the file. An earlier version read every table row and
    // picked up the field reference above, which names JSON keys rather than
    // conflicts.
    const section = prose.slice(prose.indexOf('## Recorded conflicts'));
    const tabulated = [...section.matchAll(/^\|\s*`([a-z-]+)`\s*\|/gmu)].map((row) => row[1]);
    const recorded = new Set(conflicts.map((conflict) => conflict.id));

    expect(tabulated.length, 'the conflict table was not found').toBeGreaterThan(0);
    for (const id of tabulated) {
      expect(recorded.has(id), `the table names ${id}, which no conflict records`).toBe(true);
    }
  });

  it('agree with the prose about whether each is settled', () => {
    for (const conflict of conflicts) {
      const row = prose.split('\n').find((line) => line.includes(`\`${conflict.id}\``)) ?? '';
      expect(row, `the table and the record disagree about ${conflict.id}`).toContain(
        conflict.status,
      );
    }
  });

  it('carry a resolution once enforcement is on', () => {
    // rollout.md makes settling every conflict a precondition for enforcement,
    // and no deterministic rule can see an unsettled one.
    if (documents.policy.rollout.mode !== 'enforce') return;

    for (const conflict of conflicts) {
      expect(conflict.status, `${conflict.id} is still open`).toBe('resolved');
      expect(conflict.resolution, `${conflict.id} resolves to nothing`).toBeTruthy();
    }
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
