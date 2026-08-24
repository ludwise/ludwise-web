# Paste this into Claude Code

You are working in the `daniel-kindl/ludwise` repository (Astro 7, server output, Cloudflare Workers, TypeScript, React available for islands but not yet used).

Your task: **adopt the LUDWISE design system into this codebase.** The design system lives in `design_handoff_ludwise_design_system/` at the repo root — read its `README.md` first, then `system/readme.md`, which is the design guide.

## Before you write anything

Read, in this order:

1. `PRODUCT.md` — canonical. Sections 110–120 (accessibility, responsive, design system, visual character, themes, localisation, errors, empty states, missing data) are the product requirements this work satisfies. Sections 25, 28, 40, 51–56, 61–66, 70–75, 120–122 are the semantics the game primitives encode.
2. `ARCHITECTURE.md` — in particular *Module boundary* and *What is deliberately absent* (it currently says "No component library or design tokens"; this change is what removes that line).
3. `CONTRIBUTING.md` and `AGENTS.md` — branch model, commit format, and what a change needs before it is finished.
4. `design_handoff_ludwise_design_system/README.md` — what is in the bundle and how it maps onto this repo.

## Hard constraints

- **Nothing under `src/lib/` may import `astro:*`, `cloudflare:*` or `@astrojs/*`.** This is a lint error, not a convention. Design tokens are CSS and belong in `src/styles/`, not `src/lib/`. Pure formatting helpers (money, dates, relative time) *do* belong in `src/lib/` and must take their inputs as arguments.
- **Server-rendered HTML is the default.** SEO is a product requirement (§83, §89). A component becomes a client island only when it genuinely needs browser state — see the island table in the README. Do not make the whole page interactive.
- **Every architectural decision gets an ADR** in `docs/adr/`, following `docs/adr/template.md`. This work needs at least one: *0006 — Design tokens and component layer*. A second may be justified for the theme-switching mechanism.
- **`pnpm check` must pass** before you consider a phase done. It is the same sequence CI runs.
- **Conventional commits**, one logical change per commit. `feat(design): …`, `docs(adr): …`.

## Phases

Work through these in order and stop for review at the end of each. Do not skip ahead.

### Phase 1 — Token layer

1. Copy `design_handoff_ludwise_design_system/system/tokens/*.css` into `src/styles/tokens/` and `system/styles.css` into `src/styles/global.css`, keeping the `@import` structure exactly as it is. `global.css` stays a list of `@import` lines only.
2. **Self-host Geist and Geist Mono instead of the Google Fonts import.** Performance is a product feature (§91) and a third-party font request on the critical path contradicts it. Download the Latin `woff2` subsets, put them in `public/fonts/`, and replace the `@import url(fonts.googleapis.com…)` in `tokens/fonts.css` with local `@font-face` rules — `font-display: swap`, `unicode-range` scoped to Latin. Do not change any token name.
3. Link `global.css` from the base layout. Add `<link rel="preload">` for the two font files actually used above the fold.
4. Write the ADR: why a CSS-custom-property token layer rather than Tailwind or CSS-in-JS, why the semantic/primitive split, and why tokens are not in `src/lib/`.

**Acceptance:** a page renders with LUDWISE typography and colour, `pnpm check` is green, and no token name differs from the bundle.

### Phase 2 — Theme switching, done without a flash

`[data-theme="light" | "dark"]` on `<html>` selects the theme; both are authored, neither is an inversion.

Requirements:
- The server must render the correct `data-theme` on the first response. Read a `theme` cookie in middleware and set the attribute during SSR. **No client-side theme detection that runs after paint** — a flash of the wrong theme on a price comparison is a real defect, not a polish issue.
- Default when no cookie exists: respect `prefers-color-scheme` via a `<script>` in `<head>` that runs before first paint and sets the attribute, then persists the resolved value to the cookie on first interaction.
- `color-scheme` is already set per theme in `tokens/color-semantic.css`; do not duplicate it.
- The toggle lives in `AppHeader` and must work with JavaScript disabled where practical (a form POST fallback is acceptable but optional — note the decision in the ADR either way).

**Acceptance:** hard-reload in dark mode shows no light flash; the cookie survives navigation; `prefers-color-scheme` is honoured for a first-time visitor.

### Phase 3 — Primitives

