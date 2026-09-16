import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';
import { detectCountry } from '../helpers/e2e-region.js';
import { LOGOTYPES } from '../helpers/logotypes.js';

/**
 * The home page against the recorded home lists (ludwise-web#123).
 *
 * With no detected country the fallback DE pair applies, and its lists are
 * `recently_verified`. The JP lists are `stale`, so a JP visitor sees the
 * stale state. `empty.spec.ts`, `degraded.spec.ts` and
 * `home-list-unavailable.spec.ts` cover the other states.
 */

const BASE_URL = 'http://localhost:4321';
const THEMES = ['light', 'dark'] as const;

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

function list(page: Page, name: 'Current discounts' | 'Recently added'): Locator {
  return page.getByRole('list', { name });
}

function section(page: Page, name: 'Current discounts' | 'Recently added'): Locator {
  return page.getByRole('region', { name });
}

test.describe('the home page', () => {
  test('renders the search panel, then current discounts, then recently added', async ({
    page,
  }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search the catalogue');
    const headings = await page.getByRole('main').locator('h1, h2').allTextContents();
    expect(headings).toEqual(['Search the catalogue', 'Current discounts', 'Recently added']);
  });

  test('searches the catalogue with the same native GET form as the header', async ({ page }) => {
    await page.goto('/');

    const panel = page.getByRole('region', { name: 'Search the catalogue' });
    await panel.getByRole('searchbox', { name: 'Search the catalogue' }).fill('half');
    await panel.getByRole('button', { name: 'Search' }).click();

    await page.waitForURL('/games?q=half');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('links each section to its full list', async ({ page }) => {
    await page.goto('/');

    await expect(
      section(page, 'Current discounts').getByRole('link', { name: 'All sales' }),
    ).toHaveAttribute('href', '/sales');
    await expect(
      section(page, 'Recently added').getByRole('link', { name: 'All games' }),
    ).toHaveAttribute('href', '/games');
  });

  test('renders the discounts in the order the backend chose', async ({ page }) => {
    await page.goto('/');

    const titles = await list(page, 'Current discounts').getByRole('heading').allTextContents();
    expect(titles).toEqual([
      'Steep Discount Demo Game',
      'Two Store Demo Game',
      'Half Off Demo Game',
    ]);
  });

  test('renders every recently added game in the order the backend chose', async ({ page }) => {
    await page.goto('/');

    const titles = await list(page, 'Recently added').getByRole('heading').allTextContents();
    expect(titles).toEqual([
      'Steep Discount Demo Game',
      'Yen Sale Demo Game',
      'Withdrawn Demo Game',
      'Equal Price Demo Game',
      'Two Store Demo Game',
      'Half Off Demo Game',
      'Promoted Cover Demo Game',
      'No Offers Demo Game',
    ]);
  });

  test('gives every shown price its store and its freshness', async ({ page }) => {
    await page.goto('/');

    const card = list(page, 'Current discounts')
      .getByRole('listitem')
      .filter({ hasText: 'Half Off Demo Game' });
    await expect(card.getByText('€29.99')).toBeVisible();
    await expect(card.getByText('€59.99')).toBeVisible();
    await expect(card.getByLabel('50 percent off')).toBeVisible();
    await expect(card.getByText('Aurora Market')).toBeVisible();
    await expect(card.locator('.lw-freshness')).toHaveAttribute('data-state', 'recently_verified');
    await expect(card.locator('time')).toHaveAttribute('datetime', /^\d{4}-/u);

    const priced = list(page, 'Recently added').locator('.lw-price');
    const freshness = list(page, 'Recently added').locator('.lw-freshness');
    await expect(priced).toHaveCount(await freshness.count());
  });

  test('keeps a recently added game with no price in this region, without a price', async ({
    page,
  }) => {
    await page.goto('/');

    const card = list(page, 'Recently added')
      .getByRole('listitem')
      .filter({ hasText: 'Withdrawn Demo Game' });
    await expect(card.getByText('No price in this region')).toBeVisible();
    await expect(card.locator('.lw-price')).toHaveCount(0);
    await expect(card.locator('.lw-freshness')).toHaveCount(0);
  });

  test('links every card to the canonical game page as one link', async ({ page }) => {
    await page.goto('/');

    for (const name of ['Current discounts', 'Recently added'] as const) {
      const items = list(page, name).getByRole('listitem');
      const links = list(page, name).getByRole('link');
      await expect(links).toHaveCount(await items.count());
      for (const href of await links.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('href') ?? ''),
      )) {
        expect(href).toMatch(/^\/games\/[a-z0-9-]+$/u);
      }
    }
  });

  test('draws the artwork, and keeps the frame when a game has none', async ({ page }) => {
    await page.goto('/');
    const cards = list(page, 'Recently added').getByRole('listitem');

    const withArtwork = cards.filter({ hasText: 'Promoted Cover Demo Game' });
    await expect(withArtwork.locator('img')).toHaveAttribute(
      'src',
      '/media/images.igdb.com/igdb/image/upload/t_1080p/demo-cover-only.jpg',
    );
    await expect(withArtwork.locator('img')).toHaveAttribute('loading', 'lazy');

    const without = cards.filter({ hasText: 'No Offers Demo Game' });
    await expect(without.locator('img')).toHaveCount(0);
    await expect(without.getByText('No artwork available')).toBeAttached();

    const heights = await cards
      .locator('.lw-artwork')
      .evaluateAll((frames) =>
        frames.map((frame) => Math.round(frame.getBoundingClientRect().height)),
      );
    expect(new Set(heights).size).toBe(1);
  });

  test('says nothing is out of date when the backend calls the lists recent', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('These prices may be out of date')).toHaveCount(0);
  });

  test('warns in each list when the backend calls its prices stale', async ({ page }) => {
    await detectCountry(page, 'JP');
    await page.goto('/');

    await expect(page.getByText('Prices for Japan · JPY.')).toBeVisible();
    for (const name of ['Current discounts', 'Recently added'] as const) {
      await expect(section(page, name).getByText('These prices may be out of date')).toBeVisible();
    }
    const card = list(page, 'Current discounts')
      .getByRole('listitem')
      .filter({ hasText: 'Yen Sale Demo Game' });
    await expect(card.locator('.lw-freshness')).toHaveAttribute('data-state', 'stale');
    await expect(card.getByText('¥2,392')).toBeVisible();
  });

  test('refreshes both lists in the region the visitor saves', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);

    await page.getByRole('button', { name: 'Region: Germany, DE · EUR' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Region: Germany, DE · EUR' });
    await dialog.getByLabel('Choose a region').selectOption('JP');
    await dialog.getByRole('button', { name: 'Apply' }).click();

    await page.waitForURL('/');
    await expect(page.getByText('Prices for Japan · JPY.')).toBeVisible();
    await expect(list(page, 'Current discounts').getByRole('listitem')).toHaveCount(1);
    await expect(list(page, 'Recently added').getByText('€', { exact: false })).toHaveCount(0);
  });

  for (const width of [320, 768, 1024, 1600]) {
    test(`reflows the grids without horizontal scrolling at ${String(width)}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);

      for (const name of ['Current discounts', 'Recently added'] as const) {
        const grid = list(page, name);
        const box = await grid.boundingBox();
        expect(box !== null && box.x >= 0 && box.x + box.width <= width).toBe(true);
      }
    });
  }

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

  test('has no accessibility violations with stale lists', async ({ page }) => {
    await detectCountry(page, 'JP');
    await page.goto('/');
    await auditFor(page);
  });
});
