/**
 * Reading a query string the way a submitted GET form actually arrives.
 *
 * A blank control is not a filter. A GET form submits every control it
 * contains, so leaving a number field empty or a select on its default sends
 * `name=` rather than nothing at all. `Number('')` is 0 and an empty select
 * value is `''`, and a use case rightly refuses both - which means that without
 * this boundary, pressing "Apply filters" on the form the page itself rendered
 * would fail the request it had just built.
 *
 * So blank, here, means not supplied. A value that is present but malformed is
 * carried through as it is and refused by the use case, because a filter the
 * visitor can see in the address bar and cannot see in the results is worse
 * than one that is rejected out loud.
 *
 * Shared by every query-string boundary rather than copied into each: the
 * failure mode of a second, subtly different copy is a `''` quietly becoming a
 * `0`, which is a filter nobody asked for and nobody can see.
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
