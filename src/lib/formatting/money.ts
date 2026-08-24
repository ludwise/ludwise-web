/**
 * Rendering an amount, and the one function this repository copies from the
 * backend on purpose.
 *
 * ADR 0023 names this cost explicitly rather than pretending it away.
 * `formatAmountMinor` is presentation - it turns a stored integer into the
 * digits a person reads - but it lives in the backend's domain layer because
 * that is where the rules about money are, and the domain layer is not
 * publishable. A public repository cannot import it, and a package shared
 * between the two would be a registry, a release train and a second version
 * series for one function.
 *
 * So there are two implementations, and the mitigation is not "they look the
 * same". It is `tests/unit/formatting/money-vectors.test.ts`, which drives this
 * copy over a checked-in vector file that the backend drives its own copy over.
 * Two implementations agreeing because both were tested against one table of
 * expected output is a different guarantee from two implementations agreeing
 * because somebody compared them once.
 *
 * ## Why the arithmetic is done by hand
 *
 * Because dividing by `10 ** minorUnit` is wrong, and quietly. `1999 / 100` is
 * fine; `amountMinor / 10 ** 3` for a three-decimal currency is a binary
 * float that does not represent the value exactly, and the error shows up as a
 * price ending in the wrong digit on a page whose entire purpose is comparing
 * prices. Splitting the digit string is exact by construction.
 */

const MIN_MINOR_UNIT = 0;
const MAX_MINOR_UNIT = 4;

/**
 * The stored integer as a decimal string, without dividing anything.
 *
 * The sign is split off before padding rather than left inside the digit
 * string. Padding a signed string lets `padStart` count the minus as one of
 * the padded characters and separate it from the number it belongs to: `-5` at
 * two decimals becomes `0.-5`, which is a corrupt string rather than a
 * misformatted one. Negative amounts are reachable - the backend retains
 * anomalous provider reports as evidence rather than discarding them - so this
 * is a case to handle, not one to assume away.
 *
 * Throws rather than guessing on an input outside the range any real currency
 * has. Every one of these was a real corruption before it was a guard: a
 * non-integer splits across the decimal point, `NaN` renders as `N.aN`,
 * `Infinity` as `Infini.ty`, and anything past `Number.MAX_SAFE_INTEGER`
 * switches to exponential notation and becomes `1e+.21`.
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

  // Pad so there is always at least one integer digit, even when the amount is
  // smaller than one major unit: 5 minor units at two decimals is "0.05", not
  // ".05". Padding the unsigned digits only, so the sign can never be split
  // away from the number.
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
