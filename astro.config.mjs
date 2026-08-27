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
// main -> production branch model depends on. It is runtime configuration instead.
export default defineConfig({
  output: 'server',
  adapter: cloudflare({ imageService: 'compile' }),
  integrations: [react()],
  // No sessions, stated explicitly, because the default is not "off".
  //
  // @astrojs/cloudflare enables KV-backed sessions whenever `session` is not
  // literally false, and writes `kv_namespaces: [{ binding: "SESSION" }]` into
  // the generated dist/server/wrangler.json - for a feature nothing here uses.
  // It announces itself as one info line in a build log ("Enabling sessions
  // with Cloudflare KV") and is otherwise invisible.
  //
  // To be accurate about the cost: this does not break a deploy. Wrangler
  // auto-provisions the namespace on first deploy, prefixed with the Worker
  // name, so it would simply work. The objection is that it creates a real
  // stateful KV namespace per environment - infrastructure that would hold
  // visitor session data - because a default went unexamined. The backend
  // repository hit the same default earlier and chose to declare the binding
  // instead, which is the right call there. Here the honest answer is that we
  // do not want the store at all.
  //
  // This site is server-rendered and anonymous: no login, no cart, no
  // per-visitor state. The one preference it keeps (theme) is a cookie read in
  // middleware. Sessions would be a store nothing ever writes to.
  //
  // If sessions are ever genuinely needed, turning this back on is one line -
  // and it will then be a deliberate decision with a namespace behind it.
  session: false,
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
      // Already passed through `JSON.stringify` by buildDefines: `define` is raw text
      // substitution, so a bare identifier would be injected and fail to parse.
      ...buildDefines(buildIdentity(new URL('./package.json', import.meta.url))),
    },
  },
});
