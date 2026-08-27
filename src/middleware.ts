/**
 * The composition root.
 *
 * This file and `src/pages/**` are the only places permitted to import
 * `cloudflare:*`. Everything below receives what it needs as an argument.
 *
 * Four middlewares, in an order that is not arbitrary:
 *
 *     correlation -> configuration -> logging -> backend
 *
 * Correlation runs first and cannot fail, so a configuration failure still
 * produces a response carrying a request id. Configuration precedes logging
 * because the logger's level comes from it. The backend client is last
 * because it needs both the timeout and the correlation identifiers.
 */

// The supported way to reach a binding in this adapter. `Astro.locals.runtime`
// still exists but every one of its properties is a getter that throws:
// @astrojs/cloudflare removed it in Astro v6.
import { env } from 'cloudflare:workers';
import { defineMiddleware, sequence } from 'astro:middleware';

import { pageViewEvent } from './lib/analytics/events.js';
import { createAnalytics } from './lib/analytics/index.js';
import { createApiClient } from './lib/api/client.js';
import { ConfigError, type AppConfig, type Environment } from './lib/config/index.js';
import { getConfig } from './lib/config/read.js';
import {
  deriveCorrelation,
  formatTraceparent,
  REQUEST_ID_HEADER,
  TRACEPARENT_HEADER,
} from './lib/http/correlation.js';
import { isDocumentResponse } from './lib/http/response.js';
import { routeTemplate } from './lib/http/route.js';
import { withSecurityHeaders } from './lib/http/security-headers.js';
import { EVENTS } from './lib/logging/events.js';
import { operationalLogger } from './lib/logging/index.js';

const HEALTH_ROUTE = '/api/health';

/**
 * The origin the API client resolves paths against.
 *
 * Not a real address and not reachable. A service binding dispatches to the
 * bound script and ignores the host entirely, but `fetch` still requires an
 * absolute URL. So this exists to satisfy the URL parser. Written as a
 * `.invalid` name - reserved by RFC 2606 and guaranteed never to resolve - so
 * that a bug which somehow sent this over the network fails immediately and
 * loudly rather than reaching something real.
 */
const BINDING_ORIGIN = 'https://backend.invalid';

function withCorrelationHeaders(
  response: Response,
  derived: ReturnType<typeof deriveCorrelation>,
): Response {
  // A response served from a static asset can carry immutable headers, in which
  // case it is rebuilt rather than mutated. Throwing here would turn an asset
  // into a 500.
  if (response.status === 204 || response.status === 304) return response;
  try {
    response.headers.set(REQUEST_ID_HEADER, derived.requestId);
    response.headers.set(TRACEPARENT_HEADER, formatTraceparent(derived));
    return response;
  } catch {
    const headers = new Headers(response.headers);
    headers.set(REQUEST_ID_HEADER, derived.requestId);
    headers.set(TRACEPARENT_HEADER, formatTraceparent(derived));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
}

/**
 * Runs first and cannot fail, so that a configuration failure further down the
 * chain still produces a response carrying a request id.
 */
/**
 * The environment, or `undefined` when configuration never validated.
 *
 * `locals.config` is typed as always present because every handler runs after
 * the configuration middleware sets it - but this runs after `next()` has
 * unwound, which includes the path where configuration threw. Absent,
 * `withSecurityHeaders` withholds indexing rather than assuming production.
 */
function configuredEnvironment(context: { locals: App.Locals }): Environment | undefined {
  return (context.locals as { config?: AppConfig }).config?.environment;
}

const correlation = defineMiddleware(async (context, next) => {
  const derived = deriveCorrelation(context.request.headers);
  context.locals.requestId = derived.requestId;
  context.locals.traceId = derived.traceId;
  context.locals.spanId = derived.spanId;
  context.locals.traceparent = formatTraceparent(derived);
  context.locals.startedAt = Date.now();

  const response = withCorrelationHeaders(await next(), derived);

  // Applied in the outermost step so they land on every response, including the
  // configuration-failure 503 that returns before any later middleware runs.
  return withSecurityHeaders(response, configuredEnvironment(context));
});

/**
 * Validates configuration once per isolate.
 *
 * Returns a structured 503 rather than letting the isolate die at module
 * evaluation, which would produce an opaque platform error with no request id.
 *
 * The response names no field. `ConfigError.fields` names the settings of this
 * deployment, which is exactly the material that belongs in a log and not in a
 * response. The request id is what connects the two.
 */
const configuration = defineMiddleware(async (context, next) => {
  try {
    context.locals.config = getConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      operationalLogger().fatal(EVENTS.CONFIG_INVALID, 'Web configuration is invalid', {
        error,
        error_category: 'configuration',
        request_id: context.locals.requestId,
        invalid_fields: [...error.fields],
      });

      return new Response(
        JSON.stringify({
          status: 'error',
          code: error.code,
          request_id: context.locals.requestId,
        }),
        {
          status: 503,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-store',
            'x-content-type-options': 'nosniff',
          },
        },
      );
    }
    throw error;
  }
  return await next();
});

/**
 * Emits exactly one record per request.
 *
 * One rather than a started/completed pair: the pair doubles log volume against
 * the Workers Logs budget to convey what the completion record already carries.
 *
 * Raw URLs, query strings, cookies, authorization headers, user agent and
 * client IP are all deliberately absent. Only the route template is recorded -
 * `/games/[slug]` rather than the game somebody looked at.
 */
