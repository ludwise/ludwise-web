/**
 * What the deployed Worker is actually allowed to hold.
 *
 * `boundaries.test.ts` proves the *source* reaches nothing private. This proves
 * the same of the *deployment*: a binding is capability, and one that appears in
 * the generated configuration is usable at runtime whether or not any source
 * file mentions it. The file read is `dist/server/wrangler.json`, which
 * @astrojs/cloudflare produces by merging `wrangler.jsonc` with its own
 * additions - what ships is not what was authored.
 *
 * The rule is an allowlist rather than a list of forbidden bindings, because
 * the risk is a binding arriving that nobody chose. @astrojs/cloudflare turns
 * on KV-backed sessions and emits a `SESSION` namespace unless `session` is
 * literally `false`, which `astro.config.mjs` sets and this suite keeps set.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const GENERATED = resolve('dist/server/wrangler.json');
const AUTHORED = resolve('wrangler.jsonc');

interface Route {
  readonly pattern?: string;
  readonly custom_domain?: boolean;
}

interface ServiceBinding {
  readonly binding: string;
  readonly service: string;
  /** Absent means the target Worker's default entrypoint. See architecture decision record (ADR) 0028. */
  readonly entrypoint?: string;
}

interface AuthoredEnvironment {
  readonly routes?: readonly Route[];
  readonly workers_dev?: boolean;
  readonly services?: readonly ServiceBinding[];
}

interface AuthoredConfig {
  readonly workers_dev?: boolean;
  readonly services?: readonly ServiceBinding[];
  readonly env?: Readonly<Record<string, AuthoredEnvironment>>;
}

/** Parse this repository's JSONC configuration without adding a dependency for one test. */
function readJsonc(path: string): AuthoredConfig {
  const source = readFileSync(path, 'utf8');
  let output = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        output += char;
      }
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      output += char;
      if (char === '\\') {
        output += next ?? '';
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
    } else if (char === '/' && next === '/') {
      inLineComment = true;
      index += 1;
    } else if (char === '/' && next === '*') {
      inBlockComment = true;
      index += 1;
    } else {
      output += char;
    }
  }

  return JSON.parse(output.replace(/,(\s*[}\]])/gu, '$1')) as AuthoredConfig;
}

const authored = readJsonc(AUTHORED);

/**
 * The bindings this Worker is allowed to receive, and why each one is here.
 *
 * - `ASSETS`   serves the built client files. Astro's adapter requires it.
 * - `BACKEND`  the service binding to ludwise-backend. The entire data path,
 *              and deliberately a service binding rather than a URL (ADR 0024, ADR 0028).
 */
const ALLOWED_BINDINGS = new Set(['ASSETS', 'BACKEND']);

/**
 * Binding categories that must be empty, named individually rather than
 * inferred, so that adding a real one is a decision someone makes here.
 *
 * `kv_namespaces` is the one that actually fired. The rest are the other ways a
 * public web client could grow direct state or direct data access, which is the
 * thing the split exists to prevent: this repository reads through `/v1` or it
 * does not read at all.
 */
const MUST_BE_EMPTY = [
  'kv_namespaces',
  'd1_databases',
  'r2_buckets',
  'queues',
  'hyperdrive',
  'vectorize',
  'durable_objects',
  'analytics_engine_datasets',
  'mtls_certificates',
  'dispatch_namespaces',
  'secrets_store_secrets',
  'send_email',
] as const;

interface GeneratedConfig {
  readonly name?: string;
  readonly services?: readonly ServiceBinding[];
  readonly assets?: { readonly binding?: string };
  readonly vars?: Readonly<Record<string, string>>;
  readonly [key: string]: unknown;
}

/**
 * Set by the CI step that runs this suite after the build. Absent means the
 * build output may legitimately not exist yet. Present means it must, and a
 * missing file is a failure.
 *
 * `test` runs before `build` in `pnpm run check` and in `verify.yml` alike, so
 * skip-if-absent on its own fires on every run, CI included. This flag makes
 * the post-build run self-enforcing: reorder the workflow steps or drop it and
 * the suite fails rather than quietly going hollow.
 */
const REQUIRE_BUILD_OUTPUT = process.env['LUDWISE_REQUIRE_BUILD_OUTPUT'] === '1';

function readGenerated(): GeneratedConfig | undefined {
  if (!existsSync(GENERATED)) return undefined;
  return JSON.parse(readFileSync(GENERATED, 'utf8')) as GeneratedConfig;
}

const config = readGenerated();

