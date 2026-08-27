/**
 * Starts the fake backend and the site together, so a suite can just run.
 *
 * Two processes rather than one, because that is genuinely the shape of the
 * system now: this repository is a site that talks to a backend, and a suite
 * that did not exercise the boundary would be testing something other than what
 * is deployed.
 *
 * The mode is read from the environment and passed through, so
 * `tests/e2e/degraded.spec.ts` can bring the pair up with a backend that is not
 * there. Playwright's own `webServer` starts them in order and waits for the
 * site's health endpoint, which cannot answer until configuration has validated.
 */

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.env.LUDWISE_FAKE_BACKEND_MODE ?? 'populated';
const port = process.env.LUDWISE_FAKE_BACKEND_PORT ?? '8788';

const child = spawn(
  process.execPath,
  ['--experimental-strip-types', resolve(root, 'scripts', 'fake-backend.ts')],
  {
    cwd: root,
    env: {
      ...process.env,
      LUDWISE_FAKE_BACKEND_MODE: mode,
      LUDWISE_FAKE_BACKEND_PORT: port,
    },
    stdio: 'inherit',
  },
);

// Forwarded rather than left to the default. Playwright terminates the process
// group it started. Without this the listener survives and the next run fails
// to bind, which looks like a flaky suite rather than a leaked process.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    child.kill(signal);
    process.exit(0);
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
