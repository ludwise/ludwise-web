import { defineConfig, devices } from '@playwright/test';

/**
 * One browser, and two servers.
 *
 * The second server is the point. This repository is a site that talks to a
 * backend. So a suite running against the site alone would be testing something
 * other than what is deployed. `scripts/fake-backend.ts` answers `/v1` with the
 * contract's own shapes, which makes the suite deterministic - a real backend's
 * catalog changes as ingestion runs. So an assertion about what is on the
 * page would be an assertion about what Steam was selling that morning.
 *
 * Chromium only. A second engine doubles the slowest step in CI to re-answer a
 * question about our own markup rather than about a browser. Add one when a
 * real cross-browser defect justifies it.
 */

const PORT = 4321;
const BASE_URL = `http://localhost:${String(PORT)}`;
const BACKEND_PORT = process.env.LUDWISE_FAKE_BACKEND_PORT ?? '8788';

/**
 * Which fixtures the backend serves, and whether it answers at all.
 *
 * `degraded.spec.ts` runs with its own configuration with this set to `unavailable`. The reason
 * is that "the backend is not there" is a property of the whole process rather than of one
 * request. It cannot be toggled mid-suite without one test changing another's world.
 */
const MODE = process.env.LUDWISE_FAKE_BACKEND_MODE ?? 'populated';

export default defineConfig({
  testDir: './tests/e2e',
  // Vitest owns tests/**/*.test.ts. Keeping the extensions disjoint means
  // neither runner ever tries to execute the other's files.
  testMatch: '**/*.spec.ts',
  // Two suites need the backend answering something other than the catalog,
  // and each runs with playwright.states.config.ts with its own pair of
  // servers. That is not a convenience: "the backend has nothing" and "the
  // backend is not there" are properties of the whole process, and toggling
  // either mid-suite would let one test change another's world.
  testIgnore: ['**/degraded.spec.ts', '**/empty.spec.ts'],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // A red CI run needs the first actionable failure, not every timeout caused
  // by the same broken server. Green runs still execute the complete suite.
  maxFailures: process.env.CI ? 1 : 0,
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
      // A route the fake answers, so readiness means "serving" rather than
      // "listening". A port check would pass before the routes were wired.
      url: `http://localhost:${BACKEND_PORT}/v1/games`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { LUDWISE_FAKE_BACKEND_MODE: MODE, LUDWISE_FAKE_BACKEND_PORT: BACKEND_PORT },
    },
    {
      command: 'pnpm exec astro dev --port 4321',
      // Do not use a rendered page for readiness. The cold-SSR CI gate checks
      // the first page request separately so this probe cannot warm or mask it.
      url: `${BASE_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { BACKEND_DEV_URL: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
