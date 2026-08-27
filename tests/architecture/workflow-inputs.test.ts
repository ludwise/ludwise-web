import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guards a failure mode that looks like a passing workflow until you read the
 * logs: a **required action input fed from an optional secret**.
 *
 * `actions/github-script` requires `github-token`. When the secret behind it is
 * unset the expression resolves to the empty string and the action fails with
 * "Input required and not supplied: github-token" - before it reads the script,
 * so a no-op guard written inside that script is unreachable.
 *
 * A step-level `if:` cannot fix this: `steps.if` is not given the `secrets`
 * context, so the condition cannot ask whether a secret exists. The fallback
 * operator can, and is what the workflows now use. The rule covers required
 * inputs of known actions only - an optional input receiving an empty string is
 * fine - and scans line by line, no YAML library being a dependency here.
 */

const WORKFLOW_DIR = '.github/workflows';

/**
 * Inputs that the action rejects when empty. Extend as workflows adopt actions
 * with the same shape. An unknown action is not assumed safe, it is simply not
 * covered, which the coverage assertion below keeps honest.
 */
const REQUIRED_INPUTS: ReadonlyMap<string, readonly string[]> = new Map([
  ['actions/github-script', ['github-token']],
]);

function workflowFiles(): readonly string[] {
  return readdirSync(WORKFLOW_DIR)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .map((name) => join(WORKFLOW_DIR, name));
}

interface CoveredInput {
  readonly file: string;
  readonly action: string;
  readonly input: string;
  readonly expression: string;
}

const INDENT = /^(\s*)\S/;
/** `uses:` naming an action, with the version or SHA after `@` discarded. */
const USES = /^\s*-?\s*uses:\s*['"]?([^'"@\s]+)/;
const MAPPING_KEY = /^\s*([A-Za-z0-9_-]+):\s*(.*)$/;
/** `key: |` or `key: >`, whose indented body is text rather than mapping keys. */
const BLOCK_SCALAR = /^\s*[A-Za-z0-9_-]+:\s*[|>][+-]?\s*$/;
const LIST_ITEM = /^\s*-\s/;

function indentOf(line: string): number {
  // A blank or whitespace-only line has no indent to speak of. Treating it as
  // infinitely deep keeps it inside whatever block is being read, and the
  // callers skip it before this matters.
  return INDENT.exec(line)?.[1]?.length ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Every required input of a known action, with the expression feeding it.
 *
 * `uses:`, `env:` and `with:` are siblings, so a step is read from its `uses:`
 * line outward at that same indent until the block ends or the next list item
 * begins - stopping at the first sibling would stop at `env:` and find nothing,
 * which is what the coverage assertion below caught.
 *
 * Inputs are the keys directly under `with:`. The body of a block scalar is
 * skipped, since `script: |` holds JavaScript and a `key: value` line inside it
 * is program text rather than an input.
 */
function coveredInputs(): readonly CoveredInput[] {
  const found: CoveredInput[] = [];

  for (const file of workflowFiles()) {
    const lines = readFileSync(file, 'utf8').split('\n');

    for (const [index, line] of lines.entries()) {
      const action = USES.exec(line)?.[1];
      if (action === undefined) continue;

      const required = REQUIRED_INPUTS.get(action);
      if (required === undefined) continue;

      const stepIndent = indentOf(line);
      let withIndent: number | undefined;
      let blockScalarIndent: number | undefined;

      for (const candidate of lines.slice(index + 1)) {
        if (candidate.trim() === '') continue;
        const candidateIndent = indentOf(candidate);

        if (blockScalarIndent !== undefined) {
          if (candidateIndent > blockScalarIndent) continue;
          blockScalarIndent = undefined;
        }

        // Out of the step: dedented past it, or the next step in the list.
        if (candidateIndent < stepIndent) break;
        if (candidateIndent === stepIndent && LIST_ITEM.test(candidate)) break;

        const key = MAPPING_KEY.exec(candidate);
        if (key === null) continue;

        if (candidateIndent === stepIndent) {
          withIndent = key[1] === 'with' ? candidateIndent : undefined;
          continue;
        }

        if (BLOCK_SCALAR.test(candidate)) blockScalarIndent = candidateIndent;

        // Only keys directly under `with:` are inputs. `env:` keys are not.
        if (withIndent === undefined) continue;
        if (!required.includes(key[1] ?? '')) continue;

        found.push({ file, action, input: key[1] ?? '', expression: (key[2] ?? '').trim() });
      }
    }
  }

  return found;
}

/**
 * A `secrets.*` reference with no fallback. Matches the whole expression so
 * that `secrets.A || secrets.B` is accepted while a bare `secrets.A` is not.
 */
const UNGUARDED_SECRET = /^\$\{\{\s*secrets\.[A-Za-z0-9_]+\s*\}\}$/;

describe('a required action input is never fed from an optional secret alone', () => {
  it('feeds every required input an expression that survives a missing secret', () => {
    const unguarded = coveredInputs()
      .filter((candidate) => UNGUARDED_SECRET.test(candidate.expression))
      .map((candidate) => `${candidate.file}: ${candidate.action} ${candidate.input}`);

    expect(unguarded).toEqual([]);
  });

  it('finds the inputs it claims to check, so the rule is not guarding an empty set', () => {
    expect(coveredInputs().length).toBeGreaterThan(0);
  });
});
