# Layout, grid and responsive behaviour

## Page regions

```
┌──────────────────────────────────────────────┐
│ Banner (rare, system-wide only)              │
│ Header — sticky, 60px, hairline bottom       │
├──────────────────────────────────────────────┤
│ Breadcrumbs (detail pages)                   │
│ Page heading + page-level controls           │
│ Active filter chips (result pages)           │
├───────────────────────────┬──────────────────┤
│ Primary content           │ Side rail        │
│                           │ sticky, top 80   │
├───────────────────────────┴──────────────────┤
│ Pagination                                   │
│ Footer                                       │
└──────────────────────────────────────────────┘
```

## Two page archetypes

**Visual discovery** — sales, browse, search-as-grid. `--layout-max-width-wide` (1440). Card grid `repeat(auto-fill, minmax(230px, 1fr))`, gap `space.4`. Optional 300px right rail for the promo slot and standing context.

**Data comparison** — game detail, offers, history, account, B2B. `--layout-max-width-standard` (1200). Two columns: `minmax(0,1fr)` plus a 340px sticky rail carrying the best current offer. Gap `space.8`.

**Reading** — editorial, docs, legal, developer guides. `--layout-max-width-reading` (720), single column, `body-lg`.

Do not force one archetype onto the other. A comparison table inside a discovery measure wastes the width; a card grid inside a reading measure wastes the grid.

## Grid

12 columns, `space.6` gap (`space.4` at compact density), inside the active max-width and gutter.

| Content | Columns |
| --- | --- |
| Game card grid | auto-fill, 230px minimum — not the 12-col grid |
| Detail primary | 8 of 12 |
| Detail side rail | 4 of 12, fixed 340px above xl |
| Filter sidebar | 3 of 12, fixed 260px above lg |
| Metadata key/value | 2 columns above md, 3 above xl |
| Rating cards | auto-fit, 200px minimum |

## Breakpoints

Five, named by intent, all min-width.

| Token | Value | What changes |
| --- | --- | --- |
| `sm` | 480 | Card grid moves from 1 to 2 columns. Price stays `numeric-md`. |
| `md` | 768 | Metadata goes to 2 columns. Modals stop being bottom sheets. Card grid 3 columns. |
| `lg` | 1024 | Filter sidebar appears inline instead of in a sheet. Header nav appears instead of the menu button. Tables stop scrolling in most cases. |
| `xl` | 1280 | Detail pages gain the sticky side rail. Discovery gains the promo rail. |
| `2xl` | 1600 | Grid widens by adding columns. **No new layout** — this breakpoint only lets existing layouts breathe. |

## Below lg — mobile is a first-class surface

- **Header.** Wordmark, theme and account stay in the bar. Nav collapses behind the menu button into a panel below it, and the market control moves into that panel. Search takes its own full-width row beneath the bar, sticky with it. `AppHeader` implements this itself through `useIsCompactHeader`; no host media query is needed.
- **Card grids become row lists.** A `GameCard` grid below `md` becomes a `GameRow` list. A one-column stack of tall cards buries the prices below the fold.
- **Tables scroll horizontally inside their own border.** They do not reflow into cards: a price comparison read as a stack of cards is no longer a comparison. The first column may be sticky.
- **Filters live in a bottom sheet** opened by a persistent "Filters (3)" button, with the count of applied filters in the label. Applied filters still appear as chips above the results.
- **The best-offer rail becomes a sticky bottom bar** carrying price, store and the single primary action. Nothing else.
- **Modals become bottom sheets:** full width, `--radius-modal` on the top corners only, anchored to the bottom edge.
- **Touch targets are 44px minimum.** `Button size="sm"` and `IconButton size="sm"` are desktop-only.

## Density

`comfortable` is the default everywhere. Switch a whole region to `compact` when it holds more than about 25 rows, or when a comparison benefits from more rows in view. Density never changes font size below `body-sm`; it changes padding and row height only.
