/**
 * The sitemap of the stable route set.
 *
 * The sitemap holds no game page. The contract cannot list the game slugs at an
 * acceptable cost, and ludwise-web#78 records that decision.
 */

import { baseLocale } from '../../i18n/index.js';
import {
  selectServedLegalPolicies,
  type LegalPolicyData,
  type LegalPolicyEntry,
} from '../legal/policies.js';

/** The pages that every environment serves, in sitemap order. */
const STABLE_PATHS = ['/', '/games', '/sales'] as const;

/** A legal policy as the content collection holds it. */
export interface SitemapPolicy extends LegalPolicyEntry {
  readonly data: LegalPolicyData & { readonly lastUpdated: Date };
}

export interface SitemapSource<T extends SitemapPolicy> {
  /** The canonical origin, which the runtime configuration supplies. */
  readonly siteUrl: string;
  readonly policies: readonly T[];
  /** Selects the policies that production serves. */
  readonly production: boolean;
  /** The path of the legal route that serves a policy. */
  readonly legalPath: (policy: T) => string;
}

/** One address in the sitemap. */
export interface SitemapEntry {
  readonly loc: string;
  /** The date that the page content last changed. Only a legal policy has one. */
  readonly lastmod?: Date | undefined;
}

/**
 * The stable pages, and then each legal policy that the legal route serves.
 *
 * The legal entries come from the policy selection of the legal route, and
 * never from a list of paths.
 */
export function sitemapEntries<T extends SitemapPolicy>(source: SitemapSource<T>): SitemapEntry[] {
  const stable = STABLE_PATHS.map((path) => ({ loc: new URL(path, source.siteUrl).href }));

  const legal = selectServedLegalPolicies(source.policies, baseLocale, source.production).map(
    (policy) => ({
      loc: new URL(source.legalPath(policy), source.siteUrl).href,
      lastmod: policy.data.lastUpdated,
    }),
  );

  return [...stable, ...legal];
}

/** The sitemap document. No entry carries a `changefreq` or a `priority` element. */
export function sitemapXml(entries: readonly SitemapEntry[]): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map(urlElement).join('') +
    '</urlset>\n'
  );
}

function urlElement(entry: SitemapEntry): string {
  const lastmod =
    entry.lastmod === undefined ? '' : `<lastmod>${calendarDate(entry.lastmod)}</lastmod>`;
  return `<url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>\n`;
}

/** The UTC calendar date, because the content collection reads a date as UTC midnight. */
function calendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
