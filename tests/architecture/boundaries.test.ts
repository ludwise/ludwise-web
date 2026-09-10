/**
 * The rules that make this repository publishable, asserted over the real tree.
 *
 * The backend has a `publication.test.ts` that answers "may this file be
 * published?" against an allowlist that grows. This is the mirror image and a
 * simpler question: everything here is already public. So what has to be
 * proved is that nothing private ever arrives.
 *
 * That difference is why this file exists rather than being a copy. A rule
 * phrased as "these paths are clean" would go vacuously green in a tree where
 * every path is clean. These rules are phrased as absences. An absence is
 * only worth asserting if the thing could plausibly appear, so each block
 * below names something a reasonable change might actually introduce.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { createMediaProxy } from '../../src/lib/media/proxy.js';
import {
  importsInFile,
  listSourceFiles,
  resolveSpecifier,
  stripComments,
  type ImportEdge,
} from '../helpers/imports.js';

const sourceFiles = listSourceFiles('src');

/**
 * A file's code, with its prose removed.
 *
 * Every content rule below reads through this rather than the raw file. Both
 * of the first two rules written here failed on their own documentation.
 * `client.ts` explains why it must never request `/ops`, and the rule forbidding
 * `/ops` matched that sentence. `contract.ts` uses the phrase
 * "optional-because-sometimes-uninteresting", forty URL-safe characters and so
 * indistinguishable from a Cloudflare API token to a regex.
 *
 * Rewording the comments is the wrong fix twice over. It makes them worse to
 * protect the test, and leaves the next accurate comment about a forbidden
 * thing failing the build. A rule about code must read code.
 */
const codeOf = (file: string): string => stripComments(readFileSync(file, 'utf8'));

function edges(): ImportEdge[] {
  return sourceFiles.flatMap((file) =>
    importsInFile(file).map((specifier) => ({
      from: file,
      specifier,
      to: resolveSpecifier(file, specifier),
    })),
  );
}

describe('the tree is large enough for these rules to mean something', () => {
  it('scanned the source files it is asserting over', () => {
    // Without this, deleting src/ would make every assertion below pass.
    expect(sourceFiles.length).toBeGreaterThanOrEqual(30);
    expect(sourceFiles).toContain('src/middleware.ts');
    expect(sourceFiles).toContain('src/lib/api/client.ts');
    expect(sourceFiles).toContain('src/pages/games.astro');
  });
});

/**
 * Nothing here reaches the catalog except through the backend.
 *
 * Named as concrete module and binding names rather than as a general "no
 * database" rule, because a general rule matches nothing and passes forever.
 * Each of these is a specific thing that would appear if somebody copied a file
 * across from the private repository without reading it.
 */
describe('the frontend has no data access of its own', () => {
  const FORBIDDEN_IMPORTS = [
    // Cloudflare bindings that belong to the backend. `cloudflare:workers` is
    // permitted in the composition root alone, which the next block covers.
    'cloudflare:sockets',
    'cloudflare:email',
    // Anything shaped like the private tree.
    'lib/persistence',
    'lib/providers',
    'lib/domain',
    'lib/application',
    'lib/infrastructure',
  ];

  it.each(FORBIDDEN_IMPORTS)('nothing imports %s', (forbidden) => {
    const offenders = edges()
      .filter((edge) => edge.specifier.includes(forbidden))
      .map((edge) => `${edge.from} -> ${edge.specifier}`);
    expect(offenders).toEqual([]);
  });

  /**
   * Type names, not just imports.
   *
   * An import rule cannot see a type that arrived through an ambient
   * declaration, and `D1Database` is exactly that: it is global wherever
   * `worker-configuration.d.ts` is included. A page could name it without
   * importing anything.
   */
  const FORBIDDEN_IDENTIFIERS = [
    'D1Database',
    'D1Result',
    'SqlDatabase',
    'STEAM_API_KEY',
    'IGDB_CLIENT_SECRET',
    'IGDB_CLIENT_ID',
    'TRANSACTIONAL_EMAIL',
    'CLOUDFLARE_API_TOKEN',
    'SendEmail',
  ];

  it.each(FORBIDDEN_IDENTIFIERS)('no source file names %s', (identifier) => {
    const offenders = sourceFiles.filter((file) => codeOf(file).includes(identifier));
    expect(offenders).toEqual([]);
  });

  it('no source file writes SQL', () => {
    // A public repository that grew a query would mean a database binding had
    // arrived with it. Checked as a phrase rather than a keyword: 'select' and
    // 'from' are ordinary English and ordinary JavaScript.
    const sqlish = /\bSELECT\b[\s\S]{0,200}?\bFROM\b/u;
    const offenders = sourceFiles.filter((file) => sqlish.test(codeOf(file)));
    expect(offenders).toEqual([]);
  });
});

