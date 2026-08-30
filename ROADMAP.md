---
ste-prose: descriptive
---

# Roadmap

High level and deliberately undated. Sequence matters. Deadlines invented during
planning do not.

This document covers the public web client only. Catalogue semantics, provider
integration, persistence, and commercial calculations belong in
`ludwise-backend`.

Backend capabilities can block web features. They do not transfer feature
ownership into this repository.

## Foundation — complete

The web client has an independent architecture, deployment path, design system,
and quality gates.

- [x] Public web repository split
- [x] Astro and React application architecture
- [x] Server-side backend reads through the named `VisitorRead` entrypoint
- [x] Design tokens, reusable components, and light and dark themes
- [x] Responsive application baseline
- [x] Automated accessibility coverage
- [x] Public prelaunch site for `ludwise.com`
- [x] Shared application header and footer
- [x] Shared legal-policy rendering architecture
- [x] ASD-STE100 language policy and enforcement
- [x] Localization infrastructure with English as the initial locale
- [x] Staging and production deployment architecture

The browser does not call the backend directly. Public pages consume backend
contracts during server-side rendering.

## MVP web — public application launch

The first public application must expose the core comparison experience clearly
and safely.

- [x] Catalogue and search presentation
- [x] Canonical game-detail pages
- [x] Sales browsing presentation
- [x] Responsive game-detail and degraded-state coverage (#6)
- [ ] Production SEO and discoverability baseline (#9)
- [ ] Final production legal content
- [ ] Public About and contact information
- [ ] Required provider attribution and disclosures
- [ ] Replace the prelaunch site with the production application
- [ ] Complete public launch verification with the backend release

The backend owns catalogue correctness, ranking, price calculations, and data
freshness semantics. This repository renders those decisions.

## Production quality gates

Quality gates are part of the web architecture. They are not optional polish.

- [x] Automated axe and responsive coverage on representative flows
- [x] Accessible component-boundary contrast (#17)
- [ ] Strict Lighthouse CI and deployment gates (#31)
- [ ] WCAG 2.2 AA engineering baseline and release process (#37)
- [ ] Production performance and transfer-size budgets
- [ ] Representative post-deployment production checks

Automated tools are necessary but do not prove complete accessibility
conformance.

## MVP+ discovery and presentation

These features improve the first public experience but must not delay an
otherwise launch-ready MVP.

- [ ] Price-history charts and observed-low presentation (#7)
- [ ] Homepage discovery surface (#10)
- [ ] Advanced discovery sorting and filtering UI (#11)
- [ ] Structured data and rich SEO metadata (#12)
- [ ] Privacy-first outbound store click analytics (#13)
- [ ] Shareability polish for public game pages (#14)
- [ ] User-facing provenance and freshness explanations (#15)
- [ ] Loading, empty, partial, stale, and error-state polish (#16)

Where a feature needs new catalogue semantics, its backend issue owns those
semantics. This repository owns only the presentation and interaction layer.

## Content

Editorial content remains separate from catalogue ranking and commercial logic.

- [ ] First-party LUDWISE blog (#8)
- [ ] Article metadata, canonical URLs, and social metadata
- [ ] RSS and sitemap integration
- [ ] Documented static publishing workflow

Editorial content must not change factual game, offer, or search ordering.

## Localization

Localization infrastructure exists. Additional languages are not yet committed
launch scope.

- [x] Typed Paraglide message compilation
- [x] Astro-owned locale routing architecture
- [x] English source catalogue
- [x] Locale kept separate from market, region, and currency
- [ ] Select the next supported locale from product need
- [ ] Define translation and review workflow
- [ ] Add a language-selection experience when multiple locales exist
- [ ] Add localized SEO and canonical behavior
- [ ] Expand locale coverage based on actual audience need

Adding a locale must not change commercial market or currency implicitly.

## Accounts and personalization

This phase depends on backend account capabilities. Core public comparison must
remain usable without an account.

- [ ] Sign-in and account-management UI
- [ ] Wishlist and watchlist presentation
- [ ] Price-alert creation and preference UI
- [ ] Linked identity and account-security surfaces
- [ ] Account privacy, export, and deletion controls

Account creation should appear where persistence provides clear user value.

## Monetization

Monetization presentation depends on provider-neutral backend capabilities.

- [ ] Affiliate disclosure and outbound-link presentation
- [ ] Premium and entitlement presentation
- [ ] Billing and subscription-management UI
- [ ] Ad presentation and ad-free states
- [ ] Early Supporter presentation

Commercial state must not influence factual ranking, prices, search order, or
recommendations.

## Future

Future web work can include richer discovery, recommendation presentation,
developer and API-facing surfaces, and additional locales.

A future feature belongs here only when it is primarily a visitor-facing page,
interaction, presentation rule, or web quality concern.

## Not planned

The web client will not duplicate backend catalogue logic, provider adapters,
pricing arithmetic, ranking logic, or persistence. It will not use invasive
visitor tracking or affiliate-influenced presentation.
