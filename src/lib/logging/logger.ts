import { BUILD_INFO } from '../build-info.js';
import type { Environment } from '../config/index.js';
import { redact, type RedactOptions } from './redact.js';
import { consoleSink, prettySink } from './sinks.js';
import {
  LOG_LEVEL_SEVERITY,
  type ErrorContext,
  type LogChannel,
  type LogContext,
  type LogError,
  type Logger,
  type LogLevel,
  type LogRecord,
  type LogSink,
} from './types.js';

export interface LoggerOptions {
  readonly level?: LogLevel;
  readonly channel?: LogChannel;
  readonly service?: string;
  readonly environment?: Environment | 'unknown';
  readonly pretty?: boolean;
  readonly sink?: LogSink;
  readonly bindings?: LogContext;
  /** Injectable clock, so tests can assert an exact timestamp. */
  readonly now?: () => number;
  readonly redactOptions?: RedactOptions;
  /** Stack traces help in operational logs but are noise in production. */
  readonly includeStack?: boolean;
}

function toLogError(
  raw: unknown,
  category: string,
  includeStack: boolean,
  redactOptions: RedactOptions | undefined,
): LogError {
  if (raw instanceof Error) {
    const error: {
      category: string;
      type: string;
      message: string;
      stack?: string;
      code?: string;
      cause?: unknown;
    } = {
      category,
      type: raw.name,
      message: raw.message,
    };
    if (includeStack && typeof raw.stack === 'string') error.stack = raw.stack;
    const code: unknown = (raw as { code?: unknown }).code;
    if (typeof code === 'string') error.code = code;
    // Redacted rather than copied: a cause chain is attacker-influenced in
    // principle, so it needs the same depth, breadth, length and cycle bounds as
    // any other untrusted structure. redact() already walks nested causes.
    if (raw.cause !== undefined) error.cause = redact(raw.cause, redactOptions);
    return error;
  }
  return { category, type: typeof raw, message: String(raw) };
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? 'info';
  const channel = options.channel ?? 'operational';
  const service = options.service ?? 'ludwise-web';
  const environment = options.environment ?? 'unknown';
  const bindings = options.bindings ?? {};
  const now = options.now ?? Date.now;
  const redactOptions = options.redactOptions;
  const includeStack = options.includeStack ?? environment !== 'production';
  const pretty = options.pretty ?? import.meta.env.DEV;
  const sink = options.sink ?? (pretty ? prettySink : consoleSink);

  const threshold = LOG_LEVEL_SEVERITY[level];

  function isEnabled(candidate: LogLevel): boolean {
    return LOG_LEVEL_SEVERITY[candidate] >= threshold;
  }

  function emit(
    recordLevel: LogLevel,
    event: string,
    message: string,
    context?: ErrorContext,
  ): void {
    if (!isEnabled(recordLevel)) return;

    const merged: Record<string, unknown> = { ...bindings, ...(context ?? {}) };

    // Correlation identifiers are promoted to top-level fields so queries do not
    // need to know the shape of `context`.
    const requestId = merged['request_id'];
    const traceId = merged['trace_id'];
    const spanId = merged['span_id'];
    const durationMs = merged['duration_ms'];
    const rawError = merged['error'];
    const errorCategory = merged['error_category'];
    delete merged['request_id'];
    delete merged['trace_id'];
    delete merged['span_id'];
    delete merged['duration_ms'];
    delete merged['error'];
    delete merged['error_category'];

    const redacted = redact(merged, redactOptions) as Record<string, unknown>;

    const record: Record<string, unknown> = {
      timestamp: new Date(now()).toISOString(),
      level: recordLevel,
      channel,
      event,
      message,
      service,
      environment,
      version: BUILD_INFO.version,
      git_commit: BUILD_INFO.gitCommitShort,
      build_id: BUILD_INFO.buildId,
    };

    if (typeof requestId === 'string') record['request_id'] = requestId;
    if (typeof traceId === 'string') record['trace_id'] = traceId;
    if (typeof spanId === 'string') record['span_id'] = spanId;
    if (typeof durationMs === 'number') record['duration_ms'] = durationMs;
    if (rawError !== undefined) {
      record['error'] = toLogError(
        rawError,
        typeof errorCategory === 'string' ? errorCategory : 'unspecified',
        includeStack,
        redactOptions,
      );
    }
    if (Object.keys(redacted).length > 0) record['context'] = redacted;

    // A failing sink must never take down the request it was describing.
    try {
      sink(record as unknown as LogRecord);
    } catch {
      // Intentionally swallowed: there is nowhere left to report this.
    }
  }

  const logger: Logger = {
    level,
    channel,
    isEnabled,
    debug: (event, message, context) => {
      emit('debug', event, message, context);
    },
    info: (event, message, context) => {
      emit('info', event, message, context);
    },
    warn: (event, message, context) => {
      emit('warn', event, message, context);
    },
    error: (event, message, context) => {
      emit('error', event, message, context);
    },
    fatal: (event, message, context) => {
      emit('fatal', event, message, context);
    },
    // Returns a new logger rather than mutating this one. Workers isolates are
    // reused across requests from different users, so mutating a shared logger
    // would leak the correlation id of one visitor into the records of another.
    child: (extra) =>
      createLogger({
        ...options,
        level,
        channel,
        service,
        environment,
        sink,
        bindings: { ...bindings, ...extra },
      }),
  };

  return Object.freeze(logger);
}
