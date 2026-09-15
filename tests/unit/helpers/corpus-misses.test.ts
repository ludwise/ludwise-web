import { describe, expect, it } from 'vitest';

import {
  corpusMissesFailure,
  EXPECTED_CORPUS_MISSES,
  unexpectedCorpusMisses,
} from '../../helpers/corpus-misses.js';

describe('corpus misses of an end-to-end run', () => {
  it('are none when the log is empty', () => {
    expect(unexpectedCorpusMisses('')).toEqual([]);
    expect(unexpectedCorpusMisses('\n\n')).toEqual([]);
  });

  it('ignore a request that a test expects to miss', () => {
    expect(unexpectedCorpusMisses('/igdb/image/upload/nothing.jpg\n')).toEqual([]);
    expect(EXPECTED_CORPUS_MISSES.has('/igdb/image/upload/nothing.jpg')).toBe(true);
  });

  it('name each unexpected request one time, in log order', () => {
    const log = [
      '/v1/sales?market=GB&currency=GBP',
      '/igdb/image/upload/nothing.jpg',
      '/v1/games?q=x',
      '/v1/sales?market=GB&currency=GBP',
      '',
    ].join('\n');

    expect(unexpectedCorpusMisses(log)).toEqual([
      '/v1/sales?market=GB&currency=GBP',
      '/v1/games?q=x',
    ]);
  });

  it('compare the whole request, query included', () => {
    const expected = new Set(['/v1/sales']);

    expect(unexpectedCorpusMisses('/v1/sales\n/v1/sales?page=2\n', expected)).toEqual([
      '/v1/sales?page=2',
    ]);
  });

  it('put every unexpected request in the failure message', () => {
    const message = corpusMissesFailure(['/v1/sales?market=GB&currency=GBP', '/v1/games?q=x']);

    expect(message).toContain('no recording for 2 request(s)');
    expect(message).toContain('  /v1/sales?market=GB&currency=GBP\n  /v1/games?q=x\n');
    expect(message).toContain('EXPECTED_CORPUS_MISSES');
  });
});
