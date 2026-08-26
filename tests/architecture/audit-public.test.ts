import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * The secret scanner, checked against secrets.
 *
 * `audit-public.mjs` printing "No findings" is indistinguishable from it being
 * broken, and this repository is public. So every rule is exercised by planting
 * a synthetic secret in a real tracked file and checking the audit fails.
 *
 * Written against an audit that reported a clean tree, this found two ways it
 * was blind - `RULE_FILES` skipping whole files rather than the one rule they
 * needed skipped, and lockfile integrity hashes suppressed by line rather than
 * by span. These tests exist so neither can come back quietly.
 *
 * The payloads carry a `not-a-real-secret` marker, typed deliberately at each
 * value, because this file is tracked and the audit reads it too.
 */

const audit = (): { failed: boolean; output: string } => {
  try {
    return {
      failed: false,
      output: execFileSync('node', ['scripts/audit-public.mjs'], { encoding: 'utf8' }),
    };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { failed: true, output: `${failure.stdout ?? ''}${failure.stderr ?? ''}` };
  }
};

/** Plant `payload` in `file`, run the audit, and always put the file back. */
const withPlanted = (file: string, payload: string): { failed: boolean; output: string } => {
  const original = readFileSync(file, 'utf8');
  try {
    writeFileSync(file, original + payload);
    return audit();
  } finally {
    writeFileSync(file, original);
  }
};

describe('the public-repository audit', () => {
  it('passes on the repository as it stands', () => {
    expect(audit().failed).toBe(false);
  });

  // Vendor-prefixed shapes, each unambiguous enough to block a build.
  const SECRETS: readonly [string, string][] = [
    ['a GitHub token', 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'], // not-a-real-secret
    ['an AWS access key id', 'AKIAIOSFODNN7EXAMPLE'], // not-a-real-secret
    ['a Slack token', 'xoxb-1234567890-abcdefghijkl'], // not-a-real-secret
    ['a private key block', '-----BEGIN RSA PRIVATE KEY-----'], // not-a-real-secret
    ['a bearer token', 'Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345'], // not-a-real-secret
    ['a Cloudflare API token', 'CLOUDFLARE_API_TOKEN="abcdefghij0123456789ABCDEFGHIJ0123456789"'], // not-a-real-secret
    ['a lowercase Steam key', 'key a1b2c3d4e5f60718293a4b5c6d7e8f90'], // not-a-real-secret
    ['an unquoted YAML token', 'token: aBcDeF0123456789xyzQ'], // not-a-real-secret
    ['credentials in a URL', 'https://admin:hunter2thing@internal.example.com/x'], // not-a-real-secret
  ];

  it.each(SECRETS)('fails when %s is committed', (_label, payload) => {
    expect(withPlanted('docs/architecture.md', `\n${payload}\n`).failed).toBe(true);
  });

  // The files an extension allowlist used to skip in silence. `.dev.vars.example`
  // is the likeliest place for a real credential to be pasted by accident, since
  // its whole job is to look like the file that holds them.
  it.each(['.dev.vars.example', '.gitattributes'])(
    'reads %s, which an extension allowlist would skip',
    (file) => {
      expect(withPlanted(file, '\nghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\n').failed).toBe(true); // not-a-real-secret
    },
  );

  it('still reports a real key in the file whose fixtures are exempt', () => {
    // correlation.test.ts legitimately contains 32-hex trace ids. The exemption
    // is scoped to those known values, so an actual key alongside them is caught.
    const planted = withPlanted(
      'tests/unit/http/correlation.test.ts',
      '\n// A1B2C3D4E5F60718293A4B5C6D7E8F90\n', // not-a-real-secret
    );
    expect(planted.failed).toBe(true);
  });

  it('still reports credentials in a lockfile resolution URL', () => {
    // Integrity hashes on this line are suppressed; the tarball URL is not.
    const planted = withPlanted(
      'pnpm-lock.yaml',
      '\n    resolution: {integrity: sha512-x, tarball: https://u:p@evil.example.test/a}\n', // not-a-real-secret
    );
    expect(planted.failed).toBe(true);
  });
});
