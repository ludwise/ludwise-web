# AGENTS.md

Tool-neutral engineering guidance for this repository.

## Code clarity and comments

Code should explain itself through names, types, structure, and tests. Prefer
refactoring over explanatory comments.

- Comments explain **why**, not **what** the next lines do.
- Keep inline comments short, precise, factual, and durable.
- Treat an inline comment longer than about 80 characters as a readability smell.
  First improve naming, types, decomposition, or control flow; then decide whether
  the comment is still necessary.
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
externally observable behaviour, invariants, errors, side effects, and
compatibility constraints; do not describe implementation steps.

The 80-character heuristic applies to explanatory inline comments, not to a
structured API contract that genuinely requires multiple concise lines.

During review, a long explanatory comment triggers a readability check: prefer
clearer names, stronger types, a smaller function, an extracted concept, or
simpler control flow whenever those can make the comment unnecessary.