describe('production code has no provider-specific metadata dependency', () => {
  it('does not import IGDB or Twitch modules', () => {
    const offenders = edges()
      .filter((edge) => /igdb|twitch/iu.test(edge.specifier))
      .map((edge) => `${edge.from} -> ${edge.specifier}`);
    expect(offenders).toEqual([]);
  });

  const FORBIDDEN_PROVIDER_CONCEPTS: readonly [string, RegExp][] = [
    [
      'provider credentials',
      /\b(?:IGDB|Twitch)[A-Z0-9_]*(?:KEY|SECRET|TOKEN|CLIENT_ID|CLIENT_SECRET)\b/iu,
    ],
    [
      'provider API calls or URL construction',
      /\b(?:api\.igdb\.com|images\.igdb\.com|twitch\.tv|id\.twitch\.tv)\b/iu,
    ],
    [
      'provider-specific contract types',
      /\b(?:IGDB|Igdb|Twitch)[A-Za-z0-9_]*(?:View|Metadata|Genre|Platform|Game|Contract|Dto|DTO)\b/u,
    ],
  ];

  it.each(FORBIDDEN_PROVIDER_CONCEPTS)('contains no %s', (_label, pattern) => {
    const offenders = sourceFiles.filter((file) => pattern.test(codeOf(file)));
    expect(offenders).toEqual([]);
  });
});

/**
 * The one module that may write a provider's public address.
 *
 * A visible credit that names a provider must link to it, which issue #58
 * makes a release condition. That link is a public website and not the API
 * dependency the rules above refuse. So it lives in one module, and the
 * absence rule above stays exact rather than being widened for it.
 */
