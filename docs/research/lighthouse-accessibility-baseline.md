---
ste-prose: descriptive
---

# Lighthouse and accessibility baseline

The measured distance between the application today and the gates that
[#31](https://github.com/ludwise/ludwise-web/issues/31) and
[#37](https://github.com/ludwise/ludwise-web/issues/37) propose. It resolves
[#63](https://github.com/ludwise/ludwise-web/issues/63). It decides nothing.

## How the numbers were made

- Date: 2026-09-05.
- Commit: the tip of `daniel-kindl/wayfinder`.
- Build: `SITE_URL=http://127.0.0.1:4321 pnpm run build`. A production build, not
  a development server.
- Server: `wrangler dev --port 4321`, which runs the built Worker in `workerd`.
- Backend: `scripts/fake-backend.ts` in `populated` mode on port 8788. It replays
  the recorded corpus in `tests/fixtures/corpus/`, so the data is deterministic.
- Browser: Chrome for Testing 151.0.7922.34, headless.
- Tool: Lighthouse 12.8.2, one run per route per form factor.

The four routes are the classes that #31 names.

| Class          | Route                   |
| -------------- | ----------------------- |
| Home           | `/`                     |
| Search         | `/games?q=half`         |
| Sales          | `/sales`                |
| Game detail    | `/games/canonical-demo` |

## Category scores

| Run              | Performance | Accessibility | Best Practices | SEO |
| ---------------- | ----------- | ------------- | -------------- | --- |
| home desktop     | 100         | 100           | 100            | 66  |
| search desktop   | 100         | 100           | 100            | 66  |
| sales desktop    | 100         | 100           | 100            | 66  |
| game desktop     | 100         | 100           | 100            | 66  |
| home mobile      | 99          | 100           | 100            | 66  |
| search mobile    | 99          | 100           | 100            | 66  |
| sales mobile     | 99          | 100           | 100            | 66  |
| game mobile      | 99          | 100           | 100            | 66  |

#31 proposes Performance 95 or higher, Accessibility 100, Best Practices 100 and
SEO 100. Three of the four thresholds are met today on every route.

## Lab metrics

| Run            | LCP     | CLS   | TBT |
| -------------- | ------- | ----- | --- |
| home desktop   | 473 ms  | 0.000 | 0 ms |
| search desktop | 508 ms  | 0.000 | 0 ms |
| sales desktop  | 452 ms  | 0.000 | 0 ms |
| game desktop   | 490 ms  | 0.000 | 0 ms |
| home mobile    | 1959 ms | 0.000 | 0 ms |
| search mobile  | 1959 ms | 0.000 | 0 ms |
| sales mobile   | 1961 ms | 0.000 | 0 ms |
| game mobile    | 1960 ms | 0.000 | 0 ms |

#31 proposes 2500 ms for Largest Contentful Paint, 0.10 for Cumulative Layout
Shift and 200 ms for Total Blocking Time. Every route is inside all three.

The Lighthouse benchmark index moved between 512 and 2739 across the runs. The
machine is loaded and noisy. Treat a single millisecond value as approximate.
The direction of the result is safe. The precision is not.

## Transfer size

Mobile, in kibibytes.

| Route  | Total | Script | Stylesheet | Image | Font  | Document | Requests |
| ------ | ----- | ------ | ---------- | ----- | ----- | -------- | -------- |
| home   | 176.8 | 64.4   | 5.7        | 0.0   | 101.6 | 4.6      | 9        |
| search | 179.0 | 64.4   | 6.8        | 0.0   | 101.6 | 5.6      | 10       |
| sales  | 181.0 | 64.4   | 7.3        | 0.0   | 101.6 | 7.2      | 10       |
| game   | 181.0 | 64.4   | 7.2        | 0.0   | 101.6 | 7.3      | 10       |

The typeface is 57 percent of the page weight and is the largest asset class.
The site serves it itself, which `tests/e2e/shell.spec.ts` asserts. The script
weight is the same on every route.

## The one SEO failure

`is-crawlable` is the only failing SEO audit on every route. The other SEO audits
pass. The page carries `noindex,nofollow` because `ENVIRONMENT` is `development`,
which is correct behavior and not a defect.

This is a constraint on the gate that #31 proposes, and not a task in it:

- A deterministic Lighthouse run needs the fake backend.
- The fake backend is reachable only through `BACKEND_DEV_URL`.
- `resolveTransport` in `src/middleware.ts` honors that variable only when
  `ENVIRONMENT` is `development`. The check exists to remove a way to point the
  live site at any origin.
- A `development` environment sends `noindex`.

So a Lighthouse run against deterministic fixtures is always a `development` run,
and always fails `is-crawlable`. Staging is `noindex` too. An SEO threshold of 100
therefore cannot pass on a pull request or on staging. It can pass only against
production, after the deployment.

## Accessibility

Every automated suite passes. 99 tests, 0 failures.

| Suite                     | Tests | Result |
| ------------------------- | ----- | ------ |
| `pnpm run test:e2e`       | 83    | pass   |
| `pnpm run test:e2e:empty` | 4     | pass   |
| `pnpm run test:e2e:degraded` | 12 | pass   |

The coverage includes axe on the home, games, sales and not-found pages in the
light theme and the dark theme, the sales page with and without an active filter,
the empty catalogue, the failure page, horizontal overflow at 320, 375, 768 and
1024 pixels, the skip link, and keyboard navigation.

Lighthouse reports Accessibility 100 on all four routes.

None of this proves conformance with WCAG 2.2 A and AA. axe and Lighthouse test
the criteria a machine can decide. #37 asks for an applicability matrix and a
manual audit, and this baseline touches neither.

## What is small and what is structural

Small:

- `render-blocking-resources` and `render-blocking-insight` fail on every route,
  and the Performance score is still 99 or 100.
- `unused-javascript` fails on every route.
- Mobile Performance is 99 rather than 100. First Contentful Paint scores 0.97
  to 0.98.

Structural:

- The SEO gate cannot run before production. See the section above.
- Every image measurement is 0.0 KiB, on every route. No media renders yet,
  because [#53](https://github.com/ludwise/ludwise-web/issues/53) has not wired
  it. This is a baseline of the site **without** cover art, screenshots or
  trailers.
- Largest Contentful Paint and Cumulative Layout Shift are the two metrics media
  changes most. The canonical media contract supplies no dimensions and no aspect
  ratio, which
  [#69](https://github.com/ludwise/ludwise-web/issues/69) owns. A CLS of 0.000
  today is not evidence that the budget holds after #53.

Measure again after #53. A budget set on these numbers would be set on a site
that does not yet show a game's pictures.
