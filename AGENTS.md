# AGENTS.md

Tool-neutral engineering guidance for this repository.

## Controlled language

> All English prose that LUDWISE authors and controls must obey the LUDWISE
> ASD-STE100 profile, unless its content class has an explicit exemption.

This is an architecture invariant, not a writing preference. The standard is
pinned to ASD-STE100 Simplified Technical English, Issue 9, dated 2025-01-15.
The LUDWISE profile is version 1. A later issue needs a decision, a
compatibility audit, a terminology audit, checker updates and a controlled
migration. Never treat a version change as a routine upgrade.

The whole policy lives in [docs/language/](docs/language/README.md) and is not
repeated here. `ludwise-backend` carries the same profile version, the same
content classes and the same rule identifiers.

Before you author or change any prose:

1. Classify it. [scope.md](docs/language/scope.md) says which class a path carries.
2. Write `STE-STRICT` prose to [profile.md](docs/language/profile.md). The limits
   are 20 words for a step and 25 for a description.
3. Use the preferred term from
   [terminology.json](docs/language/terminology.json). An open conflict there is
   a decision the architecture owes, not a word you may pick.
4. Run the humanizer step over `STE-DERIVED` text only, never over `STE-STRICT` prose.
   [user-facing-text.md](docs/language/user-facing-text.md) owns the pipeline.
   The humanizer must never change meaning, a number, a price, a date or a
   permission. It must never change a security, privacy, billing, legal or
   accessibility meaning. It must never change the meaning of a destructive
   action, a recovery instruction, a technical fact or product behavior.
5. Prefer better names, types and structure over an explanatory comment.
   Conformance never justifies weak code beside a compliant comment.
6. Never bypass a checker failure. There is no inline suppression. Record an
   exception in [exceptions.json](docs/language/exceptions.json) instead, with a
   scope, a reason, a rule and an owner.
7. Run `pnpm run check:ste` before you report the work as done, and read what it
   printed.

The checker is deterministic and partial.
[conformance.md](docs/language/conformance.md) lists what it cannot decide. A
green run never proves conformance with the standard.

## Code clarity and comments

Code should explain itself through names, types, structure, and tests. Prefer
refactoring over explanatory comments.

- Comments explain **why**, not **what** the next lines do.
- Keep inline comments short, precise, factual, and durable.
- **A run of `//` comments may not exceed three lines, and a `/** */` doc
  comment fifteen.** `eslint-rules/max-comment-block-lines.js` enforces both
  under `src/`. A fourth `//` line means either the code is not saying what it
  does, or a contract is being described somewhere documentation tooling cannot
  read it. Make the code carry it, move the contract onto its declaration, or
  put the evidence in the test that pins it — deleting the text is not the fix.
- **A doc comment states the contract. It does not argue for it.** Do not
  enumerate worked examples: a list of inputs and the wrong output each would
  produce is a set of test cases written as prose, and belongs in the test that
  asserts them. Cite that test, an architecture decision record, or ARCHITECTURE.md in one line instead.
- Treat an inline comment longer than about 80 characters as a readability smell.
  First improve naming, types, decomposition, or control flow. Then decide
  whether the comment is still necessary.
- Do not narrate control flow, restate types, describe obvious syntax, or leave
  implementation-history commentary.
- Do not use comments to compensate for unclear abstractions or oversized
  functions.
- Update or remove comments when the contract they describe changes. A stale
  comment is a defect.

Short comments are justified for non-obvious rationale, invariants, security or
privacy constraints, external-system quirks, and deliberate workarounds with a
stable reference.

Structured documentation comments are API contract documentation, not narrative
implementation notes. Use the language/tooling convention in the surrounding
code so documentation generators can treat them as a source of truth. Describe
externally observable behavior, invariants, errors, side effects, and
compatibility constraints. Do not describe implementation steps.

The 80-character heuristic applies to explanatory inline comments, not to a
structured API contract that genuinely requires multiple concise lines.

During review, a long explanatory comment triggers a readability check: prefer
clearer names, stronger types, a smaller function, an extracted concept, or
simpler control flow whenever those can make the comment unnecessary.
