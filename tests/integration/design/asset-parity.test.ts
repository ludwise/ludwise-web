import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A drift guard between the vendored design-system bundle and the brand assets
 * the application serves, matching the one token-parity.test.ts places on the
 * token layer.
 *
 * The favicon is the logo mark, and the logo mark belongs to the handoff. Two
 * copies of a brand asset in one repository diverge the moment someone nudges
 * a colour in whichever one they have open, and the divergence is invisible
 * until a designer notices the browser tab does not match the header.
 *
 * Byte-identical rather than visually similar, for the same reason the tokens
 * are: "similar enough" has no failing case.
 */

// tests/integration/design -> tests/integration -> tests -> repository root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const BUNDLE_MARK = join(REPO_ROOT, 'design', 'system', 'assets', 'logo-mark.svg');
const SERVED_FAVICON = join(REPO_ROOT, 'public', 'favicon.svg');
const LAYOUT = join(REPO_ROOT, 'src', 'layouts', 'BaseLayout.astro');

describe('the served favicon', () => {
  it('is the design system logo mark, byte for byte', () => {
    expect(existsSync(SERVED_FAVICON)).toBe(true);
    expect(readFileSync(SERVED_FAVICON, 'utf8')).toBe(readFileSync(BUNDLE_MARK, 'utf8'));
  });

  it('is the colour mark, not the mono one', () => {
    // logo-mark-mono.svg paints its field with `currentColor`, which resolves
    // against nothing in a favicon request: the browser fetches the file on
    // its own, outside any document. It would render as a black square.
    expect(readFileSync(SERVED_FAVICON, 'utf8')).not.toContain('currentColor');
  });

  it('is declared by the document, so a browser does not have to guess', () => {
    // Without this the browser falls back to probing /favicon.ico, which this
    // repository does not serve, and the tab shows a blank page glyph.
    expect(readFileSync(LAYOUT, 'utf8')).toContain(
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    );
  });
});
