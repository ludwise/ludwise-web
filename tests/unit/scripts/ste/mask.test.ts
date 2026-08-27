import { describe, expect, it } from 'vitest';

import { MASK_CHAR, IMPLEMENTED_EXEMPTION_IDS, maskSpans } from '../../../../scripts/ste/mask.mjs';

/**
 * Span level exemptions.
 *
 * Masking replaces an exempt span character for character, so every later
 * offset stays true and a diagnostic can still name a column. A masked run
 * counts as one word, which is why a long path never breaks a word limit.
 */

const mask = (text: string, officialNames: readonly string[] = []): string =>
  maskSpans(text, { officialNames });

const masked = (text: string): boolean =>
  text.split('').every((character) => character === MASK_CHAR);

describe('maskSpans', () => {
  it('preserves length exactly', () => {
    const source = 'Read `docs/language/policy.json` before you change https://example.com/a.';
    expect(mask(source)).toHaveLength(source.length);
  });

  it('masks an inline code span with its backticks', () => {
    const output = mask('Use `checkPaths()` here.');
    expect(masked(output.slice(4, 18))).toBe(true);
    expect(output.startsWith('Use ')).toBe(true);
    expect(output.endsWith(' here.')).toBe(true);
  });

  it('masks a bare address but keeps the surrounding prose', () => {
    const output = mask('See https://example.com/x for detail.');
    expect(output.startsWith('See ')).toBe(true);
    expect(output.endsWith(' for detail.')).toBe(true);
    expect(output).toContain(MASK_CHAR);
  });

  it('masks a mail address including its domain suffix', () => {
    const output = mask('Contact git@danielkindl.dev for detail.');
    expect(output).not.toContain('danielkindl.dev');
    expect(output).not.toContain('.dev');
    expect(output).toContain('Contact ');
    expect(output).toContain(' for detail.');
  });

  it('masks a link destination and keeps the link text', () => {
    const output = mask('Read [the rules](docs/language/profile.md) now.');
    expect(output).toContain('the rules');
    expect(output).not.toContain('profile.md');
  });

  it('masks a path and a file name', () => {
    expect(mask('Open scripts/ste/cli.mjs now.')).not.toContain('cli.mjs');
    expect(mask('Open policy.json now.')).not.toContain('policy.json');
  });

  it('masks an identifier in every shape a source file uses', () => {
    expect(mask('Call loadPolicy soon.')).not.toContain('loadPolicy');
    expect(mask('The StoreOffer type.')).not.toContain('StoreOffer');
    expect(mask('Set MAX_WORDS here.')).not.toContain('MAX_WORDS');
    expect(mask('Call render() twice.')).not.toContain('render()');
  });

  it('masks an official name', () => {
    expect(mask('LUDWISE pins the issue.', ['LUDWISE'])).not.toContain('LUDWISE');
  });

  it('masks a documentation comment tag', () => {
    expect(mask('@param source the text')).not.toContain('@param');
  });

  it('does not mask a code span that runs past one line', () => {
    const source = 'A `paragraph\nwritten inside backticks` is prose.';
    expect(mask(source)).toBe(source);
  });

  it('does not mask a code span that is longer than a whole sentence', () => {
    const inner = 'word '.repeat(30).trim();
    expect(mask(`A \`${inner}\` run.`)).toContain(inner);
  });

  it('leaves ordinary prose untouched', () => {
    const source = 'The checker reports one violation for each sentence that is too long.';
    expect(mask(source)).toBe(source);
  });

  it('does not mask an ordinary capitalized word at the start of a sentence', () => {
    expect(mask('Read the policy.')).toBe('Read the policy.');
  });

  it('does not mask a sentence period as if it were a file extension', () => {
    expect(mask('This is prose. This is more prose.')).toBe('This is prose. This is more prose.');
  });

  it('publishes the exemption identifiers that it implements', () => {
    expect(IMPLEMENTED_EXEMPTION_IDS).toContain('inline-code');
    expect(IMPLEMENTED_EXEMPTION_IDS).toContain('official-name');
    expect(new Set(IMPLEMENTED_EXEMPTION_IDS).size).toBe(IMPLEMENTED_EXEMPTION_IDS.length);
  });
});

describe('maskSpans, on inputs that once broke it', () => {
  it('keeps its length across an astral character', () => {
    const source = 'A 🎮 and `code` after.';
    expect(mask(source)).toHaveLength(source.length);
  });

  it('does not mask a code span that holds more words than an identifier would', () => {
    const source =
      'A ` mark. This sentence must stay visible with the catalogue. The `id` is exact.';
    expect(mask(source)).toContain('This sentence must stay visible');
  });
});
