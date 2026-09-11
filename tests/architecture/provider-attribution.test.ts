import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '../helpers/imports.js';

/**
 * The credits that issue #58 makes a release condition.
 *
 * Each rule below is one acceptance criterion of that issue. The wording comes
 * from the resolution on issue #71. A credit is a duty to a provider and not a
 * preference. So it is pinned here, where a rewrite of a page cannot drop it
 * quietly.
 */

const FOOTER = 'src/components/navigation/SiteFooter.astro';
const BLOCK = 'src/components/game/DataSources.astro';
const GAME_PAGE = 'src/pages/games/[slug].astro';
const read = (file: string): string => readFileSync(file, 'utf8');

/**
 * The file with every run of whitespace collapsed.
 *
 * The formatter wraps a sentence in a template. A rule that read the raw bytes
 * would fail on a reflow that changed no word.
 */
const flat = (file: string): string => read(file).replace(/\s+/gu, ' ');

describe('the footer credit', () => {
  it('names both providers in the agreed wording', () => {
    const source = flat(FOOTER);

    expect(source).toContain('Game information comes from');
    expect(source).toContain('IGDB.com');
    expect(source).toContain('Store information comes from');
    expect(source).toContain('a Valve service');
  });

  it('denies any affiliation beside the credit', () => {
    expect(flat(FOOTER)).toContain('LUDWISE is not affiliated with IGDB, Twitch or Valve.');
  });

  it('sits outside every disclosure element', () => {
    expect(read(FOOTER)).not.toContain('<details');
  });

  it('renders on every page through the one layout', () => {
    // The footer credits the integration rather than the page, so it must not
    // depend on what a response carried.
    expect(read('src/layouts/BaseLayout.astro')).toContain('<SiteFooter');
  });
});

describe('the data sources page', () => {
  const SOURCES = 'src/content/legal/en/sources.md';

  it('is served, and not held back as a placeholder', () => {
    // A page marked draft returns 404 in production, and a placeholder
    // discharges no duty. Both facts make this front matter load-bearing.
    const source = read(SOURCES);

    expect(source).toContain('policyId: sources');
    expect(source).toContain('status: current');
    expect(source).toContain('footer: true');
    expect(source).toContain('navLabel: Data sources');
  });

  it('credits both providers and denies any affiliation', () => {
    const source = flat(SOURCES);

    expect(source).toContain('Game information on LUDWISE comes from IGDB.com.');
    expect(source).toContain('Store offers and prices come from Steam, a Valve service.');
    expect(source).toContain('LUDWISE is not affiliated with IGDB, Twitch or Valve.');
  });
});

describe('the game-page data sources block', () => {
  it('is rendered by the game page', () => {
    expect(read(GAME_PAGE)).toContain('<DataSources');
  });

  it('labels the three groups the resolution named', () => {
    const source = flat(BLOCK);

    expect(source).toContain('Data sources');
    expect(source).toContain('Game information');
    expect(source).toContain('Images and video');
    expect(source).toContain('Offers and prices');
  });

  it('sits outside every disclosure element', () => {
    // A credit behind a disclosure component is a weak answer to a visibility
    // duty. Issue #15 rewrites both source surfaces on this page, and this
    // block must survive that work in the open.
    expect(read(BLOCK)).not.toContain('<details');
  });
});

describe('every provider link', () => {
  it('carries no robots directive that Valve forbids', () => {
    // Valve forbids a link that discourages a search engine from following or
    // scoring it. The noopener, noreferrer and robots meta values are not
    // that, so this rule reads a link relationship alone.
    const linkRelationship = /rel\s*=\s*["'][^"']*nofollow/iu;
    const offenders = listSourceFiles('src').filter((file) =>
      linkRelationship.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
