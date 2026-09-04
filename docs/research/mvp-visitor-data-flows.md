---
ste-prose: descriptive
---

# MVP visitor data flows

This document is a factual inventory of the visitor data the MVP application
touches, as the code and configuration in this repository stand today. It
supports issue #65 and feeds issue #55, which needs a privacy policy that
matches the release candidate. This document proposes no policy wording. Every
row cites a file and a line number, or states plainly that the fact cannot be
determined from code.

"Today" means the state of this worktree's source tree, `wrangler.jsonc`,
`wrangler.prelaunch.jsonc`, `astro.config.mjs`, `.dev.vars.example`,
`package.json`, and the GitHub Actions workflows, read directly.

## 1. Cookies and browser storage

| Item | What it holds / does | Status | Source (file:line) |
| --- | --- | --- | --- |
| `theme` cookie | The visitor's chosen color theme, `light` or `dark`. Written only when the visitor clicks the header theme toggle. `Path=/`, `Max-Age=` one year, `SameSite=Lax`, `Secure` when the page is served over https, not `HttpOnly` (the toggle writes it from a script). | Active in code | `src/lib/http/theme.ts:14` (cookie name), `:38-55` (read/parse), `:70-79` (serialize); written from `src/components/navigation/AppHeader.tsx:314`; read server-side at `src/layouts/BaseLayout.astro:48` |
| Pre-paint theme script | Applies `prefers-color-scheme` to `<html data-theme>` before first paint when no `theme` cookie exists. Deliberately does not write the cookie itself — see the code comment on why a script-only preference does not qualify as strictly necessary storage. | Active in code | `src/layouts/BaseLayout.astro:100-126` |
| `localStorage` | Not used anywhere in the application. | Not present in code | A repository-wide search of `src/` for `localStorage` returns no matches (checked 2026-09-05) |
| `sessionStorage` | Not used anywhere in the application. | Not present in code | A repository-wide search of `src/` for `sessionStorage` returns no matches (checked 2026-09-05) |
| Any other first-party cookie | None. The `theme` cookie is the only one this application sets or reads. | Not present in code | Repository-wide search for `cookie` (case-insensitive) outside `theme.ts`, `middleware.ts`, and the logging redaction denylist returns no other cookie-setting code |
| Cloudflare Access cookie (staging only) | Cloudflare's own edge sets an authentication cookie when a visitor reaches the staging hostname. This application never reads or writes it. | Cannot be determined from code — this is Cloudflare Access's own behavior, configured through the Cloudflare dashboard, not through anything in this repository | `.github/workflows/deploy-staging.yml:95-136` shows Access gates staging, but the cookie's shape and lifetime are provider-side |

## 2. Analytics events

| Item | What it holds / does | Status | Source (file:line) |
| --- | --- | --- | --- |
| `page_view` event definition | One property, `route`: the matched route template only, for example `/games/[slug]`, never the requested URL or query string. No referrer, user agent, viewport, session id, or visitor id. Refuses to build an event at all when the route could not be matched to a template (a sanitized path is "whatever the visitor asked for" and is deliberately excluded). | Active in code (the function exists and is called) | `src/lib/analytics/events.ts:16-18` (event name), `:24-31` (input shape), `:33-46` (comment on excluded fields), `:48-56` (builder) |
| `page_view` emission | Called once per HTML document response (not for redirects, error content types, or non-document responses). | Active in code | `src/middleware.ts:317-332`; the document-response test is `src/lib/http/response.ts:17-22` |
| Analytics transport / vendor | `createAnalytics` returns the no-op provider unconditionally today. When `ANALYTICS_ENABLED` is `false` (every environment as configured now) it returns `noopAnalytics` directly. Even when the flag is `true`, it still wraps `noopAnalytics`, because no analytics vendor has been chosen yet — the code comment states this outright. So no analytics event reaches any external system in any configuration that exists in this repository today. | Configured but not enabled — no real transport exists in code at all, flag or no flag | `src/lib/analytics/index.ts:18-29` (comment stating no vendor is chosen), `:30-44` (implementation; the unconditional `noopAnalytics` wrap is `:33`) |
| `ANALYTICS_ENABLED` flag | Boolean config var. Set to `"false"` in every environment defined in `wrangler.jsonc`. | Configured but not enabled | `wrangler.jsonc:46` (local/development), `:112` (staging), `:153` (production); parsed at `src/lib/config/index.ts:96-99` |
| Analytics transport-failure log | If a track call ever throws, the event name and version (never the properties) are logged to the operational log channel, not the analytics channel. | Active in code, but unreachable today since the transport is a no-op that cannot throw | `src/lib/analytics/index.ts:33-43` |
| Analytics vendor SDK in dependencies | No analytics package (for example a GA, Plausible, PostHog, Fathom, or Umami client) appears in `package.json`. | Not present in code | `package.json:41-74` (full dependency and devDependency lists) |

