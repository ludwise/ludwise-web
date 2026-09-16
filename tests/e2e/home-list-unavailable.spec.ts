import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';
import { LOGOTYPES } from '../helpers/logotypes.js';

/**
 * The home page when one list fails and the other list loads (ludwise-web#151).
 *
 * `playwright.states.config.ts` runs this suite with the backend in
 * `home-list-unavailable` mode. The backend does not answer current discounts,
 * and it replays every other path. One list failing must not take down the
 * other (ludwise-web#123).
 */

const BASE_URL = 'http://localhost:4322';
const THEMES = ['light', 'dark'] as const;
const VISITOR_REQUEST_ID = 'home-list-unavailable-e2e-request-id';

async function auditFor(page: Page): Promise<void> {
  const builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
  ]);
  for (const logotype of LOGOTYPES) builder.exclude(logotype);
  const results = await builder.analyze();
  expect(results.violations).toEqual([]);
}

test.describe('one home list is unavailable', () => {
  test('answers 200, because the other list loaded', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('searchbox', { name: 'Search the catalogue' })).toBeVisible();
  });

  test('scopes the failure to the current discounts', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-request-id': VISITOR_REQUEST_ID });
    await page.goto('/');

    const discounts = page.getByRole('region', { name: 'Current discounts' });
    const message = discounts.locator('.lw-inline-message');
    await expect(message).toHaveAttribute('data-tone', 'danger');
    await expect(message).toHaveRole('alert');
    await expect(message).toContainText('Current discounts could not be loaded');
    await expect(discounts.getByText(VISITOR_REQUEST_ID, { exact: true })).toBeVisible();
    await expect(discounts.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/');

    await expect(page.getByRole('list', { name: 'Current discounts' })).toHaveCount(0);
    await expect(discounts.locator('.lw-empty-state')).toHaveCount(0);
    await expect(discounts.getByText(/^No discounts in/u)).toHaveCount(0);
  });

  test('keeps the recently added cards', async ({ page }) => {
    await page.goto('/');

    const recent = page.getByRole('region', { name: 'Recently added' });
    const cards = page.getByRole('list', { name: 'Recently added' }).getByRole('listitem');
    await expect(recent.getByRole('alert')).toHaveCount(0);
    await expect(cards).toHaveCount(8);
    await expect(cards.getByRole('heading', { name: 'Half Off Demo Game' })).toBeVisible();
    await expect(page.locator('[role="alert"]')).toHaveCount(1);
  });

  for (const theme of THEMES) {
    test(`has no accessibility violations in the ${theme} theme`, async ({ browser }) => {
      const context = await browser.newContext();
      await context.addCookies([{ name: THEME_COOKIE_NAME, value: theme, url: BASE_URL }]);
      const page = await context.newPage();

      await page.goto('/');
      await auditFor(page);

      await context.close();
    });
  }
});
