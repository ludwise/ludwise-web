# Handoff: LUDWISE design system → `daniel-kindl/ludwise`

## Overview

This bundle is the complete LUDWISE design system: a token layer, 44 component primitives, a four-screen recreation of the consumer web product, and the written rules behind all of it. The task is to adopt it into the LUDWISE Astro/Cloudflare codebase, which currently has no UI, no tokens and no components.

`PROMPT.md` in this folder is the prompt to paste into Claude Code. This README is the reference it points at, and is self-sufficient: a developer who was not in the conversation that produced the design system can implement from it.

## About the design files

**Everything under `system/components/` is a design reference, not production code.** It is written as one markdown file per group — each component's prop contract, its usage rules, and a reference implementation in a fenced block. The implementations are inline-styled React because that is what the design-system tooling required. This repository is Astro 7 with server-rendered HTML as the default and React available only for interactive islands, so the components must be **recreated** in that environment — static ones as `.astro` with scoped styles over the token custom properties, interactive ones as React islands with an explicit `client:` directive.

Three things in the bundle *are* meant to be adopted more or less verbatim:

- `system/styles.css` and `system/tokens/*.css` — the token layer. Copy it, keep the `@import` structure, change only the font loading (see below).
- the **Prop contract** block for each component — that is the API. Port the names, the defaults and the constraint comments.
- `system/guidelines/*.md` — the written rules. Reference them; do not restate them in code comments.

## Fidelity

**High fidelity.** Final colours, type scale, spacing, radii, elevation, motion and copy. Recreate pixel-accurately using the token values — every number in the design is a token, so there is nothing to eyeball. The exceptions, and they are real:

- **No game artwork.** Nothing in the bundle ships imagery. Every `GameArtwork` renders its designed "No artwork available" state. That state is correct and must be implemented, but the artwork path is unexercised.
- **No retailer logos.** `StoreIdentity` falls back to a neutral storefront glyph.
- **The logo is a sketch in code**, not designer-finished curve work. Implement it as specified; expect it to be replaced.
- **Mobile compositions are specified in prose**, in `system/guidelines/layout.md`, but only the desktop composition is built as a screen.

## What is in this bundle

| Path | What it is |
| --- | --- |
| `PROMPT.md` | The prompt to paste into Claude Code |
| `system/readme.md` | The design guide: direction, principles, content and visual foundations, component index |
| `system/styles.css` | Entry point. `@import` lines only |
| `system/tokens/` | 10 files: fonts, colour primitives, colour semantics, typography, space, shape, elevation, layout, motion, base |
| `system/components/` | 44 components in 10 groups, one markdown file per group. Each component has a prop contract, usage rules and a reference implementation. Start at `README.md` there |
| `system/guidelines/tokens.md` | Full token reference with measured contrast ratios |
| `system/guidelines/layout.md` | Grids, breakpoints, page regions, responsive behaviour |
| `system/guidelines/component-states.md` | State matrix for every interactive component |
| `system/guidelines/accessibility.md` | WCAG 2.2 AA requirements and how each is met |
| `system/guidelines/content-style.md` | UI writing, with the fixed strings |
| `system/guidelines/governance.md` | When a new token or component is justified; versioning |
| `system/assets/icons/` | 49 Lucide SVGs (ISC licence included) |
| `reference/screens.md` | The four screens as composition reference, with sample data |
| `reference/logo-exploration.html` | The six logo directions considered. Opens standalone in a browser |

## Where things go in the repo

```
src/styles/global.css            ← system/styles.css
src/styles/tokens/*.css          ← system/tokens/*.css
public/fonts/*.woff2             ← self-hosted Geist (see below)
public/icons/*.svg               ← system/assets/icons (or inline; see Icon)
src/components/<group>/*.astro   ← static primitives
src/components/<group>/*.tsx     ← interactive islands
src/lib/format/*.ts              ← money, dates, freshness, discount
src/layouts/*.astro              ← links global.css, sets data-theme
docs/adr/0006-design-tokens.md   ← the ADR this work requires
```

**Tokens do not go in `src/lib/`.** That directory is framework-neutral TypeScript with a lint-enforced import boundary; CSS has no business there. Formatting helpers *do* belong there, as pure functions taking their inputs as arguments — `loadConfig(source)` is the pattern the repo already uses.

## Fonts

The bundle loads Geist and Geist Mono from Google Fonts because it had no way to ship binaries. **Do not carry that into production.** Performance is a product feature (§91) and this is a Cloudflare-first stack; a third-party request on the critical path is the wrong default.

- Geist and Geist Mono, SIL OFL 1.1, from `https://fonts.google.com/specimen/Geist` and `.../Geist+Mono`.
- Take the Latin `woff2` subsets only. Weights actually used: **400, 500, 600** for Geist; **400, 500** for Geist Mono. The token file also declares 300 and 700 — 300 is unused in product UI and 700 is reserved; do not ship them.
- Replace the `@import url(...)` at the top of `tokens/fonts.css` with local `@font-face` rules. `font-display: swap`, `unicode-range` scoped to Latin. **Change no token name** — `--font-family-sans` and `--font-family-mono` already carry the right stacks including the `Geist Fallback` metric-override name.