## 3. Server logs and operational telemetry

| Item | What it holds / does | Status | Source (file:line) |
| --- | --- | --- | --- |
| Per-request completion log line | One record per request: `method`, `route` (template, not the raw path), `route_source`, `status`, `duration_ms`, and `cf_ray` when Cloudflare supplied one. Emitted at `debug`/`info`/`warn`/`error` depending on route and status. | Active in code | `src/middleware.ts:171-230`, specifically the record fields at `:206-217` |
| Fields deliberately excluded from that log line | Raw URLs, query strings, cookies, authorization headers, user agent, and client IP are named in code comments as deliberately absent, and none of those fields appear in the record built at lines 206-217. | Active in code (absence, not presence) | `src/middleware.ts:167-169` (comment), corroborated by the field list at `:206-217` |
| Correlation identifiers | `request_id`, `trace_id`, `span_id`, and a W3C `traceparent`, generated per request (or carried forward from an inbound header if validly shaped). Not tied to a persistent visitor identity; a fresh id is minted per request unless the caller supplied a valid one. `request_id` is echoed back to the visitor on the `x-request-id` response header. | Active in code | `src/lib/http/correlation.ts:36-45` (shape), `:88-116` (derivation); echoed at `src/middleware.ts:64-65` |
| `cf-ray` | Cloudflare's own per-request identifier, read from the `cf-ray` request header and logged when present, as the join key to Cloudflare's own logs. | Active in code | `src/middleware.ts:189`, `:215` |
| Log record shape | `timestamp`, `level`, `channel` (`operational`/`security`/`audit`), `event`, `message`, `service`, `environment`, `version`, `git_commit`, `build_id`, plus optional `request_id`/`trace_id`/`span_id`/`duration_ms`/`error`/`context`. | Active in code | `src/lib/logging/types.ts:60-80` |
| Redaction before any record is written | A denylist of normalized key fragments — including `cookie`, `authorization`, `token`, `password`, `secret`, `email`, `session`, `sessionid`, `ssn`, `otp`, `pin` — is redacted from any logged context object. Bearer tokens and JWT-shaped strings are redacted wherever they appear, regardless of field name. Strings longer than 2048 characters are truncated. | Active in code | `src/lib/logging/redact.ts:15-36` (denylist), `:63-84` (secret-pattern and truncation rules) |
| Config-invalid fatal log | On startup configuration failure, logs which config field *names* were invalid (never their values) plus the request id. | Active in code | `src/middleware.ts:120-151`, specifically `:125-130` |
| Log sink | Production: one JSON object per line via `console.log`/`warn`/`error`, ingested by Cloudflare Workers Logs. Development: a human-readable pretty-printer, compiled out of the production bundle. | Active in code | `src/lib/logging/sinks.ts:9-21` (JSON console sink), `:31-49` (dev pretty sink) |
| Cloudflare Workers Observability | Enabled with `head_sampling_rate: 1` (every request sampled). This is what makes the structured log lines above queryable in Cloudflare's dashboard at all. | Active in code (the toggle); the actual retention window is provider-side | `wrangler.jsonc:25-32` |
| `security` log channel | A separate channel exists for "potential abuse and security-relevant events," with its own event name `access.denied` defined. | Configured but not enabled — the channel and event name exist, but nothing in `src/` currently calls `securityLogger()` with `ACCESS_DENIED`, or at all, outside its own definition | Channel: `src/lib/logging/index.ts:65-68`; event name: `src/lib/logging/events.ts:14`; a repository-wide search for `ACCESS_DENIED` finds only that one definition |
| `audit` log channel | A separate channel exists for "records of consequential actions." The code comment states plainly that no product actions exist yet, so nothing writes here during bootstrap. | Configured but not enabled | `src/lib/logging/index.ts:70-78` |
| `email.send.*` event names | Three event names (`requested`, `succeeded`, `failed`) are defined in the shared event catalog. | Configured but not enabled — no caller anywhere in this repository (this site sends no email; the names likely belong to a shared catalog with the backend) | `src/lib/logging/events.ts:25-27`; a repository-wide search for `EMAIL_SEND` finds only that definition |
| `analytics.track_failed` event | Logged if the (currently no-op) analytics transport throws. | Configured but not enabled today, since the transport cannot throw (see section 2) | `src/lib/logging/events.ts:15`; used at `src/lib/analytics/index.ts:37-42` |
| Retention period of Cloudflare Workers Logs data | Cannot be determined from code — this is a setting in the Cloudflare dashboard/plan, not in this repository | N/A |

