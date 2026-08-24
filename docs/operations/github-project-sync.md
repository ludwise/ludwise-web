# GitHub Project synchronization

LUDWISE issues are tracked in the organization project [LUDWISE Development](https://github.com/orgs/ludwise/projects/2).

## Current inventory

- `ludwise/ludwise-backend`: all 40 existing issues are synchronized.
- `ludwise/ludwise-web`: currently has no issues, but is linked and has the same automation.
- Both repositories are linked to the organization Project.

## Automation

Each repository contains `.github/workflows/project-sync.yml`. It runs:

- on issue open, reopen, close, edit, label, and unlabel events;
- hourly as a repair/backfill pass;
- manually through `workflow_dispatch`.

The workflow is intentionally additive. It adds missing issue items and updates only automation-owned metadata:

- closed issues become `Done`;
- reopened issues become `Backlog`;
- clear area labels map to the Project `Area` field: `frontend` → `Web`, `area: backend` → `Backend`, `area: database` → `Data`, infrastructure/CI/observability labels → `Infra`, and ops labels → `Ops`.

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
