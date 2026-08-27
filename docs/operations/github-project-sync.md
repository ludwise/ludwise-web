# GitHub Project synchronization

LUDWISE issues are tracked in the organization project [LUDWISE Development](https://github.com/orgs/ludwise/projects/2).

## Current inventory

- `ludwise/ludwise-backend`: all 38 existing issues are synchronized.
- `ludwise/ludwise-web`: currently has no issues, but is linked and has the same automation.
- Both repositories are linked to the organization Project.

## Link review findings

Reviewed against the live Project:

- All 38 items are real issues. There are no drafts, no archived items, and no orphaned or duplicate entries.
- Every item's Project `Status` agrees with its issue state, so no item claims `Done` while its issue is open.
- The Project's own `Auto-add to project (backend)` and `Auto-add to project (web)` workflows are enabled, so new issues are added without any token.
- `Area` is set for 23 of 38 items. The remaining 15 have no area-bearing label, so the mapping intentionally leaves them unset rather than guessing.
- The Project `Priority` field has no options defined, so the `priority: *` labels are not represented in the Project. Define the options before expecting priority to appear there.
- `ludwise/ludwise-backend` has repository projects disabled, which is fine: this is an organization-level Project.
- `ludwise/ludwise-web` still has `feat/initial-web-client` as its default branch, so scheduled and dispatch runs use that branch until the default changes.
- `ludwise/ludwise-backend` has this workflow only on `refactor/frontend-extraction`. Scheduled and dispatch triggers run from the default branch, so backend automation starts once that branch merges to `main`.

## Automation

Each repository contains `.github/workflows/project-sync.yml`. It runs:

- on issue open, reopen, close, edit, label, and unlabel events.
- Hourly as a repair/backfill pass.
- Manually through `workflow_dispatch`.

The workflow is intentionally additive. It adds missing issue items and updates only automation-owned metadata:

- closed issues become `Done`.
- Reopened issues become `Backlog`.
- Clear area labels map to the Project `Area` field: `frontend` → `Web`, `area: backend` → `Backend`, `area: database` → `Data`, infrastructure/CI/observability labels → `Infra`, and ops labels → `Ops`.

It does not delete project items, copy issue bodies, or overwrite an active manually chosen status during the hourly pass.

## Required repository secret

Configure `LUDWISE_PROJECT_TOKEN` in **both** repositories. It must be a GitHub token that can read and write organization Projects and read repository issues. A classic token with the `project` scope is the simplest supported option. Do not use a Cloudflare token, and never commit the token.

The workflow fails with an explicit message when the secret is absent. To configure it interactively outside the repository, use GitHub's secret UI or the equivalent `gh secret set` command with a token supplied through a protected local mechanism.

## Manual run

```text
gh workflow run project-sync.yml --repo ludwise/ludwise-backend
gh workflow run project-sync.yml --repo ludwise/ludwise-web
```

The hourly pass is the recovery path if an issue event is missed. Project status changes made manually remain authoritative for open issues unless an issue is explicitly closed or reopened.
