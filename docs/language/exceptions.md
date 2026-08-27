---
ste-prose: descriptive
---

# Exceptions

There is no inline suppression. A comment such as an ignore marker beside a line
is not read by the checker and never will be. An exception is central and
auditable, or it does not exist.

## The three normal corrections

1. Rewrite the prose.
2. Use the approved LUDWISE term.
3. Correct the content class of the file.

Reach for an exception only when none of the three applies.

## The record

An exception lives in [exceptions.json](exceptions.json) and holds:

| Field     | Required | Meaning                                         |
| --------- | -------- | ----------------------------------------------- |
| `id`      | Yes      | A stable identifier                             |
| `scope`   | Yes      | The paths that the exception covers             |
| `rules`   | Yes      | The rule identifiers that it suspends           |
| `reason`  | Yes      | Why the normal correction does not apply        |
| `owner`   | Yes      | The person or the role that reviews it          |
| `expires` | No       | The date after which the exception is a failure |

## What the checker does with it

- A missing field fails the build under `LW-STE-EXCEPTION-INVALID`.
- An unknown rule identifier fails the build under the same rule.
- A date in the past fails the build under `LW-STE-EXCEPTION-EXPIRED`.
- An exception that matches no file fails the build under
  `LW-STE-EXCEPTION-UNUSED`.

The last one is what keeps the set small. An exception that stopped being needed
is removed, and the build says so.

## Today

The list is empty. Phase 2 will need a small number of exceptions for quoted
external text that cannot move into a fenced block. Each one will name its
reason.
