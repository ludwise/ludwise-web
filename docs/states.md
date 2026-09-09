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

| State                  | Where it comes from                                          | What renders                                                                         |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Loading                | A submitted search, before the next document arrives         | `SearchField` shows a spinner in the magnifier's place, with `aria-busy`             |
| Empty catalog          | `resultCount` is 0 and no filter is set                      | `EmptyState`, with no recovery control. There is no filter to remove                 |
| No search results      | `resultCount` is 0 with a term or a filter set               | `EmptyState`, plus a link to the whole catalog                                       |
| No offers              | `offerGroups` is empty                                       | `EmptyState` inside the offers section. The rest of the page still renders           |
| No sale in this market | `contextCount` is 0                                          | `EmptyState`, plus a link to every market                                            |
| No prices collected    | `hasAnyOfferData` is false                                   | `EmptyState` that names the collection state, never the market                       |
| No catalog details     | `metadata` is null, or holds nothing                         | `InlineMessage`, tone `info`, in place of the sections that would have rendered      |
| A field LUDWISE lacks  | One field inside `metadata` is null                          | Nothing. The row is absent rather than filled with a placeholder                     |
| Stale data             | The newest priced observation is a day old or more           | `FreshnessNotice`, once for the page, beside the per-row `FreshnessIndicator`        |
| No observation time    | No priced offer on the page carries `observedAtMs`           | `FreshnessNotice`. Never rendered as an age                                          |
| Provider failure       | A read threw `LudwiseApiError`                               | `InlineMessage`, tone `danger`, with the code, the request id, and a retry           |
| Words a price carries  | The surface holds at least one priced offer                  | `DataNotes`, one disclosure below the freshness notice. Nothing when it holds none   |
| One offer's provenance | The offer carries `sourceName`, `observedAtMs`, or both      | `ProvenanceNote` inside the row's own disclosure. No summary when it carries neither |
| A credited provider    | Provenance reached the page for metadata, media, or an offer | `DataSources`, in the open, with the sentence that says what a credit means          |

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

## Why an explanation is gated like a value

An explanation is a claim about data. "A price here carries the time LUDWISE
last read it at the store" is true only where a price and a check time reached
the page. A page that failed to load holds neither. The same sentence there
describes data that does not exist. It reads as though the prices are present
and the visitor is looking in the wrong place.

So `src/lib/state/provenance.ts` answers which notes a surface has earned, and
`DataNotes` renders only those. It reads the age boundaries from
`src/lib/state/freshness.ts` rather than restating one. A note about an old
price must fire where the indicator beside it says the same thing.

The two modules answer different questions about age, and both answers are
correct at once. `surfaceFreshness` reads the newest observation, because that
decides whether the page may present itself as current. `surfaceProvenance`
reads every observation, because a single old row is a row a visitor can see
and ask about.

## Provider-supplied, LUDWISE-observed, and derived

`PRODUCT.md` requires derived data to stay distinguishable from source data at
the point of display. Three kinds of value reach a surface, and each says so
where it renders.

| Kind              | Example                                          | Where the interface says so                          |
| ----------------- | ------------------------------------------------ | ---------------------------------------------------- |
| Provider-supplied | The current price and the regular price          | `ProvenanceNote` names the source in the offer row   |
| LUDWISE-observed  | When LUDWISE last read that price                | The `Last checked` row, and the note that defines it |
| Derived           | The discount percentage, computed by the backend | The note that says LUDWISE works out the discount    |

A credit is a different statement. `DataSources` names the providers whose data
reached the page, and it says that a provider is not the store that sells the
game. Issue #71 decided that this block stays in the open, and
`tests/e2e/game-detail.spec.ts` asserts that no disclosure element contains it.

## What is not here

LUDWISE has no price history in the MVP. `src/lib/api/contract.ts` exposes
`observedAtMs`, which is when a price was last seen, and no series behind it.
So there is no chart, no observed low, and no "we have only just started
watching this game" state that a chart would need. Issue #7 owns that surface.

A visitor still asks what the age beside a price says about earlier prices. The
answer today is that it says nothing, and `DataNotes` states it in one sentence
wherever a price renders. That sentence is the observation window as LUDWISE
can honestly describe it before issue #7 lands. `content-style.md` prohibits
"all-time low" and every phrase like it, and nothing here implies one.

## Where the assertions live

| Suite                                 | Command                      | What it pins                                                         |
| ------------------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| `tests/e2e/empty.spec.ts`             | `pnpm run test:e2e:empty`    | Every empty state, against a backend that has ingested nothing       |
| `tests/e2e/degraded.spec.ts`          | `pnpm run test:e2e:degraded` | Every failure state, against a backend that is not there             |
| `tests/e2e/sales.spec.ts`             | `pnpm run test:e2e`          | Stale data and filter recovery, against the recorded corpus          |
| `tests/e2e/game-detail.spec.ts`       | `pnpm run test:e2e`          | Stale data, partial metadata, and the 404 that is not a failure      |
| `tests/e2e/shell.spec.ts`             | `pnpm run test:e2e`          | The search field's in-flight state, and that the field keeps its box |
| `tests/unit/state/freshness.test.ts`  | `pnpm test`                  | The age boundaries, and that a surface reads its newest observation  |
| `tests/unit/state/provenance.test.ts` | `pnpm test`                  | Which notes a surface has earned, and that an empty one earns none   |

The two state suites are the boundary issue #93 inherits. A redesign may change
what these states look like. It must not change what they assert.

Stale data and partial data are not in those two suites, and cannot be. A
backend that has ingested nothing has no observation to be old, and a backend
that is not there has no view at all. Those two suites assert instead that
neither state makes a currency claim, that neither explains data it never
received, and that neither credits a provider. The populated suites carry the
positive assertions.

`tests/helpers/data-notes.ts` holds every explanation as one list. The two
state suites assert the absence of exactly what the populated suites assert the
presence of. Wording that reaches one surface and not another fails there.
