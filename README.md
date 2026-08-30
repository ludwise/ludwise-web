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

> **Status:** staging and the public prelaunch site are available. The production application has not launched.

See [`ROADMAP.md`](ROADMAP.md) for web priorities and launch work.

## Repository responsibility

| This repository owns | The backend owns |
| --- | --- |
| Routing and page composition | Canonical game identity and matching |
| Design tokens and components | Store listings, offers, markets, and currencies |
| Responsive and accessible interaction | Pricing and sale semantics |
| SEO presentation and public metadata | Search ranking and catalog rules |
| Localization presentation | Provider integrations and ingestion |
| Visitor-facing legal and account UI | Persistence and migrations |
| Backend client and degraded states | Operations and backend observability |

The boundary is intentional. This repository renders backend decisions; it does
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

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Astro development server with localization watching |
| `pnpm build` | Compile messages and build the Worker |
| `pnpm format` | Apply formatting |
| `pnpm lint` | Run lint checks |
| `pnpm check:ste` | Validate ASD-STE100 policy |
| `pnpm typecheck` | Type-check shipped Astro code |
| `pnpm typecheck:tests` | Type-check the test tree |
| `pnpm test` | Run unit, architecture, and contract tests |
| `pnpm test:e2e` | Run Playwright end-to-end tests |
| `pnpm test:coverage` | Run tests with coverage reporting |
| `pnpm i18n:compile` | Compile Paraglide messages |
| `pnpm cf-typegen` | Regenerate Cloudflare binding types |
| `pnpm check` | Run the main CI verification sequence |

Run `pnpm check` before opening a pull request.

## Localization

Localization uses Paraglide JS with Astro-owned routing. English is the current
source locale. Locale remains separate from market, region, and currency.

Source messages live in `messages/`. Generated Paraglide output is derived from
them and must not become a second source of truth.

See the localization documentation and [`ROADMAP.md`](ROADMAP.md) before adding a
new locale.

## Design system and accessibility

Design tokens are the styling API. Components should consume shared tokens and
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
STE policy, localization compilation, type safety, tests, architecture rules,
and the production build.

The repository has independent staging and production deployment paths. Public
production launch remains gated by the web roadmap and coordinated backend
release readiness.

## Documentation

| Document | Purpose |
| --- | --- |
| [`ROADMAP.md`](ROADMAP.md) | Public web roadmap and launch priorities |
| [`docs/architecture.md`](docs/architecture.md) | Web architecture and backend boundary |
| [`docs/design-system.md`](docs/design-system.md) | Design tokens and component rules |
| [`AGENTS.md`](AGENTS.md) | Rules for AI-assisted work |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution and branch workflow |
| [`SECURITY.md`](SECURITY.md) | Vulnerability reporting process |

## Contributing

Issues and pull requests are welcome. Read the architecture and design-system
documentation before making structural or styling changes.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/),
which `commitlint` enforces.

## Security

Report vulnerabilities privately rather than in a public issue. See
[`SECURITY.md`](SECURITY.md).

## License

The code is licensed under Apache-2.0. See [`LICENSE`](LICENSE) and
[`NOTICE`](NOTICE).

The LUDWISE name, wordmark, and logo marks are reserved separately. See
[`TRADEMARKS.md`](TRADEMARKS.md). A code license does not grant permission to use
the LUDWISE brand.
