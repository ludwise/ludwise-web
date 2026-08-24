import type { APIRoute } from 'astro';

// A route rather than a file in public/, because the answer differs by
// environment and a static file cannot. public/ is served by Workers Assets
// without invoking the Worker at all, so a robots.txt placed there would be
// identical on staging and production - which is the one thing it must not be.
export const prerender = false;

// Written out rather than assembled from parts. robots.txt has no formal
// grammar, crawlers disagree about the edges of it, and the whole file is four
// lines: seeing both versions side by side is worth more than not repeating
// `User-agent: *`.
const DISALLOW_EVERYTHING = 'User-agent: *\nDisallow: /\n';
const ALLOW_EVERYTHING = 'User-agent: *\nAllow: /\n';

/**
 * Tells crawlers whether this deployment is meant to be indexed.
 *
 * Not a security control, and nothing here is written as though it were.
 * Staging is kept private by Cloudflare Access; this only means that a staging
 * page which somehow does reach a crawler - a link in a public issue, a proxy
 * that strips the Access cookie - is not indexed on top of it. A crawler that
 * ignores this file is not doing anything wrong.
 *
 * Deliberately lists no paths. A disallow list naming real routes is a public
 * index of the routes somebody thought were worth hiding.
 *
 * No `Sitemap:` line: there is no sitemap yet, and pointing at one that 404s is
 * worse than saying nothing. It belongs here when one exists.
 */
export const GET: APIRoute = ({ locals }) =>
  new Response(
    locals.config.environment === 'production' ? ALLOW_EVERYTHING : DISALLOW_EVERYTHING,
    {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    },
  );