describe('the generated deployment configuration', () => {
  it('was produced by a build, or these rules are not running', () => {
    // Not an assertion about the configuration - an assertion about this suite. Every
    // rule below is `runIf(config)`, so without this one a run with no build
    // output reports passes and skips and checks nothing.
    if (REQUIRE_BUILD_OUTPUT) {
      expect(
        config,
        `${GENERATED} is missing: this suite must run after \`pnpm run build\``,
      ).toBeDefined();
      return;
    }

    if (config === undefined) {
      console.warn(
        'dist/server/wrangler.json is absent: run `pnpm run build` for the deployment rules to apply.',
      );
    }
    expect(true).toBe(true);
  });

  it.runIf(config)('grants only the bindings this client needs', () => {
    const bindings = [
      ...(config?.services ?? []).map((service) => service.binding),
      ...(config?.assets?.binding === undefined ? [] : [config.assets.binding]),
    ];

    for (const binding of bindings) {
      expect(ALLOWED_BINDINGS.has(binding), `unexpected binding: ${binding}`).toBe(true);
    }

    // Anti-vacuity: an empty binding list would satisfy the loop above while
    // meaning the Worker cannot reach the backend at all.
    expect(bindings).toContain('BACKEND');
    expect(bindings).toContain('ASSETS');
  });

  it.runIf(config)('carries no storage or messaging bindings of its own', () => {
    for (const key of MUST_BE_EMPTY) {
      const value = config?.[key];

      // Absent, an empty array, or an object whose every array is empty - the
      // shapes wrangler uses for "none of these". `durable_objects` is
      // `{ bindings: [] }`, so a plain array check would pass it by accident.
      const empty =
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0) ||
        (typeof value === 'object' &&
          Object.values(value as Record<string, unknown>).every(
            (inner) => Array.isArray(inner) && inner.length === 0,
          ));

      expect(empty, `${key} is not empty: ${JSON.stringify(value)}`).toBe(true);
    }
  });

  it.runIf(config)('holds no secret-shaped values in plain vars', () => {
    // `vars` is plaintext in the deployed configuration and readable by anyone
    // who can see the Worker's settings. Secrets belong in secret bindings. The
    // point here is that none of these should ever be secret at all.
    for (const [name, value] of Object.entries(config?.vars ?? {})) {
      expect(/token|secret|key|password|credential/iu.test(name), `suspicious var: ${name}`).toBe(
        false,
      );
      expect(typeof value).toBe('string');
    }
  });

  it.runIf(config)('reaches the backend through the named visitor-read entrypoint', () => {
    // The security property of ADR 0028 from this side. The backend's default
    // entrypoint has no `/v1` at all, so a binding without this field would 404
    // every page - and would mean the read contract was expected to be routed.
    const backend = (config?.services ?? []).find((s) => s.binding === 'BACKEND');

    expect(backend?.entrypoint).toBe('VisitorRead');
  });

  it.runIf(config)('names a backend that matches its own environment', () => {
    // Asserted against what shipped rather than what was authored:
    // scripts/check-environment.mjs reads wrangler.jsonc before the build, this
    // reads the merged output wrangler actually deploys.
    const name = config?.name ?? '';
    const backend = (config?.services ?? []).find((s) => s.binding === 'BACKEND')?.service ?? '';

    if (name.endsWith('-staging')) expect(backend).toBe('ludwise-staging');
    else if (name.endsWith('-production')) expect(backend).toBe('ludwise-production');
    else expect(backend).toBe('ludwise');

    // Never, under any name: a production backend behind a non-production site.
    if (!name.endsWith('-production')) {
      expect(backend).not.toBe('ludwise-production');
    }
  });
});

describe('the authored deployment routing', () => {
  it.each([
    ['staging', 'staging.ludwise.com'],
    ['production', 'ludwise.com'],
  ] as const)('claims the %s hostname as a custom domain', (environmentName, hostname) => {
    const environment = authored.env?.[environmentName];
    const route = environment?.routes?.find((entry) => entry.pattern === hostname);

    expect(route, `${environmentName} route for ${hostname}`).toEqual({
      pattern: hostname,
      custom_domain: true,
    });
  });

  it('binds every environment to the named entrypoint, local included', () => {
    // All three environments at once, the local block in particular:
    // check-environment.mjs inspects only the deployed ones, so a top-level
    // binding that lost its entrypoint would reach neither check.
    const blocks = [
      ['local', authored],
      ...(['staging', 'production'] as const).map((name) => [name, authored.env?.[name]] as const),
    ] as const;

    for (const [name, block] of blocks) {
      const backend = (block?.services ?? []).find((entry) => entry.binding === 'BACKEND');

      expect(backend, `${name} declares no BACKEND binding`).toBeDefined();
      expect(backend?.entrypoint, `${name} binds the wrong entrypoint`).toBe('VisitorRead');
    }
  });

  it.each(['staging', 'production'] as const)(
    'does not expose the %s environment on workers.dev',
    (environmentName) => {
      const environment = authored.env?.[environmentName];

      // Named environments inherit the top-level setting unless they override it.
      expect(environment?.workers_dev ?? authored.workers_dev).toBe(false);
    },
  );
});
