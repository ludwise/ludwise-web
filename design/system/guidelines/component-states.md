---
ste-prose: descriptive
---

# Component state matrix

`—` means the state does not apply.

| Component | default | hover | active | focus-visible | selected | disabled | loading | error |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Button primary | amber fill, ink text | amber-300 | amber-500 | 2px ring, 2px offset | — | disabled-surface + disabled-text, `not-allowed` | spinner replaces `iconStart`, label kept, `aria-busy` | — |
| Button secondary | surface + border.default | surface.interactive-hover | interactive-active | ring | — | as above | as above | — |
| Button ghost | transparent | interactive-hover | interactive-active | ring | — | as above | as above | — |
| Button danger | clay-500, white text | clay-600 | clay-600 | ring | — | as above | as above | — |
| IconButton | transparent, text.secondary | interactive-hover | — | ring | surface.selected + `aria-pressed` | disabled-text | — | — |
| TextField | border.default | — | — | border.focus + 2px ring | — | disabled-surface, disabled text | — | danger border, message + `circle-alert`, `aria-invalid` |
| SearchField | border.default | — | — | border.focus + ring | — | — | spinner replaces magnifier, results retained | — |
| Select | border.default | — | — | border.focus + ring | — | disabled-surface | — | danger border + message |
| Checkbox | border.strong box | — | — | ring on box | amber fill + check glyph; indeterminate = minus glyph | 55% opacity | — | inherits group error |
| Radio | border.strong ring | — | — | ring | amber ring + amber dot | 55% opacity | — | inherits group error |
| Switch | border.strong track | — | — | ring | amber track, knob right | 55% opacity | — | — |
| Chip | surface + border.default | interactive-hover | — | ring | surface.selected + accent.border, `aria-pressed` | disabled text | — | — |
| Tabs | text.secondary, no rule | text.primary | — | ring | 2px amber underline + semibold | disabled text | — | — |
| GameCard | border.default | border.strong | — | ring on the whole card | — | — | `GameArtwork loading` + skeleton text | — |
| GameRow | transparent | interactive-hover | — | ring | — | — | skeleton row | — |
| OfferRow | surface.default | interactive-hover | — | ring on the action | best = 3px amber left rule + primary button | 60% opacity, action disabled, "Unavailable" | — | freshness `unavailable` |
| DataTable header | text.tertiary, `arrow-up-down` | text.primary | — | ring on the header button | text.primary + directional arrow + `aria-sort` | — | body at 55% opacity, rows retained | — |
| Popover | closed | — | — | ring on trigger | open: `aria-expanded`, elevation-1 | — | — | — |
| Modal | closed | — | — | focus moves to dialog, returns to trigger on close | open: scrim + elevation-2 | — | — | — |
| Tooltip | hidden | visible | — | visible on focus | — | — | — | — |

## Rules that cut across the matrix

- **Focus** is one global rule: `:focus-visible { outline: 2px solid var(--color-border-focus); outline-offset: 2px }`. No component overrides it.
- **Disabled never carries a tooltip explaining why.** If the reason matters, use an enabled control and an `InlineMessage`, or don't render the control.
- **Loading keeps its label and its footprint.** No control shrinks or empties while loading.
- **Selected is never colour-only.** Every selected state adds a glyph, a weight change, a rule or `aria-pressed`/`aria-selected`.