## 4. Network metadata Cloudflare handles

| Item | What it holds / does | Status | Source (file:line) |
| --- | --- | --- | --- |
| TLS termination and edge routing | Cloudflare terminates TLS and routes each production/staging hostname to its own Worker through a `custom_domain` route. | Active in code | `wrangler.jsonc:133-138` (staging route), `:164-169` (production route) |
| Cloudflare Access gate (staging only) | Cloudflare Access authenticates every request to the staging hostname at the edge, before the Worker runs. Production carries no Access application. | Active in code and CI-verified | `.github/workflows/deploy-staging.yml:95-136` (deploy verification requires an Access service token), `:146-163` (asserts staging is *not* publicly reachable) |
| `cf-ray` request header | The one piece of Cloudflare-edge metadata this application actually reads (see section 3). | Active in code | `src/middleware.ts:189` |
| Client IP address, TLS/JA3 fingerprint, ASN, and similar edge-derived metadata | This application never reads `request.cf`, any `cf-connecting-ip` header, or any `x-forwarded-*` header — a repository-wide search finds no such reference in `src/`. Whatever Cloudflare's edge itself observes and retains about a request (IP address, TLS handshake details, geolocation guesses) happens entirely inside Cloudflare's infrastructure and is invisible to this repository's code. | Cannot be determined from code — this is Cloudflare's own edge behavior and retention policy | A repository-wide search of `src/` for `cf-connecting-ip`, `x-forwarded`, and `request.cf` (or `.cf.`) returns no matches |
| Cloudflare Workers Logs / Observability retention | See section 3. | Cannot be determined from code | N/A |
| Cloudflare Web Analytics | No reference to Cloudflare Web Analytics (its beacon script, its API, or any related configuration) exists anywhere in this repository. | Not present in code | A repository-wide search for `cloudflareinsights`, `beacon`, and `Web Analytics` in source and config files returns no matches |

## 5. Outbound store links

