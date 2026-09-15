import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';
import { REGION_COOKIE_NAME } from '../../src/lib/region/region-cookie.js';
import { detectCountry } from '../helpers/e2e-region.js';
import { LOGOTYPES } from '../helpers/logotypes.js';

/**
 * The visitor pricing region, from the first visit to a saved choice (#135).
 *
 * The order is fixed: a saved choice, then the country the edge detected, then
 * the fallback region. The development server reads the detected country from
 * a test header, because `request.cf` there describes the machine that runs it.
 * The recorded regions are DE (the fallback), EU, GB, JP and US.
 */

const BASE_URL = 'http://localhost:4321';
const THEMES = ['light', 'dark'] as const;

/** Astro removes the `ssr` attribute from an island once it has filled. */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
}

function regionButton(page: Page, label: string): Locator {
  return page.getByRole('button', { name: `Region: ${label}` });
}

async function openRegionControl(page: Page, label: string): Promise<Locator> {
  await waitForHydration(page);
  await regionButton(page, label).click();
  const dialog = page.getByRole('dialog', { name: `Region: ${label}` });
  await expect(dialog).toBeVisible();
  return dialog;
}

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

test.describe('automatic region selection', () => {
  test('uses the fallback region on a first visit with no detected country', async ({ page }) => {
    const response = await page.goto('/sales');

    expect(response?.status()).toBe(200);
    await expect(regionButton(page, 'Germany · EUR')).toBeVisible();
    await expect(page.getByText('Prices for Germany · EUR.')).toBeVisible();
    // Nothing is saved on the device until the visitor saves a region.
    expect(await response?.headerValue('set-cookie')).toBeNull();
    expect((await page.context().cookies()).map((cookie) => cookie.name)).not.toContain(
      REGION_COOKIE_NAME,
    );
  });

  test('uses the country the edge detected', async ({ page }) => {
    await detectCountry(page, 'JP');
    await page.goto('/sales');

    await expect(regionButton(page, 'Japan · JPY')).toBeVisible();
    await expect(page.getByText('Prices for Japan · JPY.')).toBeVisible();
    await expect(page.getByText('Yen Sale Demo Game')).toBeVisible();
    await expect(page.getByText('Half Off Demo Game')).toHaveCount(0);
  });

  test('uses the fallback region when the detected country has no pricing region', async ({
    page,
  }) => {
    await detectCountry(page, 'CZ');
    await page.goto('/sales');

    await expect(regionButton(page, 'Germany · EUR')).toBeVisible();
    await expect(page.getByText('Half Off Demo Game')).toBeVisible();
  });

  test('shows the region control on a page that holds no price', async ({ page }) => {
    await detectCountry(page, 'GB');
    await page.goto('/about');

    await expect(regionButton(page, 'United Kingdom · GBP')).toBeVisible();
  });
});

