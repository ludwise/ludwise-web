import { describe, expect, it } from 'vitest';

import { e2eWorkers } from '../../helpers/e2e-workers.js';

describe('Playwright worker count', () => {
  it('is one worker when the variable is unset or empty', () => {
    expect(e2eWorkers(undefined)).toBe(1);
    expect(e2eWorkers('')).toBe(1);
  });

  it('is the count that a developer sets', () => {
    expect(e2eWorkers('1')).toBe(1);
    expect(e2eWorkers('4')).toBe(4);
    expect(e2eWorkers('12')).toBe(12);
  });

  it.each(['0', '-2', '1.5', '50%', ' 2', '02', 'four'])('rejects "%s"', (value) => {
    expect(() => e2eWorkers(value)).toThrow('LUDWISE_E2E_WORKERS must be a positive integer.');
  });
});
