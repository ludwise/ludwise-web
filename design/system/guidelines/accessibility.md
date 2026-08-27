---
ste-prose: descriptive
---

# Accessibility

Target: **WCAG 2.2 AA**, built into the tokens rather than added per screen.

## Contrast

- Body and interactive text ≥ 4.5:1. `text.tertiary` is the floor at ~4.7:1 and is permitted for captions and provenance only.
- Non-text UI (borders on controls, focus rings, icon-only glyphs, chart series lines) ≥ 3:1.
- `action.primary-text` on `action.primary` is ~9.2:1 in both themes.
- Semantic surfaces (`status.*-surface`) are always paired with their matching `-text`, never with `text.primary`.

## Never colour alone

This is the system's hardest rule, because LUDWISE's whole subject is states that colour would be the lazy way to encode.

| State | Non-colour carrier |
| --- | --- |
| Freshness ladder | Filled dot / hollow dot / clock glyph / dashed ring / alert glyph, plus wording |
| Price signals | Directional arrow glyph plus the full sentence |
| Discount | The literal `−50%` |
| Sort direction | Arrow glyph plus `aria-sort` |
| Chart series | Distinct dash pattern and marker shape per series, plus a legend |
| Form errors | `circle-alert` glyph, message text, `aria-invalid` |
| Selected chip / tab | Weight change, underline or `aria-pressed` |
| Verified retailer | `shield-check` glyph with a title |

## Focus and keyboard

- One global `:focus-visible` rule; never removed, never restyled per component.
- Tab order follows DOM order. No positive `tabindex`.
- `Popover` and `Modal` close on Escape and return focus to their trigger. `Modal` moves focus into the dialog on open and sets `aria-modal`.
- The whole game card is one link, so a grid is one tab stop per game. Nested interactive controls inside cards are prohibited for exactly this reason.
- Tooltips open on focus as well as hover.

## Targets

40px minimum on pointer surfaces, 44px on touch. `--target-min-inline` 24px applies only to controls nested inside a larger target — a chip's remove ×, the search clear button.

## Text scaling and zoom

- All type is px on a scale, all layout is relative. The system is verified at 200% browser zoom.
- Nothing is sized by content-free fixed widths. Buttons size to their label; German runs about 35% longer than English.
- Line clamps are limited to game titles (2 lines) and never applied to prices, labels or messages.

## Motion

`prefers-reduced-motion: reduce` is handled once, in `tokens/motion.css`: all duration tokens become 0 and a global rule clamps every animation and transition to 0.01ms. Skeleton shimmer stops. No component needs its own query.

## Forms

- Every control has a visible label. Placeholder is never the label.
- Errors are sentences that say how to fix the problem, tied by `aria-describedby` and marked with `aria-invalid`.
- Radio and checkbox groups are wrapped in `fieldset` with a `legend`.
- Required fields are marked in the label; the asterisk is `aria-hidden` and the requirement is also on the input.

## Tables and charts

- Every `DataTable` carries a visually hidden `caption`. Sortable headers are buttons with `aria-sort`.
- Numeric columns are right-aligned and tabular so a screen magnifier user can scan a column.
- **Every chart has a table.** `PriceHistoryChart` carries `role="img"` and an accessible label, and the same observations must be available in a `DataTable` on the same page or one link away. The chart is never the only route to the numbers.

## Content

- `Toast` is `aria-live="polite"`. `Banner` and `InlineMessage` are `role="status"`, except danger which is `role="alert"`.
- Icon-only buttons always carry `label`.
- Decorative artwork is `alt=""`, because the title is always rendered adjacent.
