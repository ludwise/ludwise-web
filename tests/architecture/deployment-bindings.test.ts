/**
 * What the deployed Worker is actually allowed to hold.
 *
 * `boundaries.test.ts` next door proves the *source* reaches nothing private.
 * This proves the same about the *deployment*: a binding is capability, and a
 * binding that appears in the generated configuration is one the Worker can use
 * at runtime whether or not any source file mentions it. The two are separate
 * questions and only one of them is answered by reading src/.
 *
 * The file read here is `dist/server/wrangler.json`, which @astrojs/cloudflare
 * generates by merging `wrangler.jsonc` with its own additions and which
 * `wrangler deploy` then uses in place of the hand-written config. That merge
 * step is the reason this suite exists: what ships is not what was authored.
 *
 * ## The regression this was written for
 *
 * A dry run showed `env.SESSION  KV Namespace` on a site that has no sessions,
 * no accounts and no per-visitor state. Nothing in `wrangler.jsonc` asked for
 * it. @astrojs/cloudflare turns on KV-backed sessions unless `session` is
 * literally `false`, and emits `kv_namespaces: [{ binding: "SESSION" }]` into
 * the generated config. The only trace was one info line in a build log.
 *
 * It would not have failed a deploy - Wrangler provisions the namespace
 * automatically - which is precisely why it is worth a test. It would have
 * created a stateful KV namespace per environment, silently and permanently,
 * for a feature this site does not have.
 *
 * That is now switched off in `astro.config.mjs`, and this is the check that
 * keeps it off: the fix is a default overridden in a config file, which is
 * exactly the kind of thing an adapter upgrade re-enables silently.
 *
 * ## Why an allowlist rather than a list of forbidden bindings
 *
 * A denylist only catches the storage products someone thought to name. The
 * risk here is a binding arriving that nobody chose - so the rule is that every
 * binding must be one of a small named set, and anything else fails and has to
 * be justified by a human.
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

interface AuthoredEnvironment {
  readonly routes?: readonly Route[];
  readonly workers_dev?: boolean;
}

interface AuthoredConfig {
  readonly workers_dev?: boolean;
  readonly env?: Readonly<Record<string, AuthoredEnvironment>>;
}

/** Parse this repository's JSONC config without adding a dependency for one test. */
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
 *              and deliberately a service binding rather than a URL (ADR 0026).
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
  readonly services?: readonly { readonly binding: string; readonly service: string }[];
  readonly assets?: { readonly binding?: string };
  readonly vars?: Readonly<Record<string, string>>;
  readonly [key: string]: unknown;
}

/**
 * Set by the CI step that runs this suite after the build. Absent means "the
 * build output may legitimately not exist yet"; present means "it must, and a
 * missing file is a failure".
 *
 * This exists because the original design here was wrong in a way that could
 * not be seen from the outside. The comment this replaces said the skip was
 * safe because "CI builds, so it is asserted there" - but `test` runs *before*
 * `build`, in `pnpm run check` and in `verify.yml` alike, so the skip fired on
 * every run including CI. Hiding the generated config and rerunning gave
 * `5 passed | 4 skipped`, all of it about a file that was never opened.
 *
 * The ordering is now fixed in the workflow and this flag makes that fix
 * self-enforcing: reorder the steps or drop the post-build run and the suite
 * fails rather than quietly going hollow again.
 */
const REQUIRE_BUILD_OUTPUT = process.env['LUDWISE_REQUIRE_BUILD_OUTPUT'] === '1';

function readGenerated(): GeneratedConfig | undefined {
  if (!existsSync(GENERATED)) return undefined;
  return JSON.parse(readFileSync(GENERATED, 'utf8')) as GeneratedConfig;
}

const config = readGenerated();

describe('the generated deployment configuration', () => {
  it('was produced by a build, or these rules are not running', () => {
    // Not an assertion about the config - an assertion about this suite. Every
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
      // `{ bindings: [] }` and `queues` is `{ producers: [], consumers: [] }`,
      // so a plain array check would pass them both by accident.
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
    // who can see the Worker's settings. Secrets belong in secret bindings; the
    // point here is that none of these should ever be secret at all.
    for (const [name, value] of Object.entries(config?.vars ?? {})) {
      expect(/token|secret|key|password|credential/iu.test(name), `suspicious var: ${name}`).toBe(
        false,
      );
      expect(typeof value).toBe('string');
    }
  });

  it.runIf(config)('names a backend that matches its own environment', () => {
    // The cross-environment guard, asserted against what shipped rather than
    // what was authored. scripts/check-environment.mjs reads wrangler.jsonc
    // before the build; this reads the merged output after it, which is the
    // artifact wrangler actually deploys.
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

  it.each(['staging', 'production'] as const)(
    'does not expose the %s environment on workers.dev',
    (environmentName) => {
      const environment = authored.env?.[environmentName];

      // Named environments inherit the top-level setting unless they override it.
      expect(environment?.workers_dev ?? authored.workers_dev).toBe(false);
    },
  );
});
