---
ste-prose: descriptive
---

# The checker

The checker lives in [../../scripts/ste/](../../scripts/ste/).
It performs deterministic checks only and does not rewrite prose.

## Commands

| Command                     | Purpose                                     |
| --------------------------- | ------------------------------------------- |
| `pnpm run check:ste`        | Run the current blocking scope              |
| `pnpm run check:ste:audit`  | Audit every tracked file                    |
| `pnpm run check:ste:report` | Print the standard map and checker controls |

## Model

`standardRuleMap` contains all 53 Issue 9 writing rules.
The `rules` array contains LUDWISE enforcement controls.
A green check covers implemented deterministic controls only.

## Sentence and word count

Sentence limits map to rules 5.1 and 6.3.
The checker uses rules 8.4 through 8.7 where safe.
Balanced parenthetical text counts as one word in the containing sentence.
Parenthetical prose is also measured separately.
Quoted text, hyphenated words, and known number-unit pairs use special counting.

## Procedural versus descriptive prose

A Markdown ordered list is not automatically a procedure.
Audit mode can use list shape as a reporting estimate.
Enforcement mode requires an explicit prose type for mixed content.

## Deterministic controls

The checker reports semicolons as rule 8.1 requires.
It detects configured contractions for part of rule 4.2.
It detects configured spelling variants for part of rule 1.14.
It detects recorded technical-noun synonyms for part of rule 1.11.
It detects recorded phrasal verbs for part of rule 9.3.

## Semantic review

The checker lists each runtime-composed visitor string that requires semantic review.
Each finding gives the file, line, column, unit kind, reason, and extracted text.
A semantic review finding is not a deterministic violation.

## Controlled dictionary

Part 2 is normative for lexical conformance.
The repository does not vendor a machine-readable copy.
Rules about approved words, meanings, and parts of speech still require review.
