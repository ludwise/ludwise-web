import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';
import { DATA_NOTES, DATA_NOTES_SUMMARY, DATA_SOURCES_LEAD } from '../helpers/data-notes.js';
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

interface OfferFact {
  readonly availability: string;
  readonly edition: string;
  readonly price: string;
  readonly store: string;
}

async function readOfferFacts(page: Page): Promise<readonly OfferFact[]> {
  return page
    .getByRole('region', { name: 'European Union · EUR' })
    .getByRole('row')
    .evaluateAll((rows) =>
      rows.slice(1).map((row) => {
        const cells = [...row.querySelectorAll('td')];
        const store = cells[0]?.firstElementChild?.textContent;
        const edition = cells[1]?.textContent;
        const price = cells[2]?.querySelector('[aria-label]')?.getAttribute('aria-label');
        return {
          availability: row.getAttribute('data-availability') ?? '',
          edition: edition?.replace(/\s+/gu, ' ').trim() ?? '',
          store: store?.replace(/\s+/gu, ' ').trim() ?? '',
          price: price ?? '',
        };
      }),
    );
}

function offerRow(page: Page, storeName: string) {
  return page.getByRole('row').filter({ hasText: storeName });
}

async function gotoStatesDetail(page: Page): Promise<void> {
  await page.setViewportSize({ width: 375, height: VIEWPORT_HEIGHT });
  const response = await page.goto(STATES_ROUTE);

  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(STATES_ROUTE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Data States Demo Game');
}

test.describe('game detail', () => {
  test('renders canonical metadata and offers from multiple stores', async ({ page }) => {
    const response = await page.goto(DETAIL_ROUTE);

    expect(response?.status()).toBe(200);
    await expectCanonicalDetail(page);
    await expect(page.getByRole('heading', { name: 'About this game' })).toBeVisible();
    const metadata = page.getByRole('heading', { name: 'Game details' }).locator('..');
    const genres = metadata
      .locator('dt')
      .filter({ hasText: 'Genres' })
      .locator('xpath=following-sibling::dd[1]')
      .getByRole('listitem');
    const platforms = metadata
      .locator('dt')
      .filter({ hasText: 'Platforms' })
      .locator('xpath=following-sibling::dd[1]')
      .getByRole('listitem');
    await expect(genres).toHaveText(['Action', 'RPG']);
    await expect(platforms).toHaveText(['Linux', 'Windows']);
    await expect(genres).toHaveCount(2);
    await expect(platforms).toHaveCount(2);
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

  test('omits empty classification groups without inventing metadata', async ({ page }) => {
    const response = await page.goto('/games/half-off-demo');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Half Off Demo Game');
    await expect(page.getByRole('heading', { name: 'Game details' })).toBeVisible();
    await expect(page.getByText('Release date', { exact: true })).toBeVisible();
    await expect(page.getByText('Genres', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Platforms', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Unknown', { exact: true })).toHaveCount(0);
    await expect(page.getByText('N/A', { exact: true })).toHaveCount(0);
  });

  test('renders missing market and currency without inventing values', async ({ page }) => {
    await gotoStatesDetail(page);
    const missingMarket = page.getByRole('region', {
      name: 'Market not provided · EUR',
      exact: true,
    });
    await expect(missingMarket.getByRole('table')).toHaveAccessibleName(
      'Market not provided, EUR offers for Data States Demo Game',
    );

    const missingCurrency = page.getByRole('region', {
      name: 'European Union',
      exact: true,
    });
    await expect(missingCurrency.getByRole('table')).toHaveAccessibleName(
      'European Union, currency not provided for Data States Demo Game',
    );

    await expect(page.getByRole('heading', { name: 'Market not provided · EUR' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'European Union', exact: true })).toBeVisible();
    await expect(page.getByText('Genres', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Platforms', { exact: true })).toHaveCount(0);

    await auditFor(page);
  });

  test('renders a missing price and freshness value explicitly', async ({ page }) => {
    await gotoStatesDetail(page);

    const missingPrice = offerRow(page, 'Fallow Store');
    await expect(missingPrice.locator('.lw-price')).toHaveAttribute(
      'aria-label',
      'Price not provided.',
    );
    await expect(missingPrice.locator('.lw-price')).toContainText('Not provided');

    const missingFreshness = offerRow(page, 'Gable Store').locator('.lw-freshness');
    await expect(missingFreshness).toHaveAttribute('data-level', 'unknown');
    await expect(missingFreshness).toContainText('Freshness not provided');
    await expect(missingFreshness.locator('time')).toHaveCount(0);
  });

  test('renders distinct freshness ages and availability states', async ({ page }) => {
    await gotoStatesDetail(page);

    const expected = [
      { ageMs: 5 * 60 * 1000, level: 'fresh', label: 'Updated 5 min ago', store: 'Copper Shop' },
      {
        ageMs: 2 * 60 * 60 * 1000,
        level: 'aging',
        label: 'Checked 2 hours ago',
        store: 'Delta Store',
      },
      {
        ageMs: 2 * 24 * 60 * 60 * 1000,
        level: 'stale',
        label: 'Last checked 2 days ago',
        store: 'Echo Store',
      },
      {
        ageMs: 30 * 60 * 1000,
        level: 'unavailable',
        label: 'Harbor Store temporarily unavailable',
        store: 'Harbor Store',
      },
    ] as const;

    for (const state of expected) {
      const freshness = offerRow(page, state.store).locator('.lw-freshness');
      await expect(freshness).toHaveAttribute('data-level', state.level);
      await expect(freshness).toContainText(state.label);
      await expect(freshness.locator('time')).toHaveAttribute(
        'datetime',
        new Date(E2E_NOW_MS - state.ageMs).toISOString(),
      );
    }

    await expect(offerRow(page, 'Gable Store').locator('.lw-freshness')).toHaveAttribute(
      'data-level',
      'unknown',
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

  test('says a game carries no catalogue details rather than rendering a bare title', async ({
    page,
  }) => {
    // This fixture's `metadata` is null. Every detail section is conditional,
    // so without this the page is a heading followed by nothing, which reads
    // as content that failed to load.
    await page.goto('/games/no-offers-demo');

    await expect(page.getByText('No catalogue details yet')).toBeVisible();
    await expect(
      page.getByText(
        'LUDWISE has not collected a description, developer, publisher or release date for this game yet.',
      ),
    ).toBeVisible();
    // A fact about the catalog, not a failure. Nothing here is an alert.
    await expect(page.locator('[role="alert"]')).toHaveCount(0);
  });

  test('says once that every price on the page is old', async ({ page }) => {
    // The canonical fixture was observed on 15 June 2025 and the suite's clock
    // is 30 August 2026. A page of offers that says nothing about that presents
    // a year-old price as the price.
    await page.goto(DETAIL_ROUTE);

    await expect(page.getByText('These prices may be out of date')).toBeVisible();
    await expect(
      page.getByText('The newest price on this page was checked Jun 15, 2025.'),
    ).toBeVisible();
  });

  test('reads the page age from the newest offer, not the oldest', async ({ page }) => {
    // The states fixture holds an offer checked two days ago beside one checked
    // five minutes ago. One old row does not make the page out of date, and a
    // warning that fires on it is one a visitor learns to ignore.
    await gotoStatesDetail(page);

    await expect(offerRow(page, 'Echo Store').locator('.lw-freshness')).toHaveAttribute(
      'data-level',
      'stale',
    );
    await expect(page.getByText('These prices may be out of date')).toHaveCount(0);
  });

  /**
   * What the words beside a price mean, for a visitor who asks. Each note is a
   * claim about this page's data. So each is asserted against the fixture that
   * earns it, rather than as decoration the page always carries.
   */
  test('explains the words a price carries, behind one disclosure', async ({ page }) => {
    await page.goto(DETAIL_ROUTE);

    const summary = page.getByText(DATA_NOTES_SUMMARY);
    await expect(summary).toHaveCount(1);
    // The page leads with the prices. The explanation is one click away, and
    // reachable without script, which is why it is a details element.
    await expect(page.getByText(DATA_NOTES.checkTimes)).toBeHidden();
    await summary.click();

    await expect(page.getByText(DATA_NOTES.checkTimes)).toBeVisible();
    // Every price here was read in June 2025 against a clock of August 2026.
    await expect(page.getByText(DATA_NOTES.oldCheckTimes)).toBeVisible();
    // One offer is discounted, and the backend worked that percentage out.
    await expect(page.getByText(DATA_NOTES.derivedDiscounts)).toBeVisible();
    await expect(page.getByText(DATA_NOTES.noHistory)).toBeVisible();
    // Every store here reported when it was read, so there is no absence to
    // explain. A note that fires anyway describes a state nobody can see.
    await expect(page.getByText(DATA_NOTES.untimedPrices)).toHaveCount(0);
  });

  test('explains a missing check time only where one is missing', async ({ page }) => {
    await gotoStatesDetail(page);

    await page.getByText(DATA_NOTES_SUMMARY).click();
    await expect(page.getByText(DATA_NOTES.untimedPrices)).toBeVisible();
    // One row was read two days ago, so the note that explains an old price
    // belongs here even though the page-level warning stays silent. That
    // warning reads the newest observation. A visitor reads one row.
    await expect(page.getByText(DATA_NOTES.oldCheckTimes)).toBeVisible();
    await expect(page.getByText('These prices may be out of date')).toHaveCount(0);
    // No offer in this fixture is discounted.
    await expect(page.getByText(DATA_NOTES.derivedDiscounts)).toHaveCount(0);
  });

  test('names the source of each price and the moment it was read', async ({ page }) => {
    await page.goto(DETAIL_ROUTE);
    const row = offerRow(page, 'Copper Shop').first();

    await row.getByText('Source details').click();
    const provenance = row.locator('.lw-provenance');
    // The store sells the game. The source is where LUDWISE read the price,
    // and the two are different parties that a row must not merge.
    await expect(provenance.getByText('Source', { exact: true })).toBeVisible();
    await expect(provenance.getByText('Copper Source')).toBeVisible();
    await expect(provenance.getByText('Last checked', { exact: true })).toBeVisible();
    // The exact timestamp behind "Last checked 441 days ago". The zone is the
    // runtime's, so the assertion reads the parts that do not depend on it.
    await expect(provenance.locator('dd').last()).toHaveText(
      /Jun \d{1,2}, 2025, \d{1,2}:\d{2}\s(AM|PM)/u,
    );
  });

  test('says which source each catalogue value came from, in words', async ({ page }) => {
    // The contract states this as `release_date` and `direct`. Neither is a
    // phrase a visitor has met before.
    await page.goto(DETAIL_ROUTE);

    await page.getByText('Where this information came from').click();
    await expect(
      page.getByText('LUDWISE took each value from the source named beside it.'),
    ).toBeVisible();
    await expect(
      page.getByText('Release date: Orbit Source, supplied by the source'),
    ).toBeVisible();
    await expect(page.getByText('release_date')).toHaveCount(0);
  });

  /**
   * The credit for the sources this page carried, checked as a visitor meets
   * it. The visibility assertion is the one that matters. Content in a closed
   * disclosure element is not visible, so this test fails if the block is ever
   * folded into one.
   */
  test('credits the sources it carried, in the open', async ({ page }) => {
    await page.goto(DETAIL_ROUTE);
    const block = page.getByRole('region', { name: 'Data sources' });

    await expect(block).toBeVisible();
    // Issue #71 decided the placement and issue #15 keeps it. Visibility alone
    // would still pass inside an open details element, so the ancestor is
    // asserted directly.
    await expect(page.locator('details .lw-data-sources')).toHaveCount(0);
    // A credit with no explanation reads as a list of partners. These
    // providers supplied data, and none of them sells the game.
    await expect(block.getByText(DATA_SOURCES_LEAD)).toBeVisible();
    await expect(block).toContainText('Game information');
    await expect(block).toContainText('Images and video');
    await expect(block).toContainText('Offers and prices');

    await expect(block.getByRole('link', { name: 'IGDB' })).toHaveAttribute(
      'href',
      'https://www.igdb.com/',
    );
    // A name the address map does not hold is still credited, as plain text.
    await expect(block).toContainText('Orbit Source');
    await expect(block.getByRole('link', { name: 'Orbit Source' })).toHaveCount(0);
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

test.describe('game detail offer ordering', () => {
  test('renders factual offers in backend-provided order', async ({ page }) => {
    const response = await page.goto(DETAIL_ROUTE);

    expect(response?.status()).toBe(200);
    await expectCanonicalDetail(page);
    const facts = await readOfferFacts(page);
    expect(facts).toEqual([
      {
        availability: 'available',
        edition: 'Deluxe edition',
        price: 'Current price Free.',
        store: 'Orbit Market',
      },
      {
        availability: 'available',
        edition: 'Base game',
        price: 'Discounted price €12.99. Regular price €19.99.',
        store: 'Orbit Market',
      },
      {
        availability: 'available',
        edition: 'Base game',
        price: 'Current price €14.99.',
        store: 'Copper Shop',
      },
    ]);
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
