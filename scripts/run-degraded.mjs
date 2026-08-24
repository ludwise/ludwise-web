/**
 * Runs the degraded suite with the backend in `unavailable` mode.
 *
 * A script rather than an inline environment assignment, because `FOO=bar cmd`
 * is shell syntax that Windows does not have and this repository is developed
 * on both. Setting it here works everywhere and needs no `cross-env`
 * dependency for one variable.
 */

import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--config=playwright.states.config.ts'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, LUDWISE_FAKE_BACKEND_MODE: 'unavailable' },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 0);
