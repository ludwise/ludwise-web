import { describe, expect, it, vi } from 'vitest';

import { createLogger, type LoggerOptions } from '../../../src/lib/logging/logger.js';
import { REDACTED } from '../../../src/lib/logging/redact.js';
import { createMemorySink } from '../../../src/lib/logging/sinks.js';

function build(options: Partial<LoggerOptions> = {}) {
  const memory = createMemorySink();
  const logger = createLogger({
    sink: memory.sink,
    level: 'debug',
    environment: 'production',
    now: () => Date.parse('2026-01-01T12:00:00.000Z'),
    ...options,
  });
  return { logger, memory };
}

describe('createLogger', () => {
  it('emits a complete record with build identity attached', () => {
    const { logger, memory } = build();
    logger.info('test.event', 'A thing happened', { route: '/games' });

    expect(memory.records[0]).toMatchObject({
      timestamp: '2026-01-01T12:00:00.000Z',
      level: 'info',
      channel: 'operational',
      event: 'test.event',
      message: 'A thing happened',
      service: 'ludwise-web',
      environment: 'production',
      version: '0.0.0-test',
      git_commit: 'testsha',
      build_id: 'test-run',
      context: { route: '/games' },
    });
  });

  it('filters records below the configured level', () => {
    const { logger, memory } = build({ level: 'warn' });
    logger.debug('a', 'a');
    logger.info('b', 'b');
    logger.warn('c', 'c');
    logger.error('d', 'd');
    expect(memory.records.map((record) => record.level)).toEqual(['warn', 'error']);
  });

  it('promotes correlation identifiers to top-level fields', () => {
    const { logger, memory } = build();
    logger.info('e', 'e', { request_id: 'req-1', trace_id: 'tr-1', span_id: 'sp-1' });

    expect(memory.records[0]).toMatchObject({
      request_id: 'req-1',
      trace_id: 'tr-1',
      span_id: 'sp-1',
    });
    expect(memory.records[0]?.context).toBeUndefined();
  });

  it('redacts context before it reaches the sink', () => {
    const { logger, memory } = build();
    logger.info('e', 'e', { password: 'hunter2' });
    expect(memory.records[0]?.context).toEqual({ password: REDACTED });
  });

  // Workers isolates are reused across visitors, so a child that mutated its
  // parent would leak one visitor correlation id into another visitor records.
  it('does not mutate the parent when creating a child', () => {
    const { logger, memory } = build();
    const child = logger.child({ request_id: 'req-child' });

    child.info('a', 'a');
    logger.info('b', 'b');

    expect(memory.records[0]?.request_id).toBe('req-child');
    expect(memory.records[1]?.request_id).toBeUndefined();
  });

  it('merges bindings transitively through nested children', () => {
    const { logger, memory } = build();
    logger.child({ a: 1 }).child({ b: 2 }).info('e', 'e');
    expect(memory.records[0]?.context).toEqual({ a: 1, b: 2 });
  });

  it('converts a thrown value into a categorised error field', () => {
    const { logger, memory } = build({ includeStack: false });
    logger.error('e', 'e', { error: new TypeError('bad'), error_category: 'validation' });

    expect(memory.records[0]?.error).toEqual({
      category: 'validation',
      type: 'TypeError',
      message: 'bad',
    });
  });

  it('includes a stack trace when configured to', () => {
    const { logger, memory } = build({ includeStack: true });
    logger.error('e', 'e', { error: new Error('boom') });
    expect(memory.records[0]?.error?.stack).toBeDefined();
  });

  it('defaults an uncategorised error rather than dropping it', () => {
    const { logger, memory } = build();
    logger.error('e', 'e', { error: 'a bare string' });
    expect(memory.records[0]?.error).toMatchObject({
      category: 'unspecified',
      message: 'a bare string',
    });
  });

  // Workers Observability derives a record severity from the console method
  // that produced it, not from any field in the payload.
  it('routes each level to the console method carrying its severity', () => {
    const spies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => undefined),
      info: vi.spyOn(console, 'info').mockImplementation(() => undefined),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
    };

    const logger = createLogger({ level: 'debug', pretty: false });
    logger.debug('a', 'a');
    logger.info('b', 'b');
    logger.warn('c', 'c');
    logger.error('d', 'd');
    logger.fatal('e', 'e');

    expect(spies.debug).toHaveBeenCalledTimes(1);
    expect(spies.info).toHaveBeenCalledTimes(1);
    expect(spies.warn).toHaveBeenCalledTimes(1);
    // error and fatal both map to console.error.
    expect(spies.error).toHaveBeenCalledTimes(2);

    const emitted: unknown = JSON.parse(spies.info.mock.calls[0]?.[0] as string);
    expect(emitted).toMatchObject({ event: 'b', level: 'info' });

    for (const spy of Object.values(spies)) spy.mockRestore();
  });

  it('never lets a failing sink break the caller', () => {
    const logger = createLogger({
      level: 'debug',
      sink: () => {
        throw new Error('sink exploded');
      },
    });
    expect(() => {
      logger.info('e', 'e');
    }).not.toThrow();
  });

  it('carries the channel it was constructed with', () => {
    const { logger, memory } = build({ channel: 'security' });
    logger.warn('e', 'e');
    expect(memory.records[0]?.channel).toBe('security');
  });
});

describe('an error cause reaches the log', () => {
  /**
   * The failure taxonomy in src/lib/application/ deliberately withholds the
   * underlying failure from every visitor-facing surface. It does so on the
   * promise that an operator holding the request id can still find it. That
   * promise is only kept if the cause actually reaches a log record. Otherwise
   * a D1 failure is reported as "ERR_APP_INFRASTRUCTURE: games.list failed",
   * and nothing anywhere says which column was misspelled.
   */
  it('records the cause of a wrapped failure, bounded and redacted', () => {
    const sink = createMemorySink();
    const logger = createLogger({ sink: sink.sink, level: 'debug' });

    const cause = new Error('D1_ERROR: no such column: canonical_titel: SQLITE_ERROR');
    const wrapper = new Error('ERR_APP_INFRASTRUCTURE: games.list failed', { cause });

    logger.error('application.query_failed', 'Game catalogue query failed', {
      error: wrapper,
      error_category: 'application',
    });

    const record = sink.records[0];
    expect(record?.error?.message).toBe('ERR_APP_INFRASTRUCTURE: games.list failed');
    expect(JSON.stringify(record?.error?.cause)).toContain('canonical_titel');
  });

  it('omits the cause entirely when there is none, rather than emitting a null', () => {
    const sink = createMemorySink();
    const logger = createLogger({ sink: sink.sink, level: 'debug' });

    logger.error('application.query_failed', 'no cause', {
      error: new Error('plain'),
      error_category: 'application',
    });

    expect(sink.records[0]?.error).not.toHaveProperty('cause');
  });

  it('bounds a hostile cause chain rather than following it forever', () => {
    const sink = createMemorySink();
    const logger = createLogger({ sink: sink.sink, level: 'debug' });

    // A cause chain is attacker-influenced in principle: a provider client can
    // wrap whatever it likes. The record still has to survive JSON.stringify,
    // which is the property the whole redactor exists to guarantee.
    let deep = new Error('bottom');
    for (let i = 0; i < 50; i++) deep = new Error(`level ${String(i)}`, { cause: deep });

    logger.error('application.query_failed', 'deep', {
      error: deep,
      error_category: 'application',
    });

    expect(() => JSON.stringify(sink.records[0])).not.toThrow();
  });
});
