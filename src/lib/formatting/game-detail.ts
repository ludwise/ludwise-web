/** Formats the reduced-precision release date stored by the canonical model. */
export function formatReleaseDate(value: string | null, locale = 'en-US'): string | null {
  if (value === null) return null;
  if (/^\d{4}$/.test(value)) return value;

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = dayText === undefined ? 1 : Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    ...(dayText === undefined ? {} : { day: 'numeric' }),
    timeZone: 'UTC',
  }).format(date);
}
