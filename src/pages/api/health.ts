import type { APIRoute } from 'astro';

import { BUILD_INFO } from '../../lib/build-info.js';

// Without this the route can be frozen at build time, pinning both the version
// and a build-time request id into a response that then never changes.
export const prerender = false;

/**
 * Liveness probe.
 *
 * Always 200: if this handler ran, the Worker is alive, its configuration
 * validated, and the rendering path works. That is the whole claim.
 *
 * It deliberately asks the backend nothing. A liveness probe that fails when a
 * dependency is slow turns one blip into "the site is down" in every uptime
 * monitor, and hands any caller an amplification primitive - every
 * unauthenticated hit becoming a backend request. Reachability is a readiness
 * question, for whoever asks it with their own budget and alerting.
 *
 * `git_commit` is omitted because nothing reads it here; it is on every log
 * record already.
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
