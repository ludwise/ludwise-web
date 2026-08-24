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

/**
 * Which files get read, expressed as what to *skip* rather than what to allow.
 *
 * This was an allowlist of known-textual extensions, and it silently excluded
 * ten tracked files - among them `.dev.vars.example`, which is precisely the
 * file most likely to grow a real credential, and `.gitattributes`, `.npmrc`,
 * and anything a future `.sh`, `.tf` or `.toml` would add. A scanner that
 * decides what to look at by listing the formats someone remembered is one
 * that stops covering the repository the moment it grows a new kind of file,
 * and it fails silently, which is the worst way for a security check to fail.
 *
 * Inverting it means a new file type is scanned by default and the only way to
 * escape review is to be unreadable as text.
 */
const BINARY =
  /\.(?:woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tgz|mp4|webm|wasm)$/iu;

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
//
// Vendor-prefixed shapes are worth more than generic entropy rules: `ghp_` and
// `AKIA` are unambiguous, so they can be BLOCKING without producing the noise
// that would get this check switched off.
const PATTERNS = [
  ['BLOCKING', 'a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  // Case-insensitive: a Steam key is conventionally uppercase, but nothing
  // stops one being pasted in lowercase, and the uppercase-only rule would
  // have missed it.
  ['BLOCKING', 'a Steam Web API key', /\b[0-9a-fA-F]{32}\b/u],
  ['BLOCKING', 'a GitHub token', /\bgh[pousr]_[A-Za-z0-9]{16,}\b/u],
  ['BLOCKING', 'an AWS access key id', /\bAKIA[0-9A-Z]{16}\b/u],
  ['BLOCKING', 'a Slack token', /\bxox[abposr]-[A-Za-z0-9-]{10,}/u],
  ['BLOCKING', 'a Cloudflare API token', /\b[A-Za-z0-9_-]{40}\b(?=[^A-Za-z0-9_-]|$)/u],
  ['BLOCKING', 'a bearer token', /\bBearer\s+[A-Za-z0-9_\-.]{20,}/u],
  ['BLOCKING', 'credentials embedded in a URL', /\bhttps?:\/\/[^/\s:@]+:[^/\s@]+@/u],
  // Both quoted and unquoted: `token: ghp_...` in YAML has no quotes, and the
  // quoted-only rule read straight past it.
  [
    'BLOCKING',
    'a credential assignment',
    /\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+]{16,}['"]?/iu,
  ],
  ['IMPORTANT', 'a Cloudflare account id', /\baccount[_-]?id\s*[:=]\s*['"][0-9a-f]{32}['"]/iu],
  ['IMPORTANT', 'a D1 database id', /database_id\s*[:=]\s*['"][0-9a-f-]{36}['"]/iu],
  ['IMPORTANT', 'a provider credential name', /STEAM_API_KEY|IGDB_CLIENT_SECRET|IGDB_CLIENT_ID/u],
  ['IMPORTANT', 'a database binding type', /\bD1Database\b|\bSqlDatabase\b/u],
  ['IMPORTANT', 'an Access AUD tag', /ACCESS_AUD\s*[:=]\s*['"][0-9a-f]{16,}/iu],
];

/**
 * Matches that are structurally incapable of being the secret they resemble.
 *
 * Each of these is justified by what the value *is*, not by which file it sits
 * in, so a real credential in the same file is still caught. That distinction
 * matters: exempting `correlation.test.ts` because it trips the hex rule would
 * also exempt a genuine key pasted into it next year.
 */
const NOT_A_SECRET = [
  // The W3C Trace Context specification's example trace id. It appears in the
  // spec, in every tutorial, and in the tests that pin our parser against it.
  // It is a published constant, and a 32-hex rule cannot tell it from a key.
  /^4bf92f3577b34da6a3ce929d0e0e4736$/iu,
  // All-zero and other single-character runs. The spec *requires* rejecting an
  // all-zero trace id, so the test suite is obliged to contain one. No key
  // generator emits a constant.
  /^(.)\1+$/u,
  // Sequential hex, the conventional shape of a fixture: 0123456789ABCDEF...
  /^(?:0123456789abcdef)+$/iu,
  // A git object id: 40 hex characters. Every pinned action SHA in the
  // workflows is one, and pinning actions by SHA is a security practice we
  // want, so the Cloudflare-token rule must not punish it. A real token is
  // URL-safe base64 and in practice contains characters outside [0-9a-f].
  /^[0-9a-f]{40}$/iu,
  // Hyphen-separated words: `optional-because-sometimes-uninteresting`, in a
  // comment. Random base64 does produce hyphens, but not three of them
  // separating four all-lowercase alphabetic runs. Prose is not a credential.
  /^[a-z]+(?:-[a-z]+){2,}$/u,
];

/**
 * Subresource-integrity hashes, which are base64 and therefore contain
 * 40-character windows indistinguishable from a Cloudflare API token. Forty-five
 * of them occur in `pnpm-lock.yaml`.
 *
 * Matched as a *span*, and a match is suppressed only when it falls inside one.
 * The first attempt suppressed any finding on a line mentioning `integrity` or
 * `resolution`, which the mutation test immediately broke: a planted
 * tarball URL carrying basic-auth credentials, on a resolution line, went
 * unreported. A lockfile tarball URL is a real way for a credential to be
 * committed, so the suppression has to be narrower than the line.
 *
 * Skipping the lockfile wholesale would have been easier and wrong for the same
 * reason: it is tracked, and it is published.
 */
const INTEGRITY_HASH = /\bsha(?:256|384|512)-[A-Za-z0-9+/=_-]+/gu;

/**
 * Files whose whole purpose is to name a forbidden thing in order to ban it.
 *
 * This file is on the list, which reads like special pleading and is not. The
 * audit's own pattern table contains the literal string STEAM_API_KEY, so on
 * the first run after it was committed it reported itself - a finding that is
 * true, useless, and would train a reader to skim past the output. The rule
 * cannot be written without naming the thing it forbids.
 *
 * The same mistake in boundaries.test.ts was solved by stripping comments
 * before matching, and that would not work here: these strings are in the code,
 * not the prose. An allowlist of files that exist to describe the ban is the
 * honest mechanism, and it stays short and explicit so that adding to it is a
 * visible decision rather than a quiet exemption.
 *
 * The exemption is scoped to the one rule that needs it - the *name* rule,
 * which fires on strings like STEAM_API_KEY - and not to the file. It used to
 * skip these files entirely, so all nine rules were off for five of the most
 * security-relevant documents in the repository. A mutation test planted a
 * GitHub PAT, an AWS key id, a private key block and a basic-auth URL in
 * `docs/architecture.md` and the audit reported none of them.
 */
const RULE_FILES = [
  'scripts/audit-public.mjs',
  'tests/architecture/boundaries.test.ts',
  'scripts/check-bundle.mjs',
  'SECURITY.md',
  'docs/architecture.md',
];

// The only label RULE_FILES may suppress. Naming it explicitly means an
// exemption cannot silently widen when a rule is added to the table.
const NAME_RULE = 'a provider credential name';

/**
 * An explicit, greppable marker for a value that is deliberately shaped like a
 * credential: the synthetic positives that prove a scanner can still fire, and
 * the example strings in this file's own comments.
 *
 * Scoping the old exemption to one rule was correct and immediately surfaced
 * three such values - `boundaries.test.ts` plants a fake Cloudflare token so
 * its own regex is not silently dead, and that assertion is worth keeping.
 * Marking the line is better than re-widening the exemption, because the
 * marker sits at the value, has to be typed on purpose, and shows up in review
 * as an admission rather than hiding in a list at the top of a file.
 */
const SYNTHETIC = /\bnot-a-real-secret\b/u;

for (const file of tracked) {
  if (BINARY.test(file)) continue;
  const describesTheBan = RULE_FILES.includes(file);

  let source;
  try {
    source = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  // Character ranges covered by an integrity hash, computed once per file.
  const hashSpans = [...source.matchAll(INTEGRITY_HASH)].map((m) => [
    m.index,
    m.index + m[0].length,
  ]);

  for (const [severity, label, pattern] of PATTERNS) {
    if (describesTheBan && label === NAME_RULE) continue;
    // Every match, not just the first. `exec` returned one hit per file, so a
    // suppressed or benign match would hide a real credential further down the
    // same file - which is not hypothetical: the all-zero trace id on line 68
    // of correlation.test.ts was masking a second hex match on line 76, and
    // fixing only the reported one would have left the build red.
    const all = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
    for (const match of source.matchAll(all)) {
      if (NOT_A_SECRET.some((benign) => benign.test(match[0]))) continue;
      const inHash = hashSpans.some(([from, to]) => match.index >= from && match.index < to);
      if (inHash) continue;
      const before = source.slice(0, match.index);
      const line = before.split('\n').length;
      // A deliberately fake value, marked on its own line or the one above it,
      // since the natural place for the marker is the comment that explains
      // why the value is there.
      const lineStart = before.lastIndexOf('\n') + 1;
      const lineEnd = source.indexOf('\n', match.index);
      const text = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd);
      const previousStart = before.lastIndexOf('\n', lineStart - 2) + 1;
      const previous = source.slice(previousStart, Math.max(previousStart, lineStart - 1));
      if (SYNTHETIC.test(text) || SYNTHETIC.test(previous)) continue;
      note(severity, `${file}:${String(line)}`, `looks like ${label}: ${match[0].slice(0, 50)}`);
    }
  }
}

// --- Private-repository leakage --------------------------------------------
const PRIVATE_HINTS = [
  ['IMPORTANT', 'a private repository path', /ludwise-backend\/src\//u],
  ['OPTIONAL', 'an internal-only hostname', /ops(?:-staging)?\.ludwise\.com/u],
];

for (const file of tracked) {
  if (BINARY.test(file)) continue;
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
