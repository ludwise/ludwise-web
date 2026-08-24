import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * The public-repository audit, run over what git will actually publish.
 *
 * `tests/architecture/boundaries.test.ts` checks `src/`. This checks
 * *everything tracked*, including documentation, workflows, fixtures and
 * configuration - which is where a leak would actually be, because those are
 * the files nobody thinks of as code.
 *
 * Run against `git ls-files` rather than the filesystem, so anything gitignored
 * is out of scope by construction and a `.dev.vars` sitting on disk cannot
 * produce a false alarm about a file that will never be pushed.
 */

const tracked = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean);

const TEXTUAL = /\.(?:ts|tsx|js|mjs|cjs|astro|css|json|jsonc|md|yml|yaml|txt|html|svg)$|^[^.]+$/u;

const findings = [];
const note = (severity, file, message) => findings.push({ severity, file, message });

// --- Files that must never be tracked at all -------------------------------
const FORBIDDEN_FILES = [
  ['.dev.vars', 'local secrets'],
  ['.env', 'environment secrets'],
  ['.env.local', 'environment secrets'],
  ['.env.production', 'environment secrets'],
];

for (const [name, what] of FORBIDDEN_FILES) {
  if (tracked.includes(name)) note('BLOCKING', name, `tracked, and holds ${what}`);
}

// --- Content patterns ------------------------------------------------------
const PATTERNS = [
  ['BLOCKING', 'a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  ['BLOCKING', 'a Steam Web API key', /\b[0-9A-F]{32}\b/u],
  ['BLOCKING', 'a bearer token', /\bBearer\s+[A-Za-z0-9_\-.]{20,}/u],
  [
    'BLOCKING',
    'a credential assignment',
    /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-./+]{16,}['"]/iu,
  ],
  ['IMPORTANT', 'a Cloudflare account id', /\baccount[_-]?id\s*[:=]\s*['"][0-9a-f]{32}['"]/iu],
  ['IMPORTANT', 'a D1 database id', /database_id\s*[:=]\s*['"][0-9a-f-]{36}['"]/iu],
  ['IMPORTANT', 'a provider credential name', /STEAM_API_KEY|IGDB_CLIENT_SECRET|IGDB_CLIENT_ID/u],
  ['IMPORTANT', 'a database binding type', /\bD1Database\b|\bSqlDatabase\b/u],
  ['IMPORTANT', 'an Access AUD tag', /ACCESS_AUD\s*[:=]\s*['"][0-9a-f]{16,}/iu],
];

/** Files whose whole purpose is to name a forbidden thing in order to ban it. */
const RULE_FILES = [
  'tests/architecture/boundaries.test.ts',
  'scripts/check-bundle.mjs',
  'SECURITY.md',
  'docs/architecture.md',
];

for (const file of tracked) {
  if (!TEXTUAL.test(file)) continue;
  if (RULE_FILES.includes(file)) continue;

  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  for (const [severity, label, pattern] of PATTERNS) {
    const match = pattern.exec(source);
    if (match === null) continue;
    const line = source.slice(0, match.index).split('\n').length;
    note(severity, `${file}:${String(line)}`, `looks like ${label}: ${match[0].slice(0, 50)}`);
  }
}

// --- Private-repository leakage --------------------------------------------
const PRIVATE_HINTS = [
  ['IMPORTANT', 'a private repository path', /ludwise-backend\/src\//u],
  ['OPTIONAL', 'an internal-only hostname', /ops(?:-staging)?\.ludwise\.com/u],
];

for (const file of tracked) {
  if (!TEXTUAL.test(file)) continue;
  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }
  for (const [severity, label, pattern] of PRIVATE_HINTS) {
    if (pattern.test(source)) note(severity, file, `mentions ${label}`);
  }
}

// --- Third-party network origins -------------------------------------------
//
// The check that matters for a privacy-first product: nothing here should ask
// a third party for anything. Fonts are self-hosted, there is no analytics
// vendor, and no script comes from a CDN.
//
// XML namespaces are excluded rather than allowlisted. `xmlns=` is an
// identifier, not an address - nothing fetches it, and `http://www.w3.org/2000/svg`
// appearing in every inline SVG would otherwise report a third-party request on
// every icon in the repository.
const ORIGIN =
  /(?<!xmlns(?::\w+)?=")https?:\/\/(?!localhost|127\.0\.0\.1|backend\.invalid)([a-z0-9.-]+)/giu;
const ALLOWED_ORIGINS = new Set([
  'ludwise.com',
  'staging.ludwise.com',
  'www.apache.org',
  'github.com',
  'www.conventionalcommits.org',
  'developers.cloudflare.com',
  // Fixture storefronts, under the reserved .test TLD, which never resolves.
  'orbit-market.example.test',
  'copper-shop.example.test',
  'aurora-market.example.test',
  'vertex-store.example.test',
]);

const origins = new Set();
for (const file of tracked.filter((f) => /^src\//u.test(f))) {
  const source = readFileSync(file, 'utf8');
  for (const match of source.matchAll(ORIGIN)) origins.add(match[1]);
}
for (const origin of origins) {
  if (!ALLOWED_ORIGINS.has(origin)) {
    note('IMPORTANT', 'src/', `reaches a third-party origin: ${origin}`);
  }
}

// --- Report ----------------------------------------------------------------
const order = { BLOCKING: 0, IMPORTANT: 1, OPTIONAL: 2 };
findings.sort((a, b) => order[a.severity] - order[b.severity]);

console.log(`${String(tracked.length)} tracked files audited\n`);
if (findings.length === 0) {
  console.log('No findings.');
  process.exit(0);
}

for (const { severity, file, message } of findings) {
  console.log(`[${severity}] ${file}\n    ${message}`);
}

// Only BLOCKING fails the build. An IMPORTANT finding is a judgement call - a
// database id in a configuration file is not a secret, but it is worth being
// told about - and a check that failed on every one of those would be turned
// off within a week. That is the failure mode this severity split exists to
// avoid: a security check nobody runs proves less than one that is narrow.
const blocking = findings.filter((finding) => finding.severity === 'BLOCKING');
if (blocking.length > 0) {
  console.error(`\n${String(blocking.length)} blocking finding(s). This repository is public.`);
  process.exit(1);
}
