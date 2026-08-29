import * as messages from '../paraglide/messages.js';
import {
  baseLocale,
  getTextDirection,
  isLocale,
  locales,
  type Locale,
} from '../paraglide/runtime.js';

export { baseLocale, getTextDirection, isLocale, locales, messages, type Locale };

export function resolveLocale(value: string | undefined): Locale {
  if (value === undefined) return baseLocale;
  if (!isLocale(value)) throw new RangeError(`Locale is not supported: ${value}`);
  return value;
}
