import type { APIRoute } from 'astro';

import { BUILD_INFO } from '../../lib/build-info.js';

// Without this the route can be frozen at build time, pinning both the version
// and a build-time request id into a response that then never changes.
export const prerender = false;

/**
 * Liveness probe.
 *
 * Always 200: if this handler ran, the Worker is alive, its configuration
 * validated - the middleware would have answered 503 otherwise - and the
 * rendering path works. That is the whole claim.
 *
 * It deliberately does **not** ask the backend anything, and the temptation to
 * is stronger here than it was before the split: this Worker now has a
 * dependency it could check, and a health endpoint that reported on it would
 * look more useful. It would be worse. A liveness probe that fails when a
 * dependency is slow turns one backend blip into "the site is down" in every
 * uptime monitor, and it hands any caller a free amplification primitive -
 * every unauthenticated hit becomes a backend request.
 *
 * Whether the backend is reachable is a readiness question and belongs to
 * whatever asks it deliberately, with its own budget and its own alerting.
 *
 * `git_commit` is omitted because nothing reads it here. It is already on every
 * log record, which is where an incident investigation looks for it.
 */
export const GET: APIRoute = ({ locals }) =>
  new Response(
    JSON.stringify({
      status: 'ok',
      service: 'ludwise-web',
      version: BUILD_INFO.version,
      environment: locals.config.environment,
      request_id: locals.requestId,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // A cached health response reports a stale version after a deploy,
        // which is worse than having no health endpoint at all.
        'cache-control': 'no-store, no-cache, must-revalidate',
        'x-content-type-options': 'nosniff',
      },
    },
  );
