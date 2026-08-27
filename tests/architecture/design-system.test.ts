import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '../helpers/imports.js';

/**
 * Guards the two design-system rules that a reimplementation loses first.
 *
 * A token layer only holds if nothing bypasses it. One hard-coded `#2D2A26` is
 * invisible in review. It surfaces only when someone switches theme, or when a
 * token is retuned and one component silently does not follow. A per-component
 * focus ring looks fine in isolation and produces an inconsistent, sometimes
 * invisible, focus indicator across the product.
 *
 * Both are stated as rules in the handoff, which is why they are asserted
 * rather than reviewed. `design/system/guidelines/component-states.md` says
 * focus "is one global rule ... No component overrides it". Also,
 * `design/README.md` calls never-color-alone "the system's hardest rule and
 * the one most often lost in reimplementation".
 */

// tests/architecture -> tests -> repository root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where product UI lives. The token layer itself is deliberately not here. */
const UI_DIRECTORIES = ['src/components', 'src/layouts', 'src/pages'];

/**
 * A CSS hex color, not an anchor.
 *
 * The lookbehind excludes `href="#main"` and friends: an id reference is
 * preceded by a quote or `=`, a color never is.
 */
const HEX_COLOUR = /(?<![\w"'=#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const FUNCTIONAL_COLOUR = /\b(?:rgba?|hsla?|oklch|color-mix)\s*\(/g;
/**
 * Every way a component can take the focus indicator into its own hands.
 *
 * Not just `:focus-visible`. An accessibility review found two breaches in one
 * component that the narrower pattern missed. The first was a `:focus-within`
 * box-shadow that put a second, concentric ring around one control. The second
 * was a bare `outline: none` that was inert only because the cascade happened
 * to order the global rule after it. Both look local and harmless. Together
 * they produce a focus indicator that changes shape as a keyboard operator
 * moves across the page. That is the exact failure the one-rule policy exists
 * to prevent.
 */
const FOCUS_OVERRIDE = /:focus-visible|:focus-within|outline\s*:\s*none/g;

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;

/**
 * The rule is about declarations, not prose.
 *
 * A comment recording that near-black on `#E8A33D` measures 9.2:1 is the kind
 * of note this codebase wants - it is the evidence behind a decision. Only a
 * value the browser will act on is a bypass.
 */
function stripComments(source: string): string {
  return source.replace(BLOCK_COMMENT, '').replace(HTML_COMMENT, '').replace(LINE_COMMENT, '$1');
}

/**
 * Every file that can style something, including plain `.css`.
 *
 * `listSourceFiles` deliberately answers "what does the import graph contain",
 * so it looks at `.ts`, `.tsx` and `.astro` only. That is the wrong question
 * here, and the gap was real. A React island cannot use Astro's scoped
 * `<style>`, so `AppHeader.css` exists as a plain stylesheet. Both focus
 * breaches an accessibility review found were in it, unscanned.
 */
function uiFiles(): string[] {
  return UI_DIRECTORIES.filter((directory) => existsSync(join(REPO_ROOT, directory))).flatMap(
    (directory) => [
      ...listSourceFiles(directory),
      ...stylesheetsIn(join(REPO_ROOT, directory), directory),
    ],
  );
}

function stylesheetsIn(absolute: string, relative: string): string[] {
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = `${relative}/${entry.name}`;
    if (entry.isDirectory()) return stylesheetsIn(join(absolute, entry.name), child);
    return entry.name.endsWith('.css') ? [child] : [];
  });
}

const read = (file: string): string => readFileSync(join(REPO_ROOT, file), 'utf8');

function matchesIn(source: string, pattern: RegExp): string[] {
  return stripComments(source).match(pattern) ?? [];
}

function offenders(pattern: RegExp): string[] {
  return uiFiles().flatMap((file) =>
    matchesIn(read(file), pattern).map((match) => `${file}: ${match}`),
  );
}

