---
ste-prose: descriptive
---

# The go and no-go standard

This standard comes from
[The go and no-go standard](https://github.com/ludwise/ludwise-web/issues/68).
[Where the Lighthouse SEO threshold runs](https://github.com/ludwise/ludwise-web/issues/74)
corrects gate 2 and gate 4, and it widens gate 3. This document transcribes both
resolutions, and it decides nothing.

The steps of the swap are a separate document. See
[cutover-runbook.md](cutover-runbook.md).

Four gates. Two are machine verdicts that a person reads. Two are calls that a
person makes. The launch is the last gate, and not the deploy.

The quiet window is what makes this shape possible. No announcement exists, and
[the SEO baseline](https://github.com/ludwise/ludwise-web/issues/9) owns the
sitemap submission. So the swap and the moment an audience arrives are separate
events.

## Why staging cannot prove the catalog

`wrangler.jsonc` binds staging to `ludwise-staging` and production to
`ludwise-production`. The separation is structural and deliberate. It is what
stops a staging site reading production data. It also means the catalog a
visitor meets on day one renders nowhere before the swap.

So the checks split by what they depend on. A check that depends only on the
build runs before the swap. A check that depends on real data runs on
production, after the swap.

## Gate 1. Build green

Automated, on the release-candidate commit.

`verify.yml` in full mode covers the language gate, lint, typecheck, unit tests
with coverage, and the build. It also covers the Playwright suites, the
empty-catalog and backend-unavailable suites, the Wrangler dry runs for both
targets, and the publish audit.

No judgment. The candidate passes, or it is not a candidate.

## Gate 2. Candidate accepted

A person, before the swap.

- The manual
  [accessibility pass](https://github.com/ludwise/ludwise-web/issues/37),
  written down before it is run.
- The comparison of the
  [policy text](https://github.com/ludwise/ludwise-web/issues/55) against the
  release candidate.
- The
  [Lighthouse re-measurement](https://github.com/ludwise/ludwise-web/issues/31)
  after [the media work](https://github.com/ludwise/ludwise-web/issues/53),
  taken from the deterministic run below.

The manual pass and the policy comparison run on staging. Staging redeploys on
every push to `main`, so such a pass can silently run against a build that is
not the candidate. Read `https://staging.ludwise.com/api/health` first, and
confirm that `version` matches the candidate. Hold `main` for the length of the
pass.

Staging owes no Lighthouse score. Its payload moves when the staging catalog
moves, so a regression against the baseline cannot be told apart from a data
change.

This gate already has a signature. Publishing the release only starts the
workflow. The deploy job then waits on the `production` GitHub environment
approval. Approving it is the act of saying the candidate passed, and it leaves
a run record without a second ritual.

### The deterministic Lighthouse run

A production build served by `wrangler dev`, with `scripts/fake-backend.ts`
replaying `tests/fixtures/corpus/`. It is the run a number comes from, because
it is the only run that means the same thing twice. It skips one audit and
enforces everything else.

The skipped audit is `is-crawlable`. A deterministic run has to be a development
run, and a development run sends `noindex`. So that one audit fails for a reason
that is correct behavior.

Lighthouse `settings.skipAudits` removes an audit from its category and
renormalizes the remaining weights. A reweighted `SEO` score is thus an honest
number. An assertion override in Lighthouse CI is not, because it leaves the
failure inside the score. So the run declares `skipAudits: ['is-crawlable']`,
and the exclusion is recorded here.

The thresholds and the asset budgets live in the committed Lighthouse
configuration and nowhere else. This standard holds the procedure and restates
no number.

## Gate 3. Cutover clean

Automated, on production. `deploy-production.yml` runs it, and
[cutover-runbook.md](cutover-runbook.md) lists what the workflow already
asserts.

Four assertions join that list.

- A canonical game-detail URL answers 200, and a known-absent path answers 404.
  Both come from
  [the cutover](https://github.com/ludwise/ludwise-web/issues/67).
- The `version` that `/api/health` reports equals the release tag. See the
  section below.
- The served HTML carries no robots meta tag with `noindex`. This one comes from
  [the Lighthouse SEO resolution](https://github.com/ludwise/ludwise-web/issues/74).

The last assertion exists because `src/layouts/BaseLayout.astro` emits
`<meta name="robots" content="noindex,nofollow">` when the environment is not
indexable. The workflow reads the header and not the tag, and the tag is the
silent and expensive failure.

## Gate 4. Live accepted

A person, on production, on the day of the swap. This is the launch.

- The catalog reads true against production data: game detail, search and sales.
- Media renders. The provenance and freshness wording matches what the backend
  returned.
- The [provider attribution](https://github.com/ludwise/ludwise-web/issues/58)
  is visible on a page that a visitor loads, and not merely merged.
- The [states](https://github.com/ludwise/ludwise-web/issues/16) behave against
  real responses.
- The production Lighthouse run.

The production Lighthouse run measures all four categories on the live site,
with no exclusion. It covers the same four route classes as
[the baseline](https://github.com/ludwise/ludwise-web/issues/63), on desktop and
on mobile. It enforces nothing. It is evidence for this gate, and it attaches to
the launch record.

That run is one command that a person gives, and not a workflow job. By the time
Lighthouse could run inside `deploy-production.yml`, the Worker is live and
serving, so a red job is a notification and not a barrier. It is also the only
measurement of the real catalog.

Gate 4 has no workflow to approve, so it is recorded by hand.

## The version assertion

Nothing today proves that the build somebody signed off is the build that is
serving. `/api/health` reports `version` from `BUILD_INFO`, which release-please
keeps in step with the tag. `deploy-production.yml` greps that response for
`environment` and `service`, and it ignores `version`. The assertion closes that
gap in one line.

## How the backend release and the web release match

Do not build a version handshake. Three facts already speak to the match, and
together they are enough.

- Wrangler refuses a binding that names an entrypoint the target Worker does not
  export. A `ludwise-production` without `VisitorRead` thus fails the deploy
  rather than serving a broken site.
- The game-detail assertion in gate 3 proves that the backend answers, and that
  the contract still renders. A shape mismatch is a broken detail page, and the
  assertion catches it.
- Production has no backend readiness probe and needs none.
  `wantsBackendReadiness` returns true only for staging, deliberately, so that a
  public liveness request cannot start backend work.

What is owed here is a record, and not a check. Write the `ludwise-production`
release identifier and its deploy time into the launch record, beside the web
tag.

## The window

Gate 4 completes on the day of the swap. Otherwise the site rolls back, and the
launch is attempted again.

Nothing keeps a visitor or a crawler out of that window. `robots.txt` allows
crawling, and production sends no `X-Robots-Tag`. What is controlled is that
nothing is announced and no sitemap is submitted.

The bound does not exist to keep the site private. It exists to keep the
rollback lever usable. `workflow_dispatch` on `deploy-prelaunch.yml` takes two
to four minutes on the day. It becomes a decision nobody wants to take after a
week.

## What reverses the launch

Three classes roll back. Everything else is a follow-up issue on a live site.

1. **A duty is not satisfied on the live site.** The IGDB credit is absent. A
   policy page is missing or wrong, or it describes collection that does not
   match the code.
2. **A route class is broken for a visitor.** Any of `/`, `/games`, `/sales` or
   game detail fails, or the catalog renders empty against a populated backend.
3. **An internal surface answers on the public hostname.** Gate 3 already
   asserts this for `/ops`, `/ops/logs`, `/v1/games` and `/v1/sales`.

One test keeps the line honest. A rollback is for what a lawyer or a visitor
cannot live with. An issue is for what an engineer wants fixed. A layout defect,
a slow page, a wrong string, or an accessibility finding off a critical path is
a follow-up.

A Lighthouse miss is none of the three classes. A weak `SEO` score, or a slow
Largest Contentful Paint, is an engineer's problem. It becomes a follow-up issue
on a live site. That is why gate 3 asserts the robots meta tag directly, and why
the Lighthouse number is a confirmation rather than a protection.

## Who calls it

One releaser. Gate 2 and gate 4 are that person's call. Gate 1 and gate 3 are
machine verdicts that they read rather than judge. A red gate 1 or gate 3 is no
judgment call at all.

Today one person holds the approval on the `production` GitHub environment, and
that same rule gates the rollback in both directions. This standard says one
releaser plainly, rather than implying a committee.

## Where it is recorded

Two places, holding different things.

The **standard** is this document: the four gates, their evidence and the
reversal bar. It is the part that gets reused.

The **launch record** is one issue, filled in as the gates pass. It holds this
launch and no other.

- The live version identifier from preflight step 5, which is the break-glass
  rollback target.
- The web release tag, plus the `ludwise-production` release identifier and its
  deploy time.
- Who signed gate 2 and gate 4, and when.
- The production Lighthouse report.
- What was filed as a follow-up rather than rolled back, with links.

Release notes were rejected as the only record. They describe what changed, and
not what was verified. Nobody returns to edit a gate-4 result into them.

## What this standard does not decide

- The steps of the swap, and how each one reverses. See
  [cutover-runbook.md](cutover-runbook.md).
- What the manual accessibility pass contains. This standard says only that it
  is written before it is run.