| Item | What it does | Status | Source (file:line) |
| --- | --- | --- | --- |
| "View at {store}" offer link | The only outbound link to an external store in the application. Renders as `<a href={href} target="_blank" rel="noopener noreferrer">`. `target="_blank"` opens the store in a new tab. `rel="noopener"` stops the new tab from reaching back into this page via `window.opener`. `rel="noreferrer"` suppresses the `Referer` header for that one navigation entirely — stronger than this site's page-wide `Referrer-Policy`, and the code comment explains why: the full LUDWISE URL names the game a visitor was comparing, and that is "theirs to know only if we choose to say it." | Active in code | `src/components/game/OfferTable.astro:92-99`, specifically the anchor at `:94` |
| Site-wide default `Referrer-Policy` header | `strict-origin-when-cross-origin`, applied to every response. This governs ordinary cross-origin navigation on the site; the store link above overrides it locally with `rel="noreferrer"`. | Active in code | `src/lib/http/security-headers.ts:51-54` |
| Tracking or affiliate parameters appended to the outbound URL | None. The `href` used is exactly `offer.offerUrl` or `offer.storePageUrl` as supplied by the backend's game-detail contract, unmodified — no query parameter is added, rewritten, or stripped by this application before the link is rendered. | Not present in code | `src/components/game/OfferTable.astro:30-32` (the `actionUrl` function), `:55` (where it is used), `:94` (the rendered `href`); field definitions at `src/lib/api/contract.ts:112-113` |
| Whether any of those store links are commercial affiliate links | Not implemented in this application, and the Affiliate Disclosure legal page is an unfilled draft: "This section will explain when a LUDWISE link is an affiliate link." | Cannot be determined from code whether an affiliate business relationship exists at all — the frontend code applies no affiliate parameter or redirect regardless | `src/content/legal/en/affiliate-disclosure.md:19-21` |
| Redirect/tracking intermediary (for example a click-tracking domain) | None. The `href` resolves directly to the store's own URL as returned by the backend; no LUDWISE-hosted redirect route exists in `src/pages`. | Not present in code | `src/pages/` directory listing has no redirect or click-tracking route |

## 6. Third-party services the production deployment depends on

| Item | What it does | Status | Source (file:line) |
| --- | --- | --- | --- |
| Cloudflare Workers / Pages | Hosts and runs the application at the edge; owns DNS and TLS for the production and staging custom domains. | Active in code | `wrangler.jsonc:1-171` (whole file) |
| Cloudflare Workers Observability (Logs) | Ingests the structured JSON log lines described in section 3. | Active in code | `wrangler.jsonc:25-32` |
| Cloudflare Access | Authentication gate in front of the staging hostname only. | Active in code (CI-verified) | `.github/workflows/deploy-staging.yml:95-136` |
| LUDWISE's own backend Worker (`ludwise` / `ludwise-staging` / `ludwise-production`) | Serves `/v1/games`, `/v1/games/{slug}`, and `/v1/sales` reads over a Cloudflare service binding — not a public URL, no CORS, no API key. This is LUDWISE's own first-party backend, not an external vendor, but it is the one system this Worker calls on every content page. | Active in code | Binding declarations: `wrangler.jsonc:97-103` (local), `:119-125` (staging), `:157-163` (production); the only client that calls it: `src/lib/api/client.ts` (whole file, allowlist of three operations at `:332-381`) |
| Self-hosted Geist / Geist Mono fonts | Served from this Worker's own `/fonts/*` path (`public/fonts/*.woff2`), preloaded from `<head>`. No third-party font request is made by the shipped application. | Active in code | Preload: `src/layouts/BaseLayout.astro:66-79`; `@font-face` declarations: `src/styles/tokens/fonts.css:15-18` |
| Google Fonts CDN | Referenced only inside the separate design-system reference bundle (`design/system/tokens/fonts.css`), which is explicitly not what ships — an architecture test asserts that no UI file in the actual application loads `fonts.googleapis.com` or `fonts.gstatic.com`. | Configured in the design-system reference only, not enabled in the shipped application | Reference file: `design/system/tokens/fonts.css:4`; the shipped-code assertion: `tests/architecture/design-system.test.ts:164-170` |
| Analytics vendor of any kind | None selected. See section 2. | Not present in code | `src/lib/analytics/index.ts:21` ("No analytics vendor has been chosen") |
| Error-tracking / crash-reporting SDK (for example Sentry) | None found. | Not present in code | `package.json:41-74` (no such dependency); a repository-wide search for `sentry` (case-insensitive) returns no matches |
| Outbound content links to GitHub | The homepage links to this repository's own public GitHub pages (source, architecture notes). These are plain anchor navigations, not an API call or a runtime dependency of the deployed application. | Active in code, but is a content link rather than a service dependency | `src/pages/index.astro:46,48` |
| CDN for images, video, or other third-party assets | None found; the Cloudflare adapter's `imageService` is set to `compile` (build-time), and no external image or media host appears anywhere in `src/`. | Not present in code | `astro.config.mjs:25`; a repository-wide search for hardcoded external asset hosts in `src/` returns no matches beyond the GitHub content links and the design-reference Google Fonts URL noted above |

