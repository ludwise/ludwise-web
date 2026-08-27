import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A drift guard between the vendored design-system bundle and the copy the
 * application actually loads.
 *
 * The handoff is explicit that the token layer is adopted verbatim: "Copy it,
 * keep the `@import` structure, change only the font loading" and "Do not
 * rename a token. If a name is wrong, raise it. Do not silently diverge." Two
 * copies of one file drift the moment someone tunes a color in whichever they
 * have open. The divergence is invisible until a designer reviews a page
 * and cannot say why it does not match.
 *
 * So this pins the whole custom-property surface - every name and value, in
 * order - rather than spot-checking. The one permitted divergence is the font
 * transport, asserted explicitly below rather than excluded quietly.
 */

// tests/integration/design -> tests/integration -> tests -> repository root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BUNDLE_TOKENS_DIR = join(REPO_ROOT, 'design', 'system', 'tokens');
const ADOPTED_TOKENS_DIR = join(REPO_ROOT, 'src', 'styles', 'tokens');
const BUNDLE_ENTRY = join(REPO_ROOT, 'design', 'system', 'styles.css');
const ADOPTED_ENTRY = join(REPO_ROOT, 'src', 'styles', 'global.css');

/** The one file the handoff instructs us to change, and the only one. */
const FONT_TRANSPORT_FILE = 'fonts.css';

/**
 * `base.css` carries the reset, the global `:focus-visible` rule and the
 * `.lw-text-*` utilities - it consumes tokens rather than declaring any. It is
 * named here rather than skipped silently so that the emptiness is asserted:
 * a token file that lost every declaration would otherwise satisfy a
 * "declarations match" comparison by matching nothing against nothing.
 */
const FILES_DECLARING_NO_CUSTOM_PROPERTIES = ['base.css'];

const CUSTOM_PROPERTY = /(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
const CSS_IMPORT = /@import\s+url\(\s*["']([^"']+)["']\s*\)/g;

/**
 * Every custom-property declaration in source order.
 *
 * Order matters and duplicates are kept: `color-semantic.css` declares each
 * token twice, once per theme, and a comparison that deduplicated them would
 * pass while the dark theme silently went missing.
 */
function declarations(css: string): string[] {
  const withoutComments = css.replace(CSS_COMMENT, '');
  return [...withoutComments.matchAll(CUSTOM_PROPERTY)].map(
    ([, name, value]) => `${name ?? ''}: ${(value ?? '').trim().replace(/\s+/g, ' ')}`,
  );
}

function imports(css: string): string[] {
  return [...css.replace(CSS_COMMENT, '').matchAll(CSS_IMPORT)].map(([, specifier]) => specifier ?? '');
}

function cssFilesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.css'))
    .map((entry) => entry.name)
    .sort();
}

const read = (path: string): string => readFileSync(path, 'utf8');

describe('design token parity with the vendored bundle', () => {
  it('adopts every token file the bundle ships, and no others', () => {
    expect(cssFilesIn(ADOPTED_TOKENS_DIR)).toEqual(cssFilesIn(BUNDLE_TOKENS_DIR));
  });

  // Pinned rather than derived, so that a token file which lost every
  // declaration cannot quietly join this set and start comparing nothing
  // against nothing.
  it('knows which bundle files declare no tokens at all', () => {
    const tokenFree = cssFilesIn(BUNDLE_TOKENS_DIR).filter(
      (file) => declarations(read(join(BUNDLE_TOKENS_DIR, file))).length === 0,
    );

    expect(tokenFree).toEqual(FILES_DECLARING_NO_CUSTOM_PROPERTIES);
  });

  it.each(cssFilesIn(BUNDLE_TOKENS_DIR))(
    'declares %s with the bundle names and values, in order',
    (file) => {
      const bundle = declarations(read(join(BUNDLE_TOKENS_DIR, file)));

      if (!FILES_DECLARING_NO_CUSTOM_PROPERTIES.includes(file)) {
        expect(bundle.length).toBeGreaterThan(0);
      }
      expect(declarations(read(join(ADOPTED_TOKENS_DIR, file)))).toEqual(bundle);
    },
  );

  it('keeps the entry point a list of imports in the bundle order', () => {
    expect(imports(read(ADOPTED_ENTRY))).toEqual(imports(read(BUNDLE_ENTRY)));
  });

  describe('the one permitted divergence: font transport', () => {
    it('serves fonts from this origin rather than Google Fonts', () => {
      const adopted = read(join(ADOPTED_TOKENS_DIR, FONT_TRANSPORT_FILE));

      // PRODUCT.md section 91 makes performance a product feature. A third-party
      // request on the critical path of every page contradicts that, and hands a
      // font vendor the visitor's IP on a site that sets no cookies of its own.
      expect(read(join(BUNDLE_TOKENS_DIR, FONT_TRANSPORT_FILE))).toContain('fonts.googleapis.com');
      expect(adopted).not.toContain('fonts.googleapis.com');
      expect(adopted).toContain('@font-face');
    });

    it('references only font files that are actually served', () => {
      const referenced = [
        ...read(join(ADOPTED_TOKENS_DIR, FONT_TRANSPORT_FILE)).matchAll(
          /url\(\s*['"]?(\/fonts\/[^'")]+)['"]?\s*\)/g,
        ),
      ].map(([, url]) => url ?? '');

      // A @font-face pointing at a missing file fails silently: the browser
      // falls back and the page merely looks slightly wrong, which is exactly
      // the kind of defect that survives review and reaches production.
      expect(referenced.length).toBeGreaterThan(0);
      for (const url of referenced) {
        expect(existsSync(join(REPO_ROOT, 'public', url.slice('/'.length)))).toBe(true);
      }
    });

    it('is the only file whose non-token content differs from the bundle', () => {
      const differing = cssFilesIn(BUNDLE_TOKENS_DIR).filter(
        (file) =>
          read(join(BUNDLE_TOKENS_DIR, file)).replace(CSS_COMMENT, '').trim() !==
          read(join(ADOPTED_TOKENS_DIR, file)).replace(CSS_COMMENT, '').trim(),
      );

      expect(differing).toEqual([FONT_TRANSPORT_FILE]);
    });
  });
});
