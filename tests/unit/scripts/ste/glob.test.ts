import { describe, expect, it } from 'vitest';

import { matchesGlob } from '../../../../scripts/ste/glob.mjs';

/**
 * Path matching for the classification table.
 *
 * Classification decides whether a file is controlled prose, so a pattern that
 * matches too much is a silent bypass of the whole policy. The separator must
 * never be crossed by a single star.
 */

describe('matchesGlob', () => {
  it('matches a literal path', () => {
    expect(matchesGlob('AGENTS.md', 'AGENTS.md')).toBe(true);
    expect(matchesGlob('AGENTS.md', 'CLAUDE.md')).toBe(false);
  });

  it('keeps a single star inside one path segment', () => {
    expect(matchesGlob('README.md', '*.md')).toBe(true);
    expect(matchesGlob('docs/README.md', '*.md')).toBe(false);
  });

  it('lets a double star cross separators', () => {
    expect(matchesGlob('docs/adr/0001-x.md', 'docs/**/*.md')).toBe(true);
    expect(matchesGlob('docs/README.md', 'docs/**/*.md')).toBe(true);
    expect(matchesGlob('src/a.ts', 'docs/**/*.md')).toBe(false);
  });

  it('matches everything below a directory with a trailing double star', () => {
    expect(matchesGlob('docs/language/policy.json', 'docs/language/**')).toBe(true);
    expect(matchesGlob('docs/language', 'docs/language/**')).toBe(false);
  });

  it('matches every path with a bare double star', () => {
    expect(matchesGlob('a', '**')).toBe(true);
    expect(matchesGlob('a/b/c.md', '**')).toBe(true);
  });

  it('expands a brace alternation', () => {
    expect(matchesGlob('src/a.ts', 'src/**/*.{ts,tsx}')).toBe(true);
    expect(matchesGlob('src/a.tsx', 'src/**/*.{ts,tsx}')).toBe(true);
    expect(matchesGlob('src/a.mjs', 'src/**/*.{ts,tsx}')).toBe(false);
  });

  it('treats a regular expression character in the pattern as a literal', () => {
    expect(matchesGlob('a.b.md', 'a.b.md')).toBe(true);
    expect(matchesGlob('axbxmd', 'a.b.md')).toBe(false);
  });
});
