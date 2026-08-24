/**
 * Refuses a deployment whose backend binding names the wrong environment.
 *
 * The single worst configuration mistake available in this architecture. A
 * staging site reading production data publishes production prices on a
 * hostname that is not meant to be public, and makes staging's own data
 * untrustworthy for the testing it exists to do. From a developer's machine it
 * is worse: an experiment reading real data over a binding nobody audited.
 *
 * Cloudflare's own model makes this mostly structural. A service binding names
 * a Worker *script*, not a URL, so there is no hostname a mistyped variable
 * could redirect and no configuration a deploy could override. This check is
 * for the case the structure cannot catch: someone editing `wrangler.jsonc` and
 * naming the wrong script.
 *
 * Run before the build in both deploy workflows, so a wrong binding fails while
 * nothing has shipped. The deployed Worker's own `/api/health` reports its
 * environment afterwards, which is the same question asked of what actually ran
 * rather than of what was written down.
 */

import { readFileSync } from 'node:fs';

/** Which backend script each site environment is allowed to name. */
const EXPECTED = {
  staging: 'ludwise-staging',
  production: 'ludwise-production',
};

const target = process.argv[2];

if (!Object.hasOwn(EXPECTED, target)) {
  console.error(
    `Usage: node scripts/check-environment.mjs <${Object.keys(EXPECTED).join('|')}>\n` +
      `Got: ${String(target)}`,
  );
  process.exit(1);
}

/**
 * `wrangler.jsonc` with its comments removed.
 *
 * Hand-stripped rather than parsed with a dependency, because the file is ours
 * and the alternative is adding a package to read one field. The string-literal
 * guard matters: a `//` inside a URL is not a comment, and treating it as one
 * would silently truncate the value being checked.
 */
function readJsonc(path) {
  const source = readFileSync(path, 'utf8');
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (inLine) {
      if (char === '\n') {
        inLine = false;
        out += char;
      }
      continue;
    }
    if (inBlock) {
      if (char === '*' && next === '/') {
        inBlock = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      out += char;
      if (char === '\\') {
        out += next ?? '';
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      continue;
    }
    if (char === '/' && next === '/') {
      inLine = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      inBlock = true;
      index += 1;
      continue;
    }
    out += char;
  }

  // Trailing commas, which JSONC allows and JSON.parse does not.
  return JSON.parse(out.replace(/,(\s*[}\]])/gu, '$1'));
}

const config = readJsonc('wrangler.jsonc');
const environment = config.env?.[target];

if (environment === undefined) {
  console.error(`::error::wrangler.jsonc declares no "${target}" environment.`);
  process.exit(1);
}

const bindings = environment.services ?? [];
const backend = bindings.find((service) => service.binding === 'BACKEND');

if (backend === undefined) {
  // Not inherited from the top level, and this is where that matters: wrangler
  // does not inherit bindings into named environments, so an absent one here
  // means the deployed Worker would have no backend at all.
  console.error(
    `::error::The "${target}" environment declares no BACKEND service binding.\n` +
      'Bindings are not inherited from the top level of wrangler.jsonc.',
  );
  process.exit(1);
}

if (backend.service !== EXPECTED[target]) {
  console.error(
    `::error::The "${target}" site is bound to the backend Worker "${String(backend.service)}".\n` +
      `It must be bound to "${EXPECTED[target]}".\n` +
      "A site reading another environment's catalogue publishes that data on this hostname.",
  );
  process.exit(1);
}

// The other environments too, so a change that swapped two blocks fails here
// rather than on the next deploy of whichever one was not being checked.
for (const [name, expected] of Object.entries(EXPECTED)) {
  const other = config.env?.[name]?.services?.find((service) => service.binding === 'BACKEND');
  if (other !== undefined && other.service !== expected) {
    console.error(
      `::error::The "${name}" environment is bound to "${String(other.service)}", not "${expected}".`,
    );
    process.exit(1);
  }
}

console.log(`${target} is bound to ${EXPECTED[target]}, as expected.`);
