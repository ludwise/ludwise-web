import { describe, expect, it } from 'vitest';

import {
  formatDate,
  formatList,
  formatNumber,
  formatPercentFromWhole,
  formatRelativeTime,
} from '../../../src/i18n/format.js';
import {
  baseLocale,
  isLocale,
  locales,
  messages as m,
  resolveLocale,
} from '../../../src/i18n/index.js';

describe('localization boundary', () => {
  it('uses the base locale when Astro has no current locale', () => {
    expect(resolveLocale(undefined)).toBe(baseLocale);
  });

  it('rejects an unsupported locale', () => {
    expect(() => resolveLocale('not-a-locale')).toThrow(RangeError);
  });

  it('recognizes every compiled locale', () => {
    for (const locale of locales) expect(isLocale(locale)).toBe(true);
  });

  it('forces a locale for compiled messages', () => {
    const options = { locale: baseLocale } as const;
    expect(m.shell_navigation_home({}, options)).toBe('Home');
    expect(m.price_discounted({ current: '$9.99', regular: '$12.99' }, options)).toBe(
      'Discounted price $9.99. Regular price $12.99.',
    );
    expect(m.price_percent_off({ percentage: '50' }, options)).toBe('50 percent off');
  });

  it('uses the explicit locale for Intl formatting helpers', () => {
    expect(formatNumber(1234.5, baseLocale)).toBe(new Intl.NumberFormat(baseLocale).format(1234.5));
    expect(formatPercentFromWhole(20, baseLocale)).toBe(
      new Intl.NumberFormat(baseLocale, { style: 'percent', maximumFractionDigits: 0 }).format(0.2),
    );
    expect(formatDate(0, baseLocale, { timeZone: 'UTC' })).toBe(
      new Intl.DateTimeFormat(baseLocale, { timeZone: 'UTC' }).format(0),
    );
    expect(formatRelativeTime(-1, 'day', baseLocale)).toBe(
      new Intl.RelativeTimeFormat(baseLocale).format(-1, 'day'),
    );
    expect(formatList(['A', 'B'], baseLocale)).toBe(
      new Intl.ListFormat(baseLocale).format(['A', 'B']),
    );
  });
});
