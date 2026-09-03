---
ste-prose: descriptive
---

# Issue tracker: GitHub

Issues and specs for this repository live as GitHub issues. Use the `gh` CLI for
all operations. The repository is `ludwise/ludwise-web`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for a multi-line body.
- **Read an issue**: `gh issue view <number> --comments`. Filter the comments with `jq`, and fetch the labels too.
- **List issues**: see the first command below. Add `--label` and `--state` filters as necessary.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply or remove a label**: `gh issue edit <number> --add-label "..."` or `gh issue edit <number> --remove-label "..."`
- **Close an issue**: `gh issue close <number> --comment "..."`

```sh
gh issue list --state open \
  --json number,title,body,labels,comments \
  --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'
```

`gh` reads the repository from `git remote -v` when it runs inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

Set this flag to `yes` if this repository treats an external pull request as a
feature request. The `/triage` skill reads the flag.

When the flag is `yes`, a pull request uses the same labels and states as an
issue, through the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments`, and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: see the second command below. Keep only an `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` or `NONE`. Drop `OWNER`, `MEMBER` and `COLLABORATOR`.
- **Comment, label or close**: `gh pr comment`, `gh pr edit --add-label`, `gh pr edit --remove-label`, `gh pr close`.

```sh
gh pr list --state open \
  --json number,title,body,labels,author,authorAssociation,comments
```

GitHub uses one number space for issues and pull requests. A bare `#42` can be
either one. Resolve it with `gh pr view 42`, and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

The `/wayfinder` skill uses these operations. The **map** is one issue. Its
tickets are **child** issues of that map.

This repository has native sub-issues and native issue dependencies. The read
endpoints answer, and `issue_dependencies_summary` is present on an issue. This
was confirmed on 2026-09-03. The write path was not exercised. Use the canonical
path below, and fall back to a body convention only if a write is refused.

- **Map**: one issue with the `wayfinder:map` label. Its body holds the Destination, Notes, Decisions-so-far, Not-yet-specified and Out-of-scope sections. Create it with `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue. Link it with `gh api --method POST repos/ludwise/ludwise-web/issues/<map>/sub_issues -F sub_issue_id=<child-db-id>`. Read `<child-db-id>` from `gh api repos/ludwise/ludwise-web/issues/<n> --jq .id`. That is the numeric database id, not the `#number` and not the `node_id`. Label every ticket `wayfinder:<type>`, where the type is `research`, `prototype`, `grilling` or `task`.
- **Blocking**: use the native issue dependencies. Add an edge with `gh api --method POST repos/ludwise/ludwise-web/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`. Read `<blocker-db-id>` the same way as above. GitHub counts the open blockers in `issue_dependencies_summary.blocked_by`. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the open children with `gh api repos/ludwise/ludwise-web/issues/<map>/sub_issues`. Drop every child that has an open blocker or an assignee. The first one in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`. This is the first write of the session, before any other work.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`. Then append a gist and a link to the Decisions-so-far section of the map.

A write to the sub-issue or dependency endpoint can be refused. Then add the
child to a task list in the map body. Write `Part of #<map>` at the top of the
child body. Write `Blocked by: #<n>, #<n>` above it.