## 7. Contact and support route

| Item | What it does | Status | Source (file:line) |
| --- | --- | --- | --- |
| A `/contact` or `/support` page or route | Does not exist. | Not present in code | `src/pages/` contains only `404.astro`, `500.astro`, `games.astro`, `index.astro`, `robots.txt.ts`, `sales.astro`, `api/health.ts`, `games/[slug].astro`, and `legal/[slug].astro` — no contact route |
| A `mailto:` link anywhere the application renders | None found in `src/`. | Not present in code | A repository-wide search of `src/` for `mailto:` returns no matches |
| A contact form | None found. | Not present in code | No form-handling route exists in `src/pages`; the only GET form in the UI is the games search field, `src/components/navigation/AppHeader.tsx:421-428` |
| Legal-page "Contact" sections | Three of the four legal pages (Terms, Privacy, Affiliate Disclosure) carry a heading named "Contact," and each one's body is the same unfilled placeholder sentence: "This section will provide the correct \[legal/privacy\] contact information before publication." The Cookie Policy page carries no Contact heading at all. | Configured but not enabled — a heading exists; no address or channel is named anywhere in the rendered content | `src/content/legal/en/terms.md:43-45`; `src/content/legal/en/privacy.md:39-41`; `src/content/legal/en/affiliate-disclosure.md:39-41`; `src/content/legal/en/cookies.md:1-41` has no Contact section (confirmed by its full heading list) |
| `security@ludwise.com` | A vulnerability-disclosure address for security researchers, defined in the repository's own `SECURITY.md`. It is a repository-level document for people reading the GitHub repository, not a route or link the deployed website surfaces to a visitor. | Present in repository documentation, not exposed in the deployed application's UI | `SECURITY.md:12` |
| Planned contact page | The project roadmap lists "Public About and contact information" as an unchecked, not-yet-built item. | Not present in code (explicitly planned, not built) | `ROADMAP.md:49` |

## What this document cannot answer

The following facts live only inside a third-party provider's own dashboard,
account settings, or terms of service. No file in this repository can prove
them, so a human must check the provider directly before any policy states a
number or a duration.

- **Cloudflare's edge log retention.** How long Cloudflare itself retains raw
  request metadata (client IP, TLS handshake details, geolocation guesses) at
  the network edge, independent of anything this application logs.
- **Cloudflare Workers Observability (Logs) retention.** How long the
  structured JSON log lines this application emits (section 3) stay queryable
  in the Cloudflare dashboard once `head_sampling_rate: 1` (`wrangler.jsonc:31`)
  ingests them.
- **Cloudflare Access session and audit-log retention (staging).** How long
  Cloudflare retains sign-in records and session cookies for the staging
  hostname's Access application.
- **Cloudflare Web Analytics data retention.** Not applicable today since
  nothing in this repository enables Cloudflare Web Analytics (section 4), but
  worth confirming has stayed off, since the setting lives in the Cloudflare
  dashboard rather than in this repository.
- **DNS and CDN request-level metadata retention.** How long Cloudflare
  retains DNS query logs and CDN cache/access logs for `ludwise.com` and
  `staging.ludwise.com`.
- **Who inside the LUDWISE organization can access Cloudflare's dashboard
  data**, and under what access-control policy — this is an account-level
  Cloudflare setting, not a fact this codebase states.
