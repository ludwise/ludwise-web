/**
 * The rules that make this repository publishable, asserted over the real tree.
 *
 * The backend has a `publication.test.ts` that answers "may this file be
 * published?" against an allowlist that grows. This is the mirror image and a
 * simpler question: everything here is already public, so what has to be
 * proved is that nothing private ever arrives.
 *
 * That difference is why this file exists rather than being a copy. A rule
 * phrased as "these paths are clean" would go vacuously green in a tree where
 * every path is clean. These rules are phrased as absences, and an absence is
 * only worth asserting if the thing could plausibly appear - so each block
 * below names something a reasonable change might actually introduce.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

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
 * Every content rule below reads through this rather than the raw file, and
 * the reason is that both of the first two rules written here failed on their
 * own documentation. `client.ts` explains *why* it must never request `/ops`,
 * and the rule that forbids requesting `/ops` matched that sentence.
 * `contract.ts` uses the phrase "optional-because-sometimes-uninteresting",
 * which is forty URL-safe characters and therefore indistinguishable from a
 * Cloudflare API token to a regex.
 *
 * Both were the test being wrong rather than the code, and the tempting fix -
 * reword the comment - is the wrong one twice over: it makes the comment worse
 * to protect the test, and it leaves the next accurate comment about a
 * forbidden thing failing the build. A rule about code should read code.
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
 * Nothing here reaches the catalogue except through the backend.
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

/**
 * Bindings are reached in one place.
 *
 * Not a style rule. `cloudflare:workers` is how the service binding is
 * obtained, and a page that could reach it directly could construct its own
 * client with its own path - which is the generic-proxy shape this whole design
 * refuses. Confining it to middleware means the allowlist in `client.ts` is the
 * only way to name a backend route.
 */
describe('cloudflare bindings are reached only from the composition root', () => {
  const COMPOSITION_ROOTS = ['src/middleware.ts'];

  it('the composition root actually does reach one', () => {
    // Proves the carve-out is a real exception rather than a rule matching
    // nothing: if middleware stopped importing it, this list would be guarding
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
 * There is exactly one way to talk to the backend.
 *
 * The rule that a scattered `fetch` would break is not tidiness: each call site
 * is a place where a timeout is forgotten, a correlation header is not
 * forwarded, a malformed response is trusted, or a backend error message ends
 * up in a page. Those have to be got right once.
 *
 * It is also the security boundary. `client.ts` exposes three named operations
 * and no path parameter, so there is no way to ask the backend for `/ops` or
 * for an internal route - which is what stops this Worker from becoming an open
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
    // Deliberately covers the whole tree outside the client rather than only
    // src/pages. A component that fetched would be doing it from the browser,
    // which this site does not do at all - every read happens during SSR.
    const callsFetch = /(?<![.\w])fetch\s*\(/u;
    const offenders = sourceFiles.filter(
      (file) => file !== CLIENT && callsFetch.test(codeOf(file)),
    );
    expect(offenders).toEqual([]);
  });

  it('the client exposes named operations and no caller-supplied path', () => {
    const source = codeOf(CLIENT);
    // The three reads this site makes. A fourth is a deliberate decision and
    // should fail here until this list is updated to acknowledge it.
    expect(source).toContain("path: '/v1/games'");
    expect(source).toContain("path: '/v1/sales'");
    expect(source).toContain('path: `/v1/games/${encodeURIComponent(slug)}`');
    // No route outside /v1 is reachable, which is what keeps /ops and the
    // backend's internal surfaces unreachable from here even though a service
    // binding bypasses Cloudflare Access entirely (ADR 0024).
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
    expect(cloudflare.test('token = "abcdefghij0123456789ABCDEFGHIJ0123456789";')).toBe(true);
    const [, steam] = CREDENTIAL_SHAPES[1]!;
    expect(steam.test('key = "0123456789ABCDEF0123456789ABCDEF";')).toBe(true);
  });
});
