import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { listSourceFiles } from '../helpers/imports.js';

/**
 * Every place the framework's escaping is switched off, and whether anything
 * variable flows into it.
 *
 * Astro's `set:html` and React's `dangerouslySetInnerHTML` are the only ways to
 * put unescaped markup into a page here, and both are legitimate for a
 * compile-time constant. The dangerous version does not look dangerous:
 * `set:html={'<title>' + title + '</title>'}` reads as assembling a constant and
 * stays harmless for as long as every caller passes a literal. So the rule is
 * structural: a raw-HTML sink takes a name, or a lookup into one, and nothing else.
 *
 * It judges the expression at the sink, never the provenance of the name:
 * `const markup = '<b>' + title` then `set:html={markup}` passes. Closing that
 * needs dataflow analysis, a different tool and a different decision.
 */

// tests/architecture -> tests -> repository root.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const UI_DIRECTORIES = ['src/components', 'src/layouts', 'src/pages'];

/**
 * `set:html={...}` and `dangerouslySetInnerHTML={{ __html: ... }}`, capturing
 * the expression up to its closing brace so it can be judged.
 *
 * `[\s\S]*?` rather than `[^\n]*`, and the difference is not cosmetic. An
 * end-of-line capture returns nothing once Prettier wraps the expression, so
 * *formatting a dangerous line would silently switch the rule off*. The key
 * may be quoted or computed - `["__html"]:` - because a computed key must not
 * hide the sink from the rule.
 */
const RAW_HTML_SINK = /(?:set:html=\{|__html["']?\s*\]?\s*:\s*)([\s\S]*?)\}/g;

/**
 * The only expressions permitted at a sink: a name, or a lookup into one.
 *
 * An allowlist, not a denylist of composition operators. A denylist has to
 * anticipate every way to build a string - `.concat`, `.join`, `.replace`, a
 * ternary, a helper call. The first one nobody thought of then passes. This
 * says instead what safe looks like, and everything else is a finding.
 */
const NAMES_A_VALUE = /^[A-Za-z_$][\w$]*(?:\.[\w$]+|\[[A-Za-z_$][\w$]*\])*$/;

function uiFiles(): string[] {
  return UI_DIRECTORIES.flatMap((directory) => listSourceFiles(directory));
}

function sinksComposingValues(source: string): string[] {
  return [...source.matchAll(RAW_HTML_SINK)]
    .map(([, expression]) => (expression ?? '').trim().replace(/,$/, ''))
    .filter((expression) => !NAMES_A_VALUE.test(expression));
}

describe('the rule can actually fire', () => {
  it.each([
    ['an astro template interpolation', 'set:html={`<title>${title}</title>` + markup}'],
    ['an astro concatenation', "set:html={'<title>' + title + '</title>'}"],
    ['a react interpolation', 'dangerouslySetInnerHTML={{ __html: `<b>${name}</b>` }}'],
    ['a react concatenation', 'dangerouslySetInnerHTML={{ __html: prefix + markup }}'],

    // Each of these defeated the first version of the rule, which looked for
    // composition operators on a single line. Kept as cases because each is a
    // plausible way to write the dangerous thing, not because anyone wrote them.
    ['a concat call', 'set:html={markup.concat(title)}'],
    ['a join', "set:html={[markup, title].join('')}"],
    ['a replace', "set:html={markup.replace('X', title)}"],
    ['a ternary', 'set:html={trusted ? markup : userHtml}'],
    // A computed key must not hide the sink from the rule. The expression is
    // then judged on its own merits, exactly as a plain key would be.
    ['a computed react key', 'dangerouslySetInnerHTML={{ ["__html"]: `<b>${x}</b>` }}'],
    ['a call', 'set:html={renderMarkup(title)}'],
    [
      // The worst of them: the original rule captured to end-of-line, so
      // running Prettier on a genuinely dangerous line disarmed it.
      'an expression Prettier has wrapped across lines',
      'set:html={\n  `<title>${title}</title>` + markup\n}',
    ],
  ])('reports %s', (_label, source) => {
    expect(sinksComposingValues(source)).toHaveLength(1);
  });

  it.each([
    ['a bare identifier in astro', 'set:html={markup}'],
    ['a bare identifier in react', 'dangerouslySetInnerHTML={{ __html: markup }}'],
    ['a lookup with no composition', 'dangerouslySetInnerHTML={{ __html: LUDWISE_ICONS[name] }}'],
    ['a property access', 'set:html={icons.markup}'],
    ['a wrapped bare identifier', 'dangerouslySetInnerHTML={{\n  __html: markup,\n}}'],
  ])('does not report %s', (_label, source) => {
    expect(sinksComposingValues(source)).toEqual([]);
  });
});

describe('no raw-HTML sink composes a value', () => {
  it('scanned enough UI to be meaningful', () => {
    expect(uiFiles().length).toBeGreaterThanOrEqual(10);
  });

  it.each(uiFiles())('%s', (file) => {
    expect(sinksComposingValues(readFileSync(join(REPO_ROOT, file), 'utf8'))).toEqual([]);
  });
});
