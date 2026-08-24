import type { Environment } from '../config/index.js';

/**
 * Ordered by severity. Meanings are documented in docs/operations/logging.md;
 * undocumented levels always drift into inconsistent use.
 */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_LEVEL_SEVERITY: Readonly<Record<LogLevel, number>> = Object.freeze({
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
});

export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * PRODUCT.md section 103 requires operational telemetry, security logs and
 * audit records to stay conceptually distinct. Bound at logger construction
 * rather than passed per call, so it cannot be forgotten, and queryable as a
 * field so one transport can carry three concerns without blurring them.
 *
 * Product analytics is deliberately not a channel here. It is a separate module
 * with a separate contract - see src/lib/analytics.
 */
export type LogChannel = 'operational' | 'security' | 'audit';

export type LogContext = Readonly<Record<string, unknown>>;
export type ErrorContext = LogContext & {
  readonly error?: unknown;
  /** Stable failure category, e.g. 'provider_unavailable'. Alerts key on this. */
  readonly error_category?: string;
};

export interface LogError {
  readonly category: string;
  readonly type: string;
  readonly message: string;
  readonly stack?: string;
  readonly code?: string;
  /**
   * The underlying failure, redacted and depth-bounded.
   *
   * Load-bearing rather than convenience. `ApplicationError` deliberately
   * keeps the cause out of its own message, out of `toLogContext()` and out of
   * every response, on the promise that an operator holding the request id can
   * still find what actually failed. This field is where that promise is kept:
   * without it a rejected D1 call is reported as
   * `ERR_APP_INFRASTRUCTURE: games.list failed` and nothing anywhere records
   * which column was misspelled.
   */
  readonly cause?: unknown;
}

export interface LogRecord {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly channel: LogChannel;
  /** Stable machine key, e.g. 'http.request.completed'. Never reworded. */
  readonly event: string;
  /** Human prose. Free to change in any commit; never parsed, never localised. */
  readonly message: string;
  readonly service: string;
  readonly environment: Environment | 'unknown';
  readonly version: string;
  readonly git_commit: string;
  readonly build_id: string;
  readonly request_id?: string;
  readonly trace_id?: string;
  readonly span_id?: string;
  readonly duration_ms?: number;
  readonly error?: LogError;
  /** Redacted before it reaches this field. Domain fields live here. */
  readonly context?: LogContext;
}

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  readonly level: LogLevel;
  readonly channel: LogChannel;
  debug(event: string, message: string, context?: LogContext): void;
  info(event: string, message: string, context?: LogContext): void;
  warn(event: string, message: string, context?: ErrorContext): void;
  error(event: string, message: string, context?: ErrorContext): void;
  fatal(event: string, message: string, context?: ErrorContext): void;
  /** Returns a new logger with merged bindings. Never mutates this one. */
  child(bindings: LogContext): Logger;
  isEnabled(level: LogLevel): boolean;
}
