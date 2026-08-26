/**
 * The corpus is a transcript, and this proves it still reads like one.
 *
 * `tests/fixtures/corpus/` is not fixture data authored here. Every file is a
 * byte-for-byte copy of a response the private backend really produced, written
 * by its `tests/contract/corpus.test.ts`. The fake backend replays them, so the
 * end-to-end suites are evidence about the real contract - a property entirely
 * a matter of the bytes matching, which nothing else here would notice losing.
 * A reformat breaks it silently: the fake parses these files, so no test fails.
 *
 * A diff against the backend cannot be written here - this repository is public
 * and must pass its own CI without access to the private one. So it pins the
 * serialisation the recorder produces instead, which is the strongest statement
 * available from inside this repository and exactly what Prettier broke.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CORPUS = resolve('tests/fixtures/corpus');

const FILES = readdirSync(CORPUS)
  .filter((name) => name.endsWith('.json'))
  .sort();

describe('the recorded corpus', () => {
  it('has recordings to check', () => {
    // An empty directory would make every `it.each` below vacuous. The floor is
    // under the count at the time of writing (27), so a deliberate removal does
    // not fail but deleting the corpus does.
    expect(FILES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(FILES)('%s is serialised exactly as the recorder wrote it', (name) => {
    const raw = readFileSync(resolve(CORPUS, name), 'utf8');

    // The recorder's exact call. Re-serialising and comparing to the bytes on
    // disk catches reformatting, reindenting, reordered keys and a stripped
    // trailing newline in one assertion, without a regex over JSON.
    const reserialised = `${JSON.stringify(JSON.parse(raw), null, 2)}\n`;

    expect(raw).toBe(reserialised);
  });

  it.each(FILES)('%s carries a status and a body, and no request id', (name) => {
    const parsed = JSON.parse(readFileSync(resolve(CORPUS, name), 'utf8')) as Record<
      string,
      unknown
    >;

    // The recorder writes exactly these two keys. Anything else means the file
    // was hand-edited, which is the failure mode this whole suite exists for -
    // a plausible-looking recording of a response no backend ever sent.
    expect(Object.keys(parsed).sort()).toEqual(['body', 'status']);
    expect(typeof parsed['status']).toBe('number');

    // The recorder redacts per-request ids so the files stay stable. An
    // unredacted one fails the backend's comparison every run, and is a real
    // value from a real request in a public repository.
    const body = JSON.stringify(parsed['body']);
    expect(body).not.toMatch(/"request_id":\s*"(?!<request-id>)/u);
  });
});
