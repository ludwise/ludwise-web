/**
 * The country the Cloudflare edge assigned to a request.
 *
 * This is the only location signal LUDWISE uses, and it is used only to choose
 * a pricing region. Nothing here reads a finer location, and nothing stores
 * the result or the client IP address.
 */

import type { Environment } from '../config/index.js';
import { readCountryCode } from './country-code.js';

/**
 * The development-only stand-in for edge metadata.
 *
 * In development, `request.cf` describes the machine that runs this Worker. A
 * browser suite on a CI runner would then see the country of that runner.
 */
export const TEST_COUNTRY_HEADER = 'x-ludwise-test-country';

/**
 * The detected country code, or `null`.
 *
 * Outside development it reads `request.cf.country`, which the edge sets and a
 * caller cannot. It never reads a request header there, because a caller can
 * send any header.
 */
export function detectCountryCode(request: Request, environment: Environment): string | null {
  if (environment === 'development') {
    return readCountryCode(request.headers.get(TEST_COUNTRY_HEADER));
  }

  const metadata = (request as { cf?: { country?: unknown } }).cf;
  return readCountryCode(metadata?.country);
}
