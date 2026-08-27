---
ste-prose: descriptive
---

# Conformance matrix

The policy has two separate layers.
The first layer maps the normative standard.
The second layer records LUDWISE enforcement controls.
Do not treat those layers as one-to-one mappings.

## Normative map

`conformance.json` maps all 53 writing rules in ASD-STE100 Issue 9.
Each row records its verified rule number and section.
The map was checked against the provided Issue 9 source.

| Section | Name                       | Rules |
| ------: | -------------------------- | ----: |
|       1 | Words                      |    14 |
|       2 | Multi-word nouns           |     2 |
|       3 | Verbs                      |     7 |
|       4 | Sentences                  |     5 |
|       5 | Procedural writing         |     5 |
|       6 | Descriptive writing        |     6 |
|       7 | Safety instructions        |     3 |
|       8 | Punctuation and word count |     7 |
|       9 | Writing practices          |     4 |

The total is 53 writing rules.
Section 9 also contains general recommendations that are not part of that count.

## Enforcement controls

The `rules` array records checks and required review controls.
A deterministic check does not make the whole standard deterministic.
Rules about meaning, grammar, risk, or domain terminology still need review.

The checker maps these controls directly to verified Issue 9 rules:

- Procedural sentence length: rule 5.1.
- Descriptive sentence length: rule 6.3.
- Paragraph sentence count: rule 6.6.
- Recorded contractions: part of rule 4.2.
- Recorded technical-noun synonyms: part of rule 1.11.
- Recorded phrasal verbs: part of rule 9.3.
- Recorded spelling variants: part of rule 1.14.
- Semicolon prohibition: rule 8.1.

## Word count

The checker applies rules 8.4 through 8.7 where structure is identifiable.
Balanced parenthetical text counts once in the containing sentence.
Parenthetical prose is also measured as its own sentence.
Quoted text and known number-unit pairs count as one word.
Hyphenated words count as one word.

Rule 8.6 cannot be fully inferred from plain text.
New proper nouns, titles, labels, or domain units can require review.

## Procedural and descriptive prose

Markdown numbering does not define a procedure.
Audit mode can use list shape only as a reporting estimate.
Enforcement mode does not trust that estimate.
A mixed unit then emits `LW-STE-PROSE-KIND-UNRESOLVED`.

## Controlled dictionary

Part 2 is normative.
The repository does not copy or vendor the dictionary.
The local checker has no complete machine-readable dictionary source.
Lexical conformance therefore remains a semantic review obligation.

## What a green check means

A green deterministic check means that implemented checks found no violation.
It does not prove full ASD-STE100 conformance.
Run `pnpm run check:ste:report` to inspect both policy layers and their limitations.
