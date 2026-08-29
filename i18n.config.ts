import { readFileSync } from 'node:fs';

interface InlangSettings {
  baseLocale: string;
  locales: string[];
}

const settings = JSON.parse(
  readFileSync(new URL('./project.inlang/settings.json', import.meta.url), 'utf8'),
) as InlangSettings;

if (settings.locales.length === 0 || !settings.locales.includes(settings.baseLocale)) {
  throw new Error('project.inlang/settings.json must include its base locale.');
}

if (new Set(settings.locales).size !== settings.locales.length) {
  throw new Error('project.inlang/settings.json contains a duplicate locale.');
}

export const DEFAULT_LOCALE = settings.baseLocale;
export const SUPPORTED_LOCALES = [...settings.locales];
export const LOCALE_FALLBACKS = Object.fromEntries(
  settings.locales
    .filter((locale) => locale !== settings.baseLocale)
    .map((locale) => [locale, settings.baseLocale]),
);

export const LOCALE_ROUTING = {
  prefixDefaultLocale: false,
  fallbackType: 'rewrite',
} as const;
