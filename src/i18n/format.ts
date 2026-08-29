import type { Locale } from './index.js';

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(
  value: Date | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: Locale,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}

export function formatList(
  values: readonly string[],
  locale: Locale,
  options?: Intl.ListFormatOptions,
): string {
  return new Intl.ListFormat(locale, options).format(values);
}

export function formatPercentFromWhole(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(value / 100);
}
