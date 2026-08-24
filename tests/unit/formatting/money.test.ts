import { describe, expect, it } from 'vitest';

import { formatMoney } from '../../../src/lib/formatting/money.js';

describe('formatMoney', () => {
  it.each([
    [{ amountMinor: 1234, currencyCode: 'EUR', minorUnit: 2 }, '€12.34'],
    [{ amountMinor: 1800, currencyCode: 'JPY', minorUnit: 0 }, '¥1,800'],
    [{ amountMinor: 3500, currencyCode: 'KWD', minorUnit: 3 }, 'KWD 3.500'],
  ] as const)('uses the currency exponent for %s', (money, expected) => {
    expect(formatMoney(money, 'en-US')).toBe(expected);
  });

  it('renders a zero amount as a normal currency value for callers to label as free', () => {
    expect(formatMoney({ amountMinor: 0, currencyCode: 'EUR', minorUnit: 2 }, 'en-US')).toBe(
      '€0.00',
    );
  });
});
