import type { APIRoute } from 'astro';

// A route, not a file in public/: the answer differs by environment. Workers
// Assets serves public/ without invoking the Worker, so a robots.txt there would
// be identical on staging and production. The one thing it must not be.
export const prerender = false;

// Written out rather than assembled: robots.txt has no formal grammar, crawlers
// disagree about its edges, and the whole file is four lines. Seeing both
// versions side by side beats not repeating `User-agent: *`.
const DISALLOW_EVERYTHING = 'User-agent: *\nDisallow: /\n';
const ALLOW_EVERYTHING = 'User-agent: *\nAllow: /\n';

/**
 * Tells crawlers whether this deployment is meant to be indexed.
 *
 * Not a security control, and nothing here is written as though it were.
 * Staging is kept private by Cloudflare Access. This only means that a staging
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
