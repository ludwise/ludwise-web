import { readFileSync, writeFileSync } from 'node:fs';

import { CORPUS_MISSES_LOG, corpusMissesFailure, unexpectedCorpusMisses } from './corpus-misses.js';

/**
 * Playwright global setup that fails the run when the fake backend received an unrecorded request.
 *
 * The setup empties `corpus-misses.log`. The returned teardown reads it and throws when it holds
 * a request that `EXPECTED_CORPUS_MISSES` does not name. Playwright starts `webServer` before the
 * setup and stops it after the teardown, so the log covers the requests of the tests only.
 *
 * @throws Error from the teardown when the log holds an unexpected request.
 */
export default function corpusMissesGate(): () => void {
  writeFileSync(CORPUS_MISSES_LOG, '');

  return () => {
    const misses = unexpectedCorpusMisses(readFileSync(CORPUS_MISSES_LOG, 'utf8'));
    if (misses.length > 0) throw new Error(corpusMissesFailure(misses));
  };
}
