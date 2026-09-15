import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The file where `scripts/fake-backend.ts` appends each request that has no recording. */
export const CORPUS_MISSES_LOG = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'corpus-misses.log',
);

/**
 * The requests that a test sends to the fake backend because the request must miss.
 *
 * Each entry is the path and query exactly as the fake backend writes it to the log.
 */
export const EXPECTED_CORPUS_MISSES: ReadonlySet<string> = new Set([
  // media.spec.ts: the media route answers 404 for a path the upstream does not have.
  '/igdb/image/upload/nothing.jpg',
]);

/**
 * The logged requests that no entry in `expected` names, each one time, in log order.
 *
 * Blank lines are ignored.
 */
export function unexpectedCorpusMisses(
  log: string,
  expected: ReadonlySet<string> = EXPECTED_CORPUS_MISSES,
): string[] {
  const requests = log
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !expected.has(line));
  return [...new Set(requests)];
}

/** The error message for a run whose fake backend received requests that it has no recording for. */
export function corpusMissesFailure(misses: readonly string[]): string {
  return [
    `The fake backend has no recording for ${String(misses.length)} request(s) from this run:`,
    ...misses.map((request) => `  ${request}`),
    'Add a case to the corpus of the backend and copy the recording to tests/fixtures/corpus/.',
    'If a test sends the request to get a miss, add it to EXPECTED_CORPUS_MISSES in tests/helpers/corpus-misses.ts.',
  ].join('\n');
}
