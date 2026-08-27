---
ste-prose: descriptive
---

# LUDWISE language policy

LUDWISE uses one controlled standard for English technical prose.
This directory is the canonical language-policy source.
`AGENTS.md` and `CLAUDE.md` point here instead of duplicating the policy.

## Invariant

All controlled English prose must follow the LUDWISE ASD-STE100 profile.
An explicit content class can define a different treatment.
An exception must use the recorded exception process.

## Pinned standard

| Item               | Value                                            |
| ------------------ | ------------------------------------------------ |
| Normative standard | ASD-STE100 Simplified Technical English, Issue 9 |
| Issue date         | 2025-01-15                                       |
| Publisher          | ASD, Brussels, Belgium                           |
| LUDWISE profile    | version 1                                        |

The issue is pinned.
A later issue requires an explicit architecture decision and controlled migration.

## Normative verification

The provided Issue 9 source was reviewed for this profile.
The conformance data maps all 53 writing rules in all nine sections.
Section 2 is `Multi-word nouns` in Issue 9.
The map also distinguishes section 9 recommendations from writing rules.

A complete rule map is not the same as complete machine enforcement.
Many rules depend on meaning, grammar, risk, or domain terminology.
Those rules are mandatory review obligations.

## Documents

| Document                                   | Purpose                                         |
| ------------------------------------------ | ----------------------------------------------- |
| [scope.md](scope.md)                       | Content classes and repository scope            |
| [profile.md](profile.md)                   | How LUDWISE applies the standard                |
| [terminology.md](terminology.md)           | Controlled project terminology                  |
| [abbreviations.md](abbreviations.md)       | LUDWISE abbreviation policy                     |
| [user-facing-text.md](user-facing-text.md) | The `STE-DERIVED` text pipeline                 |
| [exceptions.md](exceptions.md)             | Recorded language exceptions                    |
| [conformance.md](conformance.md)           | Normative rule map and enforcement controls     |
| [checker.md](checker.md)                   | Deterministic checker behavior and limitations  |
| [rollout.md](rollout.md)                   | Audit mode and the path to blocking enforcement |

## Copyright and source handling

ASD owns the ASD-STE100 copyright and trademark.
This repository does not redistribute the standard or its dictionary.
The repository records rule identifiers and LUDWISE paraphrases only.

LUDWISE does not claim ASD approval, certification, or endorsement.
Part 2 remains the normative controlled dictionary.
The local checker does not contain a complete machine-readable copy.
Lexical conformance thus still needs semantic review.

The normative map is complete before the phase 2 compliance migration starts.
