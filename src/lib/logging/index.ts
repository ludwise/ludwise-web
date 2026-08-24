import { getConfig } from '../config/read.js';
import { createLogger, type LoggerOptions } from './logger.js';
import type { LogChannel, Logger } from './types.js';

export { createLogger } from './logger.js';
export { EVENTS, type KnownEvent } from './events.js';
export { consoleSink, createMemorySink, prettySink, type MemorySink } from './sinks.js';
export {
  DEFAULT_DENYLIST,
  isDeniedKey,
  normalizeKey,
  redact,
  REDACTED,
  type RedactOptions,
} from './redact.js';
export { isLogLevel, LOG_LEVEL_SEVERITY, LOG_LEVELS } from './types.js';
export type {
  ErrorContext,
  LogChannel,
  LogContext,
  LogError,
  Logger,
  LogLevel,
  LogRecord,
  LogSink,
} from './types.js';
export type { LoggerOptions } from './logger.js';

/**
 * Root loggers, one per telemetry channel.
 *
 * Built lazily and cached per isolate. Never eagerly, because construction reads
 * configuration, and a throw at module evaluation time on Workers kills the
 * isolate before any handler exists.
 *
 * These carry no request state. Request-scoped fields belong on a child logger
 * held in Astro.locals, never here: isolates are shared across visitors.
 */
const roots = new Map<LogChannel, Logger>();

function rootFor(channel: LogChannel): Logger {
  const existing = roots.get(channel);
  if (existing) return existing;

  let options: LoggerOptions;
  try {
    const config = getConfig();
    options = { channel, level: config.logLevel, environment: config.environment };
  } catch {
    // Configuration is invalid. Logging is how that gets reported, so it must
    // still work; fall back to a safe verbose default rather than rethrowing.
    options = { channel, level: 'info' };
  }

  const logger = createLogger(options);
  roots.set(channel, logger);
  return logger;
}

/** What the system did. The default channel for application logging. */
export function operationalLogger(): Logger {
  return rootFor('operational');
}

/** Potential abuse and security-relevant events. Separate retention concerns. */
export function securityLogger(): Logger {
  return rootFor('security');
}

/**
 * Records of consequential actions: actor, action, target, outcome.
 *
 * Distinct from operational logs, which may be sampled, reformatted or expired.
 * No product actions exist yet, so nothing writes here during bootstrap.
 */
export function auditLogger(): Logger {
  return rootFor('audit');
}

/** Test-only. Clears the cached root loggers. */
export function resetLoggerCache(): void {
  roots.clear();
}
