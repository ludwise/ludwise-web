/**
 * Rendering an amount, and the one function this repository copies from the
 * backend on purpose (architecture decision record 0023).
 *
 * `formatAmountMinor` is presentation, but it lives in the backend's domain
 * layer because that is where the rules about money are, and that layer is not
 * publishable. A shared package would be a registry and a release train for one
 * function.
 *
 * So there are two implementations, and the mitigation is not "they look the
 * same": `tests/unit/formatting/money-vectors.test.ts` drives this copy over a
 * vector file the backend drives its own copy over. The arithmetic is by hand
 * because `amountMinor / 10 ** minorUnit` is an inexact binary float.
 */

const MIN_MINOR_UNIT = 0;
const MAX_MINOR_UNIT = 4;

/**
 * The stored integer as a decimal string, without dividing anything.
 *
 * The sign is split off before padding, or `padStart` counts it as one of the
 * padded characters. Negative amounts are reachable: the backend retains
 * anomalous provider reports as evidence rather than discarding them.
 *
 * @throws {RangeError} if `amountMinor` is not a safe integer, or `minorUnit`
 * is not an integer in 0-4. Both guards are load-bearing rather than
 * defensive. tests/unit/formatting pins the corruption each one prevents.
 */
export function formatAmountMinor(amountMinor: number, minorUnit: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new RangeError('amountMinor: expected a safe integer');
  }
  if (!Number.isInteger(minorUnit) || minorUnit < MIN_MINOR_UNIT || minorUnit > MAX_MINOR_UNIT) {
    throw new RangeError('minorUnit: expected an integer between 0 and 4');
  }

  const isNegative = amountMinor < 0;
  const sign = isNegative ? '-' : '';
  const unsignedDigits = (isNegative ? -amountMinor : amountMinor).toString();

  if (minorUnit === 0) return `${sign}${unsignedDigits}`;

  // At least one integer digit, so 5 minor units at two decimals is '0.05' rather
  // than '.05'. Unsigned digits only: the sign must never be split off.
  const padded = unsignedDigits.padStart(minorUnit + 1, '0');
  const splitIndex = padded.length - minorUnit;
  return `${sign}${padded.slice(0, splitIndex)}.${padded.slice(splitIndex)}`;
}

export interface MoneyFormatInput {
  readonly amountMinor: number;
  readonly currencyCode: string;
  readonly minorUnit: number;
}

/**
 * An amount with its currency, as a person reads it.
 *
 * `minimumFractionDigits` and `maximumFractionDigits` are both pinned to the
 * currency's own exponent rather than left to `Intl`'s default. `Intl` knows
 * the conventional exponent for a currency code, and the backend knows the one
 * the price was actually recorded in - and where those disagree, the recorded
 * one is the fact. Pinning both bounds to the same value also stops `Intl`
 * rounding a three-decimal amount to two, which would display a price that is
 * not the price.
 *
 * The locale defaults to `en-US` and is a parameter rather than a constant so
 * that adding a locale is configuration rather than a refactor - the site is
 * already routed locale-aware for exactly that reason.
 */
export function formatMoney(money: MoneyFormatInput, locale = 'en-US'): string {
  const majorAmount = Number(formatAmountMinor(money.amountMinor, money.minorUnit));
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currencyCode,
    minimumFractionDigits: money.minorUnit,
    maximumFractionDigits: money.minorUnit,
  }).format(majorAmount);
}
