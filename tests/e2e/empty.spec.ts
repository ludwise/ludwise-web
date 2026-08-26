import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * What the site says when LUDWISE has ingested nothing at all.
 *
 * Its own suite and its own backend mode, because this state is a property of
 * the whole catalogue rather than of one request.
 *
 * "No games are on sale right now" is a claim about the market, true only once
 * LUDWISE has observed prices and found none of them discounted. Before that it
 * is a fabrication, and the correct sentence is that nothing has been collected
 * yet. The backend distinguishes the two with `hasAnyOfferData`; this suite is
 * what proves the interface acts on it.
 */

const LOGOTYPE = '.lw-header__wordmark-accent';

async function auditFor(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude(LOGOTYPE)
    .analyze();
  expect(results.violations).toEqual([]);
}

test.describe('an empty catalogue', () => {
  test('renders the designed empty state rather than an error', async ({ page }) => {
    const response = await page.goto('/games');

    // 200, not 503. Nothing failed - there is genuinely nothing here, and the
    // distinction between those is the whole point of this suite.
    expect(response?.status()).toBe(200);
    await expect(page.getByText('No games in the catalogue yet')).toBeVisible();
    await expect(page.getByText('The game catalogue could not be loaded')).toHaveCount(0);
  });

  test('explains an empty sales page rather than showing a broken one', async ({ page }) => {
    const response = await page.goto('/sales');

    expect(response?.status()).toBe(200);
    // The sentence that is true here, and the one that is not. Pinning the
    // second as an absence is what stops "no game is discounted" being
    // rendered for a catalogue that has never seen a price.
    await expect(page.getByText('LUDWISE has not collected any prices yet')).toBeVisible();
    await expect(page.getByText('No games are on sale right now')).toHaveCount(0);
    // Nothing is on sale, so there is no market to name and no filter form
    // built from one.
    await expect(page.getByText(/Showing .+ prices, in/u)).toHaveCount(0);
    await expect(page.getByText('Sales could not be loaded')).toHaveCount(0);
  });

  test('answers a game detail request with a real 404', async ({ page }) => {
    const response = await page.goto('/games/anything-at-all');

    // Not a failure page. The backend answered, and its answer is that no game
    // carries this slug.
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Game not found');
  });

  test('has no accessibility violations in an empty state', async ({ page }) => {
    // Empty states are composed differently from populated ones - an EmptyState
    // standing where a list would be - so an audit of the populated pages says
    // nothing about them.
    for (const path of ['/games', '/sales']) {
      await page.goto(path);
      await auditFor(page);
    }
  });
});
