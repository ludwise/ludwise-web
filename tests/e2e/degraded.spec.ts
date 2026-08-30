import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * What a visitor sees when the backend does not answer.
 *
 * The rule it exists to enforce: **unavailable is not empty**. The two arrive at a page as
 * similar-looking absences and mean opposite things. Rendering the first as the second tells a
 * visitor there are no games on sale. The truth is that we failed to ask. That is a false claim
 * about the market rather than a cosmetic slip.
 *
 * `playwright.states.config.ts` runs this with the backend in `unavailable` mode. The socket is
 * destroyed rather than answered with a 503. A 503 is the backend telling us something, and
 * this is the backend not being there, a different path through the client.
 */

const LOGOTYPE = '.lw-header__wordmark-accent';

/** Sentences that would be lies when the backend did not answer. */
const FALSE_CLAIMS = [
  'No games in the catalogue yet',
  'No games are on sale right now',
  'LUDWISE has not collected any prices yet',
  'No games match your search',
];

/** Anything from inside the backend, the client, or the runtime. */
const LEAKS = [
  'D1_ERROR',
  'SQLITE_',
  'ECONNREFUSED',
  'ECONNRESET',
  'fetch failed',
  'backend.invalid',
  'localhost:87',
  'node_modules',
  'LudwiseApiError',
  'at attempt',
];

async function auditFor(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude(LOGOTYPE)
    .analyze();
  expect(results.violations).toEqual([]);
}

async function readUnavailableBody(page: Page, path: string): Promise<string> {
  const response = await page.request.get(path);
  expect(response.status()).toBe(503);
  return response.text();
}

const PAGES = ['/games', '/sales', '/games/half-off-demo'];

test.describe('the backend is unavailable', () => {
  for (const path of PAGES) {
    test(`${path} says so rather than claiming to be empty`, async ({ page }) => {
      const body = await readUnavailableBody(page, path);
      for (const claim of FALSE_CLAIMS) {
        expect(body, `${path} claimed: ${claim}`).not.toContain(claim);
      }
    });

    test(`${path} discloses nothing about why`, async ({ page }) => {
      const body = await readUnavailableBody(page, path);

      for (const leak of LEAKS) {
        expect(body, `${path} leaked ${leak}`).not.toContain(leak);
      }
    });

    test(`${path} shows the request id a visitor can quote`, async ({ page }) => {
      // The whole bridge between what a visitor can see and what an operator
      // can find. A failure page without one is a failure nobody can
      // investigate, which is the state this replaces.
      const response = await page.goto(path);
      const requestId = response?.headers()['x-request-id'];

      expect(requestId).toBeTruthy();
      await expect(page.getByText(requestId!)).toBeVisible();
    });
  }

  test('the shell still renders, so the site is navigable', async ({ page }) => {
    // A failed read must not take the header and navigation down with it. A
    // visitor who lands on a broken page must be able to leave it.
    await page.goto('/games');

    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('the pages that need no backend still work', async ({ page }) => {
    // The health endpoint deliberately does not probe the backend, which is
    // what makes it usable during an outage rather than another casualty of
    // one. `robots.txt` and the home page have nothing to fetch at all.
    const health = await page.goto('/api/health');
    expect(health?.status()).toBe(200);

    const home = await page.goto('/');
    expect(home?.status()).toBe(200);

    const robots = await page.goto('/robots.txt');
    expect(robots?.status()).toBe(200);
  });

  test('a failure page is still accessible', async ({ page }) => {
    // An error state is exactly where an accessibility regression goes
    // unnoticed, because nobody looks at it until something has already gone
    // wrong.
    await page.goto('/games');
    await auditFor(page);
  });
});
