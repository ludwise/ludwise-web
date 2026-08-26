import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The exit codes of the command line interface.
 *
 * Zero means no violation, one means a violation, and two means the checker
 * could not run. A caller that cannot tell the second from the third would
 * read a broken configuration as a clean result.
 */

const CLI = join(process.cwd(), 'scripts/ste/cli.mjs');

const AUDIT_TIMEOUT = 60_000;

const run = (args: readonly string[]): { status: number; output: string } => {
  try {
    const output = execFileSync(process.execPath, [CLI, ...args], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return { status: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      status: failure.status ?? -1,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
    };
  }
};

const textFile = (contents: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), 'ste-')), 'text.md');
  writeFileSync(path, contents, 'utf8');
  return path;
};

describe('the command line entry point', () => {
  it(
    'exits with zero when the phase one scope is clean',
    () => {
      const result = run(['check']);
      expect(result.status, result.output).toBe(0);
    },
    AUDIT_TIMEOUT,
  );

  it('exits with two for an unknown subcommand', () => {
    const result = run(['explode']);
    expect(result.status).toBe(2);
    expect(result.output).toContain('explode');
  });

  it('exits with two when the root holds no policy', () => {
    expect(run(['check', '--root', tmpdir()]).status).toBe(2);
  });

  it(
    'reports the audit without failing, and never calls the result compliant',
    () => {
      const result = run(['audit']);
      expect(result.status).toBe(0);
      expect(result.output).toContain('audit');
      expect(result.output).not.toContain('STE compliant');
    },
    AUDIT_TIMEOUT,
  );

  it(
    'fails the audit when the strict option is given and violations exist',
    () => {
      expect(run(['audit', '--strict']).status).toBe(1);
    },
    AUDIT_TIMEOUT,
  );

  it('prints the conformance matrix and names the unsupported rules', () => {
    const result = run(['report']);
    expect(result.status).toBe(0);
    expect(result.output).toContain('LW-STE-ABBREVIATION-UNKNOWN');
    expect(result.output).toContain('not-implemented');
  });

  it('checks a single text file and fails on a violation', () => {
    const result = run(['check-text', textFile("It doesn't comply.\n")]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('LW-STE-CONTRACTION');
  });

  it('passes a single text file that complies', () => {
    expect(run(['check-text', textFile('The text complies with the profile.\n')]).status).toBe(0);
  });

  it('exempts the structured prefix of a Conventional Commit subject', () => {
    expect(
      run(['check-text', textFile('feat(api): add the read contract\n'), '--kind', 'commit'])
        .status,
    ).toBe(0);
  });

  it('still checks the prose after a Conventional Commit prefix', () => {
    const result = run([
      'check-text',
      textFile("chore(ci): don't run the job\n"),
      '--kind',
      'commit',
    ]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('LW-STE-CONTRACTION');
  });

  it(
    'emits machine readable output on request',
    () => {
      const result = run(['check', '--format', 'json']);
      expect(() => JSON.parse(result.output) as unknown).not.toThrow();
    },
    AUDIT_TIMEOUT,
  );
});
