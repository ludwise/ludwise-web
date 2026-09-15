/**
 * The region a visitor saved, carried in a first-party cookie.
 *
 * A cookie, because an anonymous visitor has no account, and this Worker must
 * read the region before it renders the first price. The cookie holds the
 * region identifier only. The market and the currency come from the backend
 * contract on each request, so they cannot drift from it.
 *
 * A visitor sets this cookie by saving a region. That act is what keeps it
 * inside the strictly-necessary exemption, as architecture decision record
 * 0013 states for the theme cookie.
 */

import { readCountryCode } from './country-code.js';

export const REGION_COOKIE_NAME = 'region';

/** A year. A visitor who saved a region expects to find it on a later visit. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** The saved region identifier, or `null` when there is none or it is malformed. */
export function readRegionCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() !== REGION_COOKIE_NAME) continue;
    return readCountryCode(pair.slice(separator + 1).trim());
  }

  return null;
}

/**
 * The `Set-Cookie` value that saves a region.
 *
 * `HttpOnly`, because only this Worker writes it. `SameSite=Lax`, so a visitor
 * who follows a link from another site still sees their own region.
 */
export function serializeRegionCookie(countryCode: string, options: { secure: boolean }): string {
  return attributes(`${REGION_COOKIE_NAME}=${countryCode}`, ONE_YEAR_SECONDS, options);
}

/** The `Set-Cookie` value that removes a saved region the backend no longer supports. */
export function clearRegionCookie(options: { secure: boolean }): string {
  return attributes(`${REGION_COOKIE_NAME}=`, 0, options);
}

function attributes(pair: string, maxAgeSeconds: number, options: { secure: boolean }): string {
  return [
    pair,
    'Path=/',
    `Max-Age=${String(maxAgeSeconds)}`,
    'SameSite=Lax',
    'HttpOnly',
    ...(options.secure ? ['Secure'] : []),
  ].join('; ');
}
