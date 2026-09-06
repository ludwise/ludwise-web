---
ste-prose: descriptive
---

# The Lighthouse gate

The machinery that keeps a Lighthouse score and an asset budget from getting
worse. It comes from
[Enforce the Lighthouse thresholds and budgets](https://github.com/ludwise/ludwise-web/issues/91).

This document holds the procedure. It restates no threshold. Every limit lives
in `lighthouse.config.json`, which is the one place a limit is written.
[go-and-no-go-standard.md](go-and-no-go-standard.md) explains why the
deterministic run is the run that carries a number.

## What the gate measures

A production build that `wrangler dev` serves, with `scripts/fake-backend.ts`
replaying `tests/fixtures/corpus/`. The catalog is a recording, so the same
commit measures the same bytes twice.

The gate covers four route classes and two form factors. It takes several
samples of each pair and reports the median. One sample is noise, and the
Lighthouse benchmark index moves a lot between runs on a shared machine.

The gate pins the theme through the theme cookie that `src/lib/http/theme.ts`
reads. Without that cookie the page follows the color scheme of whatever
started the browser. Two launchers then measure two different pages, and the
run stops being deterministic.

The browser is the Chromium that `@playwright/test` pins. There is no second
download, and no path that works only in continuous integration.

## The skipped audits

The deterministic run removes two audits from their categories. Lighthouse
`settings.skipAudits` computes the remaining weights again, so a reweighted
score is an honest number. The production run removes nothing.

Never skip an audit without a reason recorded here.
`tests/architecture/lighthouse-gate.test.ts` fails when this document does not
name every audit that `lighthouse.config.json` skips.

### `is-crawlable`

A deterministic run has to be a development run, because the fake backend is
reachable only through `BACKEND_DEV_URL`. A development run sends `noindex`. So
this audit fails for a reason that is correct behavior, and it cannot pass
before production. `deploy-production.yml` asserts the crawlability facts on
every deploy.

### `color-contrast`

The LUDWISE wordmark accent does not meet the contrast ratio against the light
theme background. WCAG 1.4.3 exempts text that is part of a logo or a brand
name, so this is not a defect. The color is the design system's own, and
`design/system/components/foundation.md` specifies it.

Lighthouse can remove an audit, but not one element. Keeping this audit would
report a rule that does not apply to the element it reports.

Contrast is still checked, and more strictly. `tests/e2e/shell.spec.ts` runs axe
over the route classes in both themes with the `wcag2aa` and `wcag22aa` tags. It
excludes the wordmark alone, so any other contrast failure anywhere still fails
that suite. Delete both exclusions when the wordmark color changes.

## Where the gate runs

| Workflow                | When                       | Effect            |
| ----------------------- | -------------------------- | ----------------- |
| `ci.yml`                | Every pull request         | Blocks the merge  |
| `deploy-production.yml` | Before a production deploy | Blocks the deploy |

Both call `.github/workflows/lighthouse.yml`, so production never gets a weaker
rule than pull request validation.

The production run against the live site is a different measurement. It is a
command that a person runs, it enforces nothing, and it is not a workflow job.
[go-and-no-go-standard.md](go-and-no-go-standard.md) says why.

## The required merge check

The check is named `Lighthouse / Lighthouse`, and the repository ruleset for
`main` requires it. A repository administrator sets that, in the rules of the
repository settings, and not in a file here.

The job runs on every pull request and reports a status every time, so the
required check never blocks on a skipped job.

A ready pull request always measures. A draft pull request measures only when
`scripts/ci/impact.mjs` says the change can move a score. `verify.yml` applies
that same rule to the rest of the suite.

## What a failure tells you

A failure names the route class, the form factor, the audit, the expected limit
and the measured value. The job summary repeats the numbers as a table, so a
person can see which value moved.

Every Lighthouse report is uploaded as a job artifact, whether the gate passed
or failed. Open the HTML report of the route class that failed.

## Running the gate on your machine

```sh
pnpm install
pnpm exec playwright install chromium
cp .dev.vars.example .dev.vars

SITE_URL=http://127.0.0.1:4321 pnpm run build
node --experimental-strip-types scripts/fake-backend.ts &
BACKEND_DEV_URL=http://127.0.0.1:8788 pnpm exec wrangler dev --port 4321 --ip 127.0.0.1 &

pnpm run lighthouse -- --target http://127.0.0.1:4321
```

The command writes its reports to `lighthouse-reports/`.

## Changing a limit

Edit `lighthouse.config.json`, and nowhere else. The gate reads no default, so
a configuration that omits a limit fails to load.

Never lower a threshold only to make a pull request pass. A threshold change
needs a documented reason and explicit review.
`tests/architecture/lighthouse-gate.test.ts` fails when a workflow file or this
document restates a limit, because a limit and its evidence must not drift
apart.

## Pinning

The `lighthouse` package is pinned exactly, as every dependency of this
repository is. A minor Lighthouse release can change an audit, and a changed
audit moves a score without a change to this site.
