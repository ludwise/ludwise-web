---
ste-prose: descriptive
---

# Localization boundary

Astro owns locale routes and locale URLs. Paraglide compiles the message files.
The product domain owns market, region, currency, and provider data.

`project.inlang/settings.json` is the source for the supported locales. The
message source files are in `messages/`. The generated Paraglide files are in
`src/paraglide/`, and Git does not track them.

Code in Astro can call the compiled message functions with an explicit locale.
A React island receives resolved text and URLs through its props. The island
does not detect a locale and does not import the localization runtime.

The default locale has no URL prefix. Astro adds a prefix for each other locale.
Astro uses a rewrite fallback to serve the canonical page implementation for a
localized URL. As a result, a new locale does not require a copy of each page.

Locale does not select a market or a currency. Those values are separate product
inputs. Provider text stays in its source language unless the provider supplies
a localized value with provenance.

The English catalog follows the user-facing language policy. A translation must
preserve the approved meaning. Legal content is not ordinary interface copy and
must use its own approved translation process.
