/**
 * Shared test vectors for `formatAmountMinor`.
 *
 * Architecture decision record 0023 accepts that this one function exists twice - once in the backend's
 * private domain layer, once in the public web client that cannot import it.
 * This is the mitigation: both repositories drive their own implementation over
 * this exact table, so the two agree because each was checked against one
 * statement of the answer rather than because somebody diffed them once.
 *
 * Checked in to both repositories and must stay byte-identical. Changing it in
 * one place only is the failure this exists to prevent. Several cases are
 * regressions rather than hypotheticals.
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

  // Negative amounts are reachable: price_observations omits the non-negative
  // constraint so an anomalous provider report is retained as evidence. Both were
  // corrupt before the sign was split off ahead of padding.
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
