import { describe, expect, it } from 'vitest';

import { BUILD_INFO } from '../../src/lib/build-info.js';

describe('BUILD_INFO', () => {
  // If the define wiring in vitest.config.ts or astro.config.mjs breaks, these
  // values silently become the fallbacks and every log record loses its build
  // identity. Asserting the sentinels distinguishes "injection works" from
  // "the fallback works".
  it('reads the values injected at build time', () => {
    expect(BUILD_INFO.version).toBe('0.0.0-test');
    expect(BUILD_INFO.buildId).toBe('test-run');
    expect(BUILD_INFO.gitCommit).toBe('testsha0000000000000000000000000000000');
  });

  it('shortens the commit for readable log fields', () => {
    expect(BUILD_INFO.gitCommitShort).toBe('testsha');
    expect(BUILD_INFO.gitCommitShort).toHaveLength(7);
  });

  it('is frozen, since build identity must not drift at runtime', () => {
    expect(Object.isFrozen(BUILD_INFO)).toBe(true);
  });

  it('does not carry an environment, which is runtime configuration', () => {
    expect(BUILD_INFO).not.toHaveProperty('environment');
  });
});
