/**
 * Reading a query string the way a submitted GET form actually arrives.
 *
 * A blank control is not a filter. A GET form submits every control it holds,
 * so an empty number field sends `name=`. `Number('')` is 0 and a use case
 * rightly refuses it. Without this boundary, "Apply filters" would fail the
 * request the page had just built.
 *
 * A present-but-malformed value is carried through and refused out loud: a
 * filter a visitor can see in the address bar and not in the results is worse
 * than one that is rejected. Shared rather than copied, because a second copy
 * turns `''` into a `0` nobody asked for and nobody can see.
 */

const DECIMAL_INTEGER = /^[+-]?\d+$/;

/** A trimmed value, or nothing when the control was blank or absent. */
export function optionalText(params: URLSearchParams, name: string): string | undefined {
  const value = params.get(name)?.trim();
  return value === undefined || value === '' ? undefined : value;
}

/**
 * A decimal integer, or nothing when the control was blank.
 *
 * Not `Number()` alone: it reads '0x10' as 16, '1e3' as 1000 and ' 12 ' as 12,
 * none of which a number input can produce, so a hand-written URL would
 * otherwise mean something the form cannot say. `NaN` reaches validation and is
 * refused there, which is where the reason for refusing it lives.
 */
export function optionalInteger(params: URLSearchParams, name: string): number | undefined {
  const value = optionalText(params, name);
  if (value === undefined) return undefined;
  return DECIMAL_INTEGER.test(value) ? Number(value) : Number.NaN;
}

/** Every value supplied for a repeatable control, trimmed, without the blanks. */
export function repeatedText(params: URLSearchParams, name: string): string[] {
  return params
    .getAll(name)
    .map((value) => value.trim())
    .filter((value) => value !== '');
}