test.describe('the region control', () => {
  test('explains the choice, and derives the currency from the region', async ({ page }) => {
    await page.goto('/sales');
    const dialog = await openRegionControl(page, 'Germany · EUR');

    await expect(dialog.getByRole('heading', { name: 'Region' })).toBeVisible();
    await expect(dialog.getByText('Prices and availability depend on your region.')).toBeVisible();
    await expect(
      dialog.getByText("LUDWISE doesn't convert prices between currencies."),
    ).toBeVisible();

    // One selector. The currency is a fact of the region, not a second choice.
    await expect(dialog.getByRole('combobox')).toHaveCount(1);
    await expect(dialog.locator('output')).toHaveText('EUR');
    await dialog.getByLabel('Choose a region').selectOption({ label: 'Japan · JPY' });
    await expect(dialog.locator('output')).toHaveText('JPY');
  });

  test('saves a choice that wins over detection and survives a reload and a later visit', async ({
    browser,
    page,
  }) => {
    await detectCountry(page, 'JP');
    await page.goto('/sales?sort=price');
    const dialog = await openRegionControl(page, 'Japan · JPY');

    await dialog.getByLabel('Choose a region').selectOption({ label: 'Germany · EUR' });
    await dialog.getByRole('button', { name: 'Save' }).click();

    // Back on the same page, with its query, now in the chosen region.
    await page.waitForURL('/sales?sort=price');
    await expect(regionButton(page, 'Germany · EUR')).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Games on sale' }).getByRole('heading', { level: 3 }),
    ).toHaveText(['Two Store Demo Game', 'Half Off Demo Game', 'Steep Discount Demo Game']);

    const saved = (await page.context().cookies()).find(
      (cookie) => cookie.name === REGION_COOKIE_NAME,
    );
    expect(saved?.value).toBe('DE');
    expect(saved?.httpOnly).toBe(true);
    expect(saved?.sameSite).toBe('Lax');
    // A persistent cookie, not one that ends with the browser session.
    expect(saved?.expires ?? 0).toBeGreaterThan(Date.now() / 1000 + 300 * 24 * 60 * 60);

    await page.reload();
    await expect(regionButton(page, 'Germany · EUR')).toBeVisible();

    // A later visit, in a fresh browser session that still holds the cookie.
    const later = await browser.newContext({ storageState: await page.context().storageState() });
    const laterPage = await later.newPage();
    await detectCountry(laterPage, 'JP');
    await laterPage.goto('/sales');
    await expect(regionButton(laterPage, 'Germany · EUR')).toBeVisible();
    await expect(laterPage.getByText('Yen Sale Demo Game')).toHaveCount(0);
    await later.close();
  });

  test('changes region with the keyboard alone, and Escape closes it', async ({ page }) => {
    await page.goto('/sales');
    await waitForHydration(page);
    const trigger = regionButton(page, 'Germany · EUR');

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const select = page.getByRole('dialog').getByLabel('Choose a region');
    await expect(select).toBeFocused();
    // Options are ordered by name: European Union, Germany, Japan, and so on.
    await page.keyboard.press('ArrowDown');
    await expect(select).toHaveValue('JP');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Save' })).toBeFocused();
    await page.keyboard.press('Enter');

    await page.waitForURL('/sales');
    await expect(regionButton(page, 'Japan · JPY')).toBeVisible();
  });

  test('changes region from the menu at a narrow width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/sales');
    await waitForHydration(page);

    await page.getByRole('banner').getByRole('button', { name: 'Menu', exact: true }).click();
    const dialog = await openRegionControl(page, 'Germany · EUR');
    const box = await dialog.boundingBox();
    expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 0) <= 375).toBe(true);

    await dialog.getByLabel('Choose a region').selectOption({ label: 'United States · USD' });
    await dialog.getByRole('button', { name: 'Save' }).click();

    await page.waitForURL('/sales');
    await expect(page.getByText('No United States sales right now')).toBeVisible();
  });

  test('keeps the current region and explains a choice it refuses', async ({ page }) => {
    await page.goto('/sales?sort=price');
    const dialog = await openRegionControl(page, 'Germany · EUR');

    // A region the backend does not support, as a stale or edited form sends it.
    await dialog.getByLabel('Choose a region').evaluate((element) => {
      (element as unknown as HTMLSelectElement).add(new Option('France', 'FR', true, true));
    });
    const [response] = await Promise.all([
      page.waitForResponse(
        (candidate) =>
          new URL(candidate.url()).pathname === '/region' &&
          candidate.request().method() === 'POST',
      ),
      dialog.getByRole('button', { name: 'Save' }).click(),
    ]);

    expect(response.status()).toBe(400);
    await expect(page.getByText("That region can't be used")).toBeVisible();
    await expect(page.getByText("Your region hasn't changed.")).toBeVisible();
    await expect(
      page.getByRole('main').getByRole('link', { name: 'Back to the page you were on' }).first(),
    ).toHaveAttribute('href', '/sales?sort=price');
    await expect(page.getByText('Current region: Germany · EUR')).toBeVisible();
    expect((await page.context().cookies()).map((cookie) => cookie.name)).not.toContain(
      REGION_COOKIE_NAME,
    );
  });

  test('discards a saved region that is no longer supported', async ({ page }) => {
    await page.context().addCookies([{ name: REGION_COOKIE_NAME, value: 'FR', url: BASE_URL }]);
    await detectCountry(page, 'JP');
    const response = await page.goto('/sales');

    // Resolved again through detection, and the stale value removed.
    await expect(regionButton(page, 'Japan · JPY')).toBeVisible();
    expect(await response?.headerValue('set-cookie')).toMatch(/^region=;.*Max-Age=0/u);
    expect((await page.context().cookies()).map((cookie) => cookie.name)).not.toContain(
      REGION_COOKIE_NAME,
    );
  });

  test('discards an unsupported saved region on a page that holds no price', async ({ page }) => {
    await page.context().addCookies([{ name: REGION_COOKIE_NAME, value: 'FR', url: BASE_URL }]);
    const response = await page.goto('/about');

    await expect(regionButton(page, 'Germany · EUR')).toBeVisible();
    expect(await response?.headerValue('set-cookie')).toMatch(/^region=;.*Max-Age=0/u);
  });

  test('never asks the browser for a location', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: string[] = [];
      Object.assign(window, { geolocationCalls: calls });
      for (const method of ['getCurrentPosition', 'watchPosition'] as const) {
        Object.defineProperty(navigator.geolocation, method, {
          value: () => calls.push(method),
        });
      }
    });

    await page.goto('/sales');
    const dialog = await openRegionControl(page, 'Germany · EUR');
    await dialog.getByLabel('Choose a region').selectOption({ label: 'Japan · JPY' });
    await dialog.getByRole('button', { name: 'Save' }).click();
    await page.waitForURL('/sales');
    await waitForHydration(page);

    expect(
      await page.evaluate(() => (window as { geolocationCalls?: string[] }).geolocationCalls),
    ).toEqual([]);
  });

  for (const theme of THEMES) {
    test(`has no accessibility violations while open in the ${theme} theme`, async ({
      browser,
    }) => {
      const context = await browser.newContext();
      await context.addCookies([{ name: THEME_COOKIE_NAME, value: theme, url: BASE_URL }]);
      const page = await context.newPage();
      await page.goto('/sales');
      await openRegionControl(page, 'Germany · EUR');

      await auditFor(page);
      await context.close();
    });
  }
});

test.describe('the region page', () => {
  test('changes region without script, and returns to the page and its query', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/sales?sort=price');

    await page.getByRole('main').getByRole('link', { name: 'Change region' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Region');
    await page.getByLabel('Choose a region').selectOption({ label: 'Japan · JPY' });
    await page.getByRole('button', { name: 'Save' }).click();

    await page.waitForURL('/sales?sort=price');
    await expect(page.getByText('Prices for Japan · JPY.')).toBeVisible();
    await context.close();
  });

  test('refuses a region choice posted from another site', async ({ request }) => {
    const response = await request.post('/region', {
      form: { country: 'JP', return: '/sales' },
      headers: { origin: 'https://attacker.example' },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(403);
    expect(response.headers()['set-cookie'] ?? '').not.toContain(`${REGION_COOKIE_NAME}=`);
  });

  test('never sends the visitor to another site after a save', async ({ request }) => {
    const response = await request.post('/region', {
      form: { country: 'JP', return: '//attacker.example/sales' },
      headers: { origin: BASE_URL },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    expect(response.headers()['location']).toBe('/');
  });
});