Recreate the components documented in `system/components/*.md` under `src/components/`, mirroring the grouping (`foundation/`, `actions/`, `forms/`, `navigation/`, `display/`, `game/`, `feedback/`, `overlays/`, `charts/`, `monetisation/`).

Read `system/components/README.md` first, then the group file you are working in. **The fenced `jsx` blocks are reference implementations, not code to copy.** They are inline-styled React because that is what the design-system tooling required. In this repo:

- Static components become `.astro` with a scoped `<style>` block referencing the token custom properties. Zero client JS.
- Interactive components become React islands (`.tsx`) with an explicit `client:` directive. Use `client:visible` for anything below the fold, `client:load` only for the header.
- Keep every prop name, variant name and default from the component's **Prop contract** block. That is the API contract; it carries the constraints as comments and you should port those comments.
- Read each component's rules section before implementing it. They state the rules as WHEN / USE / BECAUSE, and several encode product requirements that a naive implementation will break.

Which components are islands, and which are not, is tabulated in the README. Follow it — the split is a performance decision, not a style preference.

Start with, in this order: `Icon`, `Wordmark`/`LudwiseMark`, `Button`, `IconButton`, `Badge`, `Price`, `DiscountBadge`, `PriceSignal`, `FreshnessIndicator`, `StoreIdentity`. Those ten unblock a real game page.

**Acceptance:** each component has the states its row in `system/guidelines/component-states.md` lists; focus is the single global `:focus-visible` rule and no component overrides it.

### Phase 4 — Formatting helpers in `src/lib/`

Port `formatMoney` and add the date/freshness helpers to `src/lib/format/`. Pure functions, no platform imports, unit-tested.

- Money: `Intl.NumberFormat` with `style: "currency"`. **Never** concatenate a symbol onto a number. A price without a currency is not a price (§40).
- Relative time: relative wording up to 7 days, absolute after. Return both forms so the caller can put the absolute one in `title` and in screen-reader text.
- Freshness level: derive `fresh | aging | stale | unknown | unavailable` from an observation timestamp and a provider-health flag. The thresholds are in `system/guidelines/content-style.md`.
- Discount: derive from reference and current price, and **return null when the reference price is absent** (§121). Do not invent a discount.

**Acceptance:** tests cover a missing reference price, a missing currency, a zero discount and a future timestamp. Coverage thresholds still pass.

### Phase 5 — Screens

Build the routes, composing Phase 3 components. `reference/screens.md` documents all four, with the route each maps to and the states each demonstrates.

| Route | Reference section |
| --- | --- |
| `/sales` | *SalesScreen* |
| `/games` and search results | *SearchScreen* |
| `/games/[slug]` | *GameScreen* |
| `/preferences` | *AccountScreen* |

Use placeholder data behind a typed interface — the domain model does not exist yet (see `ROADMAP.md` → *Next — the domain model*). **Do not invent a schema.** Define the view models the templates need, mark them clearly as provisional, and keep them in the page files rather than in `src/lib/`.

**Acceptance:** every route server-renders meaningful content with JS disabled; Lighthouse accessibility is 100; no horizontal scroll at 375px, 768px or 1024px.

## What not to do

- Do not add Tailwind, a CSS framework, a component library, or a CSS-in-JS runtime. The token layer plus scoped Astro styles is the decision.
- Do not rename a token, a component or a prop. If a name is wrong, raise it; do not silently diverge.
- Do not build a combobox, slider, date picker or wishlist toggle. `system/guidelines/governance.md` lists them as deliberate extension points with the conditions for building them.
- Do not colour a price. Prices are ink; hue marks direction of change and the observed low only.
- Do not write "all-time low", or any historical claim outside the fixed vocabulary in `system/guidelines/content-style.md`.
- Do not let a retailer's brand colour touch anything but the 3px identity rule and the retailer's own logo.
- Do not put an ad or affiliate element inside a content component. `PromoSlot` exists so that cannot happen.
- Do not implement the domain model, persistence, or the Steam provider. That is the next roadmap phase and is out of scope here.

## When you are done

Update:
- `ARCHITECTURE.md` — remove "No component library or design tokens" from *What is deliberately absent*, and add a short *Design system* section pointing at `src/styles/` and `src/components/`.
- `README.md` — add the design system to the documentation table.
- `docs/` — a short `docs/development/design-system.md` explaining how to add a component and when a new token is justified, deferring to `system/guidelines/governance.md`.

Then summarise: which phases landed, which components exist, what you deferred and why.
