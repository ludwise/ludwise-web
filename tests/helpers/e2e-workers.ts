export const E2E_WORKERS_VARIABLE = 'LUDWISE_E2E_WORKERS';

/**
 * The Playwright worker count for a configuration that starts `astro dev`.
 *
 * The count is 1 when `value` is unset or empty. The Cloudflare development
 * runner shares one module graph and is not safe for concurrent SSR requests.
 * A developer can set `LUDWISE_E2E_WORKERS` to a positive integer to accept
 * that risk.
 *
 * @throws Error when `value` is not a positive integer.
 */
export function e2eWorkers(value: string | undefined): number {
  if (value === undefined || value === '') return 1;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${E2E_WORKERS_VARIABLE} must be a positive integer. The value is "${value}".`);
  }
  return Number(value);
}
