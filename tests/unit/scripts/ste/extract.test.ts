import { describe, expect, it } from 'vitest';

import {
  commentCoverage,
  declaredProseKind,
  extractComments,
  extractMarkdown,
} from '../../../../scripts/ste/extract.mjs';

/**
 * Which parts of a file are prose at all.
 *
 * A fenced block, front matter and an HTML comment are not prose, so the
 * extractor drops them before any rule runs. An ordered list item is a step,
 * which is how the checker separates a procedure from a description.
 */

const kinds = (source: string): string[] => extractMarkdown(source).map((unit) => unit.kind);
const texts = (source: string): string[] => extractMarkdown(source).map((unit) => unit.text.trim());

describe('extractMarkdown', () => {
  it('returns a paragraph as one unit', () => {
    expect(texts('One sentence here.\n')).toEqual(['One sentence here.']);
  });

  it('joins the wrapped lines of one paragraph', () => {
    expect(texts('One sentence\nover two lines.\n')).toEqual(['One sentence\nover two lines.']);
  });

  it('separates two paragraphs', () => {
    expect(texts('First one.\n\nSecond one.\n')).toEqual(['First one.', 'Second one.']);
  });

  it('drops a fenced code block', () => {
    expect(texts('Before.\n\n```js\nconst it = "not prose";\n```\n\nAfter.\n')).toEqual([
      'Before.',
      'After.',
    ]);
  });

  it('drops a fence that a tilde opens', () => {
    expect(texts('Before.\n\n~~~\nraw\n~~~\n\nAfter.\n')).toEqual(['Before.', 'After.']);
  });

  it('drops front matter', () => {
    expect(texts('---\nname: thing\n---\n\nProse here.\n')).toEqual(['Prose here.']);
  });

  it('drops an HTML comment', () => {
    expect(texts('<!-- hidden note -->\n\nProse here.\n')).toEqual(['Prose here.']);
  });

  it('marks a heading as its own unit', () => {
    expect(kinds('## A heading\n\nBody text.\n')).toEqual(['heading', 'paragraph']);
  });

  it('marks an ordered list item as procedural and a bullet as descriptive', () => {
    const units = extractMarkdown('1. Open the file.\n\n- A described thing.\n');
    expect(units[0]?.prose).toBe('procedural');
    expect(units[1]?.prose).toBe('descriptive');
  });

  it('returns each list item as its own unit', () => {
    expect(texts('- one\n- two\n')).toEqual(['one', 'two']);
  });

  it('returns each table cell as its own unit', () => {
    const units = extractMarkdown('| Rule | Meaning |\n| --- | --- |\n| A | It applies. |\n');
    expect(units.every((unit) => unit.kind === 'table-cell')).toBe(true);
    expect(units.map((unit) => unit.text.trim())).toContain('It applies.');
  });

  it('keeps a block quote under control rather than exempting it', () => {
    expect(kinds('> A quoted claim.\n')).toEqual(['blockquote']);
  });

  it('reports an offset that points back into the source', () => {
    const source = 'First.\n\nSecond.\n';
    const units = extractMarkdown(source);
    expect(source.slice(units[1]!.start, units[1]!.start + 7)).toBe('Second.');
  });
});

describe('extractComments', () => {
  it('returns a line comment', () => {
    const units = extractComments('// A reason.\nconst a = 1;\n', 'a.ts');
    expect(units.map((unit) => unit.text.trim())).toEqual(['A reason.']);
  });

  it('joins a run of line comments into one unit', () => {
    const units = extractComments('// One reason\n// over two lines.\nconst a = 1;\n', 'a.ts');
    expect(units).toHaveLength(1);
    expect(units[0]?.text.trim()).toBe('One reason\nover two lines.');
  });

  it('returns a documentation comment without its markers', () => {
    const units = extractComments('/**\n * A contract.\n */\nexport const a = 1;\n', 'a.ts');
    expect(units[0]?.text.trim()).toBe('A contract.');
    expect(units[0]?.kind).toBe('doc-comment');
  });

  it('returns a trailing line comment after code', () => {
    const units = extractComments('const a = 1; // A durable reason.\n', 'a.ts');
    expect(units.map((unit) => unit.text.trim())).toEqual(['A durable reason.']);
  });

  it('returns an inline block comment after code', () => {
    const units = extractComments('const a = 1; /* A durable reason. */\n', 'a.ts');
    expect(units.map((unit) => unit.text.trim())).toEqual(['A durable reason.']);
  });

  it('ignores a comment marker inside a string', () => {
    expect(extractComments('const a = "// not a comment";\n', 'a.ts')).toEqual([]);
  });

  it('ignores a comment marker inside a template literal', () => {
    expect(extractComments('const a = `http://example.com`;\n', 'a.ts')).toEqual([]);
  });

  it('ignores a tooling directive comment', () => {
    expect(extractComments('// eslint-disable-next-line no-console\n', 'a.ts')).toEqual([]);
  });

  it('reads the frontmatter of an Astro component', () => {
    const units = extractComments(
      '---\n// A reason.\nconst a = 1;\n---\n<p>Hello</p>\n',
      'a.astro',
    );
    expect(units.map((unit) => unit.text.trim())).toEqual(['A reason.']);
  });

  it('reports an offset that points back into the source', () => {
    const source = 'const a = 1;\n// A reason.\n';
    const units = extractComments(source, 'a.ts');
    expect(source.slice(units[0]!.start, units[0]!.start + 2)).toBe('//');
  });
});

