import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';

const BASE_URL = 'http://localhost:4322';
const THEMES = ['light', 'dark'] as const;
const LOGOTYPE = '.lw-header__wordmark-accent';

async function auditFor(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude(LOGOTYPE)
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe('game detail', () => {
  test('renders canonical metadata and offers from multiple stores', async ({ page }) => {
    const response = await page.goto('/games/canonical-demo');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Canonical Demo Game');
    await expect(page.getByRole('heading', { name: 'About this game' })).toBeVisible();
    await expect(page.getByText('Orbit Market', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Copper Shop', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Free')).toBeVisible();
    await expect(page.getByText('¥1,800')).toBeVisible();
    await expect(page.getByText('KWD 3.500')).toBeVisible();
    await expect(page.getByText('Unavailable', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /View at Orbit Market/ }).first()).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'European Union · EUR' }).getByRole('row').nth(1),
    ).toContainText('Free');
  });

  test('renders a truthful no-offer state without treating it as an error', async ({ page }) => {
    const response = await page.goto('/games/no-offers-demo');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('No Offers Demo Game');
    await expect(page.getByText('No current offers')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'The game page is unavailable' })).toHaveCount(
      0,
    );
  });

  test('answers an unknown canonical slug with a 404 page', async ({ page }) => {
    const response = await page.goto('/games/does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Game not found');
    await expect(page.getByRole('link', { name: 'Browse games' })).toBeVisible();
  });
});

test.describe('canonical game search', () => {
  test('submits the native GET search with the canonical result URL', async ({ page }) => {
    await page.goto('/games');

    const search = page.getByRole('searchbox', { name: 'Search games' }).first();
    await search.fill('Canonical Demo Game');
    await search.press('Enter');

    expect(new URL(page.url()).searchParams.get('q')).toBe('Canonical Demo Game');
    await expect(page.getByRole('link', { name: 'Canonical Demo Game' })).toHaveAttribute(
      'href',
      '/games/canonical-demo',
    );
  });

  test('renders active filters, reset links, and a truthful no-results state', async ({ page }) => {
    await page.goto(
      '/games?store=orbit-market&market=EU&currency=EUR&min=1000&max=1500&discounted=true&fromYear=2025&toYear=2025',
    );

    await expect(page.getByText('Active filters')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reset all' })).toHaveAttribute('href', '/games');
    await expect(page.getByRole('link', { name: 'Canonical Demo Game' })).toBeVisible();

    await page.goto('/games?q=not-a-real-canonical-game');
    await expect(page.getByText('No games match your search', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reset' })).toHaveAttribute('href', '/games');
  });

  test('applies one filter when the rest of the form is submitted blank', async ({ page }) => {
    await page.goto('/games');

    await page.getByRole('checkbox', { name: 'Orbit Market' }).check();
    const [response] = await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Apply filters' }).click(),
    ]);

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).searchParams.getAll('store')).toEqual(['orbit-market']);
    await expect(page.getByText('The game catalogue could not be loaded')).toHaveCount(0);
    await expect(page.getByText('Those filters do not go together')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Canonical Demo Game' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Remove store filter: Orbit Market' }),
    ).toBeVisible();
  });

  test('treats a wholly blank filter submission as no filter at all', async ({ page }) => {
    await page.goto('/games');

    const [response] = await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Apply filters' }).click(),
    ]);

    expect(response?.status()).toBe(200);
    await expect(page.getByText('The game catalogue could not be loaded')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Canonical Demo Game' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'No Offers Demo Game' })).toBeVisible();
    await expect(page.getByLabel('Active filters')).toHaveCount(0);
  });

  test('keeps a searched term and its results across a blank filter submission', async ({
    page,
  }) => {
    await page.goto('/games?q=Canonical');

    const [response] = await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Apply filters' }).click(),
    ]);

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).searchParams.get('q')).toBe('Canonical');
    await expect(page.getByRole('link', { name: 'Canonical Demo Game' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'No Offers Demo Game' })).toHaveCount(0);
  });

  test('asks for the missing half of a market and currency pair instead of failing', async ({
    page,
  }) => {
    await page.goto('/games');

    await page.locator('select[name="market"]').selectOption('EU');
    const [response] = await Promise.all([
      page.waitForNavigation(),
      page.getByRole('button', { name: 'Apply filters' }).click(),
    ]);

    expect(response?.status()).toBe(400);
    await expect(page.getByText('The game catalogue could not be loaded')).toHaveCount(0);
    await expect(page.getByText('Those filters do not go together')).toBeVisible();
    await expect(
      page.getByText('Choose a market and a currency together, or leave both on Any.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeVisible();
    await expect(page.locator('select[name="market"]')).toHaveValue('EU');
  });

  test('keeps filter controls usable in the responsive disclosure', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/games');

    await expect(page.getByText('Filters', { exact: true })).toBeVisible();
    await expect(page.locator('select[name="market"]')).toBeVisible();
    await expect(page.getByLabel('Currently discounted')).toBeVisible();
  });
});

test.describe('game detail accessibility', () => {
  for (const theme of THEMES) {
    for (const path of ['/games', '/games?market=EU', '/games/canonical-demo']) {
      test(`has no axe violations on ${path} in the ${theme} theme`, async ({ browser }) => {
        const context = await browser.newContext();
        await context.addCookies([{ name: THEME_COOKIE_NAME, value: theme, url: BASE_URL }]);
        const page = await context.newPage();
        await page.goto(path);

        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await auditFor(page);
        await context.close();
      });
    }
  }
});

test.describe('game detail responsive layout', () => {
  for (const width of [320, 375, 768, 1024, 1280]) {
    test(`does not scroll horizontally at ${String(width)}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/games');

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows).toBe(false);
    });
  }
});