describe('the guard can actually fire', () => {
  // Synthetic sources. Every assertion below runs against a clean tree, so
  // without these the whole file could be a no-op and look green.
  it.each([
    ['a hex colour in a style block', '<style>.a { color: #2d2a26; }</style>', HEX_COLOUR],
    ['a short hex colour', '<style>.a { color: #fff; }</style>', HEX_COLOUR],
    ['a hex colour in an inline style', '<span style="color:#2d2a26">x</span>', HEX_COLOUR],
    ['an rgba colour', '<style>.a { color: rgba(0,0,0,.5); }</style>', FUNCTIONAL_COLOUR],
    [
      'a per-component focus ring',
      '<style>.a:focus-visible { border: 0; }</style>',
      FOCUS_OVERRIDE,
    ],
    [
      'a second ring via focus-within',
      '<style>.a:focus-within { box-shadow: 0 0 0 2px; }</style>',
      FOCUS_OVERRIDE,
    ],
    ['an outline removal', '<style>.a { outline: none; }</style>', FOCUS_OVERRIDE],
  ])('reports %s', (_label, source, pattern) => {
    expect(matchesIn(source, pattern)).toHaveLength(1);
  });

  it.each([
    ['an anchor reference', '<a href="#main">Skip</a>'],
    ['a hex quoted in a line comment', '// near-black on #E8A33D clears 9.2:1'],
    ['a hex quoted in a block comment', '/* the amber tile is #E8A33D */'],
    ['a hex quoted in markup comment', '<!-- was #E8A33D before the retune -->'],
  ])('does not report %s', (_label, source) => {
    expect(matchesIn(source, HEX_COLOUR)).toEqual([]);
  });
});

describe('the design token layer is not bypassed', () => {
  it('scanned enough UI to be meaningful', () => {
    // Without this the rules below pass on an empty tree, which is exactly
    // the state this test was written in.
    expect(uiFiles().length).toBeGreaterThanOrEqual(10);
  });

  it('no component, layout or page declares a raw colour', () => {
    // Every color in this product exists as a semantic token with a value per
    // theme. A literal here is a value that belongs to one theme only.
    expect(offenders(HEX_COLOUR)).toEqual([]);
    expect(offenders(FUNCTIONAL_COLOUR)).toEqual([]);
  });

  it('only the token layer defines the focus ring', () => {
    // `:focus-visible` is set once, globally, in src/styles/tokens/base.css.
    // A component that restyles it produces a focus indicator that changes
    // shape as a keyboard operator moves through the page.
    expect(offenders(FOCUS_OVERRIDE)).toEqual([]);
    expect(readFileSync(join(REPO_ROOT, 'src/styles/tokens/base.css'), 'utf8')).toContain(
      ':focus-visible',
    );
  });

  it('no UI file loads a font or stylesheet from a third party', () => {
    // Performance is a product feature (PRODUCT.md section 91) and a
    // third-party request on the critical path also hands that party the
    // visitor's IP address.
    for (const file of uiFiles()) {
      expect(read(file)).not.toContain('fonts.googleapis.com');
      expect(read(file)).not.toContain('fonts.gstatic.com');
    }
  });
});

describe('every component has a consumer', () => {
  /**
   * A component nobody renders is the speculative surface `AGENTS.md` rules
   * out, and it is worse than dead code in one specific way: it looks
   * finished. Someone reaching for it later finds a primitive nothing has ever
   * rendered. Nobody has seen it in either theme, and it has never been through
   * the accessibility gate. They trust it because it sits in the design system
   * next to the ones that have.
   *
   * This has already happened once here. Five primitives shipped with no
   * importer. The reason is that a React island cannot import an Astro
   * component, so the header reimplemented their geometry instead. That left
   * two copies of the brand mark, one of which nothing rendered.
   */
  it('is imported by something, somewhere in src/', () => {
    const componentFiles = listSourceFiles('src/components').filter(
      (file) => /\/[A-Z]/.test(file) && !file.endsWith('.css'),
    );
    expect(componentFiles.length).toBeGreaterThanOrEqual(5);

    const orphans = componentFiles.filter((file) => {
      // `group/Name` is how every import of it is written, from a page or from
      // a sibling alike. Matching the path rather than the bare name avoids
      // counting prose in a comment as a use.
      const importPath = file.split('/').slice(-2).join('/').replace(/.w+$/, '');

      return !listSourceFiles('src')
        .filter((candidate) => candidate !== file)
        .some((candidate) => readFileSync(join(REPO_ROOT, candidate), 'utf8').includes(importPath));
    });

    expect(orphans).toEqual([]);
  });
});
