---
ste-prose: descriptive
---

# Architecture

How this repository is put together, and why the boundary between it and the
backend is drawn where it is.

## The shape

```
Browser
   │  HTML, CSS, a small amount of JavaScript
   ▼
ludwise-web Worker                          ← this repository
   │  Cloudflare service binding, JSON over fetch
   ▼
ludwise-backend Worker                      ← private repository
   │
   ▼
application / domain / persistence / providers
   │
   ▼
D1, Steam
```

Two Cloudflare Workers in one account, plus a third for scheduled ingestion that
neither of these talks to directly.

## The boundary

The backend owns every decision about the catalog:

- canonical identity, matching, and slugs
- search relevance and result ordering
- whether an offer is a sale, and by how much
- pricing arithmetic, currency exponents, market validity
- which provider data may be publicly displayed
- freshness and provenance

This repository owns every decision about presentation:

- routing and page composition
- the design system, themes, and responsive behavior
- accessibility
- SEO presentation: titles, canonicals, `robots.txt`, indexability
- loading, empty and failure states
- operational request logging
- the API client and how it handles failure

**The frontend renders backend decisions rather than recreating them.** That is
the rule with teeth. `discountPercentage` arrives computed because whether
something is a sale depends on availability, on both prices being present, and
on the currency's exponent being known. A second implementation here would
disagree with the first the moment either changed. Offer ordering arrives
ordered for the same reason.

The one thing deliberately duplicated is `formatAmountMinor`
(`src/lib/formatting/money.ts`), which turns a stored integer into digits. It is
presentation, but it lives in the backend's domain layer because that is where
money rules live. A private module cannot be imported from a public
repository. The mitigation is
[`tests/helpers/money-vectors.ts`](../tests/helpers/money-vectors.ts): a corpus
checked in to **both** repositories, byte-identical, that each side drives its
own implementation over. They agree because both were checked against one
statement of the answer, not because somebody compared them once.

## Why a service binding rather than a public API

The backend answers `/v1` over a Cloudflare **service binding** named `BACKEND`,
targeting a named `WorkerEntrypoint` called `VisitorRead`. `/v1` is not a route
on the backend Worker at all, and it keeps `workers_dev: false`.

If the backend answered on a public hostname, the read API would be a public
attack surface whatever the documentation said about it. It would need CORS,
rate limiting, abuse protection and its own Cloudflare Access story for staging
— four controls that can each be misconfigured. Endpoint secrecy would not help:
a browser-visible call is inspectable by anyone who opens developer tools.

Search is also a linear scan over one persistence read by design, so a public
`?page=1000000` would be a free full-table read per request.

A binding removes all of that by removing the surface. There is no URL to call,
so the browser never sees an API request.

### What that claim rests on, exactly

This was got wrong once, and the wrong version is easy to repeat.

The earlier design bound the backend's **default** entrypoint and reasoned that
`/v1` was unreachable because the backend declared no route naming that path.
The backend's own hostname is a Cloudflare **custom domain**, and a custom domain
sends every path on the hostname to the default entrypoint. `/v1` was reachable
from the internet the whole time. The only thing refusing it was the backend's
site-wide Access guard — which was refusing this site's reads too. This is because a
binding carries no Access identity, so every server-rendered page got 403.

The backend Worker is still Internet-routed through its default entrypoint. What
is not routed is `VisitorRead`: a custom domain invokes only the default
entrypoint, and reaching a named one requires a Workers capability — this
binding. So the guarantee is the conjunction of two facts, each checked by a
test rather than asserted in a document:

- `/v1` is absent from the backend's route tree.
- This repository binds `entrypoint: "VisitorRead"` by name, which
  `tests/architecture/deployment-bindings.test.ts` and
  `scripts/check-environment.mjs` both require.

It is an invocation boundary, not a sandbox: a named entrypoint shares its
Worker's bindings. So this limits who may call rather than what the called code
may reach. What keeps D1 away from this repository is that this Worker has no
database binding, which the same test asserts.

**A service binding bypasses Cloudflare Access.** Access is an edge control and
a binding dispatches straight to the target script. So a request arriving over
the binding has been authenticated by nothing. That is why `/ops` authorization
lives in the backend's own middleware and must never move to the edge. It is
also why the API client in this repository exposes three named operations and
no path parameter. A client that could be handed a path would be a proxy into a service
