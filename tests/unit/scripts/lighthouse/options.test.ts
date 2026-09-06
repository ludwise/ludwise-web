import { describe, expect, it } from 'vitest';

import { parseOptions } from '../../../../scripts/lighthouse/options.mjs';

describe('parseOptions', () => {
  it('reads the target and defaults to the deterministic mode', () => {
    expect(parseOptions(['--target', 'http://127.0.0.1:4321'])).toMatchObject({
      target: 'http://127.0.0.1:4321',
      mode: 'deterministic',
    });
  });

  it('accepts the production mode', () => {
    expect(parseOptions(['--target', 'https://example.com', '--mode', 'production']).mode).toBe(
      'production',
    );
  });

  it('refuses a mode the gate does not define', () => {
    expect(() => parseOptions(['--target', 'https://example.com', '--mode', 'staging'])).toThrow(
      /staging/,
    );
  });

  it('refuses a run with no target', () => {
    expect(() => parseOptions([])).toThrow(/--target/);
  });

  it('refuses a target that is not an absolute address', () => {
    expect(() => parseOptions(['--target', '/games'])).toThrow(/target/);
  });

  it('drops a trailing slash so a route path never doubles it', () => {
    expect(parseOptions(['--target', 'http://127.0.0.1:4321/']).target).toBe(
      'http://127.0.0.1:4321',
    );
  });

  it('refuses an unknown flag rather than ignoring it', () => {
    expect(() => parseOptions(['--target', 'https://example.com', '--retries', '3'])).toThrow(
      /--retries/,
    );
  });

  it('refuses a sample override that cannot produce a true median', () => {
    const argv = ['--target', 'https://example.com', '--samples'];
    expect(() => parseOptions([...argv, '1'])).toThrow(/samples/);
    expect(() => parseOptions([...argv, '4'])).toThrow(/samples/);
    expect(parseOptions([...argv, '5']).samples).toBe(5);
  });

  it('leaves the sample count unset when no override is given', () => {
    expect(parseOptions(['--target', 'https://example.com']).samples).toBeUndefined();
  });

  it('takes a report directory and defaults to one', () => {
    expect(parseOptions(['--target', 'https://example.com']).reportDir).toBe('lighthouse-reports');
    expect(parseOptions(['--target', 'https://example.com', '--report-dir', 'out']).reportDir).toBe(
      'out',
    );
  });
});
