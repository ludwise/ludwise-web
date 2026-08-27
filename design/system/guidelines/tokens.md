---
ste-prose: descriptive
---

# Token reference

Every token is a CSS custom property declared in `tokens/`, reachable from `styles.css`. Product code references the **semantic** layer. Primitives exist so the semantic layer can be re-pointed.

## Naming

```
--<category>-<concept>-<variant>-<state>
```

Primitives are namespaced `--ludwise-<hue>-<step>`. Semantic tokens drop the namespace: `--color-price-current`, `--space-4`, `--radius-card`, `--motion-duration-fast`.

Prohibited: `--blue-500-button`, `--small-gray-box`, `--steam-green`, `--homepage-card-2`. A token name describes a role, never an appearance or a place.

## Colour primitives

| Ramp | Steps | Purpose |
| --- | --- | --- |
| `--ludwise-neutral-*` | 0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 850, 900, 950, 1000 | Warm graphite. All surfaces, text and borders. |
| `--ludwise-amber-*` | 50–900 | The accent. `400 #E8A33D` is the brand value. |
| `--ludwise-teal-*` | 50, 100, 300, 400, 500, 600, 800, 900 | Positive, confirmed, price decrease. |
| `--ludwise-clay-*` | 50, 100, 300, 400, 500, 600, 800, 900 | Negative, failed, price increase. |
| `--ludwise-azure-*` | 50, 100, 300, 400, 500, 600, 800, 900 | Informational only. |
| `--ludwise-series-1..6` | — | Chart series. |
| `--ludwise-store-*` | steam, gog, epic, humble, fanatical, gmg, gamesplanet | Retailer identity rules only. |

## Semantic colour groups

`background.*` primary · secondary · tertiary · inverse
`surface.*` default · raised · sunken · interactive · interactive-hover · interactive-active · selected · overlay · scrim
`text.*` primary · secondary · tertiary · disabled · inverse · link · link-hover
`border.*` subtle · default · strong · inverse · focus
`action.*` primary · primary-hover · primary-active · primary-text · secondary-text · danger · danger-hover · danger-text · disabled-surface · disabled-text
`accent.*` primary · quiet · border · text
`status.*` success / warning / danger / info / neutral, each with -text, -surface, -border
`price.*` current · reference · unavailable · free · decrease · increase
`discount.*` surface · text · border
`signal.observed-low.*` surface · text · border
`freshness.*` fresh · aging · stale · unknown · unavailable
`promo.*` surface · border · label
`chart.*` grid · axis · label · plot · nodata

Each is defined twice: once under `:root, [data-theme="light"]`, once under `[data-theme="dark"]`.

## Contrast

| Pair | Light | Dark |
| --- | --- | --- |
| text.primary on background.primary | ~15.9:1 | ~16.4:1 |
| text.secondary on background.primary | ~7.1:1 | ~7.4:1 |
| text.tertiary on background.primary | ~4.7:1 | ~4.8:1 |
| action.primary-text on action.primary | ~9.2:1 | ~9.2:1 |
| border.focus against adjacent surface | ~5.4:1 | ~5.9:1 |
| accent.text on accent.quiet | ~6.1:1 | ~7.0:1 |

`text.tertiary` is the floor. It is permitted for captions, provenance and disabled-adjacent metadata at 12–13px, and never for anything a user must act on.

## Typography

Sizes: display 44 · heading-xl 34 · heading-lg 26 · heading-md 20 · heading-sm 17 · body-lg 17 · body-md 15 · body-sm 13 · label-lg 15 · label-md 13 · label-sm 11 · caption 12 · numeric-lg 28 · numeric-md 19 · numeric-sm 14 · code 13.

Weights: 300 light (unused in product UI) · 400 regular · 500 medium · 600 semibold · 700 bold (reserved).

Line heights: display 1.08 · heading 1.2 · tight 1.35 · body 1.55 · flat 1.

Tracking: display −0.022em · heading −0.014em · body 0 · label +0.005em · caps +0.06em · numeric −0.01em.

Composite roles are exposed as `--text-*` shorthand values and as `.lw-text-*` utility classes. `.lw-tabular` applies tabular lining figures to any element.

## Spacing

`space.0 0 · 05 2 · 1 4 · 2 8 · 3 12 · 4 16 · 5 20 · 6 24 · 8 32 · 10 40 · 12 48 · 16 64 · 20 80 · 24 96`

Density: `--density-row-height-comfortable 56px` · `--density-row-height-compact 40px` · cell padding-y 12 / 8 · cell padding-x 16.

Targets: `--target-min 40px` (pointer) · `--target-min-touch 44px` · `--target-min-inline 24px` (inline controls inside a larger target: a chip's ×, a search clear).

## Shape

`radius`: none 0 · xs 2 · sm 4 · md 6 · lg 10 · xl 12 · full 999.
Aliases: button 6 · input 6 · card 10 · artwork 6 · badge 4 · chip full · popover 10 · modal 12.
`border-width`: hairline 1 · strong 2 · identity 3.
`focus-ring`: width 2 · offset 2.

## Elevation

`elevation-0` none · `elevation-1` popovers and toasts · `elevation-2` modals. Dark theme uses deeper, more opaque shadows because a light shadow is invisible on `#0B0B0A`.

## Layout

Max widths: wide 1440 (discovery) · standard 1200 (detail, comparison, account) · reading 720 (editorial, docs, legal).
Gutters: mobile 16 · tablet 24 · desktop 32.
Header height 60. Grid 12 columns, gap 24 (16 compact).
Breakpoints: sm 480 · md 768 · lg 1024 · xl 1280 · 2xl 1600.
Artwork ratios: capsule 1.5 · header 2.1455 · hero 2.6667 · cover 0.6667 · screenshot 1.7778 · store-logo 1.

## Motion

Durations: instant 0 · fast 120 · normal 180 · deliberate 240 · ambient 600.
Easings: standard `cubic-bezier(.2,0,.2,1)` · enter `cubic-bezier(0,0,.2,1)` · exit `cubic-bezier(.4,0,1,1)` · linear.
Composites: `--motion-transition-color`, `--motion-transition-transform`, `--motion-transition-overlay`.

Under `prefers-reduced-motion: reduce` the token file sets all durations to 0 **and** clamps every animation and transition globally. No component needs its own media query.

## Structured export

```
color.background.primary       color.text.primary        color.action.primary
color.price.current            color.signal.observedLow  color.freshness.stale
space.1 … space.24             radius.sm … radius.full
font.body.md                   font.numeric.lg
elevation.1                    motion.duration.fast      motion.easing.standard
layout.maxWidth.wide           breakpoint.lg             aspect.capsule
```
