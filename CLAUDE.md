---
ste-prose: descriptive
---

# CLAUDE.md

[AGENTS.md](AGENTS.md) is the canonical rulebook for this repository. Read it
first. Where the two disagree, it wins and this file is wrong. This file adds
only the mechanics that are specific to Claude Code, and it settles no rule of
its own.

## The humanizer step

AGENTS.md rule 4 says to run the humanizer step over `STE-DERIVED` text and
never over `STE-STRICT` prose. Here that step is the
[humanizer](.claude/skills/humanizer/SKILL.md) skill, invoked as `/humanizer`.
This repository holds the skill file, and
[user-facing-text.md](docs/language/user-facing-text.md) owns the pipeline that
the step belongs to.

When the skill is unavailable, AGENTS.md still applies: commit the baseline and
record the pending step, or hold the text. Never substitute a different
transformation.

## The commands behind rule 7

| Command                     | What it does                                    |
| --------------------------- | ----------------------------------------------- |
| `pnpm run check:ste`        | The gate. Run it before you report work as done |
| `pnpm run check:ste:audit`  | The whole repository, as a report               |
| `pnpm run check:ste:report` | The standard map and checker limitations        |

Read what the commands print. The standard-rule map is complete.
A green check covers only the smaller deterministic checker surface.
