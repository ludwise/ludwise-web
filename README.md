# LUDWISE web client

The public website for [LUDWISE](https://ludwise.com), a transparent PC game
store comparison and discovery platform.

This repository holds the **interface**: the pages a visitor sees, the design
system they are built from, and the client that asks the backend for data. It
holds no catalogue logic, no database, and no provider integrations — those live
in a separate private repository, and this one is built to be readable and
runnable without it.

> **Status:** staging only. Production has not been launched.

## What is here, and what is not

| Here                                       | Not here                              |
| ------------------------------------------ | ------------------------------------- |
| Routing, page composition, markup          | Canonical game identity and matching  |
| Design tokens, components, themes          | Search ranking and relevance          |
| Accessibility and responsive behaviour     | Pricing arithmetic and sale rules     |
| SEO presentation, `robots.txt`, canonicals | Which provider data may be displayed  |
| The API client and its failure handling    | Persistence, D1, provider credentials |
| Visitor analytics                          | Ingestion, the operations dashboard   |

The division is not stylistic. Everything on the right is a decision about the
_catalogue_, and this repository renders those decisions rather than making
them. A discount percentage arrives computed; an offer ordering arrives ordered.
If you find yourself adding arithmetic over prices here, it belongs on the other
side of the boundary.

## Architecture in one diagram

```
Browser
   │
   ▼
ludwise-web Worker          ← this repository
   │  Cloudflare service binding, entrypoint = "VisitorRead"
   │  (no public hostname, no CORS)
   ▼
VisitorRead entrypoint      ← private backend, not an HTTP route
   │
   ▼
application / domain / D1 / providers
```

Every read happens during server-side rendering. The browser never calls the
API — there is no URL for it to call, because the reads answer on a named
Worker entrypoint that no hostname reaches. That single decision is why this
repository contains no CORS configuration, no API key, and no client-side data
fetching.

See [`docs/architecture.md`](docs/architecture.md) for the reasoning.

## Local development

You need Node 24+ and pnpm. The backend repository is **optional**: without it,
pages render their "we could not load this" states, which are worth developing
against anyway.

```bash
pnpm install
pnpm dev            # http://localhost:4321
```

Locally the site does not use the service binding at all. It reads over HTTP
from whatever `BACKEND_DEV_URL` names, and only when `ENVIRONMENT` is
`development` — see `.dev.vars.example`, which is the file to copy. Two values
are useful:

```bash
cp .dev.vars.example .dev.vars   # defaults to the fake backend on 8788
pnpm dev                         # http://localhost:4321
```

`http://localhost:8788` is the fake backend in `scripts/fake-backend.ts`, which
replays the recorded corpus and needs neither the private repository nor any
credentials. `http://localhost:4322` is a real local backend from that
repository, started with its own `pnpm dev`. Leave the variable unset to develop
against a backend that is not there, which renders the failure states.

No Cloudflare credentials are needed for ordinary frontend work, and none are
needed to run the tests.

## Checks

```bash
pnpm check          # everything CI runs
```

Individually:

| Command                | What it proves                                     |
| ---------------------- | -------------------------------------------------- |
| `pnpm lint`            | ESLint, including `jsx-a11y`                       |
| `pnpm typecheck`       | `astro check` over shipped code                    |
| `pnpm typecheck:tests` | the test tree, which `astro check` skips           |
| `pnpm test`            | unit, architecture and contract tests              |
| `pnpm test:e2e`        | Playwright, including accessibility in both themes |
| `pnpm build`           | the Worker bundle                                  |

The architecture tests are worth knowing about before you add a file: they fail
if anything calls `fetch` outside the API client, imports a Cloudflare binding
outside `src/middleware.ts`, or names something that looks like a credential.
See [`tests/architecture/boundaries.test.ts`](tests/architecture/boundaries.test.ts),
which explains each rule where it is defined.

## Contributing

Issues and pull requests are welcome. Two things are worth reading first:

- [`docs/architecture.md`](docs/architecture.md) — especially the section on
  what must not be duplicated from the backend.
- [`docs/design-system.md`](docs/design-system.md) — the tokens are the styling
  API; a hard-coded colour will fail a test rather than a review.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/),
which `commitlint` enforces.

## Licence

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

The LUDWISE name, wordmark and logo marks are reserved separately — see
[`TRADEMARKS.md`](TRADEMARKS.md). Using the code does not grant permission to
use the brand, and a fork must be renamed.

## Security

Please report vulnerabilities privately rather than in a public issue. See
[`SECURITY.md`](SECURITY.md).
