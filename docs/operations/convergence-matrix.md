---
ste-prose: descriptive
---

# The convergence matrix

This matrix comes from
[Where the MVP redesign splits](https://github.com/ludwise/ludwise-web/issues/72).
That resolution decides the axes and the cells. This document transcribes them,
and it decides nothing.

The matrix is the convergence gate that
[the redesign umbrella](https://github.com/ludwise/ludwise-web/issues/54)
carries. It sits beside [go-and-no-go-standard.md](go-and-no-go-standard.md),
and it is not one of the four launch gates.

## The axes

The axes are **route class** and **state**, and nothing else.

Theme and breakpoint are two sweeps that the composition work owns. They are not
axes. Light and dark are already automated in the accessibility suite. Adding
both axes would take the gate from 42 cells to roughly 400, and a gate nobody
finishes is not a gate.

## The matrix

|                    | Complete | Loading | No results | Partial metadata | Stale | Provider failure | Media withheld |
| ------------------ | -------- | ------- | ---------- | ---------------- | ----- | ---------------- | -------------- |
| Home               | yes      | `n/a`   | `n/a`      | `n/a`            | `n/a` | `n/a`            | `n/a`          |
| Search, `/games`   | yes      | yes     | yes        | yes              | yes   | yes              | yes            |
| Sales, `/sales`    | yes      | yes     | yes        | yes              | yes   | yes              | yes            |
| Game detail        | yes      | yes     | yes        | yes              | yes   | yes              | yes            |
| Legal policy       | yes      | `n/a`   | `n/a`      | `n/a`            | `n/a` | `n/a`            | `n/a`          |
| Error, 404 and 500 | yes      | `n/a`   | `n/a`      | `n/a`            | `n/a` | `n/a`            | `n/a`          |

## What a cell records

A cell marked `yes` is live. It records one deliberate verdict about what that
page shows in that state. A cell marked `n/a` records why the state cannot
happen on that route class.

The matrix is walked once, and every cell is intentional. A blank cell is not a
verdict.

## The count

The table above marks 24 live cells of 42. The prose of the resolution states 23
live cells, and so does
[the issue that ordered this document](https://github.com/ludwise/ludwise-web/issues/87).
This document transcribes the table. The difference between the table and that
count is not resolved here.

## What the matrix closes

The redesign umbrella closes when every cell carries a written verdict, and when
all three of its sub-issues are closed. That replaces a judgment about whether
the result is suitable to freeze.

## The boundary the redesign inherits

[The provenance explanations](https://github.com/ludwise/ludwise-web/issues/15)
and [the state polish](https://github.com/ludwise/ludwise-web/issues/16) land
before the redesign. Their wording and their state semantics live as assertions
in `test:e2e:empty` and `test:e2e:degraded`.

A redesign may lay a state out again. It may not change what those two suites
assert. A wording change after that is a deliberate edit to the tests of the
issue that owns the wording, and a reviewer sees it.

## What this matrix does not decide

The four launch gates, and the evidence each one needs. See
[go-and-no-go-standard.md](go-and-no-go-standard.md).
