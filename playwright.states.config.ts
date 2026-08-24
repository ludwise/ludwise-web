import { defineConfig, devices } from '@playwright/test';

/**
 * The suites that need a backend answering something other than the catalogue.
 *
 * Three states live here, and they share a config because each is a property of
 * the whole backend process rather than of one request: it cannot be toggled
 * mid-suite without one test changing another test's world.
 *
 * - `empty`       nothing has been ingested. The catalogue and the sales page
 *                 must say so in the words that are true of *that* state, which
 *                 are different from the words for "nothing is discounted".
 * - `unavailable` the backend is not there. Every page must say so rather than
 *                 claiming the catalogue is empty.
 * - `malformed`   something answered and it was not a view. Same visitor-facing
 *                 outcome, different investigation.
 *
 * The mode is chosen by `LUDWISE_FAKE_BACKEND_MODE`, and each suite is run
 * separately by its own script. Both servers set `reuseExistingServer: false`,
 * so this config always brings up its own pair rather than attaching to
 * whatever the main config happens to have left running - which would produce a
 * green suite testing the wrong thing.
 */

const PORT = 4322;
const BASE_URL = `http://localhost:${String(PORT)}`;

/**
 * The same port the main config uses, deliberately.
 *
 * A different one would be tidier and does not work: `wrangler dev` reads
 * `.dev.vars` and that file wins over the environment Playwright passes to the
 * server it starts. So `BACKEND_DEV_URL` is whatever `.dev.vars` says, and the
 * fake has to listen there.
 *
 * What keeps the two configs apart is `reuseExistingServer: false` on both
 * servers here: this config always starts its own pair and shuts them down,
 * rather than attaching to whatever happens to be listening. The suites are run
 * one at a time by their own scripts for the same reason.
 */
const BACKEND_PORT = '8788';
const MODE = process.env.LUDWISE_FAKE_BACKEND_MODE ?? 'empty';

export default defineConfig({
  testDir: './tests/e2e',
  // Only the suite that matches the mode. Running the catalogue suites against
  // an empty backend would fail for the right reason and the wrong purpose.
  testMatch: MODE === 'empty' ? '**/empty.spec.ts' : '**/degraded.spec.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: [
    {
      command: 'node --experimental-strip-types scripts/e2e-backend.ts',
      // `/__ready` rather than `/v1/games`, because in `unavailable` mode the
      // fake destroys every connection to a `/v1` path and Playwright would
      // poll a server that is up and working exactly as intended until it timed
      // out. `/__ready` is answered in every mode - it is the one thing this
      // fake will always say - so readiness means "the process is listening"
      // rather than "the backend is healthy", which is the correct question
      // when the whole point is that the backend is not.
      url: `http://localhost:${BACKEND_PORT}/__ready`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { LUDWISE_FAKE_BACKEND_MODE: MODE, LUDWISE_FAKE_BACKEND_PORT: BACKEND_PORT },
    },
    {
      command: `pnpm exec astro dev --port ${String(PORT)}`,
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { BACKEND_DEV_URL: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