describe('extractComments, on what it must not join or drop', () => {
  it('does not join two comment runs that are apart', () => {
    const source = '// One sentence.\nconst a = 1;\n\n// Another sentence.\nconst b = 2;\n';
    expect(extractComments(source, 'a.ts')).toHaveLength(2);
  });

  it('keeps prose that begins with a word a directive also begins with', () => {
    const units = extractComments('// globals and no type-aware rules.\n', 'a.ts');
    expect(units.map((one) => one.text.trim())).toEqual(['globals and no type-aware rules.']);
  });

  it('still drops a real directive comment', () => {
    expect(extractComments('/* globals structuredClone: readonly */\n', 'a.ts')).toEqual([]);
  });

  it('reports how much of a file its comments cover', () => {
    expect(commentCoverage('const a = 1;\n', 'a.ts')).toBe('full');
    expect(commentCoverage('---\nconst a = 1;\n---\n<p>x</p>\n', 'a.astro')).toBe('full');
    expect(commentCoverage('<p>x</p>\n', 'a.astro')).toBe('none');
  });

  it('reads a comment from an Astro template as well as its frontmatter', () => {
    const source = '---\n// A reason.\n---\n<p>x</p>\n{/* A template reason. */}\n';
    expect(extractComments(source, 'a.astro').map((one) => one.text.trim())).toEqual([
      'A reason.',
      'A template reason.',
    ]);
  });

  it('reads a template comment when the component has no frontmatter', () => {
    const source = '<p>x</p>\n{/* Only a template reason. */}\n';
    expect(extractComments(source, 'a.astro').map((one) => one.text.trim())).toEqual([
      'Only a template reason.',
    ]);
  });

  it('reports an offset in a template comment that points back into the source', () => {
    const source = '---\nconst a = 1;\n---\n<p>x</p>\n{/* A template reason. */}\n';
    const units = extractComments(source, 'a.astro');
    const template = units.find((one) => one.text.includes('template reason'));
    expect(source.slice(template!.start, template!.start + 2)).toBe('/*');
  });
});

describe('extractMarkdown, on a fence inside a list item', () => {
  it('drops the fenced block and keeps the item text', () => {
    const units = extractMarkdown(
      '- Run this:\n\n  ```sql\n  SELECT one FROM two WHERE three;\n  ```\n',
    );
    expect(units.map((one) => one.text.trim())).toEqual(['Run this:']);
  });
});

/**
 * A document says which kind of prose it holds.
 *
 * Markdown numbering is a layout choice, so it cannot decide which sentence
 * limit applies. A document states its own kind in front matter, and a heading
 * states it for the section that follows.
 */
describe('declaredProseKind', () => {
  it('reads the kind from front matter', () => {
    expect(declaredProseKind('---\nste-prose: procedural\n---\n\nOpen it.\n')).toBe('procedural');
    expect(declaredProseKind('---\nste-prose: descriptive\n---\n\nIt is open.\n')).toBe(
      'descriptive',
    );
  });

  it('returns null when the document declares nothing', () => {
    expect(declaredProseKind('# A title\n\nBody.\n')).toBeNull();
    expect(declaredProseKind('---\nname: thing\n---\n\nBody.\n')).toBeNull();
  });

  it('ignores a value that is not one of the two kinds', () => {
    expect(declaredProseKind('---\nste-prose: whatever\n---\n\nBody.\n')).toBeNull();
  });

  it('reads the key only from real front matter', () => {
    expect(declaredProseKind('Body.\n\nste-prose: procedural\n')).toBeNull();
  });
});

describe('extractMarkdown, on a section that declares its own kind', () => {
  it('carries a section declaration to every unit under it', () => {
    const units = extractMarkdown(
      '## Reference <!-- ste-prose: descriptive -->\n\n1. The first field is the identifier.\n\n## Setup\n\n1. Open the file.\n',
    );
    const reference = units.filter((one) => one.text.includes('first field'));
    const setup = units.filter((one) => one.text.includes('Open the file'));
    expect(reference[0]?.declaredProse).toBe('descriptive');
    expect(setup[0]?.declaredProse).toBeNull();
  });

  it('keeps the list-shape estimate separate from the declaration', () => {
    const units = extractMarkdown(
      '## Reference <!-- ste-prose: descriptive -->\n\n1. The first field is the identifier.\n',
    );
    const item = units.filter((one) => one.kind === 'list-item');
    expect(item[0]?.prose).toBe('procedural');
    expect(item[0]?.declaredProse).toBe('descriptive');
  });

  it('keeps the declaration out of the measured text', () => {
    const units = extractMarkdown('## Setup <!-- ste-prose: procedural -->\n\nOpen it.\n');
    expect(units[0]?.text.trim()).toBe('Setup');
  });

  it('ends a section declaration at the next heading of the same depth or higher', () => {
    const units = extractMarkdown(
      '## Reference <!-- ste-prose: descriptive -->\n\n### Detail\n\nA field.\n\n## After\n\nOpen it.\n',
    );
    const detail = units.filter((one) => one.text.includes('A field'));
    const after = units.filter((one) => one.text.includes('Open it'));
    expect(detail[0]?.declaredProse).toBe('descriptive');
    expect(after[0]?.declaredProse).toBeNull();
  });
});
