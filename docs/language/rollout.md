---
ste-prose: descriptive
---

# Rollout state

The repository is in audit mode.
Phase 1 defines the standard and the enforcement architecture.
Phase 2 applies the standard to existing prose.

## Phase 1

Phase 1 has a verified map of all 53 Issue 9 writing rules.
The map is separate from the smaller checker-control registry.
Existing repository prose is not rewritten in this pull request.
There is no legacy baseline that permanently forgives current violations.

## Audit mode

Run `pnpm run check:ste:audit` to inspect the whole repository.
The audit reports deterministic findings without blocking on legacy prose.
Audit mode can estimate prose kind from Markdown list shape for reporting only.

## Phase 2

Before global enforcement:

1. Classify mixed controlled prose as procedural or descriptive where needed.
2. Correct deterministic findings in existing controlled prose.
3. Settle open LUDWISE terminology conflicts.
4. Review governed prose against semantic Issue 9 rules.
5. Apply the derived-text baseline and humanizer pipeline.
6. Make semantic conformance review a required merge workflow step.
7. Remove temporary rollout allowances.
8. Set the rollout mode to `enforce`.

Normative rule mapping is not a phase 2 task.
The complete 53-rule map is part of phase 1.

## Enforcement switch

Set `rollout.mode` in [policy.json](policy.json) to `enforce`.
A mixed prose unit then fails with `LW-STE-PROSE-KIND-UNRESOLVED`.
The deterministic continuous integration check remains `Verify / Language`.
Full conformance also needs the required semantic review mechanism.

Phase 1 remains audit-only until the follow-up compliance migration is complete.
