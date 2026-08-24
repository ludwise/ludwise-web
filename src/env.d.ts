/// <reference types="astro/client" />

import type { AnalyticsProvider } from './lib/analytics/types.js';
import type { LudwiseApi } from './lib/api/client.js';
import type { AppConfig } from './lib/config/index.js';
import type { Logger } from './lib/logging/types.js';

declare global {
  namespace App {
    interface Locals {
      /** Correlation identifier for this single request. Safe to show a visitor. */
      requestId: string;
      /** Correlation identifier spanning related work across services. */
      traceId: string;
      /** Identifier for this unit of work within the trace. */
      spanId: string;
      /**
       * The W3C traceparent this request will forward to the backend.
       *
       * Formatted once in middleware rather than at each call site, so the site
       * cannot report one trace to its own logs and a different one to the
       * backend's.
       */
      traceparent: string;
      /** Wall-clock start, used to derive request duration. */
      startedAt: number;
      /** Present only once configuration has validated successfully. */
      config: AppConfig;
      /** Request-scoped child logger carrying the correlation identifiers. */
      logger: Logger;
      /** Visitor analytics sink. Never required for a request to succeed. */
      analytics: AnalyticsProvider;
      /**
       * The backend client for this request.
       *
       * A thunk for the same reason the backend's own database handle is one:
       * most responses never ask the backend anything, and resolving the
       * binding eagerly would make an unbound `BACKEND` fail every request
       * including the liveness probe. Memoised per request, so the correlation
       * identifiers are captured once.
       *
       * This is the only way a page may reach data. There is no database
       * handle, no provider client and no generic fetch here, and there must
       * never be one - `tests/architecture/api-boundary.test.ts` enforces it.
       */
      backend: () => LudwiseApi;
    }
  }

  /** Injected by Vite `define` at build time. See astro.config.mjs. */
  const __BUILD_VERSION__: string;
  const __BUILD_GIT_COMMIT__: string;
  const __BUILD_ID__: string;
}

export {};
