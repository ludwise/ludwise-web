---
ste-prose: descriptive
---

# The LUDWISE ASD-STE100 profile

Profile version 1 uses ASD-STE100 Simplified Technical English, Issue 9.
The pinned issue date is 2025-01-15.
The complete rule map is in [conformance.json](conformance.json).

This profile does not reproduce the standard.
It states how LUDWISE applies the standard to software documentation.

## Content types

`STE-STRICT` prose must conform to this profile.
`STE-DERIVED` text starts from a conforming baseline and then follows the derived-text pipeline.
`STE-EXEMPT` content is machine syntax or externally controlled text.

## Procedural writing <!-- ste-prose: procedural -->

Procedural prose tells a reader what action to do.
Apply section 5 to procedural sentences.

1. Keep each procedural sentence to 20 words or fewer as rule 5.1 requires.
2. Give one instruction per sentence, except for simultaneous actions allowed by rule 5.2.
3. Use the imperative form for instructions as rule 5.3 requires.
4. Put a necessary condition before its command as rule 5.4 requires.
5. Use notes for information only as rule 5.5 requires.

Rule 5.4 is not the sentence-length rule.
The 20-word limit is rule 5.1.

## Descriptive writing

Apply section 6 to descriptive prose.
Keep each descriptive sentence to 25 words or fewer as rule 6.3 requires.
Keep one topic in each paragraph as rule 6.5 requires.
Keep each paragraph to six sentences or fewer as rule 6.6 requires.

## Words and technical terms

Apply section 1 and the controlled dictionary to word selection.
Use one technical noun consistently for one item as rule 1.11 requires.
Rule 1.14 asks for American English spelling, unless an official directive
names another spelling.
Project terminology is recorded in [terminology.json](terminology.json).

## Multi-word nouns

Section 2 is named `Multi-word nouns` in Issue 9.
Rule 2.1 limits a normal multi-word noun to three words.
Rule 2.2 defines how to handle a longer approved technical noun.

## Verbs and sentences

Apply section 3 to verb forms, tenses, voice, and action wording.
Rule 4.2 prohibits contractions and also prohibits omitting necessary words.
Use active voice as rule 3.6 requires.
Descriptive passive voice is permitted only when the agent is unknown.

## Punctuation and word count

Rule 8.1 prohibits semicolons.
Rules 8.4 through 8.7 define sentence word count.
Parenthetical text counts once in its containing sentence as rule 8.5 requires.
Its own sentence must also satisfy the applicable sentence limit.
Rule 8.7 makes a hyphenated word count as one word.

## Phrasal verbs and consistent wording

Rule 9.3 prohibits phrasal verbs.
The checker detects only phrasal verbs recorded in project terminology.
Review must detect unrecorded cases.
Rule 9.4 requires consistent terminology and wording.

## Abbreviations

ASD-STE100 does not define a general abbreviation policy.
LUDWISE defines its project policy in [abbreviations.md](abbreviations.md).

## Formatting boundary

ASD-STE100 controls language, not repository formatting.
Markdown layout, code formatting, and file syntax remain separate concerns.

## Code comments

A necessary code comment is `STE-STRICT`.
Prefer names, types, and structure that make an explanatory comment unnecessary.
Conformance never justifies unclear code beside a compliant comment.
