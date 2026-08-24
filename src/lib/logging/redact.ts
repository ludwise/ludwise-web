export const REDACTED = '[REDACTED]';
export const TRUNCATED_SUFFIX = '...[truncated]';
export const MAX_DEPTH_MARKER = '[MaxDepth]';
export const CIRCULAR_MARKER = '[Circular]';

/**
 * Normalised key fragments that must never reach a log sink.
 *
 * Matched as substrings of the normalised key, not by equality, so
 * `steamApiKey`, `providerApiKey` and `refreshTokenHash` are all caught without
 * enumerating them. The trade is deliberate and asymmetric: over-redaction
 * costs a harmless field, under-redaction puts a live credential into retained
 * logs.
 */
export const DEFAULT_DENYLIST: readonly string[] = Object.freeze([
  'authorization',
  'auth',
  'cookie',
  'setcookie',
  'token',
  'bearer',
  'password',
  'passwd',
  'secret',
  'apikey',
  'clientsecret',
  'privatekey',
  'sessionid',
  'session',
  'credential',
  'signature',
  'email',
  'otp',
  'pin',
  'ssn',
]);

export interface RedactOptions {
  readonly denylist?: readonly string[];
  readonly maxDepth?: number;
  readonly maxKeys?: number;
  readonly maxStringLength?: number;
}

const DEFAULTS = {
  maxDepth: 6,
  maxKeys: 64,
  // Workers Logs truncates a record beyond 256 KB, so an unbounded string can
  // silently destroy the rest of the record.
  maxStringLength: 2048,
} as const;

/** Lowercases and strips separators, so X-Api-Key and api_key normalise alike. */
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_.\s]/g, '');
}

export function isDeniedKey(key: string, denylist: readonly string[] = DEFAULT_DENYLIST): boolean {
  const normalised = normalizeKey(key);
  return denylist.some((denied) => normalised.includes(normalizeKey(denied)));
}

// Credentials routinely arrive inside innocently named fields such as `value`
// or `header`, so these run on every string regardless of its key.
const BEARER_PATTERN = /^bearer\s+\S/i;
const JWT_PATTERN = /^eyJ[\w-]+\.[\w-]+\./;

function looksSecret(value: string): boolean {
  return BEARER_PATTERN.test(value) || JWT_PATTERN.test(value);
}

/**
 * Exported so a boundary that only ever sees one string at a time - a
 * projected log field rather than a whole context object - can apply the same
 * secret-detection and truncation rule without walking a full object through
 * `redact()`. Both paths share one rule for what counts as a credential and
 * how long a value survives, so no caller quietly ends up with a second,
 * looser one.
 */
export function redactString(value: string, maxLength: number): string {
  if (looksSecret(value)) return REDACTED;
  if (value.length > maxLength) return value.slice(0, maxLength) + TRUNCATED_SUFFIX;
  return value;
}

/**
 * Returns a JSON-safe copy with sensitive values removed.
 *
 * Guarantees, all of which are covered by tests: never throws, never recurses
 * without bound, and its output always survives JSON.stringify. A logger that
 * throws while logging is worse than a missing log line.
 */
export function redact(value: unknown, options: RedactOptions = {}): unknown {
  const denylist = options.denylist ?? DEFAULT_DENYLIST;
  const maxDepth = options.maxDepth ?? DEFAULTS.maxDepth;
  const maxKeys = options.maxKeys ?? DEFAULTS.maxKeys;
  const maxStringLength = options.maxStringLength ?? DEFAULTS.maxStringLength;

  const seen = new WeakSet<object>();

  function walk(input: unknown, depth: number): unknown {
    if (input === null) return null;

    switch (typeof input) {
      case 'string':
        return redactString(input, maxStringLength);
      case 'number':
        return Number.isFinite(input) ? input : String(input);
      case 'boolean':
        return input;
      // JSON.stringify throws on BigInt, so it is stringified here instead.
      case 'bigint':
        return input.toString();
      case 'undefined':
      case 'function':
      case 'symbol':
        return undefined;
    }

    if (depth > maxDepth) return MAX_DEPTH_MARKER;

    const obj = input;
    if (seen.has(obj)) return CIRCULAR_MARKER;
    seen.add(obj);

    if (input instanceof Date) return input.toISOString();

    if (input instanceof Error) {
      const result: Record<string, unknown> = {
        name: input.name,
        message: redactString(input.message, maxStringLength),
      };
      if (typeof input.stack === 'string') result['stack'] = input.stack;
      if (input.cause !== undefined) result['cause'] = walk(input.cause, depth + 1);
      return result;
    }

    // Contents are never emitted: collections are exactly where personal data
    // and credentials hide, and a size is enough to debug with.
    if (input instanceof Map) return `[Map size=${String(input.size)}]`;
    if (input instanceof Set) return `[Set size=${String(input.size)}]`;

    if (Array.isArray(input)) {
      const items = input.slice(0, maxKeys).map((item) => walk(item, depth + 1));
      if (input.length > maxKeys) items.push(`[+${String(input.length - maxKeys)} more]`);
      return items;
    }

    // Platform objects have getters that throw or return streams; stringifying
    // one is a guaranteed failure inside the log path.
    const constructorName = obj.constructor?.name;
    if (
      constructorName !== undefined &&
      constructorName !== 'Object' &&
      typeof (obj as { toJSON?: unknown }).toJSON !== 'function' &&
      Object.getPrototypeOf(obj) !== null &&
      !isPlainRecord(obj)
    ) {
      return `[unserializable:${constructorName}]`;
    }

    const output: Record<string, unknown> = {};
    const keys = Object.keys(obj);
    for (const key of keys.slice(0, maxKeys)) {
      if (isDeniedKey(key, denylist)) {
        output[key] = REDACTED;
        continue;
      }
      const walked = walk((obj as Record<string, unknown>)[key], depth + 1);
      // Dropping undefined keeps the record aligned with what JSON emits.
      if (walked !== undefined) output[key] = walked;
    }
    if (keys.length > maxKeys) output['...'] = `[+${String(keys.length - maxKeys)} more]`;
    return output;
  }

  return walk(value, 0);
}

/** True for plain objects and null-prototype records. */
function isPlainRecord(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
