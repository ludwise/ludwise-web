---
ste-prose: descriptive
---

# Non-happy-path states

What each public surface says when data is loading, missing, old, incomplete, or
unavailable. Issue #16 defines these. Issue #93 composes the same states from
the design-system primitives and does not change what they mean.

## The rule every state answers to

`PRODUCT.md` §120 forbids rendering a value LUDWISE does not hold. Two absences
reach a page looking alike and mean opposite things:

- **Empty** means LUDWISE asked and the answer was nothing.
- **Unavailable** means LUDWISE could not ask.

Rendering the second as the first tells a visitor that no game is on sale. The
truth is that we failed to look. `src/lib/api/errors.ts` keeps the two apart on
the way in, and this table keeps them apart on the way out.

## The states

| State                  | Where it comes from                                  | What renders                                                                    |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Loading                | A submitted search, before the next document arrives | `SearchField` shows a spinner in the magnifier's place, with `aria-busy`        |
| Empty catalog          | `resultCount` is 0 and no filter is set              | `EmptyState`, with no recovery control. There is no filter to remove            |
| No search results      | `resultCount` is 0 with a term or a filter set       | `EmptyState`, plus a link to the whole catalog                                  |
| No offers              | `offerGroups` is empty                               | `EmptyState` inside the offers section. The rest of the page still renders      |
| No sale in this market | `contextCount` is 0                                  | `EmptyState`, plus a link to every market                                       |
| No prices collected    | `hasAnyOfferData` is false                           | `EmptyState` that names the collection state, never the market                  |
| No catalog details     | `metadata` is null, or holds nothing                 | `InlineMessage`, tone `info`, in place of the sections that would have rendered |
| A field LUDWISE lacks  | One field inside `metadata` is null                  | Nothing. The row is absent rather than filled with a placeholder                |
| Stale data             | The newest priced observation is a day old or more   | `FreshnessNotice`, once for the page, beside the per-row `FreshnessIndicator`   |
| No observation time    | No priced offer on the page carries `observedAtMs`   | `FreshnessNotice`. Never rendered as an age                                     |
| Provider failure       | A read threw `LudwiseApiError`                       | `InlineMessage`, tone `danger`, with the code, the request id, and a retry      |

## Why freshness is decided in one place

`src/lib/state/freshness.ts` owns the age boundaries and answers two questions
with them. `freshnessLevel` answers for one observation, which is what a row or
a card shows. `surfaceFreshness` answers for a page.

A page is only as stale as its newest fact. One archived row beside fresh ones
does not make the page old. A warning that fires on it is a warning a visitor
learns to ignore. So `surfaceFreshness` reads the newest observation and never
the oldest.

It reads only observations of offers that carry a price. "The newest price here
was checked X" is a claim about prices. A store read minutes ago that quoted no
price holds none. Counting it would silence the warning over a page whose every
actual price is a year old.

`formatObservationTime` states that moment as a relative age within seven days,
and as a date after. `design/system/guidelines/content-style.md` § Dates and
times fixes that rule for the whole product.

## What is not here

LUDWISE has no price history in the MVP. `src/lib/api/contract.ts` exposes
`observedAtMs`, which is when a price was last seen, and no series behind it.
So there is no chart, no observed low, and no "we have only just started
watching this game" state that a chart would need. Issue #7 owns that surface.
The nearest true statement today is the no-observation-time state above.

## Where the assertions live

| Suite                                | Command                      | What it pins                                                         |
| ------------------------------------ | ---------------------------- | -------------------------------------------------------------------- |
| `tests/e2e/empty.spec.ts`            | `pnpm run test:e2e:empty`    | Every empty state, against a backend that has ingested nothing       |
| `tests/e2e/degraded.spec.ts`         | `pnpm run test:e2e:degraded` | Every failure state, against a backend that is not there             |
| `tests/e2e/sales.spec.ts`            | `pnpm run test:e2e`          | Stale data and filter recovery, against the recorded corpus          |
| `tests/e2e/game-detail.spec.ts`      | `pnpm run test:e2e`          | Stale data, partial metadata, and the 404 that is not a failure      |
| `tests/e2e/shell.spec.ts`            | `pnpm run test:e2e`          | The search field's in-flight state, and that the field keeps its box |
| `tests/unit/state/freshness.test.ts` | `pnpm test`                  | The age boundaries, and that a surface reads its newest observation  |

The two state suites are the boundary issue #93 inherits. A redesign may change
what these states look like. It must not change what they assert.

Stale data and partial data are not in those two suites, and cannot be. A
backend that has ingested nothing has no observation to be old, and a backend
that is not there has no view at all. Those two suites assert instead that
neither state makes a currency claim, and the populated suites carry the
positive assertions.
