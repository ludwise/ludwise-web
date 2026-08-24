/**
 * This repository's copy of `formatAmountMinor`, driven over the shared corpus.
 *
 * The backend runs the identical file against its own implementation. That is
 * what makes two copies of one function an acceptable cost rather than a
 * liability: they agree because each was checked against one statement of the
 * answer, not because somebody compared them at the time of the split and
 * assumed they would stay that way.
 */

import { describe, expect, it } from 'vitest';

import { formatAmountMinor, formatMoney } from '../../../src/lib/formatting/money.js';
import { MONEY_VECTORS, REJECTED_MONEY_VECTORS } from '../../helpers/money-vectors.js';

describe('formatAmountMinor agrees with the shared vectors', () => {
  it('has vectors to check', () => {
    // Without this, emptying the corpus would make every assertion below pass.
    expect(MONEY_VECTORS.length).toBeGreaterThanOrEqual(15);
    expect(REJECTED_MONEY_VECTORS.length).toBeGreaterThanOrEqual(5);
  });

  it.each(MONEY_VECTORS)('$amountMinor at $minorUnit is $expected ($why)', (vector) => {
    expect(formatAmountMinor(vector.amountMinor, vector.minorUnit)).toBe(vector.expected);
  });

  it.each(REJECTED_MONEY_VECTORS)('refuses $amountMinor at $minorUnit ($why)', (vector) => {
    // Thrown, not rendered. Each of these produced a corrupt string before the
    // guard existed, and a corrupt price on a price-comparison site is worse
    // than an error a developer sees immediately.
    expect(() => formatAmountMinor(vector.amountMinor, vector.minorUnit)).toThrow();
  });
});

describe('formatMoney', () => {
  it('renders the currency alongside the amount', () => {
    expect(formatMoney({ amountMinor: 1999, currencyCode: 'EUR', minorUnit: 2 }, 'en-US')).toBe(
      '€19.99',
    );
  });

  it('honours the exponent the price was recorded in, not the conventional one', () => {
    // Intl knows JPY conventionally has no decimals and would render '¥500'
    // either way. The case that matters is the opposite: an amount recorded at
    // an exponent Intl would round away.
    expect(formatMoney({ amountMinor: 500, currencyCode: 'JPY', minorUnit: 0 }, 'en-US')).toBe(
      '¥500',
    );
    // Three decimals, which Intl's default for KWD happens to agree with.
    // Asserted on the parts rather than the whole string: Intl separates a
    // currency code from its amount with U+00A0, not a space, and an assertion
    // written with an ordinary space fails against output that is correct and
    // looks identical in a diff.
    const kwd = formatMoney({ amountMinor: 1999, currencyCode: 'KWD', minorUnit: 3 }, 'en-US');
    expect(kwd).toContain('KWD');
    expect(kwd).toContain('1.999');
  });

  it('does not round an amount away', () => {
    // The failure this pins: with maximumFractionDigits left to Intl, a
    // three-decimal amount under a currency Intl thinks has two would render
    // as a different number from the one stored.
    const rendered = formatMoney({ amountMinor: 1999, currencyCode: 'USD', minorUnit: 3 }, 'en-US');
    expect(rendered).toContain('1.999');
  });
});
