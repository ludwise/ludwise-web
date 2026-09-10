---
ste-prose: descriptive
---

# The prelaunch-to-production cutover

This runbook comes from
[The prelaunch-to-production cutover](https://github.com/ludwise/ludwise-web/issues/67).
That resolution decides the steps and the rollback beside each one. This
document transcribes them, and it decides nothing.

The bar that says whether the launch may proceed is a separate document. See
[go-and-no-go-standard.md](go-and-no-go-standard.md).

## The mechanism

The swap is a redeploy over one Worker script. Nothing changes at DNS.

`wrangler.prelaunch.jsonc` names the script `ludwise-web-production`. The
`production` environment in `wrangler.jsonc` names the same script. Both declare
`ludwise.com` as a custom domain. One script serves that hostname today, and
`deploy-production.yml` replaces it in place. No moment exists when two Workers
claim the hostname, and no moment exists when none does.

The cutover is the first production deploy. No `production` branch exists, no tag
exists and no release exists. `deploy-production.yml` runs only after a person
publishes a release.

Wrangler refuses a binding that names an entrypoint the target Worker does not
export. See [architecture.md](../architecture.md). A `ludwise-production` backend
without `VisitorRead` thus fails the web deploy instead of serving a broken site.

Indexing does not change at the swap. `prelaunch/robots.txt` sends `Allow: /`
today. `src/pages/robots.txt.ts` sends `Allow: /` when the environment is
production. The live site sends no `X-Robots-Tag` header.

## Where the prelaunch site goes

The prelaunch site survives at no address. It stays in `prelaunch/` in git, and
it stays in the Cloudflare version history of the script. The only reason to keep
it reachable is rollback, and rollback returns it to `ludwise.com`.

## The two rollback levers

The sanctioned lever is `workflow_dispatch` on `deploy-prelaunch.yml`. It takes
two to four minutes. It runs through the `production` GitHub environment, so it
inherits the approval rules and leaves a run record. It also verifies its own
work. It reads `Coming soon`, checks `robots.txt`, and asserts that `/games`,
`/sales`, `/api/health`, `/ops` and `/v1/games` all answer 404.

The break-glass lever is `wrangler rollback <version-id> --name ludwise-web-production`.
It takes seconds. It needs the Cloudflare API token on the operator machine, and
it leaves no record in this repository. Use it only when GitHub Actions is the
broken thing.

A person who can approve the `production` environment can run the rollback. The
same gate applies in both directions.

## Phase 0. Preflight <!-- ste-prose: procedural -->

Run these steps days before the swap. None of them change the live site.

1. Confirm that `SITE_URL` on the `production` GitHub environment reads
   `https://ludwise.com`. The build reads it, and `assertEnvironmentsMatch`
   refuses a mismatch.
2. Confirm that `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are present on
   the same environment. The prelaunch deploy already uses both.
3. Confirm that the approval rules on the `production` environment name the
   correct people. Those rules gate the rollback too.
4. Confirm that no Cloudflare Access application covers `ludwise.com`. Production
   is public.
5. Record the live version identifier with
   `wrangler versions list --name ludwise-web-production`. Write it into the
   launch record. It is the break-glass rollback target.
6. Confirm that the operator holds the Cloudflare API token locally.
7. Create a Cloudflare rate-limiting rule on `/media/*` for `ludwise.com`. The
   media route proxies provider images, and the address is not signed. The
   allow-list bounds what a stranger can serve, and this rule bounds what it
   costs. This repository holds no infrastructure as code, so an operator
   creates the rule by hand. Record the rule name and its threshold in the
   launch record.

**Rollback.** None. Nothing has changed yet.

## Phase 1. Backend release <!-- ste-prose: procedural -->

8. Release `ludwise-production` with `VisitorRead` published.
9. Probe `ludwise-production`, and then let it run. Publish the web release on a
   later day.

A backend fault found on the day of the swap is found with the public looking at
the site. A backend that is live behind an unlaunched hostname can be watched
instead.

**Rollback.** The backend owns it. This repository is untouched.

## Phase 2. Prepare the web release <!-- ste-prose: procedural -->

10. Land two edits on `main`.

- Remove the `push` trigger from `deploy-prelaunch.yml`, and keep
  `workflow_dispatch`.
- Add the two smoke-test assertions that the section below names.

11. Create the `production` branch at the reviewed `main` commit. Protect it, and
    permit a fast-forward only.
12. Publish a GitHub Release from `production`.

`deploy-prelaunch.yml` fires on a push to `main` that touches `prelaunch/**` or
`wrangler.prelaunch.jsonc`, and it deploys to `ludwise-web-production`. After the
cutover, that trigger replaces the live application with a `Coming soon` page.
Remove the trigger in the commit the release is cut from. The shared
`concurrency: group: deploy-production` stays, because it stops the two workflows
racing.

**Rollback.** Delete the branch or the draft release. The live site is still the
prelaunch site until step 13 finishes.

## Phase 3. The swap <!-- ste-prose: procedural -->

13. `deploy-production.yml` runs `verify.yml`, and then `wrangler deploy`. It
    replaces the script `ludwise-web-production`.
14. The workflow verifies its own deploy. The section below lists what it
    asserts.

**Rollback.** Run `workflow_dispatch` on `deploy-prelaunch.yml`. It takes two to
four minutes. The break-glass lever is `wrangler rollback` to the version
identifier from step 5.

## Phase 4. After the swap <!-- ste-prose: procedural -->

15. Purge the Cloudflare cache once.
16. Read `/`, `/games`, `/sales` and one game-detail page as an anonymous
    visitor.

Nothing survives the swap except by revalidation, and the new ETag settles that.
The purge is one API call against a site with no warm cache to protect. Submit no
sitemap yet. The sitemap submission belongs to
[Establish the SEO baseline](https://github.com/ludwise/ludwise-web/issues/9).

**Rollback.** The same two levers as phase 3.

## What the deploy workflow asserts

`deploy-production.yml` already asserts these facts.

- `/api/health` reports `environment=production` and `service=ludwise-web`.
- No `X-Robots-Tag` header is sent.
- `robots.txt` allows crawling.
- `/ops`, `/ops/logs`, `/v1/games` and `/v1/sales` answer 404.
- `/`, `/games` and `/sales` answer 200.

Two route classes are missing, and step 10 adds them.

- A canonical game-detail URL answers 200. Game detail has the deepest backend
  dependency, and it is the only route that proves the catalog renders.
- A known-absent path answers 404.

Two more assertions reach the same workflow from other resolutions. The go and
no-go standard holds both. See
[go-and-no-go-standard.md](go-and-no-go-standard.md).

## What this runbook does not decide

The go and no-go bar, the evidence a person must read, and who signs. That is
[The go and no-go standard](https://github.com/ludwise/ludwise-web/issues/68),
transcribed in [go-and-no-go-standard.md](go-and-no-go-standard.md).
