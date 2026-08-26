import { describe, expect, it } from 'vitest';

import { extractStrings, stringCoverage } from '../../../../scripts/ste/extract.mjs';

/**
 * The visitor-visible text of a template.
 *
 * A string reaches a person only through a small set of shapes: element text,
 * an accessible name, a page title, and a named string constant. Anything else
 * is machine syntax, so the extractor leaves it alone rather than guessing.
 */

const texts = (source: string, path = 'a.astro'): string[] =>
  extractStrings(source, path).map((unit) => unit.text.trim());

describe('extractStrings, on an Astro template', () => {
  it('returns the text of an element', () => {
    expect(texts('---\nconst a = 1;\n---\n<p>No games match these filters.</p>\n')).toEqual([
      'No games match these filters.',
    ]);
  });

  it('returns a visitor-visible attribute', () => {
    const source = '---\nconst a = 1;\n---\n<img alt="A store logo" src="/a.png" />\n';
    expect(texts(source)).toEqual(['A store logo']);
  });

  it('leaves a machine attribute alone', () => {
    const source = '---\nconst a = 1;\n---\n<div class="lw-card" data-level="fresh"></div>\n';
    expect(texts(source)).toEqual([]);
  });

  it('leaves the contents of a style or script element alone', () => {
    const source = '---\nconst a = 1;\n---\n<style>.a { color: red; }</style>\n';
    expect(texts(source)).toEqual([]);
  });

  it('leaves an expression alone and keeps the text around it', () => {
    const source = '---\nconst count = 1;\n---\n<p>Showing {count} games.</p>\n';
    expect(texts(source)).toEqual(['Showing games.']);
  });

  it('ignores whitespace and punctuation that carries no words', () => {
    expect(texts('---\nconst a = 1;\n---\n<p>{a}</p>\n<span> · </span>\n')).toEqual([]);
  });

  it('reads a visitor string from a named constant in the frontmatter', () => {
    const source = '---\nconst EMPTY_MESSAGE = "No sale is running now.";\n---\n<p>x</p>\n';
    expect(texts(source)).toEqual(['No sale is running now.']);
  });

  it('leaves an identifier-shaped constant alone', () => {
    const source = '---\nconst ROUTE = "/games";\nconst KEY = "marketCode";\n---\n<p>x</p>\n';
    expect(texts(source)).toEqual([]);
  });

  it('reports an offset that points back into the source', () => {
    const source = '---\nconst a = 1;\n---\n<p>Nothing here yet.</p>\n';
    const units = extractStrings(source, 'a.astro');
    expect(source.slice(units[0]!.start, units[0]!.start + 7)).toBe('Nothing');
  });
});

describe('extractStrings, on a React island', () => {
  it('returns the text of an element', () => {
    const source = 'export const A = () => <p>Open the menu.</p>;\n';
    expect(texts(source, 'a.tsx')).toEqual(['Open the menu.']);
  });

  it('returns an accessible name and leaves a machine attribute alone', () => {
    const source = 'export const A = () => <button aria-label="Close the menu" type="button" />;\n';
    expect(texts(source, 'a.tsx')).toEqual(['Close the menu']);
  });

  it('reads a visitor string from a named constant', () => {
    const source = 'const MENU_LABEL = "Open the main menu";\nexport const A = MENU_LABEL;\n';
    expect(texts(source, 'a.tsx')).toEqual(['Open the main menu']);
  });
});

describe('extractStrings, on a plain module', () => {
  it('reads the values of a visitor-facing table', () => {
    const source = 'const ADVICE = {\n  page: "Page numbers start at 1.",\n};\n';
    expect(texts(source, 'a.ts')).toEqual(['Page numbers start at 1.']);
  });

  it('leaves an identifier-shaped value alone', () => {
    const source = 'const SORT = { best: "bestDiscount", newest: "releasedAt" };\n';
    expect(texts(source, 'a.ts')).toEqual([]);
  });
});

describe('stringCoverage', () => {
  it('reports full support for the shapes the extractor reads', () => {
    expect(stringCoverage('a.astro')).toBe('full');
    expect(stringCoverage('a.tsx')).toBe('full');
    expect(stringCoverage('a.ts')).toBe('full');
  });

  it('reports no support for a file shape it cannot parse', () => {
    expect(stringCoverage('a.json')).toBe('none');
  });
});
