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
- visitor analytics
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
with no other public surface.

### Consequences

- No CORS anywhere in this repository.
- No `PUBLIC_`-prefixed environment variables. Astro inlines those into client
  JavaScript, and nothing here is read by the browser.
- Every read happens during SSR. There is no client-side data fetching.
- Both Workers must live in the same Cloudflare account, and the backend must
  exist before this Worker is deployed. That is now stricter: Wrangler refuses a
  binding naming an entrypoint the target Worker does not export. So a backend
  that has not yet published `VisitorRead` fails this deploy rather than serving
  a broken site. **Deploy the backend first.**
- Binding changes are two-phase: add the binding in one release, use it in the
  next. Remove one at least a release after the code stops reading it.
  Otherwise rolling back code lands on a Worker whose bindings no longer match.

## The API client

`src/lib/api/` is the only place this site talks to the backend, and
[`tests/architecture/boundaries.test.ts`](../tests/architecture/boundaries.test.ts)
enforces it rather than leaving it to convention. A scattered `fetch` is a place
where things go wrong. A timeout is forgotten, a correlation header is not
forwarded, a malformed response is trusted, or a backend error message ends up
in a page.

| File          | What it is                                              |
| ------------- | ------------------------------------------------------- |
| `contract.ts` | The authoritative wire types. See below.                |
| `client.ts`   | Transport: URLs, timeout, retry, correlation, decoding. |
| `errors.ts`   | The failure taxonomy and what may be logged from it.    |

### Failure handling

| Kind          | Cause                               | Retried?                   | What a visitor sees                             |
| ------------- | ----------------------------------- | -------------------------- | ----------------------------------------------- |
| `rejected`    | 400, the request was refused        | Never                      | Which filters were wrong, with the form redrawn |
| `unavailable` | Binding failed, or a 5xx            | Only when nothing answered | "We could not load this right now"              |
| `timeout`     | Backend did not answer in time      | Once                       | The same                                        |
| `malformed`   | Answered, but not with the contract | Never                      | The same                                        |

Two attempts at most, with a short fixed pause. The bound is the point. An
unbounded retry chain turns one slow backend into a queue of Workers all
waiting. That converts a degraded dependency into an outage of this site too.

A rejection is never retried — the request was refused for what it contained.
A 5xx carrying a backend error code is never retried either. It means the
backend reached its dependency and the dependency failed, and retrying
immediately adds load to something already struggling.

Nothing method-aware appears in that logic because every request is a GET. When
a write appears, the retry rule must not simply be widened. An unsafe request
needs an idempotency key before it may be retried at all.

### Unavailable is not empty

This is the distinction the whole error layer exists to preserve. A failed read
**throws**. It never returns an empty view. Rendering "no games found" when the
truth is "we could not ask" is a false claim about the market rather than a
cosmetic slip. The same applies to sales, offers, and a game detail page —
where a failure must never render as a 404. This is because that tells a visitor
following a good link that their link is broken.

## The contract

`src/lib/api/contract.ts` is the **authoritative** statement of the wire shape,
and it lives here rather than in the backend on purpose. This repository must
build without access to the private one. So it cannot import those types and
cannot be generated from a schema that is not present.

The backend vendors this file into its own `tests/contract/` and proves
conformance at compile time. A view type there that stops satisfying a type here
fails **that** build with TS2344.

So the direction is: the backend is authoritative about behavior, this file is
authoritative about the shape that behavior must keep. The conformance test
is the joint. A hand-written type is only as true as the test that checks it,
which is why that test is not optional.

### Evolution

Additively. A response may gain a field. It may never lose or narrow one without
a version change.

```
old frontend + new backend  → works (unknown fields ignored)
new frontend + old backend  → works (new fields must be optional)
```

That is what lets the two repositories deploy in either order. A field added to
the contract before the backend serves it must be optional and read as absent.
When a genuinely incompatible change is needed it goes to `/v2`, and both
contracts exist for a while.

### Changing it <!-- ste-prose: procedural -->

