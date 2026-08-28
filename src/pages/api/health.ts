import type { APIRoute } from 'astro';

import { BUILD_INFO } from '../../lib/build-info.js';
import { verifyBackendReadiness, wantsBackendReadiness } from '../../lib/health/readiness.js';

// Without this the route can be frozen at build time. Freezing pins both the version and a
// build-time request id into a response that then never changes.
export const prerender = false;

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, no-cache, must-revalidate',
  'x-content-type-options': 'nosniff',
};

/**
 * Liveness probe by default. A staging deploy can also request the backend probe.
 * The backend probe returns 503 when a required read fails.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const base = {
    service: 'ludwise-web',
    version: BUILD_INFO.version,
    environment: locals.config.environment,
    request_id: locals.requestId,
  };

  if (!wantsBackendReadiness(locals.config.environment, url)) {
    return new Response(JSON.stringify({ status: 'ok', ...base }), {
      status: 200,
      headers: HEADERS,
    });
  }

  try {
    await verifyBackendReadiness(locals.backend());
    return new Response(JSON.stringify({ status: 'ok', backend: 'ok', ...base }), {
      status: 200,
      headers: HEADERS,
    });
  } catch {
    return new Response(JSON.stringify({ status: 'error', backend: 'unavailable', ...base }), {
      status: 503,
      headers: HEADERS,
    });
  }
};
