/**
 * Shared test vectors for `formatAmountMinor`.
 *
 * ADR 0023 accepts that this one function exists twice - once in the backend's
 * domain layer, which is private, and once in the public web client, which
 * cannot import it. This file is the mitigation, and it is a real one rather
 * than a gesture: both repositories drive their own implementation over this
 * exact table, so the two agree because they were each checked against one
 * statement of the answer, not because somebody diffed them once.
 *
 * The file is checked in to both repositories and must stay byte-identical.
 * Changing it in one place only is the failure mode this exists to prevent, so
 * a change here is a change to both trees in the same slice of work.
 *
 * Every case is here for a reason, and several are regressions rather than
 * hypotheticals - the earlier implementation produced the string in the comment
 * beside them before the guard that now prevents it.
 */

export interface MoneyVector {
  readonly amountMinor: number;
  readonly minorUnit: number;
  readonly expected: string;
  readonly why: string;
}

export const MONEY_VECTORS: readonly MoneyVector[] = [
  // The ordinary case, and the one everything else is a departure from.
  { amountMinor: 1999, minorUnit: 2, expected: '19.99', why: 'two decimals, the common case' },

  // Zero-exponent currencies exist and are not rare. A formatter that divided
  // by 100 unconditionally would render 500 yen as five.
  { amountMinor: 500, minorUnit: 0, expected: '500', why: 'JPY has no minor unit' },
  { amountMinor: 0, minorUnit: 0, expected: '0', why: 'zero at zero exponent' },

  // Three decimals is the case that catches a hard-coded 2.
  { amountMinor: 1999, minorUnit: 3, expected: '1.999', why: 'KWD has three decimals' },
  { amountMinor: 5, minorUnit: 3, expected: '0.005', why: 'padding past the decimal point' },

  // Amounts smaller than one major unit must keep a leading zero. '.05' is not
  // a number a person reads, and it is what an unpadded implementation emits.
  { amountMinor: 5, minorUnit: 2, expected: '0.05', why: 'leading zero, not ".05"' },
  { amountMinor: 50, minorUnit: 2, expected: '0.50', why: 'trailing zero is significant' },
  { amountMinor: 0, minorUnit: 2, expected: '0.00', why: 'free is 0.00, never empty' },

  // Negative amounts are reachable: the backend retains anomalous provider
  // reports as evidence rather than discarding them, and price_observations
  // deliberately omits the non-negative constraint for that reason.
  //
  // Both of these were corrupt strings before the sign was split off ahead of
  // padding - padStart counted the minus as one of the padded characters and
  // separated it from the number it belonged to.
  { amountMinor: -5, minorUnit: 2, expected: '-0.05', why: 'was "0.-5" before the sign split' },
  { amountMinor: -50, minorUnit: 2, expected: '-0.50', why: 'was "-.50" before the sign split' },
  { amountMinor: -1999, minorUnit: 2, expected: '-19.99', why: 'ordinary negative' },
  { amountMinor: -500, minorUnit: 0, expected: '-500', why: 'negative at zero exponent' },

  // The bounds of the exponent range the schema permits.
  { amountMinor: 1, minorUnit: 4, expected: '0.0001', why: 'the widest exponent allowed' },
  { amountMinor: 123456, minorUnit: 4, expected: '12.3456', why: 'four decimals, no padding' },

  // Large but exactly representable. Anything past MAX_SAFE_INTEGER is refused
  // rather than rendered, because toString switches to exponential notation and
  // the digit-splitting produces '1e+.21'.
  {
    amountMinor: 9007199254740991,
    minorUnit: 2,
    expected: '90071992547409.91',
    why: 'the largest exactly representable integer',
  },
];

/**
 * Inputs both implementations must refuse rather than render.
 *
 * Each produced a corrupt string before it was a guard, and the corruption is
 * recorded so a future reader can see these are not defensive decoration. The
 * two repositories throw different error types - the backend raises its own
 * `DomainError`, the web client a plain `RangeError` - so the shared assertion
 * is that something is thrown, not what.
 */
export const REJECTED_MONEY_VECTORS: readonly Omit<MoneyVector, 'expected'>[] = [
  { amountMinor: 1.5, minorUnit: 2, why: 'was "1..5": a non-integer splits across the point' },
  { amountMinor: Number.NaN, minorUnit: 2, why: 'was "N.aN"' },
  { amountMinor: Number.POSITIVE_INFINITY, minorUnit: 2, why: 'was "Infini.ty"' },
  { amountMinor: 1e21, minorUnit: 2, why: 'was "1e+.21": exponential notation' },
  { amountMinor: 1999, minorUnit: -1, why: 'was "1999."' },
  { amountMinor: 1999, minorUnit: 20, why: 'was "0.00000000000000001999"' },
  { amountMinor: 1999, minorUnit: 1.5, why: 'a fractional exponent is not a currency' },
];
