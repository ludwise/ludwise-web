import { describe, expect, it } from 'vitest';

import { classifyPaths } from '../../../scripts/ci/impact.mjs';

describe('CI impact planner', () => {
  it('keeps documentation changes cheap', () => {
    expect(classifyPaths(['README.md'])).toMatchObject({
      full: false,
      format: true,
      language: true,
      static: false,
      unit: false,
      browser: false,
      deployment: false,
    });
  });

  it('runs browser and publication checks for application source', () => {
    expect(classifyPaths(['src/components/navigation/AppHeader.tsx'])).toMatchObject({
      full: false,
      static: true,
      unit: true,
      build: true,
      browser: true,
      publishAudit: true,
      deployment: false,
    });
  });

  it('runs localization-sensitive checks for messages', () => {
    expect(classifyPaths(['messages/en.json'])).toMatchObject({
      full: false,
      language: true,
      unit: true,
      build: true,
      browser: true,
    });
  });

  it('forces the full suite for CI and toolchain controls', () => {
    expect(classifyPaths(['.github/workflows/verify.yml']).full).toBe(true);
    expect(classifyPaths(['scripts/ci/impact.mjs']).full).toBe(true);
    expect(classifyPaths(['astro.config.mjs']).full).toBe(true);
    expect(classifyPaths(['pnpm-lock.yaml']).full).toBe(true);
  });

  it('forces the full suite for unknown paths', () => {
    expect(classifyPaths(['new-system/config.weird'])).toMatchObject({
      full: true,
      unknown: true,
      browser: true,
      degraded: true,
      deployment: true,
      publishAudit: true,
    });
  });

  it('takes the union for mixed changes', () => {
    expect(classifyPaths(['README.md', 'src/pages/index.astro'])).toMatchObject({
      full: false,
      language: true,
      unit: true,
      build: true,
      browser: true,
      publishAudit: true,
      deployment: false,
    });
  });
});
