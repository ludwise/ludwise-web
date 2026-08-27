---
ste-prose: descriptive
---

# Controlled terminology

ASD-STE100 allows a subject-specific technical noun and a technical verb, so
LUDWISE keeps its own controlled vocabulary. The data is in
[terminology.json](terminology.json), and the checker reads it.

## The invariant

> One concept has one preferred term.

Two concepts must not claim one preferred term, and one concept must not carry
two preferred nouns. The checker fails the build when either happens.

## The record for one term

| Field                  | Meaning                                              |
| ---------------------- | ---------------------------------------------------- |
| `conceptId`            | A stable identifier for the concept                  |
| `preferredTerm`        | The one word or phrase to write                      |
| `partOfSpeech`         | The part of speech that the term is approved for     |
| `technicalCategory`    | A technical noun or a technical verb                 |
| `meaning`              | What the term denotes in LUDWISE                     |
| `allowedContext`       | Where the term may appear                            |
| `prohibitedSynonyms`   | Words that must not be written for this concept      |
| `approvedAbbreviation` | The abbreviation, when one is approved               |
| `officialExternalName` | Whether an external owner fixes the name             |
| `notes`                | The reason, or a boundary against a near concept     |
| `source`               | Where the concept is defined                         |
| `status`               | `approved`, or another recorded state                |
| `deprecation`          | The replacement and the date, when a term is retired |

A prohibited synonym may carry an `unless` list. The list holds longer phrases
that are allowed. This is how `user agent` stays legal while `user` alone does
not.

## Technical verbs

LUDWISE is conservative here. Developer slang is not promoted to controlled
terminology. Prefer a plain approved verb when one states the operation.

The prohibited list in [terminology.json](terminology.json) records the slang
that this repository already contains, with the word to write instead. A new
technical verb is added only when no approved verb states the concept, and the
addition is recorded with its reason.

## How to add a term <!-- ste-prose: procedural -->

1. Confirm that the concept has no preferred term already.
2. Read the source that defines the concept.
3. Write the record with every field filled.
4. List a prohibited synonym only when it appears in this repository.
5. Run `pnpm run check:ste` and read what it prints.
6. Record the reason for the term in the `notes` field.

A new preferred noun for a concept that already has one is a terminology
change, not an implementation detail. It escalates.

## Recorded conflicts

Two words that name one concept are recorded, not silently corrected. The
`conflicts` list in [terminology.json](terminology.json) holds each one, with
the evidence and the decision that settled it.

| Conflict            | State    | What phase 2 settled                               |
| ------------------- | -------- | -------------------------------------------------- |
| `catalog-spelling`  | resolved | Correct the prose to the spelling the module uses. |
| `provider-overload` | resolved | The analytics sense becomes the transport.         |
| `surface-or-region` | resolved | LUDWISE prose writes surface for an area.          |

Every recorded conflict now carries a resolution. An open conflict is not a
permission to pick a word. It is a decision that the architecture owes.
