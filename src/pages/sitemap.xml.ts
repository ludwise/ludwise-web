import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getRelativeLocaleUrl } from 'astro:i18n';

import { assertLegalPolicies, legalPolicyLocale } from '../lib/legal/policies.js';
import { sitemapEntries, sitemapXml } from '../lib/seo/sitemap.js';

export const prerender = false;

/**
 * The sitemap of the stable route set, built at request time.
 *
 * It answers in every environment, so the tests can read it before the cutover.
 * Only the production `robots.txt` body offers it to a crawler.
 */
export const GET: APIRoute = async ({ locals }) => {
  const policies = await getCollection('legal');
  assertLegalPolicies(policies);

  const body = sitemapXml(
    sitemapEntries({
      siteUrl: locals.config.siteUrl,
      policies,
      production: locals.config.environment === 'production',
      legalPath: (policy) =>
        getRelativeLocaleUrl(legalPolicyLocale(policy), `legal/${policy.data.policyId}`),
    }),
  );

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      // The body is anonymous and the same for every visitor, so a cache can keep it for an hour.
      'cache-control': 'public, max-age=3600',
    },
  });
};
