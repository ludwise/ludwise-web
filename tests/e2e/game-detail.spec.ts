import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';
import { DATA_NOTES, DATA_NOTES_SUMMARY, DATA_SOURCES_LEAD } from '../helpers/data-notes.js';
import { detectCountry, TEST_COUNTRY_HEADER } from '../helpers/e2e-region.js';
import { E2E_NOW_MS } from '../helpers/e2e-time.js';
import { LOGOTYPES } from '../helpers/logotypes.js';

const BASE_URL = 'http://localhost:4321';
const DETAIL_ROUTE = '/games/canonical-demo';
const STATES_ROUTE = '/games/states-demo';
const VIEWPORT_HEIGHT = 900;
const THEMES = ['light', 'dark'] as const;

/**
 * The canonical fixture prices its offers in the EU region, which the game
 * detail fixture seeds. A test of a game priced in Germany detects DE instead.
 */
test.use({
  extraHTTPHeaders: { 'x-ludwise-test-now': String(E2E_NOW_MS), [TEST_COUNTRY_HEADER]: 'EU' },
});

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
    await expect(page.getByRole('link', { name: /View at Orbit Market/ }).first()).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'European Union · EUR' }).getByRole('row').nth(1),
    ).toContainText('Free');
  });

  test("shows only the active region's offers, in its own currency", async ({ page }) => {
    await page.goto(DETAIL_ROUTE);

    await expect(page.getByText('Prices for European Union · EUR.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'European Union · EUR' })).toBeVisible();
    // The fixture also holds a yen and a dinar offer. Neither belongs to this region.
    await expect(page.getByText('¥1,800')).toHaveCount(0);
    await expect(page.getByText('KWD 3.500')).toHaveCount(0);
  });

  test("shows another region's offers once that region is active", async ({ page }) => {
    await detectCountry(page, 'DE');
    await page.goto('/games/half-off-demo');

    await expect(page.getByText('Prices for Germany · EUR.')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Germany · EUR' })).toBeVisible();
  });

  test('omits empty classification groups without inventing metadata', async ({ page }) => {
    await detectCountry(page, 'DE');
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

  test('renders a missing price and an offer LUDWISE never verified explicitly', async ({
    page,
  }) => {
    await gotoStatesDetail(page);

    const missingPrice = offerRow(page, 'Fallow Store');
    await expect(missingPrice.locator('.lw-price')).toHaveAttribute(
      'aria-label',
      'Price not provided.',
    );
    await expect(missingPrice.locator('.lw-price')).toContainText('Not provided');

    const neverVerified = offerRow(page, 'Gable Store').locator('.lw-freshness');
    await expect(neverVerified).toHaveAttribute('data-state', 'never_verified');
    await expect(neverVerified).toContainText('Not checked yet');
    await expect(neverVerified).not.toContainText('out of date');
    await expect(neverVerified.locator('time')).toHaveCount(0);
  });

  /**
   * The fixture's words are the backend's. Echo Store is stale and Delta Store
   * is recently verified. Each row renders its own word, and its age decides
   * only the phrase.
   */
  test('renders the backend freshness word and the age phrase for each offer', async ({ page }) => {
    await gotoStatesDetail(page);

    const expected = [
      {
        ageMs: 5 * 60 * 1000,
        state: 'recently_verified',
        label: 'Updated 5 min ago',
        store: 'Copper Shop',
      },
      {
        ageMs: 2 * 60 * 60 * 1000,
        state: 'recently_verified',
        label: 'Checked 2 hours ago',
        store: 'Delta Store',
      },
      {
        ageMs: 10 * 24 * 60 * 60 * 1000,
        state: 'stale',
        label: 'Last checked Aug 20, 2026',
        store: 'Echo Store',
      },
      {
        ageMs: 30 * 60 * 1000,
        state: 'unavailable',
        label: 'Harbor Store temporarily unavailable',
        store: 'Harbor Store',
      },
    ] as const;

    for (const offer of expected) {
      const freshness = offerRow(page, offer.store).locator('.lw-freshness');
      await expect(freshness).toHaveAttribute('data-state', offer.state);
      await expect(freshness.locator('time')).toHaveText(offer.label);
      await expect(freshness.locator('time')).toHaveAttribute(
        'datetime',
        new Date(E2E_NOW_MS - offer.ageMs).toISOString(),
      );
    }

    // A stale offer says so in words, not by its glyph alone, and a recently
    // verified one never does.
    await expect(offerRow(page, 'Echo Store').locator('.lw-freshness')).toContainText(
      'Price may be out of date',
    );
    await expect(offerRow(page, 'Copper Shop').locator('.lw-freshness')).not.toContainText(
      'out of date',
    );

    await auditFor(page);
  });

  test('renders a truthful no-offer state without treating it as an error', async ({ page }) => {
    await detectCountry(page, 'DE');
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
    await detectCountry(page, 'DE');
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

  test('says once that the prices on a stale page may be out of date', async ({ page }) => {
    // The backend calls every offer on the canonical fixture stale. A page of
    // offers that says nothing about that presents an old price as the price.
    await page.goto(DETAIL_ROUTE);

    await expect(page.getByText('These prices may be out of date')).toHaveCount(1);
    await expect(
      page.getByText('The oldest price on this page was checked Jun 15, 2025.'),
    ).toBeVisible();
  });

  test('warns when any priced offer is stale, even beside one checked minutes ago', async ({
    page,
  }) => {
    // One offer was checked five minutes ago, and Echo Store is stale. The
    // newest offer does not speak for the page (ludwise-backend record 0042).
    await gotoStatesDetail(page);

    await expect(page.getByText('These prices may be out of date')).toBeVisible();
    await expect(
      page.getByText('The oldest price on this page was checked Aug 20, 2026.'),
    ).toBeVisible();
  });

  test('does not warn on a page whose every price is recently verified', async ({ page }) => {
    // Its instant is a year before the suite's clock. The word is the
    // backend's, and this client holds no horizon to overrule it.
    await detectCountry(page, 'DE');
    await page.goto('/games/half-off-demo');

    await expect(page.locator('.lw-freshness').first()).toHaveAttribute(
      'data-state',
      'recently_verified',
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
    // The backend calls these prices stale.
    await expect(page.getByText(DATA_NOTES.stalePrices)).toBeVisible();
    // One offer is discounted, and the backend worked that percentage out.
    await expect(page.getByText(DATA_NOTES.derivedDiscounts)).toBeVisible();
    await expect(page.getByText(DATA_NOTES.noHistory)).toBeVisible();
  });

  test('explains a stale price only where the backend called one stale', async ({ page }) => {
    await detectCountry(page, 'DE');
    await page.goto('/games/half-off-demo');

    await page.getByText(DATA_NOTES_SUMMARY).click();
    await expect(page.getByText(DATA_NOTES.checkTimes)).toBeVisible();
    await expect(page.getByText(DATA_NOTES.stalePrices)).toHaveCount(0);
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

  test('shares the cover through the media route, on the canonical slug', async ({ page }) => {
    await page.goto(`${DETAIL_ROUTE}?utm_source=share`);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${BASE_URL}${DETAIL_ROUTE}`,
    );
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'website');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      `${BASE_URL}/media/images.igdb.com/igdb/image/upload/t_cover_big/demo-cover.jpg`,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      'content',
      'summary_large_image',
    );
    await expect(page.locator('meta[property^="og:image:"]')).toHaveCount(0);
    await expect(page.locator('meta[name^="twitter:image"]')).toHaveCount(0);
  });

  test('sends a text card and no description for a game with no cover and no summary', async ({
    page,
  }) => {
    await detectCountry(page, 'DE');
    await page.goto('/games/half-off-demo');

    await expect(page.locator('meta[name="description"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:description"]')).toHaveCount(0);
    await expect(page.locator('meta[property="og:image"]')).toHaveCount(0);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
  });
});

/**
 * Every picture and every video the canonical media contract supplies.
 *
 * The unit suite states what `src/lib/game/media.ts` decides. Only a rendered
 * page can carry these three facts. They are the origin of each address, the
 * absence of a player, and the count in the heading above the frames.
 */
test.describe('game detail media', () => {
  test('serves every picture from the LUDWISE origin and renders no player', async ({ page }) => {
    await page.goto(DETAIL_ROUTE);

    const foreign = await page
      .locator('img')
      .evaluateAll((images) =>
        images
          .map((image) => image.getAttribute('src') ?? '')
          .filter((src) => new URL(src, location.href).origin !== location.origin),
      );

    await expect(page.locator('img')).not.toHaveCount(0);
    expect(foreign).toEqual([]);
    // `embedUrl` is never read, so a page that carries videos carries no frame.
    await expect(page.locator('iframe')).toHaveCount(0);
  });

  test('loads the cover first and every screenshot last', async ({ page }) => {
    await page.goto(DETAIL_ROUTE);
    const cover = page.locator('.lw-game-detail__cover img');

    await expect(cover).toHaveAttribute('loading', 'eager');
    await expect(cover).toHaveAttribute('fetchpriority', 'high');

    const screenshots = await page.locator('.lw-game-detail__gallery img').evaluateAll((images) =>
      images.map((image) => ({
        alt: image.getAttribute('alt'),
        decoding: image.getAttribute('decoding'),
        loading: image.getAttribute('loading'),
        priority: image.getAttribute('fetchpriority'),
      })),
    );

    expect(screenshots).not.toEqual([]);
    expect(screenshots).toEqual(
      screenshots.map(() => ({ alt: '', decoding: 'async', loading: 'lazy', priority: null })),
    );
  });

  test('counts the frames a visitor sees in the heading above them', async ({ page }) => {
    // The heading is the text alternative for the set, because no screenshot
    // carries a description. A count that disagrees with the frames is a lie.
    await page.goto(DETAIL_ROUTE);

    const heading = (await page.locator('#screenshots-title').textContent()) ?? '';
    const stated = Number(/^\d+/u.exec(heading.trim())?.[0]);

    expect(stated).toBeGreaterThan(0);
    await expect(page.locator('.lw-game-detail__gallery img')).toHaveCount(stated);
    expect(heading.trim()).toBe(`${String(stated)} screenshots`);
  });

  test('lists a video as an outbound link that names neither host', async ({ page }) => {
    await page.goto(DETAIL_ROUTE);
    const section = page.getByRole('region', { name: '1 video' });
    const link = section.getByRole('link').first();

    await expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=demo-000001');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAccessibleName('Canonical Demo Game in motion Opens in a new tab');
    // IGDB is the provenance and YouTube is the destination. A link that only
    // says what it is names neither, and the `Data sources` block credits IGDB.
    await expect(section).not.toContainText('YouTube');
    await expect(section).not.toContainText('IGDB');
    await expect(section).not.toContainText('Trailer');
  });

  test('frames a promoted cover in the identity block', async ({ page }) => {
    // Staging holds no hero-kind asset, so a cover the backend promoted is one
    // of the two shapes that exist. The identity block frames it at its own
    // ratio, which is the ratio the picture already has.
    await detectCountry(page, 'DE');
    const response = await page.goto('/games/promoted-cover-demo');

    expect(response?.status()).toBe(200);
    const cover = page.locator('.lw-game-detail__cover img');
    await expect(cover).toHaveAttribute(
      'src',
      '/media/images.igdb.com/igdb/image/upload/t_cover_big/demo-cover-only.jpg',
    );
    await expect(cover).toHaveAttribute('loading', 'eager');
    await expect(cover).toHaveAttribute('fetchpriority', 'high');
    await auditFor(page);
  });

  test('renders no band, though the contract supplies a landscape picture', async ({ page }) => {
    // The canonical recording holds an artwork of 1920 pixels. A page that
    // paints it below 400 pixels wide fails the Lighthouse gate, and one
    // address cannot make a srcset. Issue ludwise-web#121 holds the band.
    await page.goto(DETAIL_ROUTE);

    await expect(page.locator('.lw-artwork[style*="--aspect-hero"]')).toHaveCount(0);
    // The cover is above the offers, so it is the first frame on the page.
    const first = page.locator('.lw-artwork').first();
    await expect(first).toHaveClass(/lw-game-detail__cover/u);
  });

  test('says nothing at all about media on a game that carries none', async ({ page }) => {
    await detectCountry(page, 'DE');
    for (const route of ['/games/half-off-demo', '/games/no-offers-demo']) {
      await page.goto(route);

      await expect(page.locator('.lw-artwork'), route).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /screenshots?$/u }), route).toHaveCount(0);
      await expect(page.getByRole('heading', { name: /videos?$/u }), route).toHaveCount(0);
      // No empty state announces the absence. The page is complete without one.
      await expect(page.getByText('No artwork available'), route).toHaveCount(0);
    }
  });

  test('keeps the media sections clean under an accessibility audit', async ({ page }) => {
    await page.goto(DETAIL_ROUTE);

    await expectCanonicalDetail(page);
    await auditFor(page);
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
    // The price filters are amounts in the currency of the EU region.
    await page.goto(
      '/games?store=orbit-market&min=1000&max=1500&discounted=true&fromYear=2025&toYear=2025',
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

  test('keeps filter controls usable in the responsive disclosure', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/games');

    await expect(page.getByText('Filters', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Minimum price (minor units)')).toBeVisible();
    await expect(page.getByLabel('Currently discounted')).toBeVisible();
    // The visitor region sets the pair. The catalog offers no control for it.
    await expect(page.locator('select[name="market"], select[name="currency"]')).toHaveCount(0);
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
    for (const path of ['/games', '/games?store=orbit-market']) {
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
  for (const width of [320, 375, 480, 768, 1024, 1280, 1600]) {
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
      await expect(page.getByText('€14.99')).toBeVisible();

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