## Which components are islands

The split is a performance decision. SEO is a product requirement and interactivity is opt-in per component in this stack.

**Static — `.astro`, zero client JS (28)**

`Icon`, `Wordmark`, `LudwiseMark`, `Badge`, `KeyValueList`, `Breadcrumbs`, `Pagination`, `Price`, `DiscountBadge`, `PriceSignal`, `FreshnessIndicator`, `StoreIdentity`, `Rating`, `ProvenanceNote`, `GameArtwork`, `GameCard`, `GameRow`, `OfferRow`, `Skeleton`, `EmptyState`, `InlineMessage`, `Banner`, `AffiliateDisclosure`, `PromoSlot`, `TextField`, `Textarea`, `Radio`, `Checkbox`

Notes:
- `Button` is static when it is a link or a form submit, which is most cases. Only its `loading` state needs JS, and that belongs to whatever island owns the submission.
- `Pagination` is real `<a>` links to real URLs. A crawler and a keyboard user both need a URL per page.
- `Checkbox` and `Radio` are static inside a `<form>` that submits filters as query parameters. They only become part of an island when filtering is live.
- `GameArtwork`'s `onError` fallback needs one line of inline JS or a `<picture>` fallback; do not hydrate the whole card for it.
- `OfferRow`'s hover is CSS. Nothing about an offer row needs JavaScript.

**Islands — `.tsx` with `client:` (16)**

| Component | Directive | Why |
| --- | --- | --- |
| `AppHeader` | `client:load` | Theme toggle, search, and the sub-1024px collapse. The only `client:load` on the page. |
| `SearchField` | part of `AppHeader` | Controlled value, clear button, loading state |
| `Tabs` | `client:visible` | Panel switching. Consider real URL fragments so tabs are linkable. |
| `Chip` | `client:visible` | Only when it is a live toggle or removable filter |
| `Select` | `client:visible` | Only when it drives client-side sort; a form-submit `Select` is static |
| `Switch` | `client:visible` | Immediate-effect settings |
| `DataTable` | `client:visible` | Client-side sorting only. Server-sorted tables are static. |
| `PriceHistoryChart` | `client:visible` | Hover and touch readout |
| `Popover` | `client:visible` | Outside-click and Escape |
| `Tooltip` | `client:visible` | Hover and focus |
| `Modal` | `client:visible` | Focus management, Escape, scroll lock |
| `Toast` | `client:idle` | Transient, never above the fold |

Everything else composes from the above.

## Design tokens

The complete reference is `system/guidelines/tokens.md`. The values you will reach for most:

**Accent** `--ludwise-amber-400: #E8A33D`. Primary buttons are amber with near-black text (`#0B0B0A`) in **both** themes — ~9.2:1 either way, so the button is one object rather than two designs. Amber's usual warning role has been deliberately reassigned: caution states use a glyph plus wording plus neutral or clay, never an amber wash.

**Neutrals** Warm graphite, 15 steps, `--ludwise-neutral-0` through `-1000`. Light page background is `#FBFAF8`, not white. Dark is `#0B0B0A`, not black.

**Semantics** teal `#0E8A6E` positive/decrease · clay `#BC3F26` negative/increase · azure `#2F6FB0` information only. Teal and clay were chosen to stay separable under deuteranopia.

**Type** Geist. 44 / 34 / 26 / 20 / 17 display and headings; 17 / 15 / 13 body; 15 / 13 / 11 label; 12 caption; 28 / 19 / 14 numeric; 13 mono. Weights 400/500/600. Headings track −0.014em to −0.022em; `label-sm` tracks +0.06em and uppercases. **Every price, percentage, count and date uses `font-variant-numeric: tabular-nums lining-nums`.**

**Space** 4px base: 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. Row heights 56 comfortable / 40 compact. Targets 40px pointer, 44px touch, 24px for inline controls nested in a larger target.

**Radius** 2 / 4 / 6 / 10 / 12 / full. Button and input 6, card 10, badge 4, modal 12, chip full. Chips are the only pill.

**Elevation** Three levels. `0` for all page content — cards get one hairline border and no shadow. `1` for popovers and toasts. `2` for modals only.

**Motion** 0 / 120 / 180 / 240ms, plus 600ms ambient for skeleton shimmer. `cubic-bezier(.2,0,.2,1)` standard. `prefers-reduced-motion` is handled once, globally, in `tokens/motion.css` — no component needs its own query.

**Layout** Max widths 1440 discovery / 1200 comparison / 720 reading. Gutters 16 / 24 / 32. Header 60px. Breakpoints 480 / 768 / 1024 / 1280 / 1600.

**Artwork ratios** capsule 3:2, header 460:215, hero 8:3, cover 2:3, screenshot 16:9. `object-fit: cover` inside the ratio. Never crop outside the list.

## Product semantics you can break by accident

These are the rules a competent developer will violate without meaning to, because they look like styling choices and are not. Each traces to `PRODUCT.md`.

