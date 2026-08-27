import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * The sales page against a populated database.
 *
 * tests/fixtures/sales.sql seeds every case the sale rule has to get right,
 * including three that must not appear at all, plus one expensive and deeply
 * discounted game whose price rank and discount rank disagree - without it,
 * sorting "by discount" and sorting "by price" can render the same order and
 * still look correct. Asserting only that the sales show up would pass
 * against a query that returned the whole catalog, so every test here that
 * checks a card also checks something absent.
 */

const THEME_COOKIE = 'theme';
const THEMES = ['light', 'dark'] as const;

// The one accepted exception, excluded here for the same reason
// tests/e2e/shell.spec.ts excludes it: the logotype's accent is brand, it is
// decorative, and the wordmark reads without it.
const LOGOTYPE = '.lw-header__wordmark-accent';

async function auditFor(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude(LOGOTYPE)
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe('sales browsing', () => {
  test('shows the games on sale in a named market and currency', async ({ page }) => {
    const response = await page.goto('/sales');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Current sales');
    // Germany sorts before the European Union and Japan, so it is the default
    // pair, and the page says so rather than leaving it to be inferred.
    await expect(page.getByText('Showing Germany prices, in EUR.')).toBeVisible();

    const results = page.getByRole('list', { name: 'Games on sale' });
    await expect(results.getByRole('listitem')).toHaveCount(3);
    await expect(results.getByRole('link', { name: /Half Off Demo Game/u })).toBeVisible();
    await expect(results.getByRole('link', { name: /Two Store Demo Game/u })).toBeVisible();
    await expect(results.getByRole('link', { name: /Steep Discount Demo Game/u })).toBeVisible();
  });

  test('leaves out an offer that is not a sale', async ({ page }) => {
    await page.goto('/sales');

    // Priced the same as its reference price, so there is nothing to discount.
    await expect(page.getByText('Equal Price Demo Game')).toHaveCount(0);
    // Cannot be bought at all.
    await expect(page.getByText('Withdrawn Demo Game')).toHaveCount(0);
    // A sale, but in another currency, so not in this view.
    await expect(page.getByText('Yen Sale Demo Game')).toHaveCount(0);
  });

  test('shows the price, the regular price and the discount together', async ({ page }) => {
    await page.goto('/sales');

    const card = page.getByRole('listitem').filter({ hasText: 'Half Off Demo Game' });
    await expect(card.getByText('€29.99')).toBeVisible();
    await expect(card.getByText('€59.99')).toBeVisible();
    await expect(card.getByLabel('50 percent off')).toBeVisible();
    await expect(card.getByText('Released 2024')).toBeVisible();
    // The store the price above is actually from, not only a count of them.
    await expect(card.getByText('Aurora Market')).toBeVisible();
  });

  test('shows one card for a game on sale at two stores, at the lower price, and names it', async ({
    page,
  }) => {
    await page.goto('/sales');

    const cards = page.getByRole('listitem').filter({ hasText: 'Two Store Demo Game' });
    await expect(cards).toHaveCount(1);
    // Vertex is cheaper than Aurora, so Vertex's price - and Vertex's name -
    // are the ones shown, with the other store disclosed rather than only
    // counted.
    await expect(cards.getByText('Vertex Store')).toBeVisible();
    await expect(cards.getByText('and 1 more')).toBeVisible();
    await expect(cards.getByText('€19.99')).toBeVisible();
    await expect(cards.getByText('€39.99')).toHaveCount(0);
    await expect(cards.getByText('Aurora Market')).toHaveCount(0);
  });

  test('links every card to the canonical game page and nowhere else', async ({ page }) => {
    await page.goto('/sales');

    const links = page.getByRole('list', { name: 'Games on sale' }).getByRole('link');
    const hrefs = await links.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('href') ?? ''),
    );

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/games\//u);
    }
    // The card is one link, so there is exactly one per result.
    await expect(links).toHaveCount(3);
  });

  test('reports how old each price is', async ({ page }) => {
    await page.goto('/sales');

    const card = page.getByRole('listitem').filter({ hasText: 'Half Off Demo Game' });
    await expect(card.locator('time')).toHaveAttribute('datetime', /^\d{4}-/u);
  });

  test('switches market and currency together, and never mixes them', async ({ page }) => {
    await page.goto('/sales?market=JP&currency=JPY');

    await expect(page.getByText('Showing Japan prices, in JPY.')).toBeVisible();
    await expect(page.getByText('Yen Sale Demo Game')).toBeVisible();
    await expect(page.getByText('Half Off Demo Game')).toHaveCount(0);

    // Yen has no minor unit, so a price rendered with decimals would mean the
    // exponent was assumed rather than read.
    const card = page.getByRole('listitem').filter({ hasText: 'Yen Sale Demo Game' });
    await expect(card.getByText('¥2,392')).toBeVisible();
    await expect(card.getByText('¥5,980')).toBeVisible();
  });

  /**
   * #2's fix: one control offering only pairs that hold a sale, rather than
   * two independent selects a visitor could submit in a combination that
   * exists for neither of them. Switching through it, rather than a direct
   * link, is what actually exercises the control.
   */
  test('switches market and currency through the one combined control', async ({ page }) => {
    await page.goto('/sales');

    await page.getByLabel('Market and currency').selectOption({ label: 'Japan, JPY' });
    await page.getByRole('button', { name: 'Apply market' }).click();

    await expect(page.getByText('Showing Japan prices, in JPY.')).toBeVisible();
    await expect(page.getByText('Yen Sale Demo Game')).toBeVisible();
    await expect(page.getByLabel('Market and currency')).toBeVisible();
  });

  test('says which market holds no sale rather than looking broken', async ({ page }) => {
    await page.goto('/sales?market=US&currency=USD');

    await expect(page.getByText('No United States sales right now')).toBeVisible();
    await expect(page.getByText('Sales could not be loaded')).toHaveCount(0);
  });

  test('narrows to one store, and offers the way back', async ({ page }) => {
    await page.goto('/sales?store=vertex-store');

    const results = page.getByRole('list', { name: 'Games on sale' });
    await expect(results.getByRole('listitem')).toHaveCount(1);
    await expect(results.getByText('Two Store Demo Game')).toBeVisible();
    // A region, not merely an attribute: aria-label on a role-less div is
    // dropped by most screen readers, which is why this checks the
    // accessible structure rather than the markup that used to stand in for it.
    await expect(page.getByRole('region', { name: 'Active filters' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reset all' })).toHaveAttribute('href', '/sales');
  });

  test('explains a filter combination that matches nothing', async ({ page }) => {
    await page.goto('/sales?minDiscount=99');

    await expect(page.getByText('No games match these filters')).toBeVisible();
    await expect(
      page.getByText('Remove a filter to see the 3 Germany games on sale.'),
    ).toBeVisible();
  });

  test('says a page past the last one does not exist, rather than an empty range', async ({
    page,
  }) => {
    const response = await page.goto('/sales?page=999');

    expect(response?.status()).toBe(200);
    await expect(page.getByText('There is no page 999')).toBeVisible();
    // Not the results heading, which would otherwise render "Showing 0–0".
    await expect(page.getByText(/^Showing \d/u)).toHaveCount(0);

    const goToFirstPage = page.getByRole('link', { name: 'Go to page 1' });
    await expect(goToFirstPage).toBeVisible();
    await goToFirstPage.click();
    await expect(page).toHaveURL('/sales?page=1');
  });

  test('refuses a filter it cannot honour, and keeps the form usable', async ({ page }) => {
    const response = await page.goto('/sales?minDiscount=0&page=0');

    expect(response?.status()).toBe(400);
    await expect(page.getByText('Some of those filters could not be used')).toBeVisible();
    await expect(page.getByText('Page numbers start at 1.')).toBeVisible();
    // The controls survive the refusal, so the combination can be corrected.
    await expect(page.getByRole('button', { name: 'Apply filters' })).toBeVisible();
  });

  test('orders by discount by default, and by price when asked, in genuinely different orders', async ({
    page,
  }) => {
    await page.goto('/sales');
    const byDiscount = await page
      .getByRole('list', { name: 'Games on sale' })
      .getByRole('heading', { level: 3 })
      .allInnerTexts();
    // Steep Discount is 80% off at €80.00; Two Store is 66% off at €19.99;
    // Half Off is 50% off at €29.99.
    expect(byDiscount).toEqual([
      'Steep Discount Demo Game',
      'Two Store Demo Game',
      'Half Off Demo Game',
    ]);

    await page.goto('/sales?market=DE&currency=EUR&sort=price');
    const byPrice = await page
      .getByRole('list', { name: 'Games on sale' })
      .getByRole('heading', { level: 3 })
      .allInnerTexts();
    // Lowest price first: €19.99, then €29.99, then €80.00 - the deepest
    // discount is now last, not first.
    expect(byPrice).toEqual([
      'Two Store Demo Game',
      'Half Off Demo Game',
      'Steep Discount Demo Game',
    ]);
  });

  /**
   * #8's fix: the visitor-facing inputs are whole units of the active
   * currency, not the minor units LUDWISE stores. €70 has to exclude the
   * €29.99 and €19.99 offers and keep the €80.00 one - typing 7000 would
   * have been required, and would have meant something else entirely.
   */
  test('filters by price in whole currency units, not stored minor units', async ({ page }) => {
    await page.goto('/sales');

    await page.getByLabel('Lowest price (EUR)').fill('70');
    await page.getByRole('button', { name: 'Apply filters' }).click();

    const results = page.getByRole('list', { name: 'Games on sale' });
    await expect(results.getByRole('listitem')).toHaveCount(1);
    await expect(results.getByText('Steep Discount Demo Game')).toBeVisible();
  });

  test('does not force the mobile filter panel open on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/sales');

    const panel = page.locator('.lw-sale-filters');
    await expect(panel).not.toHaveJSProperty('open', true);
    await expect(page.getByLabel('Market and currency')).not.toBeVisible();

    await panel.locator('summary').click();
    await expect(panel).toHaveJSProperty('open', true);
    await expect(page.getByLabel('Market and currency')).toBeVisible();
  });

  test('shows no advertising slot and claims no affiliate relationship', async ({ page }) => {
    await page.goto('/sales');

    // Neither exists, and a disclosure describing a relationship that does not
    // exist would be a false statement rather than a formality.
    for (const claim of ['Advertisement', 'Sponsored', 'affiliate', 'commission']) {
      await expect(page.getByText(claim, { exact: false })).toHaveCount(0);
    }
    await expect(page.getByText('Legitimate stores only')).toBeVisible();
  });

  for (const theme of THEMES) {
    test(`has no accessibility violations with results in the ${theme} theme`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      await context.addCookies([
        { name: THEME_COOKIE, value: theme, url: 'http://localhost:4322' },
      ]);
      const page = await context.newPage();
      await page.goto('/sales');

      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await auditFor(page);
      await context.close();
    });
  }

  // The active-filter chips render only once a filter is active, so the audit
  // above - run against the unfiltered default view - never reaches them.
  test('has no accessibility violations with an active filter', async ({ page }) => {
    await page.goto('/sales?minDiscount=1');
    await auditFor(page);
  });

  for (const width of [320, 375, 768, 1024]) {
    test(`does not scroll horizontally with results at ${String(width)}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/sales');

      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflows).toBe(false);
    });
  }
});
