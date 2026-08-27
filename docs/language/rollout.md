---
ste-prose: descriptive
---

# Rollout state

The repository is in enforce mode.
Phase 1 defines the standard and the enforcement architecture.
Phase 2 applied the standard to existing prose.

## Phase 1

Phase 1 has a verified map of all 53 Issue 9 writing rules.
The map is separate from the smaller checker-control registry.
Existing repository prose was rewritten in phase 2, not forgiven.
There is no legacy baseline that permanently forgives current violations.

## Audit mode

Run `pnpm run check:ste:audit` to inspect the whole repository.
The audit reports deterministic findings without failing the command.
Under enforce mode `pnpm run check:ste` reads every classified file, so the two
now cover the same scope and differ only in whether a finding blocks.
Audit mode can estimate prose kind from Markdown list shape for reporting only.

## Phase 2

Phase 2 completed these actions before global enforcement:

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

`rollout.mode` in [policy.json](policy.json) is `enforce`.
In that mode, `check:ste` evaluates every classified file.
A mixed prose unit then fails with `LW-STE-PROSE-KIND-UNRESOLVED`.
`enforcedPaths` no longer narrows the scope, and is kept because audit mode
gates on it and it records the scope to fall back to.
The deterministic continuous integration check remains `Verify / Language`.
Full conformance also needs the required semantic review mechanism.

Enforcement covers the deterministic rules. The semantic review is a permanent
requirement of the merge workflow, not a temporary rollout allowance.

Some conformance rules cannot be made deterministic here. Part 2 is the
normative dictionary, and the repository holds no machine-readable copy of it.
[conformance.json](conformance.json) records which rules those are. Every rule
marked `enforcement: semantic` needs a reader.

A later compliance migration can move a rule from semantic to deterministic.
Rule 1.3 moved that way in phase 2, and `LW-STE-CAUSAL-SINCE` now checks it.
Such a migration narrows the review, and never ends it. The obligation stops
only for a named rule, and only when `conformance.json` records the checker
that replaced it.
