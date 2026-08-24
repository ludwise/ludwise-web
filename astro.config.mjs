// @ts-check
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

import { buildDefines, buildIdentity } from './scripts/build-identity.mjs';

// This file is evaluated by Node during `astro dev|build`, so Node built-ins are
// available here. That is NOT true of anything under src/, which runs in
// workerd. Do not carry this assumption across that boundary.

// `environment` is deliberately NOT injected here. Baking it into the artifact
// would make a build un-promotable between staging and production, which the
// main -> production branch model depends on. It is runtime config instead.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [react()],
  // Spread rather than assign: Astro types `site` as string, and an explicit
  // undefined fails typecheck. Absent locally, set from SITE_URL in CI/deploy.
  // It is what `<link rel="canonical">` is built from, so a build that forgot
  // it produces relative canonicals rather than wrong absolute ones.
  ...(process.env.SITE_URL ? { site: process.env.SITE_URL } : {}),
  i18n: {
    // English is the initial language, but routing is locale-aware from the
    // start so adding a locale is configuration rather than a refactor.
    defaultLocale: 'en',
    locales: ['en'],
    routing: { prefixDefaultLocale: false },
  },
  vite: {
    define: {
      // Already JSON.stringify'd by buildDefines: `define` is raw text
      // substitution, so a bare identifier would be injected and fail to parse.
      ...buildDefines(buildIdentity(new URL('./package.json', import.meta.url))),
    },
  },
});
