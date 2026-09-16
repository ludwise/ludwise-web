/**
 * Runs a degraded suite. The first argument is the backend mode, and the
 * default is `unavailable`. `home-list-unavailable` runs the suite where one
 * home list fails.
 *
 * A script rather than an inline environment assignment, because `FOO=bar cmd`
 * is shell syntax that Windows does not have and this repository is developed
 * on both. Setting it here works everywhere and needs no `cross-env`
 * dependency for one variable.
 */

import { spawnSync } from 'node:child_process';

const mode = process.argv[2] ?? 'unavailable';

const result = spawnSync(
  'pnpm',
  ['exec', 'playwright', 'test', '--config=playwright.states.config.ts'],
  {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, LUDWISE_FAKE_BACKEND_MODE: mode },
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 0);
