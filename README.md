---
ste-prose: descriptive
---

# LUDWISE web client

[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Astro](https://img.shields.io/badge/Astro-7.2-BC52EE?logo=astro&logoColor=white)](https://astro.build/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflareworkers&logoColor=white)](https://workers.cloudflare.com/)
[![Paraglide JS](https://img.shields.io/badge/Paraglide-JS-3B82F6?logo=inlang&logoColor=white)](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)

The public web client for [LUDWISE](https://ludwise.com), a transparent PC game
store comparison and discovery platform.

This repository owns the visitor-facing application: pages, presentation,
interaction, accessibility, localization, SEO presentation, and the design
system. Catalog semantics, persistence, provider integrations, and commercial
calculations belong in the private `ludwise-backend` repository.

> **Status:** staging is available. Production has not launched.

See [`ROADMAP.md`](ROADMAP.md) for web priorities and launch work.

## Repository responsibility

This repository owns:

- routing and page composition
- design tokens and components
- responsive and accessible interaction
- SEO presentation and public metadata
- localization presentation
- visitor-facing legal and account UI
- the backend client and degraded states

The backend owns:

- canonical game identity and matching
- store listings, offers, markets, and currencies
- pricing and sale semantics
- search ranking and catalog rules
- provider integrations and ingestion
- persistence and migrations
- operations and backend observability

The boundary is intentional. This repository renders backend decisions. It does
not reproduce them. Discount calculations, offer ordering, provider policy, and
canonical matching must remain outside the web client.

## Architecture

```text
Browser
   |
   v
ludwise-web Worker          <- this repository
   |
   | Cloudflare service binding
   | entrypoint = "VisitorRead"
   v
VisitorRead                 <- private backend
   |
   v
application / domain / persistence / providers
```

Public data reads happen during server-side rendering. The browser does not call
the backend directly. In deployed environments, the web Worker invokes the
backend through a named Cloudflare Worker entrypoint over a service binding.

Local development uses HTTP instead so that the web repository can run without
private backend access.

See [`docs/architecture.md`](docs/architecture.md) for the complete boundary and
deployment model.

## Repository structure

```text
.github/           Workflows, issue forms, and pull request template
docs/              Architecture, design-system, and project documentation
messages/          Source localization messages
project.inlang/    Inlang and Paraglide project configuration
public/            Static public assets
scripts/           Development, test, localization, and validation scripts
src/
  components/      Reusable application and navigation components
  layouts/         Shared page layouts
  lib/             Framework-independent web support and API contracts
  pages/           Astro routes and page composition
  styles/          Global styles and design-system foundations
tests/             Unit, contract, architecture, and integration tests
e2e/               Playwright end-to-end coverage
```

Architecture tests protect the repository boundary. They prevent direct backend
fetches outside the API client, direct Cloudflare binding access outside the
approved boundary, and credential-like values in public code.

## Prerequisites

- Node.js 24 or later. The exact version is in [`.nvmrc`](.nvmrc).
- pnpm 11. The exact version is pinned in `package.json`.
- Git.

A Cloudflare account and access to the private backend are not required for
ordinary frontend development.

## Local development

```bash
git clone https://github.com/ludwise/ludwise-web.git
cd ludwise-web
corepack enable
pnpm install
cp .dev.vars.example .dev.vars
pnpm dev
```

The local site runs at <http://localhost:4321>.

By default, `.dev.vars.example` points development at the fake backend on port
8788. The fake backend replays the recorded contract corpus and requires no
private repository or credentials.

A real local backend can also be used when available. See `.dev.vars.example`
for the supported development configuration.

## Development commands

- `pnpm dev` starts the Astro development server with localization watching.
- `pnpm build` compiles messages and builds the Worker.
- `pnpm format` applies formatting.
- `pnpm lint` runs lint checks.
- `pnpm check:ste` validates the ASD-STE100 policy.
- `pnpm typecheck` type-checks shipped Astro code.
- `pnpm typecheck:tests` type-checks the test tree.
- `pnpm test` runs unit, architecture, and contract tests.
- `pnpm test:e2e` runs Playwright end-to-end tests.
- `pnpm test:coverage` runs tests with coverage reporting.
- `pnpm i18n:compile` compiles Paraglide messages.
- `pnpm cf-typegen` regenerates Cloudflare binding types.
- `pnpm check` runs the main CI verification sequence.

Run `pnpm check` before opening a pull request.

## Localization

Localization uses Paraglide JS with Astro-owned routing. English is the current
source locale. Locale remains separate from market, region, and currency.

Source messages live in `messages/`. Generated Paraglide output is derived from
them and must not become a second source of truth.

See the localization documentation and [`ROADMAP.md`](ROADMAP.md) before adding a
new locale.

## Design system and accessibility

Design tokens are the styling API. Components must consume shared tokens and
patterns instead of introducing local hard-coded styling rules.

Accessibility is an engineering requirement. Automated axe, responsive, and
Playwright coverage are part of the repository quality gates, with broader WCAG
2.2 AA release work tracked on the roadmap.

See [`docs/design-system.md`](docs/design-system.md).

## Backend contract

The public read contract is defined in this repository so that the web client
can build and test without access to the private backend. The backend vendors
that contract and proves that its implementation conforms to it.

The fake backend uses the same recorded response corpus as the backend contract
tests. This keeps local frontend behavior and end-to-end tests aligned with the
real wire shape.

Contract changes must remain additive within a version.

## Validation and deployment

Pull requests and pushes to `main` run automated checks for formatting, linting,
the Simplified Technical English policy, localization compilation, type safety,
tests, architecture rules, and the production build.

The repository has independent staging and production deployment paths. Public
production launch remains gated by the web roadmap and coordinated backend
release readiness.

## Documentation

- [`ROADMAP.md`](ROADMAP.md) defines the public web roadmap and launch priorities.
- [`docs/architecture.md`](docs/architecture.md) defines web architecture and the
  backend boundary.
- [`docs/design-system.md`](docs/design-system.md) defines design tokens and
  component rules.
- [`AGENTS.md`](AGENTS.md) defines rules for AI-assisted work.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) defines the contribution and branch
  workflow.
- [`SECURITY.md`](SECURITY.md) defines the vulnerability reporting process.

## Contributing

Issues and pull requests are welcome. Read the architecture and design-system
documentation before making structural or styling changes.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/),
which `commitlint` enforces.

## Security

Report vulnerabilities privately rather than in a public issue. See
[`SECURITY.md`](SECURITY.md).

## License

The code uses the Apache-2.0 license. See [`LICENSE`](LICENSE) and
[`NOTICE`](NOTICE).

The LUDWISE name, wordmark, and logo marks are reserved separately. See
[`TRADEMARKS.md`](TRADEMARKS.md). A code license does not grant permission to use
the LUDWISE brand.
