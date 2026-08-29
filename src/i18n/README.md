---
ste-prose: descriptive
---

# Localization boundary

Astro owns locale routes and locale URLs. Paraglide compiles the message files.
The product domain owns market, region, currency, and provider data.

`project.inlang/settings.json` is the locale configuration source. The root
`i18n.config.ts` reads that file for Astro. The message source files are in
`messages/`. The generated Paraglide files are in `src/paraglide/`, and Git does
not track them.

Code in Astro can call the compiled message functions with an explicit locale.
A React island receives resolved text and URLs through its props. The island
does not detect a locale and does not import the localization runtime.

The default locale has no URL prefix. Astro adds a prefix for each other locale.
Astro uses a rewrite fallback to serve the canonical page implementation for a
localized URL. A locale does not require a copy of each page.

Localized authored content uses the same path shape as legal content:
`src/content/<collection>/<locale>/<id>`. A content loader can derive the
document locale from that path. The Inlang locale list remains authoritative for
application routing and message compilation.

Do not add a second locale until the locale activation checks pass. The checks
require page text to use the message catalog. They also require internal page
links and form actions to use locale-aware URLs. This prevents mixed-language
pages and links that return to the default locale.

Locale does not select a market or a currency. Those values are separate product
inputs. Provider text stays in its source language unless the provider supplies
a localized value with provenance.

The English catalog follows the user-facing language policy. A translation must
preserve the approved meaning.

Legal content uses `src/content/legal/<locale>/<policyId>.md`. The
directory supplies the document locale, while frontmatter records the policy
identity and translation status. A missing or stale legal translation redirects
to the source-language policy. The site does not serve a source policy with a
different document language. A production translation must be current,
approved, and record the current source version.
