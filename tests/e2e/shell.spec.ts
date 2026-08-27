import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';

/**
 * The one end-to-end specification.
 *
 * It answers what no other layer can: that the application boots in a real
 * engine, that the shell renders, that navigation works, and that an
 * accessibility audit finds nothing. Everything cheaper to assert elsewhere is
 * asserted elsewhere - this is not where features get tested.
 *
 * Accessibility is checked in both themes because the token layer authors them
 * as two independent value sets. A contrast failure in one says nothing about
 * the other, which is exactly the defect a single-theme audit misses.
 */

const THEMES = ['light', 'dark'] as const;

// Imported rather than retyped: Architecture decision record 0013 makes the point that the cookie name
// should be defined once. A test hard-coding 'theme' is a third place for
// it to drift.
const THEME_COOKIE = THEME_COOKIE_NAME;
const BASE_URL = 'http://localhost:4321';

/**
 * The LUDWISE wordmark, which axe reports as a contrast failure in the light
 * theme: `--color-accent-primary` on the page background measures 2.06:1.
 *
 * Excluded because WCAG 1.4.3 exempts it — "text that is part of a logo or
 * brand name has no contrast requirement" — and the color is the design
 * system's own, specified in design/system/components/foundation.md. Changing
 * it here would be redesigning the brand to satisfy a rule that does not apply
 * to it.
 *
 * It is a narrow exclusion of one element rather than of the rule, so any other
 * contrast failure anywhere still fails. The underlying legibility question is
 * raised with the designer separately. Delete this the moment the wordmark's
 * color changes.
 */
const LOGOTYPE = '.lw-header__wordmark-accent';

/** Astro removes the `ssr` attribute from an island once it has filled. */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelector('astro-island[ssr]') === null);
}

async function auditFor(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude(LOGOTYPE)
    .analyze();

  // Reported as the full violation list rather than a count, so a failure names
  // the rule and the node instead of only the number.
  expect(results.violations).toEqual([]);
}

test.describe('the application shell', () => {
  test('boots and serves the home page with its landmarks', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('LUDWISE');
  });

  test('serves the brand mark as a favicon rather than letting the tab fall blank', async ({
    page,
    request,
  }) => {
    await page.goto('/');

    // The declaration, then the file. Asserting only the tag would pass with a
    // link pointing at nothing, which is exactly the state this replaces: the
    // browser probes /favicon.ico, gets a 404 and shows its default glyph.
    const href = await page.locator('link[rel="icon"]').getAttribute('href');
    expect(href).toBe('/favicon.svg');

    const icon = await request.get(href!);
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toContain('image/svg+xml');
  });

  test('offers a skip link as the first thing a keyboard reaches', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skipLink = page.getByRole('link', { name: 'Skip to content' });
    await expect(skipLink).toBeFocused();
    // Hidden until focused, then genuinely rendered - a skip link that stays
    // clipped is one a sighted keyboard operator cannot follow.
    await expect(skipLink).toBeVisible();
  });

  test('navigates between the primary destinations', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Games' })
      .click();

    await expect(page).toHaveURL('/games');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Games');
  });

  test('reaches the sales page from the primary navigation', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Sales' })
      .click();

    await expect(page).toHaveURL('/sales');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Current sales');
  });

  test('answers an unknown address with a not-found page, not a stack trace', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');

    expect(response?.status()).toBe(404);
    // A heading, not merely the text. Styled as one but marked up as a span,
    // this page has no structure at all for anyone navigating by heading -
    // and no axe rule in the WCAG tag set reports it.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  });

  test('asks nothing of any third party, and serves its own typeface', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.goto('/');
    // After hydration, so anything the island fetches on mount is counted too.
    await waitForHydration(page);

    const origin = new URL(page.url()).origin;
    const external = requests
      .filter((url) => /^https?:/.test(url))
      .filter((url) => new URL(url).origin !== origin);

    // An origin allowlist, not a denylist of two font hostnames: a denylist has
    // to name every vendor anyone might ever add. Reported as the offending URLs
    // rather than a count, so a failure names what reached out.
    expect(external).toEqual([]);
    expect(requests).toContain(`${origin}/fonts/geist-sans-latin-400-normal.woff2`);
  });
});

/**
 * The indexing rules, checked against a running server rather than against the
 * functions that produce them.
 *
 * This suite runs against `astro dev`, where ENVIRONMENT is `development` - one
 * of the two environments that must not be indexed. The production case is the
 * one that matters more and cannot be exercised here. It is asserted in
 * tests/unit/http/security-headers.test.ts, in tests/integration/api/robots.test.ts,
 * and against the deployment itself in .github/workflows/deploy-production.yml.
 *
 * None of this is a security control. Staging is private because Cloudflare
 * Access is in front of it - see docs/operations/staging-access.md.
 */
