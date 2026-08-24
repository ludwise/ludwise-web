import { describe, expect, it } from 'vitest';

import { formatReleaseDate } from '../../../src/lib/formatting/game-detail.js';

describe('formatReleaseDate', () => {
  it('keeps a year-only date precise', () => {
    expect(formatReleaseDate('2026')).toBe('2026');
  });

  it('formats month and day precision without inventing missing parts', () => {
    expect(formatReleaseDate('2024-11', 'en-US')).toBe('November 2024');
    expect(formatReleaseDate('2024-11-03', 'en-US')).toBe('November 3, 2024');
  });

  it('does not turn an invalid stored date into a different calendar date', () => {
    expect(formatReleaseDate('2024-02-31')).toBeNull();
    expect(formatReleaseDate(null)).toBeNull();
  });
});
