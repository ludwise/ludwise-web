/**
 * The corpus is a transcript, and this proves it still reads like one.
 *
 * `tests/fixtures/corpus/` is not fixture data authored here. Every file is a
 * byte-for-byte copy of a response the private backend really produced, written
 * by its `tests/contract/corpus.test.ts` and copied across. The fake backend
 * replays them, so the end-to-end suites are evidence about the real contract
 * rather than about shapes somebody invented to match the code they were
 * testing.
 *
 * That property is entirely a matter of the bytes matching, and nothing else
 * here would notice if they stopped. A reformat is enough to break it and
 * nothing else: the fake backend parses these files, so no test fails, but the
 * backend's own byte comparison would - which is how the "identical corpus"
 * claim goes quietly false. `.prettierignore` excludes the directory, and this
 * suite is the check that catches it either way.
 *
 * ## Why a format check rather than a diff against the backend
 *
 * The obvious test - compare these files to the backend's - cannot be written
 * here. This repository is public, is cloned without the private one, and must
 * pass its own CI on a runner that has no access to it. So this pins the
 * *serialisation the recorder produces* instead: two-space indented
 * `JSON.stringify(..., null, 2)` with a trailing newline, request ids
 * redacted. A file that survives this is one the recorder could have written,
 * which is the strongest statement available from inside this repository - and
 * it is exactly the property Prettier broke.
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
    // Without this, an empty directory would make every `it.each` below vacuous
    // and the suite would pass loudest at the moment it stopped checking
    // anything. The floor is under the count at the time of writing (27) so a
    // deliberate removal does not fail, but deleting the corpus does.
    expect(FILES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(FILES)('%s is serialised exactly as the recorder wrote it', (name) => {
    const raw = readFileSync(resolve(CORPUS, name), 'utf8');

    // The recorder's exact call. Re-serialising the parsed value and comparing
    // to the bytes on disk catches reformatting, reindenting, reordered keys
    // and a stripped trailing newline in one assertion - without needing to
    // describe any of them, and without a regex over JSON.
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

    // Request ids are per-request. The recorder redacts them so the files are
    // stable; an unredacted one would make the backend's comparison fail on
    // every run, and would be a real value from a real request in a public
    // repository.
    const body = JSON.stringify(parsed['body']);
    expect(body).not.toMatch(/"request_id":\s*"(?!<request-id>)/u);
  });
});
