// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

import {
  DEFAULT_LOCALE,
  LOCALE_FALLBACKS,
  LOCALE_ROUTING,
  SUPPORTED_LOCALES,
} from './i18n.config.ts';
import { buildDefines, buildIdentity } from './scripts/build-identity.mjs';
import { CLOUDFLARE_SSR_VITE_CONFIG } from './scripts/vite/cloudflare-ssr.mjs';

// This file is evaluated by Node during `astro dev|build`, so Node built-ins are
// available here. That is NOT true of anything in src/, which runs in
// workerd. Do not carry this assumption across that boundary.

// `environment` is deliberately NOT injected here. Baking it into the artifact
// would make a build un-promotable between staging and production, which the
// main -> production branch model depends on. It is runtime configuration instead.
export default defineConfig({
  output: 'server',
  trailingSlash: 'never',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [react()],
  session: false,
  ...(process.env.SITE_URL ? { site: process.env.SITE_URL } : {}),
  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    locales: [...SUPPORTED_LOCALES],
    // Astro derives fallback keys from literal locale types. The runtime locale
    // source is validated JSON, so that literal union is intentionally absent.
    fallback: /** @type {never} */ (LOCALE_FALLBACKS),
    routing: LOCALE_ROUTING,
  },
  vite: {
    ...CLOUDFLARE_SSR_VITE_CONFIG,
    define: {
      ...buildDefines(buildIdentity(new URL('./package.json', import.meta.url))),
    },
  },
});
