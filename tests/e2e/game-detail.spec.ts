import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';
import { E2E_NOW_MS } from '../helpers/e2e-time.js';

const BASE_URL = 'http://localhost:4321';
const DETAIL_ROUTE = '/games/canonical-demo';
const STATES_ROUTE = '/games/states-demo';
const VIEWPORT_HEIGHT = 900;
const THEMES = ['light', 'dark'] as const;
const LOGOTYPE = '.lw-header__wordmark-accent';

async function auditFor(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude(LOGOTYPE)
    .analyze();
  expect(results.violations).toEqual([]);
}

async function expectCanonicalDetail(page: Page): Promise<void> {
  expect(new URL(page.url()).pathname).toBe(DETAIL_ROUTE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Canonical Demo Game');
  await expect(page.getByRole('heading', { name: 'Current offers' })).toBeVisible();
}

async function readOfferFacts(page: Page): Promise<readonly { store: string; price: string }[]> {
  return page
    .getByRole('region', { name: 'European Union · EUR' })
    .getByRole('row')
    .evaluateAll((rows) =>
      rows.slice(1).map((row) => {
        const cells = [...row.querySelectorAll('td')];
        const store = cells[0]?.firstElementChild?.textContent;
        const price = cells[2]?.querySelector('[aria-label]')?.getAttribute('aria-label');
        return {
          store: store?.replace(/\s+/gu, ' ').trim() ?? '',
          price: price ?? '',
        };
      }),
    );
}

test.describe('game detail', () => {
  test('renders canonical metadata and offers from multiple stores', async ({ page }) => {
    const response = await page.goto(DETAIL_ROUTE);

    expect(response?.status()).toBe(200);
    await expectCanonicalDetail(page);
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

  test('renders missing offer values without fabricating facts', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: VIEWPORT_HEIGHT });
    const response = await page.goto(STATES_ROUTE);

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(STATES_ROUTE);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Data States Demo Game');
    await expect(page.getByRole('heading', { level: 3 })).toHaveText('Market not provided');

    const table = page.getByRole('table');
    await expect(table).toHaveAccessibleName(
      'Market not provided, currency not provided for Data States Demo Game',
    );
    await expect(table.getByText('Not provided', { exact: true })).toBeVisible();
    await expect(table.getByText('€12.99', { exact: true })).toBeVisible();
    await expect(page.getByText('Freshness not provided', { exact: true })).toBeVisible();
    await expect(page.getByText('EUR', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Unavailable', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /View at Copper Shop/ })).toBeVisible();

    await auditFor(page);
  });

  test('renders deterministic freshness branches', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: VIEWPORT_HEIGHT });
    const response = await page.goto(STATES_ROUTE);

    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(STATES_ROUTE);
    await expect(page.getByText('Updated 5 min ago', { exact: true })).toBeVisible();
    await expect(page.getByText('Checked 2 hours ago', { exact: true })).toBeVisible();
    await expect(page.getByText('Last checked 2 days ago', { exact: true })).toBeVisible();
    await expect(page.getByText('Freshness not provided', { exact: true })).toBeVisible();
    await expect(page.locator('time').first()).toHaveAttribute(
      'datetime',
      new Date(E2E_NOW_MS - 5 * 60 * 1000).toISOString(),
    );
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
    test(`has no axe violations at a narrow width in the ${theme} theme`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 375, height: VIEWPORT_HEIGHT },
      });
      await context.addCookies([{ name: THEME_COOKIE_NAME, value: theme, url: BASE_URL }]);
      const page = await context.newPage();
      const response = await page.goto(DETAIL_ROUTE);

      expect(response?.status()).toBe(200);
      await expectCanonicalDetail(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await auditFor(page);
      await context.close();
    });
  }
});

test.describe('catalog accessibility', () => {
  for (const theme of THEMES) {
    for (const path of ['/games', '/games?market=EU']) {
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

test.describe('game detail monetization neutrality', () => {
  test('keeps factual offers and ordering unchanged across affiliate states', async ({
    browser,
  }) => {
    const states = ['none', 'affiliate'] as const;
    const facts = [] as (readonly { store: string; price: string }[])[];

    for (const state of states) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const response = await page.goto(`${DETAIL_ROUTE}?affiliate=${state}`);

      expect(response?.status()).toBe(200);
      await expectCanonicalDetail(page);
      facts.push(await readOfferFacts(page));
      await context.close();
    }

    expect(facts[0]).toEqual([
      { store: 'Orbit Market', price: 'Current price Free.' },
      {
        store: 'Orbit Market',
        price: 'Discounted price €12.99. Regular price €19.99.',
      },
      { store: 'Copper Shop', price: 'Current price €14.99.' },
    ]);
    expect(facts[1]).toEqual(facts[0]);
  });
});

test.describe('game detail responsive layout', () => {
  for (const width of [320, 375, 768, 1024, 1280]) {
    test(`keeps the canonical detail usable at ${String(width)}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      const response = await page.goto(DETAIL_ROUTE);

      expect(response?.status()).toBe(200);
      await expectCanonicalDetail(page);
      await expect(
        page.getByText(
          'A small fixture proving that a game page reads canonical data without knowing its source.',
        ),
      ).toBeVisible();
      await expect(page.getByText('¥1,800')).toBeVisible();
      await expect(page.getByText('KWD 3.500')).toBeVisible();

      const overflow = await page.evaluate(() => ({
        body: document.body.scrollWidth > document.body.clientWidth,
        document: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      }));
      expect(overflow).toEqual({ body: false, document: false });

      const offerTablesOverflow = await page.getByRole('table').evaluateAll((tables) =>
        tables.map((table) => {
          const viewport = table.parentElement;
          return viewport === null || viewport.scrollWidth > viewport.clientWidth;
        }),
      );
      expect(offerTablesOverflow.length).toBeGreaterThan(0);
      expect(offerTablesOverflow.every((overflows) => !overflows)).toBe(true);

      const actionBoxes = await page
        .getByRole('link', { name: /View at (Orbit Market|Copper Shop)/ })
        .evaluateAll((links) =>
          links.map((link) => {
            const box = link.getBoundingClientRect();
            return { height: box.height, left: box.left, right: box.right, width: box.width };
          }),
        );
      const viewportWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(
        actionBoxes.length > 0 &&
          actionBoxes.every(
            (box) => box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= viewportWidth,
          ),
      ).toBe(true);

      const metadata = page.getByRole('heading', { name: 'Game details' }).locator('..');
      const metadataBoxes = await metadata.locator('dt, dd').evaluateAll((items) =>
        items.map((item) => {
          const box = item.getBoundingClientRect();
          return { bottom: box.bottom, left: box.left, right: box.right, top: box.top };
        }),
      );
      for (let index = 0; index < metadataBoxes.length; index += 1) {
        for (let next = index + 1; next < metadataBoxes.length; next += 1) {
          const current = metadataBoxes[index]!;
          const following = metadataBoxes[next]!;
          const overlaps =
            current.left < following.right &&
            current.right > following.left &&
            current.top < following.bottom &&
            current.bottom > following.top;
          expect(overlaps).toBe(false);
        }
      }

      const headings = await page.getByRole('article').getByRole('heading').allTextContents();
      expect(headings.slice(1, 4)).toEqual(['About this game', 'Game details', 'Current offers']);
    });
  }
});
