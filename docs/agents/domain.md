---
ste-prose: descriptive
---

# Domain docs

How the engineering skills must read the domain documentation of this
repository. The layout is **single-context**.

## Read these before you explore

- **`CONTEXT.md`** at the repository root.
- **`docs/adr/`**: read every architecture decision record (ADR) that touches the area you are about to work in.

If a file does not exist, continue without a comment. Do not report the absence,
and do not propose to create it in advance. The `/domain-modeling` skill creates
these files when a term or a decision is actually resolved. `/grill-with-docs`
and `/improve-codebase-architecture` reach that skill.

At the time of writing, this repository holds neither `CONTEXT.md` nor
`docs/adr/`. That is a normal state. The backend repository holds the accepted
decisions that cross the repository boundary.

## File structure

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-first-decision.md
│   └── 0002-second-decision.md
└── src/
```

This repository is one package. `pnpm-workspace.yaml` holds pnpm settings and
declares no `packages:` key, so there is no workspace and no second context. Use
a root `CONTEXT-MAP.md` and per-context `CONTEXT.md` files only if that changes.

## Use the vocabulary of the glossary

Use the term that `CONTEXT.md` defines whenever your output names a domain
concept. This binds an issue heading, a refactor proposal, a hypothesis and a test
name. Do not drift to a synonym that the glossary avoids.

A concept that the glossary does not hold is a signal. Either you invent
language that the project does not use, and you must reconsider, or there is a
real gap. Record a real gap for `/domain-modeling`.

## Report a conflict with an ADR

Surface a contradiction with an accepted ADR. Do not override it in silence.

> Contradicts ADR-0007, but it is worth reopening because ...

## Precedence

[AGENTS.md](../../AGENTS.md) states the conflict precedence of this repository.
These rules sit below it and never override it.
