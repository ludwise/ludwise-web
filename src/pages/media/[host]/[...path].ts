import type { APIRoute } from 'astro';

// Without this the route can be frozen at build time. That bakes one upstream
// answer into the deployment until the next build.
export const prerender = false;

/**
 * The LUDWISE media route. Every decision it makes lives in `src/lib/media/`.
 *
 * Only the two path parameters are passed on, and never the visitor's request.
 * So no header, cookie or address here can reach a provider.
 */
export const GET: APIRoute = ({ locals, params }) =>
  locals.media().serve({ host: params.host ?? '', path: params.path ?? '' });
