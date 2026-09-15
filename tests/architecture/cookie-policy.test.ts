import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '../helpers/imports.js';

/**
 * The cookie policy names every cookie that the site sets.
 *
 * A module in `src/lib/` declares each cookie name as an exported
 * `*_COOKIE_NAME` constant. The policy must name each value in code format.
 * Before issue #143, only a person checked this, and #139 added a cookie.
 */

// tests/architecture -> tests -> repository root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const POLICY = 'src/content/legal/en/cookies.md';
const COOKIE_NAME_EXPORT = /^[A-Z][A-Z0-9_]*_COOKIE_NAME$/u;
const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/u;

interface CookieNameConstant {
  readonly name: string;
  readonly value: unknown;
}

function cookieNamesExportedBy(exports: Record<string, unknown>): CookieNameConstant[] {
  return Object.entries(exports)
    .filter(([name]) => COOKIE_NAME_EXPORT.test(name))
    .map(([name, value]) => ({ name, value }));
}

function undisclosedCookies(cookieNames: readonly string[], policy: string): string[] {
  const body = policy.replace(FRONT_MATTER, '');
  return cookieNames.filter((cookieName) => !body.includes(`\`${cookieName}\``));
}

/**
 * Every `*_COOKIE_NAME` export of a module in `src/lib/`, by its runtime value.
 *
 * The text search only selects which modules to load. The value comes from the
 * module itself, so a type annotation, a line wrap or a re-export cannot hide it.
 */
async function libCookieNameConstants(): Promise<CookieNameConstant[]> {
  const candidates = listSourceFiles('src/lib').filter(
    (file) =>
      !file.endsWith('.astro') &&
      readFileSync(join(REPO_ROOT, file), 'utf8').includes('_COOKIE_NAME'),
  );
  const modules = await Promise.all(
    candidates.map(
      async (file) =>
        (await import(pathToFileURL(join(REPO_ROOT, file)).href)) as Record<string, unknown>,
    ),
  );
  const unique = new Map<string, CookieNameConstant>();
  for (const constant of modules.flatMap(cookieNamesExportedBy)) {
    unique.set(constant.name, constant);
  }
  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}

describe('the rule can actually fire', () => {
  const policy = '---\ntitle: `session`\n---\n\n## Theme cookie\n\nA cookie named `theme`.\n';

  it('selects only the cookie-name constants', () => {
    const exports = {
      THEME_COOKIE_NAME: 'theme',
      COOKIE_NAME_LIMIT: 4,
      readThemeCookie: () => null,
    };

    expect(cookieNamesExportedBy(exports)).toEqual([{ name: 'THEME_COOKIE_NAME', value: 'theme' }]);
  });

  it.each([
    ['a cookie the policy does not mention', 'region'],
    ['a cookie the policy names only in plain text', 'Theme'],
    ['a cookie the policy names only in the front matter', 'session'],
    ['a cookie whose name only starts a code span', 'the'],
  ])('reports %s', (_label, cookieName) => {
    expect(undisclosedCookies([cookieName], policy)).toEqual([cookieName]);
  });

  it('does not report a cookie the policy names in code format', () => {
    expect(undisclosedCookies(['theme'], policy)).toEqual([]);
  });
});

describe('the cookie policy names every cookie the site sets', async () => {
  const constants = await libCookieNameConstants();

  it('found the cookies the site is known to set', () => {
    expect(constants.map(({ value }) => value)).toEqual(
      expect.arrayContaining(['region', 'theme']),
    );
  });

  it.each(constants)('$name holds a string', ({ value }) => {
    expect(typeof value).toBe('string');
  });

  it.each(constants)('$name is named in the policy', ({ value }) => {
    const policy = readFileSync(join(REPO_ROOT, POLICY), 'utf8');

    expect(undisclosedCookies([String(value)], policy)).toEqual([]);
  });
});
