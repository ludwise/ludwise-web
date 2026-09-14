import { describe, expect, it } from 'vitest';

import { baseLocale } from '../../../src/i18n/index.js';
import { sitemapEntries, sitemapXml, type SitemapPolicy } from '../../../src/lib/seo/sitemap.js';

const SITE_URL = 'https://ludwise.test';

const policy = (
  policyId: string,
  overrides: Partial<SitemapPolicy['data']> & { locale?: string } = {},
): SitemapPolicy => {
  const { locale = baseLocale, ...data } = overrides;
  return {
    id: `${locale}/${policyId}`,
    data: {
      policyId,
      translationStatus: 'source',
      footer: true,
      order: 10,
      status: 'current',
      version: '2026-08-28',
      lastUpdated: new Date('2026-09-10T00:00:00.000Z'),
      ...data,
    },
  };
};

const legalPath = (entry: SitemapPolicy): string => `/legal/${entry.data.policyId}`;

describe('sitemapEntries', () => {
  it('lists the home page, the catalogue and the sales page, and no game page', () => {
    expect(
      sitemapEntries({ siteUrl: SITE_URL, policies: [], production: true, legalPath }),
    ).toEqual([
      { loc: 'https://ludwise.test/' },
      { loc: 'https://ludwise.test/games' },
      { loc: 'https://ludwise.test/sales' },
    ]);
  });

  it('adds each legal policy that production serves, dated by its last update', () => {
    const entries = sitemapEntries({
      siteUrl: SITE_URL,
      policies: [
        policy('privacy', { order: 20, lastUpdated: new Date('2026-09-09T00:00:00.000Z') }),
        policy('terms', { order: 10 }),
        policy('cookies', { status: 'draft' }),
        policy('sources', { status: 'superseded' }),
      ],
      production: true,
      legalPath,
    });

    expect(entries.slice(3)).toEqual([
      { loc: 'https://ludwise.test/legal/terms', lastmod: new Date('2026-09-10T00:00:00.000Z') },
      { loc: 'https://ludwise.test/legal/privacy', lastmod: new Date('2026-09-09T00:00:00.000Z') },
    ]);
  });

  it('adds a draft policy outside production, where the legal route serves it too', () => {
    const entries = sitemapEntries({
      siteUrl: SITE_URL,
      policies: [policy('cookies', { status: 'draft' })],
      production: false,
      legalPath,
    });

    expect(entries.map((entry) => entry.loc)).toContain('https://ludwise.test/legal/cookies');
  });

  it('lists a policy once, whatever number of translations it has', () => {
    const entries = sitemapEntries({
      siteUrl: SITE_URL,
      policies: [
        policy('terms'),
        policy('terms', {
          locale: 'cs',
          translationStatus: 'approved',
          sourceVersion: '2026-08-28',
        }),
      ],
      production: true,
      legalPath,
    });

    expect(entries.filter((entry) => entry.loc.endsWith('/legal/terms'))).toHaveLength(1);
  });

  it('resolves each address against an origin that ends with a slash', () => {
    const entries = sitemapEntries({
      siteUrl: 'https://ludwise.test/',
      policies: [],
      production: true,
      legalPath,
    });

    expect(entries.map((entry) => entry.loc)).toContain('https://ludwise.test/games');
  });
});

describe('sitemapXml', () => {
  it('writes one url element with a loc element for each entry', () => {
    expect(
      sitemapXml([{ loc: 'https://ludwise.test/' }, { loc: 'https://ludwise.test/games' }]),
    ).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '<url><loc>https://ludwise.test/</loc></url>\n' +
        '<url><loc>https://ludwise.test/games</loc></url>\n' +
        '</urlset>\n',
    );
  });

  it('writes a lastmod element as a calendar date only where the entry has one', () => {
    const xml = sitemapXml([
      { loc: 'https://ludwise.test/legal/terms', lastmod: new Date('2026-09-10T00:00:00.000Z') },
      { loc: 'https://ludwise.test/sales' },
    ]);

    expect(xml).toContain(
      '<url><loc>https://ludwise.test/legal/terms</loc><lastmod>2026-09-10</lastmod></url>',
    );
    expect(xml).toContain('<url><loc>https://ludwise.test/sales</loc></url>');
  });

  it('writes no changefreq element and no priority element', () => {
    const xml = sitemapXml([
      { loc: 'https://ludwise.test/legal/terms', lastmod: new Date('2026-09-10T00:00:00.000Z') },
    ]);

    expect(xml).not.toContain('changefreq');
    expect(xml).not.toContain('priority');
  });

  it('escapes the XML special characters in an address', () => {
    expect(sitemapXml([{ loc: 'https://ludwise.test/a?b=1&c=<2>' }])).toContain(
      '<loc>https://ludwise.test/a?b=1&amp;c=&lt;2&gt;</loc>',
    );
  });
});