describe('provider attribution keeps the public addresses in one module', () => {
  const ATTRIBUTION = 'src/lib/attribution/providers.ts';

  it('holds the address of each credited provider', () => {
    // Stated positively, so deleting the credit fails here rather than
    // leaving the rule below guarding an empty set.
    const source = codeOf(ATTRIBUTION);
    expect(source).toContain('https://www.igdb.com/');
    expect(source).toContain('https://store.steampowered.com/');
  });

  it('is the only file that writes a provider address', () => {
    // The address, and not the name. The footer credit reads "IGDB.com" as
    // visible text, which is the credit the terms ask for.
    const address = /https?:\/\/[^\s"'`]*(?:igdb\.com|steampowered\.com)/iu;
    const offenders = sourceFiles.filter(
      (file) => file !== ATTRIBUTION && address.test(codeOf(file)),
    );
    expect(offenders).toEqual([]);
  });
});

/**
 * Bindings are reached in one place.
 *
 * Not a style rule. `cloudflare:workers` is how the service binding is
 * obtained. A page that could reach it directly could construct its own
 * client with its own path - which is the generic-proxy shape this whole design
 * refuses. Confining it to middleware means the allowlist in `client.ts` is the
 * only way to name a backend route.
 */
describe('cloudflare bindings are reached only from the composition root', () => {
  const COMPOSITION_ROOTS = ['src/middleware.ts'];

  it('the composition root actually does reach one', () => {
    // Proves the carve-out is a real exception rather than a rule matching
    // nothing. If middleware stopped importing it, this list would be guarding
    // an empty set.
    expect(readFileSync('src/middleware.ts', 'utf8')).toContain("from 'cloudflare:workers'");
  });

  it('nothing else imports cloudflare:workers', () => {
    const offenders = edges()
      .filter(
        (edge) =>
          edge.specifier.startsWith('cloudflare:') && !COMPOSITION_ROOTS.includes(edge.from),
      )
      .map((edge) => `${edge.from} -> ${edge.specifier}`);
    expect(offenders).toEqual([]);
  });
});

/**
 * The modules permitted to call the injected `fetch`, and nothing else.
 *
 * Two rather than one. `client.ts` is the backend's only door. `proxy.ts` is
 * the media route's, and it exists because that route reaches a provider's
 * image host rather than the backend. Each takes its `fetch` as an argument,
 * and neither will build an address that a caller supplied.
 *
 * Each carve-out carries a positive rule of its own below. A rule that only
 * says "these two are exempt" would grow a third entry and notice nothing.
 */
const FETCH_CALLERS = ['src/lib/api/client.ts', 'src/lib/media/proxy.ts'];

/**
 * There is exactly one way to talk to the backend.
 *
 * The rule that a scattered `fetch` would break is not tidiness. Each call site
 * is a place where a timeout is forgotten or a correlation header is not
 * forwarded. It is also a place where a malformed response is trusted, or a
 * backend error message ends up in a page. Those have to be got right once.
 *
 * It is also the security boundary. `client.ts` exposes three named operations
 * and no path parameter. So there is no way to ask the backend for `/ops` or
 * for an internal route. That is what stops this Worker from becoming an open
 * proxy into a service that has no other public surface.
 */
describe('the backend is reached only through the API client', () => {
  const CLIENT = 'src/lib/api/client.ts';

  it('the client is the thing that calls fetch', () => {
    // The carve-out has to be seen being used, or the rule below is guarding
    // an empty set.
    expect(readFileSync(CLIENT, 'utf8')).toContain('options.fetch(');
  });

  it('no page or component calls fetch', () => {
    // Covers the whole tree outside the carved-out modules rather than only
    // src/pages. A component that fetched would be doing it from the browser,
    // which this site does not do at all.
    const callsFetch = /(?<![.\w])fetch\s*\(/u;
    const offenders = sourceFiles.filter(
      (file) => !FETCH_CALLERS.includes(file) && callsFetch.test(codeOf(file)),
    );
    expect(offenders).toEqual([]);
  });

  it('the client exposes named operations and no caller-supplied path', () => {
    const source = codeOf(CLIENT);
    // The three reads this site makes. A fourth is a deliberate decision and
    // must fail here until this list is updated to acknowledge it.
    expect(source).toContain("path: '/v1/games'");
    expect(source).toContain("path: '/v1/sales'");
    expect(source).toContain('path: `/v1/games/${encodeURIComponent(slug)}`');
    // No route outside /v1 is reachable. That is what keeps /ops and the
    // backend's internal surfaces unreachable from here even though a service
    // binding bypasses Cloudflare Access entirely (architecture decision record 0024).
    expect(source).not.toContain('/ops');
  });

  it('no page reaches the binding itself', () => {
    // A source-text check rather than an import-graph one, because what matters
    // is the *call*: `locals.backend()` is reached through App.Locals, which no
    // import records. The rule is that pages use that thunk and nothing else.
    const offenders = listSourceFiles('src/pages').filter((file) =>
      /\benv\.BACKEND\b/u.test(codeOf(file)),
    );
    expect(offenders).toEqual([]);
  });

  it('the pages that read data do so through the port', () => {
    // Stated positively, so deleting the reads would fail rather than pass.
    for (const page of [
      'src/pages/games.astro',
      'src/pages/sales.astro',
      'src/pages/games/[slug].astro',
    ]) {
      expect(readFileSync(page, 'utf8')).toMatch(/\.backend\(\)/u);
    }
  });
});

/**
 * The media route reaches an upstream only through the allow-list.
 *
 * This is the rule that replaces the one the fetch carve-out gave up. The
 * route's own path carries a host and a path that somebody else wrote, so
 * "which addresses may be fetched" is the whole security question here.
 */
describe('the media route reaches an upstream only through the allow-list', () => {
  const PROXY = 'src/lib/media/proxy.ts';
  const ROUTE = 'src/pages/media/[host]/[...path].ts';

  it('the media module is the second thing that calls fetch', () => {
    // The carve-out has to be seen being used, or the rule above is exempting
    // a file that does nothing.
    expect(readFileSync(PROXY, 'utf8')).toContain('options.fetch(');
    expect(sourceFiles).toContain(PROXY);
    expect(sourceFiles).toContain(ROUTE);
  });

  it('admits an allow-listed host and refuses one that merely ends the same way', async () => {
    // Asserted by calling it rather than by reading it. These two hosts are
    // the pair a suffix test cannot tell apart.
    const attempted: string[] = [];
    const proxy = createMediaProxy({
      fetch: ((url: string) => {
        attempted.push(url);
        return Promise.resolve(new Response(null, { status: 200 }));
      }) as typeof fetch,
      upstream: { allowedHosts: ['images.example.test'] },
      siteUrl: 'https://ludwise.test',
    });

    const refused = await proxy.serve({
      host: 'images.example.test.attacker.test',
      path: 'a.jpg',
    });

    expect(refused.status).toBe(404);
    expect(attempted).toEqual([]);

    await proxy.serve({ host: 'images.example.test', path: 'a.jpg' });
    expect(attempted).toEqual(['https://images.example.test/a.jpg']);
  });

  it('takes its allow-list from configuration rather than from a literal', () => {
    // The other half of the rule forbidding a provider host in src/. A host
    // this file may not name has to arrive as a deployment setting.
    expect(codeOf('src/lib/config/index.ts')).toContain('MEDIA_UPSTREAM_HOSTS');
    expect(codeOf('src/middleware.ts')).toContain('mediaUpstreamHosts');
  });

  it('reads a development origin override in one guarded place', () => {
    // Both overrides go through `developmentOrigin`, which checks the
    // environment before it reads the setting. Honored outside development,
    // one variable would point the live site at an arbitrary origin.
    const source = codeOf('src/middleware.ts');

    expect([...source.matchAll(/process\.env\[/gu)]).toHaveLength(1);
    expect(source).toMatch(/environment !== 'development'/u);
    expect(source).toContain(
      "developmentOrigin(context.locals.config.environment, 'MEDIA_DEV_URL')",
    );
  });

  it('hands the module the two path parameters and nothing from the visitor', () => {
    // Structural rather than a filter. The visitor's request never reaches the
    // media module, so there is no header, cookie or address it could forward.
    const source = codeOf(ROUTE);

    expect(source).toContain('locals.media().serve(');
    expect(source).toContain('params.host');
    expect(source).toContain('params.path');
    expect(source).not.toContain('request');
  });
});

/**
 * No secret is committed here.
 *
 * The repository is public, so this is the check whose failure is
 * irreversible: a commit that lands cannot be unpublished. Deliberately
 * pattern-based rather than an allowlist of known secret names, because the
 * secret nobody thought to name is the one that gets committed.
 */
describe('no credential material is committed', () => {
  const CREDENTIAL_SHAPES: readonly [string, RegExp][] = [
    // Cloudflare API tokens: 40 characters of URL-safe base64.
    ['a Cloudflare API token', /\b[A-Za-z0-9_-]{40}\b(?=[^A-Za-z0-9_-])/u],
    // Steam Web API keys are 32 uppercase hex characters.
    ['a Steam Web API key', /\b[0-9A-F]{32}\b/u],
    ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
    ['a bearer token literal', /\bBearer\s+[A-Za-z0-9_\-.]{20,}/u],
  ];

  it.each(CREDENTIAL_SHAPES)('nothing looks like %s', (_label, pattern) => {
    const offenders = sourceFiles.filter((file) => pattern.test(codeOf(file)));
    expect(offenders).toEqual([]);
  });

  it('the patterns can actually fire', () => {
    // Each pattern is checked against a synthetic positive, because a regex
    // that matches nothing would report a clean tree forever.
    const [, cloudflare] = CREDENTIAL_SHAPES[0]!;
    // not-a-real-secret: a synthetic positive, so the regex cannot be silently dead.
    expect(cloudflare.test('token = "abcdefghij0123456789ABCDEFGHIJ0123456789";')).toBe(true);
    const [, steam] = CREDENTIAL_SHAPES[1]!;
    expect(steam.test('key = "0123456789ABCDEF0123456789ABCDEF";')).toBe(true);
  });
});