test.describe('indexing', () => {
  test('tells crawlers to stay away, in the header and in the markup', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex,nofollow',
      // The tag is in <head> and never rendered, so Playwright's default
      // visibility expectations do not apply.
      { timeout: 5_000 },
    );
  });

  test('serves a robots.txt that disallows everything', async ({ request }) => {
    const response = await request.get('/robots.txt');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('text/plain; charset=utf-8');

    const body = await response.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /');
    // A disallow list naming real routes is a public index of the routes
    // somebody thought were worth hiding.
    expect(body).not.toContain('/api');
  });
});

test.describe('theme', () => {
  test('honours prefers-color-scheme for a visitor with no cookie', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto('/');

    // Set before first paint by the inline script, since this Worker had no
    // preference to render.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await context.close();
  });

  test('records a toggled preference and keeps it across a navigation', async ({ page }) => {
    await page.goto('/');
    // The toggle is an island. Playwright will happily click a button that is
    // in the DOM but whose handler React has not attached yet, and the click
    // then does nothing - a flake that looks like a broken toggle.
    await waitForHydration(page);

    const initial = await page.locator('html').getAttribute('data-theme');
    const expected = initial === 'dark' ? 'light' : 'dark';

    await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', expected);

    await page.goto('/games');
    // Server-rendered from the cookie this time, which is the property that
    // makes the theme survive without a flash.
    await expect(page.locator('html')).toHaveAttribute('data-theme', expected);
  });

  test('ignores a theme cookie that is not a theme', async ({ browser }) => {
    const clean = await browser.newContext();
    const baseline = await clean.newPage();
    await baseline.goto('/');
    const scriptsWithoutAttack = await baseline.locator('script').count();
    await clean.close();

    const context = await browser.newContext();
    await context.addCookies([
      { name: THEME_COOKIE, value: 'dark"><script>alert(1)</script>', url: BASE_URL },
    ]);
    const page = await context.newPage();
    const dialogs: string[] = [];
    page.on('dialog', (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await page.goto('/');

    // Counting a selector the payload never sets would pass whether or not
    // anything was sanitised. What proves it: nothing executed, no element was
    // added, and the attribute never carries the payload.
    expect(dialogs).toEqual([]);
    expect(await page.locator('script').count()).toBe(scriptsWithoutAttack);

    // A real theme is allowed here: the pre-paint script sets one once the
    // server has declined to, which is rejecting the cookie rather than
    // escaping it. What must never appear is the payload.
    const rendered = await page.locator('html').getAttribute('data-theme');
    expect(rendered === null || THEMES.includes(rendered as (typeof THEMES)[number])).toBe(true);
    await context.close();
  });

  test('renders no theme attribute at all for a hostile cookie, before any script runs', async ({
    browser,
  }) => {
    // JavaScript off, so the pre-paint script cannot supply a valid value and
    // what remains is exactly what this Worker chose to emit. This is the
    // sanitiser under test, with nothing standing in front of it.
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.addCookies([
      { name: THEME_COOKIE, value: 'dark"><script>alert(1)</script>', url: BASE_URL },
    ]);
    const page = await context.newPage();
    await page.goto('/');

    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    expect(await page.content()).not.toContain('alert(1)');
    await context.close();
  });
});

test.describe('accessibility', () => {
  for (const theme of THEMES) {
    // The not-found route is audited too. It is composed differently from the
    // product routes - an EmptyState standing alone rather than inside a page
    // - and it is the route a visitor is most likely to reach by accident.
    for (const path of ['/', '/games', '/sales', '/this-route-does-not-exist']) {
      test(`${path} has no violations in the ${theme} theme`, async ({ browser }) => {
        const context = await browser.newContext();
        await context.addCookies([{ name: THEME_COOKIE, value: theme, url: BASE_URL }]);
        const page = await context.newPage();
        await page.goto(path);

        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await auditFor(page);
        await context.close();
      });
    }
  }
});

test.describe('responsive', () => {
  // 320 is the narrowest viewport this product targets and the width that
  // actually broke. /sales is checked as well as /games because it is the widest
  // layout here - a card grid beside a sticky aside.
  for (const width of [320, 375, 768, 1024]) {
    for (const path of ['/games', '/sales']) {
      test(`${path} does not scroll horizontally at ${String(width)}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);

        // Deliberately does not wait for hydration: the server-rendered layout
        // has to be correct on its own, for a slow connection and for a visitor
        // with JavaScript disabled.

        const overflows = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        expect(overflows).toBe(false);
      });
    }
  }
});