1. **A price is never coloured for cheapness** (§11.2, §113). `--color-price-current` is ink. Green prices are prohibited.
2. **No discount without a reference price** (§121). If the store did not supply one, render no discount anywhere in that row. Do not derive one from anything else.
3. **No historical claim outside the fixed vocabulary** (§11.8, §28, §134). *Observed*, *recorded*, *since*. "All-time low" is prohibited unless the data proves it, which it currently cannot.
4. **Every historical claim carries its observation window** (§134). `Lowest price observed by LUDWISE since May 2026` — the "since" clause is what makes it true.
5. **Missing is not zero** (§120). `Not provided`, `Unavailable`, `No history collected yet`. Never `0`, `—` or `N/A`.
6. **Derived stays distinguishable from source** (§122). A LUDWISE-normalised rating and a converted price are both labelled as such, and the source's own figure stays visible.
7. **A rating shows its source's own scale** (§61–§63). 91% positive and 4.4/5 are not the same measurement; one card per source, never an average.
8. **Offer ordering is price-only** (§69). Affiliate commission is prohibited as a ranking input. The "best offer" is the cheapest *comparable* one, and an Ultimate Edition is not comparable to a Standard Edition (§38).
9. **Affiliate disclosure is three clauses** (§71): may earn a commission · your price does not change · commission never affects ranking. All three, unparaphrased, at the point of the click.
10. **Ads live only in `PromoSlot`** (§75). Never inside a content component, never between comparison rows, never labelled "Featured" or "Recommended".
11. **One provider failing is not an outage** (§56). Scope the warning to the section, keep the other stores' prices live, and say when the failed one was last verified.
12. **Freshness travels with every price** (§55). A price with no verification time invites the user to treat stale data as current.
13. **Retailer colour touches the 3px identity rule and the retailer's logo, nothing else.** A LUDWISE page must still read as LUDWISE with every retailer colour removed.
14. **Never colour alone.** Every state carries a glyph, a shape, a dash pattern or a word as well. This is the system's hardest rule and the one most often lost in reimplementation — `system/guidelines/accessibility.md` tabulates the carrier for each state.

## Interactions and behaviour

**Loading.** Skeletons only for content that has never rendered. Content that already exists is **dimmed in place** while it refreshes — `DataTable loading` drops the body to 55% opacity, `SearchField loading` swaps the magnifier for a spinner and leaves the results underneath. Never flash a populated view back to empty.

**Errors.** Structure is *what happened · what you are seeing instead · what you can do*. `system/guidelines/content-style.md` has the pattern per cause. Never "Something went wrong" when context is available. A request id is acceptable when asking the user to report a problem; the repo already puts one on every response as `x-request-id`.

**Empty states.** Three sentences at most, answering what happened, why the space is empty, what to do next. One 24px glyph. No illustrations.

**Progressive disclosure.** One line on the surface, the detail in a `Popover`. `Updated 8 min ago` opens to source, provider, observed and last-checked.

**Modals.** Confirmations, the mobile filter sheet, sign-in. Anything browsable, comparable or linkable is a page with a URL, because SEO and sharing are product requirements. Below 768px a modal becomes a bottom sheet.

**Responsive.** `system/guidelines/layout.md` is authoritative. The two rules most often got wrong: a card grid becomes a **row list** below 768px, not a one-column stack of tall cards; and a comparison table **scrolls horizontally** inside its own border, it does not reflow into cards — a comparison read as a stack of cards is no longer a comparison.

## State

No global store is needed for this work. What exists:

- **Theme** — `data-theme` on `<html>`, resolved server-side from a cookie, defaulting to `prefers-color-scheme`. The only piece of state that must not be resolved after first paint.
- **Market and currency** — a cookie. Distinct from UI language; do not conflate them (§116).
- **Density** — `comfortable` or `compact`, per region, optionally persisted.
- **Filters, sort, page** — URL query parameters. They must be shareable and crawlable.
- **Search input, tab selection, popover and modal open state** — local to their island.

## Assets

- **Icons** — Lucide, ISC licence, at `system/assets/icons/` with `LICENSE` included. 49 glyphs. Stroke is normalised to **1.75** at every size; sizes are 12 / 14 / 16 / 20 / 24. The reference `Icon.jsx` inlines the SVG markup so an icon costs no request — do the same, or build an SVG sprite. Do not add `lucide-react`; it is a dependency for something the build can do statically.
- **Logo** — `system/assets/logo-mark.svg` and `logo-mark-mono.svg`. An amber tile carrying a descending three-step path, beside the split `LUD`/`WISE` wordmark. The step is the same shape the price chart draws and doubles as an L. Mark alone floors at 20px; below that the treads merge. Original work, sketched in code — expect it to be replaced by finished artwork.
- **Fonts** — see the Fonts section. Not in the bundle; download them.
- **Game artwork and retailer logos** — none. Both fallback states are designed and must be implemented.

## Out of scope

Do not implement the domain model, persistence, the Steam provider adapter, authentication, or search ranking. `ROADMAP.md` puts the canonical model next and the MVP after it; this work is the presentation layer those will use. Define the view models the templates need, mark them provisional, and keep them in the page files.
