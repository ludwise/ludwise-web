import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { ADOPTED_SUBSET, ALREADY_ADOPTED, EXCLUDED_COMPONENTS } from '../helpers/design-subset.js';
import { listSourceFiles } from '../helpers/imports.js';

/**
 * Pins which of the 44 design-system primitives this repository holds.
 *
 * Issue #77 adopts a subset of 20 and excludes 12, each exclusion for a stated
 * reason: no data in the contract, no surface that needs it, or a decision
 * another issue already took. Neither half survives as prose. A missing
 * primitive is found by whoever needs it, at the worst moment. An excluded one
 * reappears because its markdown file sits beside the ones that shipped, and
 * nothing says it must not.
 *
 * The island split is asserted for the same reason. It is a performance
 * decision, and design/README.md states it per component. A static primitive
 * written as a React island reads as an ordinary choice in review.
 */

// tests/architecture -> tests -> repository root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A component file, as opposed to a helper module or a stylesheet. */
const COMPONENT_FILE = /\/[A-Z][A-Za-z]*\.(?:astro|tsx)$/;

function componentFiles(): string[] {
  return listSourceFiles('src/components').filter((file) => COMPONENT_FILE.test(file));
}

const read = (file: string): string => readFileSync(join(REPO_ROOT, file), 'utf8');

describe('the design-system subset', () => {
  it.each(ADOPTED_SUBSET)('$name exists at $file', ({ file }) => {
    expect(existsSync(join(REPO_ROOT, file))).toBe(true);
  });

  it('holds nothing under src/components/ that is not accounted for', () => {
    // Every component file is either a subset member, adopted earlier, or a
    // composition this repository owns rather than a design-system primitive.
    const local = [
      'src/components/game/OfferTable.astro',
      'src/components/layout/PageContainer.astro',
      'src/components/legal/Policy.astro',
      'src/components/legal/PolicyHeader.astro',
      'src/components/legal/PolicyToc.astro',
      'src/components/navigation/SiteFooter.astro',
    ];
    const accounted = [
      ...ADOPTED_SUBSET.map((component) => component.file),
      ...ALREADY_ADOPTED.map((component) => component.file),
      ...local,
    ].sort();

    expect(componentFiles()).toEqual(accounted);
  });

  it('cites its reference specification in every adopted component', () => {
    // The prop contract is the API. A component that does not name the section
    // it was ported from cannot be reviewed against it.
    for (const { file } of ADOPTED_SUBSET) {
      expect(read(file), file).toContain('design/system/components/');
    }
  });
});

describe('the island split', () => {
  it.each(ADOPTED_SUBSET)('$name is a $kind component', ({ file, kind }) => {
    // design/README.md: a static primitive is `.astro` with zero client
    // JavaScript, an island is `.tsx` behind an explicit `client:` directive.
    expect(file.endsWith(kind === 'island' ? '.tsx' : '.astro')).toBe(true);
  });
});

describe('the excluded primitives', () => {
  it.each(EXCLUDED_COMPONENTS)('%s does not exist', (name) => {
    // Each exclusion has a reason on issue #77. Porting one means answering
    // that reason first, and this list is where the answer gets recorded.
    const present = componentFiles().filter(
      (file) => file.endsWith(`/${name}.astro`) || file.endsWith(`/${name}.tsx`),
    );
    expect(present).toEqual([]);
  });

  it('names a component the guard would actually catch', () => {
    // Without this the rule above passes on a typo in every entry.
    const adopted = ADOPTED_SUBSET.map((component) => component.name);
    expect(EXCLUDED_COMPONENTS.some((name) => adopted.includes(name))).toBe(false);
    expect(componentFiles().some((file) => file.endsWith('/Button.astro'))).toBe(true);
  });
});
