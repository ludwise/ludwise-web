import type { Page } from '@playwright/test';

import { TEST_COUNTRY_HEADER } from '../../src/lib/region/detection.js';

export { TEST_COUNTRY_HEADER };

/**
 * Makes every later request from `page` arrive as if the edge detected
 * `countryCode`. The development server reads this header in place of
 * `request.cf.country`.
 */
export async function detectCountry(page: Page, countryCode: string): Promise<void> {
  await page.setExtraHTTPHeaders({ [TEST_COUNTRY_HEADER]: countryCode });
}
