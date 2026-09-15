/** The region identifier and the detected country share one shape: two upper-case letters. */
const COUNTRY_CODE = /^[A-Z]{2}$/u;

/** A well-formed country code, or `null`. It never answers with the value it was given. */
export function readCountryCode(value: unknown): string | null {
  return typeof value === 'string' && COUNTRY_CODE.test(value) ? value : null;
}
