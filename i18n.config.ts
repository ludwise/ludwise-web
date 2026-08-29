export const DEFAULT_LOCALE = 'en' as const;
export const SUPPORTED_LOCALES = ['en'] as const;

// Literal locale types let Astro validate fallback routes at compile time.
// The architecture test enforces parity with project.inlang/settings.json.
export const LOCALE_FALLBACKS = {} as const;

export const LOCALE_ROUTING = {
  prefixDefaultLocale: false,
  fallbackType: 'rewrite',
} as const;
