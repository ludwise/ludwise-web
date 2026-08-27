import type { LogLevel, LogRecord, LogSink } from './types.js';

/**
 * Cloudflare Workers Observability derives severity from which console method
 * produced a record, not from any field in the payload. Routing everything
 * through console.log would make every record informational and would silently
 * break severity filtering in the dashboard.
 */
const CONSOLE_METHOD: Readonly<Record<LogLevel, 'debug' | 'info' | 'warn' | 'error'>> =
  Object.freeze({
    debug: 'debug',
    info: 'info',
    warn: 'warn',
    error: 'error',
    fatal: 'error',
  });

/** Production sink: one JSON object per line, ingested and indexed by Workers Logs. */
export const consoleSink: LogSink = (record) => {
  console[CONSOLE_METHOD[record.level]](JSON.stringify(record));
};

const LEVEL_LABEL: Readonly<Record<LogLevel, string>> = Object.freeze({
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  fatal: 'FATAL',
});

/**
 * Development sink, optimized for a human reading a terminal.
 *
 * Never selected in production. Vite eliminates it from the bundle because the
 * branch keys off import.meta.env.DEV, which is a compile-time constant.
 */
export const prettySink: LogSink = (record) => {
  const time = record.timestamp.slice(11, 23);
  const parts = [time, LEVEL_LABEL[record.level], record.event, record.message];
  if (record.request_id) parts.push(`req=${record.request_id.slice(0, 8)}`);

  const extras: Record<string, unknown> = {};
  if (record.duration_ms !== undefined) extras['duration_ms'] = record.duration_ms;
  if (record.context) Object.assign(extras, record.context);
  if (record.error) extras['error'] = record.error;

  const suffix = Object.keys(extras).length > 0 ? ` ${JSON.stringify(extras)}` : '';
  console[CONSOLE_METHOD[record.level]](parts.join('  ') + suffix);
};

export interface MemorySink {
  readonly sink: LogSink;
  readonly records: readonly LogRecord[];
  clear(): void;
}

/** Test sink: captures records for assertions instead of writing them out. */
export function createMemorySink(): MemorySink {
  const records: LogRecord[] = [];
  return {
    sink: (record) => {
      records.push(record);
    },
    records,
    clear: () => {
      records.length = 0;
    },
  };
}
