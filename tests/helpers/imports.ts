import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * A deliberately small import scanner, used by tests/architecture/ to assert
 * the layering rules over the real source tree.
 *
 * Regex-based rather than AST-based, because the alternative is a parser
 * dependency that has to understand TypeScript, JSX and Astro frontmatter to
 * answer a question about the first token of a line. What that costs in
 * precision is enumerated in boundaries.test.ts, which is the only consumer.
 */

// tests/helpers/imports.ts -> tests/helpers -> repository root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Every extension a module in this repository could be written in, not only
 * the ones currently in use.
 *
 * `.js`, `.mjs`, `.cjs` and `.jsx` are here because their absence was a
 * complete bypass: a plain `.js` file under `src/lib/` importing
 * `cloudflare:workers` was invisible to every rule, and nothing in the tree is
 * written in `.js` today - which is exactly why nobody would have noticed.
 */
export const SCANNED_EXTENSIONS = ['.ts', '.tsx', '.astro', '.js', '.mjs', '.cjs', '.jsx'];

/** Matches the `@/*` alias declared in tsconfig.json. */
const ALIAS_PREFIX = '@/';

const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT = /(^|[^:])\/\/[^\n]*/g;

/**
 * `from '…'`, `import '…'`, `export … from '…'` and `import('…')`.
 *
 * A single alternation rather than four passes, so a specifier is reported
 * once no matter which form introduced it.
 */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"]+)\1/g;

/** An edge in the import graph. `to` is null for bare and virtual specifiers. */
export interface ImportEdge {
  /** Repository-relative POSIX path of the importing file. */
  readonly from: string;
  /** The specifier exactly as written. */
  readonly specifier: string;
  /** Repository-relative POSIX path of the target, or null if not a local file. */
  readonly to: string | null;
}

export function stripComments(source: string): string {
  return source.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '$1');
}

/**
 * The frontmatter of an Astro component, which is the only part that can
 * import anything. Everything after the closing fence is markup, where a
 * path-shaped string is prose rather than a dependency.
 */
function astroFrontmatter(source: string): string {
  if (!source.startsWith('---')) return '';
  const end = source.indexOf('\n---', 3);
  return end === -1 ? source : source.slice(3, end);
}

/** Every module specifier a source string imports, re-exports or dynamically imports. */
export function importsInSource(source: string, fileName: string): string[] {
  const relevant = fileName.endsWith('.astro') ? astroFrontmatter(source) : source;
  return [...stripComments(relevant).matchAll(SPECIFIER)].map(([, , specifier]) => specifier ?? '');
}

/** Every module specifier the given repository-relative file imports. */
export function importsInFile(file: string): string[] {
  return importsInSource(readFileSync(join(REPO_ROOT, file), 'utf8'), file);
}

/**
 * Every source file under a repository-relative directory, as POSIX paths.
 *
 * Sorted, so a failure lists the same files in the same order on every
 * machine and a diff of two runs is readable.
 */
export function listSourceFiles(directory: string): string[] {
  const absolute = join(REPO_ROOT, directory);
  const found: string[] = [];

  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = posix.join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...listSourceFiles(child));
    } else if (SCANNED_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      found.push(child);
    }
  }

  return found.sort();
}

/**
 * Resolves a specifier to a repository-relative path, or null when it does not
 * name a file in this repository.
 *
 * The extension is left exactly as written. Callers match on directory
 * prefixes, so rewriting `.js` back to `.ts` would be work in service of
 * nothing - and getting it wrong would silently drop edges.
 */
export function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith(ALIAS_PREFIX)) {
    return posix.join('src', specifier.slice(ALIAS_PREFIX.length));
  }

  if (!specifier.startsWith('.')) return null;

  const resolved = relative(REPO_ROOT, resolve(REPO_ROOT, dirname(fromFile), specifier));
  return resolved.split('\\').join('/');
}