const logging = defineMiddleware(async (context, next) => {
  const config = context.locals.config;
  const logger = operationalLogger().child({
    request_id: context.locals.requestId,
    trace_id: context.locals.traceId,
    span_id: context.locals.spanId,
  });

  context.locals.logger = logger;
  context.locals.analytics = createAnalytics(config, logger);

  const { route, source } = routeTemplate({
    routePattern: (context as { routePattern?: string }).routePattern,
    url: context.url,
  });
  const method = context.request.method;
  // Assigned by the Cloudflare edge and not spoofable by the caller, unlike an
  // inbound request id. This is the join key back to Cloudflare's own logs.
  const cfRay = context.request.headers.get('cf-ray');

  try {
    const response = await next();
    const durationMs = Date.now() - context.locals.startedAt;

    // Uptime monitors poll health every few seconds. At info that is tens of
    // thousands of records a day of noise burying real traffic.
    const level =
      response.status >= 500
        ? 'error'
        : response.status >= 400
          ? 'warn'
          : route === HEALTH_ROUTE
            ? 'debug'
            : 'info';

    logger[level](
      EVENTS.HTTP_REQUEST_COMPLETED,
      `${method} ${route} -> ${String(response.status)}`,
      {
        method,
        route,
        route_source: source,
        status: response.status,
        duration_ms: durationMs,
        ...(cfRay ? { cf_ray: cfRay } : {}),
      },
    );
    return response;
  } catch (error) {
    logger.error(EVENTS.HTTP_REQUEST_FAILED, `${method} ${route} failed`, {
      error,
      error_category: 'unhandled',
      method,
      route,
      duration_ms: Date.now() - context.locals.startedAt,
    });
    // Rethrown deliberately: swallowing this turns a 500 into a blank 200.
    throw error;
  }
});

/**
 * Installs the backend client for this request.
 *
 * A thunk rather than a value, and memoised. Most responses - the health probe,
 * `robots.txt`, a 404 - never ask the backend anything, and building a client
 * eagerly would make an unbound `BACKEND` fail every request including the one
 * an operator uses to check whether the Worker is alive. A thunk can check and
 * throw where the failure belongs.
 *
 * The correlation identifiers are captured here rather than read later, so
 * every call this request makes carries the same pair. Two calls from one page
 * that reported different request ids would make the backend's records
 * unjoinable to the site's, which is the entire reason they are forwarded.
 */
const backend = defineMiddleware((context, next) => {
  let client: ReturnType<typeof createApiClient> | undefined;

  context.locals.backend = () => {
    if (client !== undefined) return client;

    const transport = resolveTransport(context.locals.config.environment);

    client = createApiClient({
      fetch: transport.fetch,
      baseUrl: transport.baseUrl,
      correlation: {
        requestId: context.locals.requestId,
        traceparent: context.locals.traceparent,
      },
      timeoutMs: context.locals.config.backendTimeoutMs,
    });
    return client;
  };

  return next();
});

/**
 * How this request reaches the backend, which differs in development alone.
 *
 * Deployed it is always the service binding: `BACKEND` names a Worker script,
 * not a URL, so nothing a mistyped variable could redirect (architecture decision record 0024).
 *
 * Locally, `wrangler dev` provides that binding whether or not anything runs
 * behind it. So a request over it fails with a 503 from Wrangler that looks
 * exactly like a backend outage. `BACKEND_DEV_URL` therefore wins in
 * development, pointing at a local backend or `scripts/fake-backend.ts`.
 *
 * The environment check is load-bearing and comes first: honoured outside
 * development, this would point the live site at an arbitrary origin on one
 * variable - the SSRF-shaped hole having no configurable URL avoids.
 */
function resolveTransport(environment: Environment): { fetch: typeof fetch; baseUrl: string } {
  if (environment === 'development') {
    const devUrl = process.env['BACKEND_DEV_URL'];
    if (devUrl !== undefined && devUrl !== '') {
      return { fetch: globalThis.fetch.bind(globalThis), baseUrl: devUrl };
    }
  }

  const binding = (env as { BACKEND?: { fetch: typeof fetch } }).BACKEND;
  if (binding !== undefined) {
    return {
      // Bound to the binding, so `fetch` keeps its receiver. Passing
      // `binding.fetch` bare loses `this` and fails at the first call.
      fetch: binding.fetch.bind(binding),
      baseUrl: BINDING_ORIGIN,
    };
  }

  // Not a ConfigError: configuration validated fine, and a missing binding is not
  // a bad value. It reaches a page as an unavailable backend, which is what it is
  // to a visitor, and a state this site renders honestly.
  throw new Error('No backend transport is available');
}

/**
 * Records that a page was rendered.
 *
 * Separate from the logging middleware rather than folded into it, because
 * product analytics and operational telemetry are distinct concerns: they
 * answer different questions, they have different retention, and one of them is
 * allowed to fail silently. Both derive the route through the same
 * `routeTemplate` function, so the two cannot disagree about what a route is.
 *
 * This is the layer that owns visitor analytics after the repository split. The
 * backend no longer sees a page view at all - it sees API reads - so there is
 * exactly one page-view event per page rather than two counting the same visit.
 */
const analytics = defineMiddleware(async (context, next) => {
  const response = await next();

  if (isDocumentResponse(response)) {
    // The whole RouteInfo: `pageViewEvent` refuses a page whose route was
    // sanitised rather than matched, because a sanitised path is whatever the
    // visitor asked for. Losing a count is recoverable. Collecting a path is not.
    const event = pageViewEvent(
      routeTemplate({
        routePattern: (context as { routePattern?: string }).routePattern,
        url: context.url,
      }),
    );
    if (event !== null) context.locals.analytics.track(event);
  }

  return response;
});

export const onRequest = sequence(correlation, configuration, logging, backend, analytics);