1. Change `src/lib/api/contract.ts` here.
2. Copy it verbatim into the backend's `tests/contract/contract.ts`.
3. Run the backend's `typecheck:tests`. It fails if the backend cannot satisfy
   the new shape.
4. Make the backend satisfy it, and deploy the backend **first** for an additive
   change.

### The recorded corpus

`tests/fixtures/corpus/` holds responses the backend really produced, written by
its `tests/contract/corpus.test.ts` and copied here byte for byte. The fake
backend replays them. That replay is what makes the end-to-end suites evidence
about the real contract, rather than about shapes invented to match the code
under test.

To change one: add or edit the case in the backend's `CASES`, run its
`pnpm run contract:corpus` to re-record, then copy the files across unmodified.

Do not edit these files here, and do not format them. `.prettierignore` excludes
the directory. The reason is that collapsing one short array is enough to break
the backend's byte comparison against a response it really does emit.
`tests/integration/corpus-integrity.test.ts` re-serialises every file the way
the recorder did, and fails if the bytes have moved. That is the strongest
check available from a repository that cannot see the backend.

## Environments

|            | Site                     | Backend              | Hostname              |
| ---------- | ------------------------ | -------------------- | --------------------- |
| local      | `ludwise-web`            | `ludwise`            | `localhost:4321`      |
| staging    | `ludwise-web-staging`    | `ludwise-staging`    | `staging.ludwise.com` |
| production | `ludwise-web-production` | `ludwise-production` | `ludwise.com`         |

Each environment names its own backend in `wrangler.jsonc`. The name is written
out in full rather than inherited. Inheritance would make the most dangerous
possible mistake invisible in the file where it happens.

A service binding names a Worker script, so there is no URL a mistyped variable
could redirect. `assertEnvironmentsMatch` in `src/lib/config/index.ts` is the
second line: it refuses to serve a page built from one environment's site and
another's data. The only permitted crossing is local → staging, which is a
real workflow reading disposable data. Nothing may read production.

## Observability

One log record per request, carrying `request_id`, `trace_id` and `span_id`.
Both are forwarded to the backend as `x-request-id` and `traceparent`. So the
two Workers' records join into one trace — without that, splitting the
repositories would have doubled the logging bill for less than it bought.

Deliberately absent from every record: raw URLs, query strings, cookies,
authorization headers, user agent, client IP. Only the route template is
recorded — `/games/[slug]`, never the game somebody looked at.

A failed backend call logs the safe error code, the HTTP status, the request id
and the duration. Never the response body, never the cause, never the values a
field was rejected for.

## Analytics

This repository owns visitor analytics. The backend owns operational telemetry.

Before the split both lived in one Worker, and a page view could plausibly have
been counted twice. After it there is exactly one page-view event per page,
emitted here. The backend sees API reads and has no way to know a page was
rendered.

The event carries a route **template** and nothing else. No referrer, no visitor
agent, no viewport, no session identifier, no visitor identifier. A route that
was sanitised rather than matched produces no event at all. Losing a count is
recoverable. Collecting a path a visitor typed is not.

No third-party analytics, no fingerprinting, no session replay, no cross-site
identifiers. Splitting the repositories must not become the moment any of those
arrive by accident.

## Caching

No caching, in the first cut. `no-store` everywhere, matching the behavior
before the split, so the migration is provably behavior-preserving.

That is a starting point rather than a conclusion. Adding a short cache later is
unusually safe here because every price carries `observedAtMs` and the interface
renders freshness from it. A cached response is honest about its own age. When
it happens, two rules are non-negotiable. Never cache across different
market/currency inputs. Never let a shared cache hold a response carrying a
request id.

Static assets are the exception and always were. `public/_headers` marks the
fonts immutable. They are content-addressed by filename and never change in
place.

## Performance

SSR-first, deliberately. The only client-side JavaScript is the header island
and the pre-paint theme script. There is no client-side router, no data
fetching in the browser, and no state management library. A visitor comparing
prices should not download the catalog to read one page.

One backend request per page. A rejected filter combination is the exception. It
costs one request, and gets its filter form rebuilt in the same response rather
than in a second round trip.
