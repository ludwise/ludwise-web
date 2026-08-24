/**
 * Checks the built artifact for things a public site must not ship.
 *
 * `tests/architecture/boundaries.test.ts` checks the *source*. This checks what
 * the build actually produced, and the two answer different questions: a value
 * can reach a bundle without appearing in any source file - inlined by Vite's
 * `define`, pulled in through a dependency, or baked into a server chunk by a
 * configuration mistake.
 *
 * Two rules, and the second is the one worth having.
 *
 * **Nothing secret anywhere.** Obvious, and cheap to check.
 *
 * **Nothing about the backend in the client bundle.** The client bundle is
 * shipped to every visitor and is trivially readable. Astro inlines any
 * `PUBLIC_`-prefixed variable into it, and this repository deliberately has
 * none - every read happens during SSR. If a backend hostname, a binding name
 * or an API path ever appears there, it means somebody has started fetching
 * from the browser, which is the architecture changing rather than a leak on
 * its own. Either way it should be a decision rather than a surprise.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIST = resolve(process.cwd(), 'dist');

/** Everything under a directory, as absolute paths. */
function walk(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

/** Text-ish files only. A font or an image cannot leak a string. */
const READABLE = /\.(?:js|mjs|cjs|css|html|json|txt|map)$/u;

const problems = [];

let files;
try {
  files = walk(DIST).filter((file) => READABLE.test(file));
} catch {
  console.error(`No build output at ${DIST}. Run \`pnpm run build\` first.`);
  process.exit(1);
}

if (files.length === 0) {
  // A check that scanned nothing would pass forever, which is worse than not
  // having it.
  console.error('The build produced no readable files, so this check proved nothing.');
  process.exit(1);
}

/** Shapes that are secrets wherever they appear. */
const SECRETS = [
  ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/u],
  ['a Steam Web API key', /\b[0-9A-F]{32}\b/u],
  ['a bearer token literal', /\bBearer\s+[A-Za-z0-9_\-.]{20,}/u],
  [
    'a Cloudflare API token assignment',
    /(?:token|secret|key)\s*[:=]\s*['"][A-Za-z0-9_-]{40}['"]/iu,
  ],
];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const [label, pattern] of SECRETS) {
    if (pattern.test(source)) problems.push(`${file}: looks like ${label}`);
  }
}

/**
 * Terms that belong to the server side of this Worker and nowhere else.
 *
 * `dist/client` is what a browser downloads. Nothing there should know the
 * backend exists.
 */
const SERVER_ONLY = [
  'BACKEND_DEV_URL',
  'backend.invalid',
  'cloudflare:workers',
  '/v1/games',
  '/v1/sales',
];

const clientFiles = files.filter((file) => file.includes(`${join('dist', 'client')}`));

for (const file of clientFiles) {
  const source = readFileSync(file, 'utf8');
  for (const term of SERVER_ONLY) {
    if (source.includes(term)) {
      problems.push(`${file}: client bundle mentions ${term}, which is server-only`);
    }
  }
}

const totalBytes = clientFiles
  .filter((file) => file.endsWith('.js'))
  .reduce((sum, file) => sum + statSync(file).size, 0);

if (problems.length > 0) {
  console.error('Bundle check failed:\n' + problems.map((line) => `  - ${line}`).join('\n'));
  process.exit(1);
}

console.log(
  `Bundle check passed: ${String(files.length)} files scanned, ` +
    `${String(clientFiles.length)} client files, ` +
    `${String(Math.round(totalBytes / 1024))} KiB of client JavaScript.`,
);
