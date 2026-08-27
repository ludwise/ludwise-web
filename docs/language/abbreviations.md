---
ste-prose: descriptive
---

# Abbreviation policy

ASD-STE100 does not set a general abbreviation policy, so LUDWISE sets one. The
data is in [terminology.json](terminology.json) and the checker reads it.

## When an abbreviation is allowed

An abbreviation is allowed when it is recorded as approved. Nothing else is
allowed. An abbreviation that no record holds is a term that somebody invented
while writing.

Two lists carry the decision:

- `abbreviations` holds every approved abbreviation, with its full term.
- `prohibitedAbbreviations` holds every clipped word and numeronym that must not
  appear, with the word to write instead.

## When the full term must appear first

Each approved record carries `expandOnFirstUse`. When it is true, the full term
must appear in the same document before the first use of the abbreviation.

| Scope    | Meaning                                          | Full term first |
| -------- | ------------------------------------------------ | --------------- |
| `global` | Every contributor and every reader knows it.     | No              |
| `domain` | It belongs to this project or to a narrow field. | Yes             |

The checker measures one document at a time. It cannot see a full term that
another document supplied.

## Globally approved

`API`, `HTTP`, `HTTPS`, `URL`, `URI`, `JSON`, `YAML`, `SQL`, `HTML`, `CSS`,
`UI`, `ID`, `CI`, `PR` and `UTC`. Each one names a protocol or a format, or is a
word that every contributor reads without effort.

## Domain abbreviations

`ADR`, `STE`, `TDD` and `DDL`. Write the full term once in each document before
the abbreviation.

## Prohibited abbreviations

A numeronym is prohibited, because a reader cannot decode it. A clipped word is
prohibited, because it is not an abbreviation that any standard records. An
ambiguous abbreviation is prohibited outright.

| Prohibited | Write instead                    | Reason             |
| ---------- | -------------------------------- | ------------------ |
| `a11y`     | accessibility                    | A numeronym        |
| `i18n`     | internationalization             | A numeronym        |
| `l10n`     | localization                     | A numeronym        |
| `e2e`      | end-to-end                       | A numeronym        |
| `repo`     | repository                       | A clipped word     |
| `config`   | configuration                    | A clipped word     |
| `env`      | environment                      | A clipped word     |
| `db`       | database                         | A clipped word     |
| `prod`     | production                       | A clipped word     |
| `dev`      | development                      | A clipped word     |
| `spec`     | specification                    | A clipped word     |
| `param`    | parameter                        | A clipped word     |
| `impl`     | implementation                   | A clipped word     |
| `auth`     | authentication, or authorization | It can mean either |

`auth` is the clearest case. A reader cannot tell which of two security concepts
it names, and the two are not the same.

## What is never expanded

An identifier, a file name, a command, a protocol name and an official external
name stay exact. Expansion would make them wrong. Those are exempt spans and the
checker never reads them as prose. See [scope.md](scope.md).

A package name such as `pnpm` and a script name such as `check:ste` are
identifiers, not abbreviations.
