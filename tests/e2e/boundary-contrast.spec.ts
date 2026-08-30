import { expect, test } from '@playwright/test';

import { contrastRatio, cssColorToHex } from '../helpers/contrast.js';
import { THEME_COOKIE_NAME } from '../../src/lib/http/theme.js';

const THEMES = ['light', 'dark'] as const;
const BASE_URL = 'http://localhost:4321';

type BorderSide = 'top' | 'bottom';

interface BoundaryCase {
  readonly label: string;
  readonly route: string;
  readonly selector: string;
  readonly side: BorderSide;
}

const BOUNDARIES: readonly BoundaryCase[] = [
  { label: 'global header', route: '/', selector: '.lw-header', side: 'bottom' },
  { label: 'header search', route: '/', selector: '.lw-search:visible', side: 'top' },
  { label: 'game filters panel', route: '/games', selector: '.lw-game-filters', side: 'top' },
  {
    label: 'game filter select',
    route: '/games',
    selector: '.lw-game-filters select[name="market"]',
    side: 'top',
  },
  { label: 'game list item', route: '/games', selector: '.lw-game-list__item', side: 'top' },
  {
    label: 'active game filter',
    route: '/games?store=orbit-market',
    selector: '.lw-games__active a',
    side: 'top',
  },
  {
    label: 'game detail offers',
    route: '/games/canonical-demo',
    selector: '.lw-offer-table__viewport',
    side: 'top',
  },
  { label: 'sales filters panel', route: '/sales', selector: '.lw-sale-filters', side: 'top' },
  {
    label: 'sales filter select',
    route: '/sales',
    selector: '.lw-sale-filters select[name="pair"]',
    side: 'top',
  },
  { label: 'sales card', route: '/sales', selector: '.lw-game-card', side: 'top' },
  { label: 'sales note', route: '/sales', selector: '.lw-sales__note', side: 'top' },
  {
    label: 'active sales filter',
    route: '/sales?minDiscount=1',
    selector: '.lw-sales__active a',
    side: 'top',
  },
  { label: 'site footer', route: '/', selector: '.lw-site-footer', side: 'top' },
];

async function readBoundary(page: import('@playwright/test').Page, item: BoundaryCase) {
  const boundary = page.locator(item.selector).first();
  await expect(boundary, item.label).toBeVisible();
  return boundary.evaluate((element, side) => {
    let background = getComputedStyle(element).backgroundColor;
    let ancestor = element.parentElement;
    while (/rgba\([^)]*,\s*0\)$/u.test(background) && ancestor !== null) {
      background = getComputedStyle(ancestor).backgroundColor;
      ancestor = ancestor.parentElement;
    }

    const styles = getComputedStyle(element);
    return {
      border: side === 'top' ? styles.borderTopColor : styles.borderBottomColor,
      background,
    };
  }, item.side);
}

for (const theme of THEMES) {
  test(`${theme} component-identifying boundaries render at 3:1`, async ({ browser }) => {
    test.setTimeout(90_000);
    const context = await browser.newContext();
    await context.addCookies([{ name: THEME_COOKIE_NAME, value: theme, url: BASE_URL }]);
    const page = await context.newPage();

    for (const route of [...new Set(BOUNDARIES.map((item) => item.route))]) {
      await page.goto(route);
      for (const item of BOUNDARIES.filter((candidate) => candidate.route === route)) {
        const colours = await readBoundary(page, item);
        const ratio = contrastRatio(
          cssColorToHex(colours.border),
          cssColorToHex(colours.background),
        );
        expect(ratio, `${theme} ${item.label}`).toBeGreaterThanOrEqual(3);
      }
    }

    await context.close();
  });

  test(`${theme} mobile controls keep their identifying boundaries`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
    await context.addCookies([{ name: THEME_COOKIE_NAME, value: theme, url: BASE_URL }]);
    const page = await context.newPage();

    for (const item of [
      { label: 'mobile search', route: '/', selector: '.lw-search:visible' },
      {
        label: 'mobile game filter',
        route: '/games',
        selector: '.lw-game-filters select[name="market"]',
      },
    ]) {
      await page.goto(item.route);
      const colours = await readBoundary(page, { ...item, side: 'top' });
      const ratio = contrastRatio(cssColorToHex(colours.border), cssColorToHex(colours.background));
      expect(ratio, `${theme} ${item.label}`).toBeGreaterThanOrEqual(3);
    }

    await context.close();
  });
}
