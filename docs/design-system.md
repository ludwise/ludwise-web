# The design system

How to build UI here, and what is not yours to decide.

The reasoning is in [ADR 0012](../adr/0012-design-tokens-and-component-layer.md)
and [ADR 0013](../adr/0013-theme-resolution-without-a-flash.md).

## Source of truth

The design system was produced outside this repository and is vendored at
[`design/`](../../design/). It is the visual source of truth. When the code and
the bundle disagree, the code is wrong.

| Path                          | What it is                                                                 |
| ----------------------------- | -------------------------------------------------------------------------- |
| `design/system/readme.md`     | The design guide: direction, principles, foundations                       |
| `design/system/tokens/`       | The token layer, 10 files                                                  |
| `design/system/components/`   | 44 components: prop contract, usage rules, reference implementation        |
| `design/system/guidelines/`   | Tokens, layout, component states, accessibility, content style, governance |
| `design/reference/screens.md` | Four screens as composition reference                                      |

`design/` is excluded from Prettier and ESLint. Do not reformat it, do not fix
its lint, do not edit it to match the code. Updating the design system means
replacing the directory wholesale.

The **reference implementations in `design/system/components/*.md` are not code
to copy.** They are inline-styled React because that is what the design tooling
required. Recreate them here as Astro components with scoped styles over the
token custom properties.

The **prop contract blocks are the API.** Port the names, the variants, the
defaults and the constraint comments. If a name is wrong, raise it — do not
silently diverge.

## Tokens

`src/styles/tokens/` is a verbatim copy of `design/system/tokens/`, imported by
`src/styles/global.css`, which the base layout loads.

`tests/integration/design/token-parity.test.ts` pins every token name and value
in source order. If you change a token here, that test fails and tells you
which one — which is the point, because two copies of the same file drift the
moment someone tunes a color in whichever one they had open.

Exactly one file differs: `tokens/fonts.css` serves Geist from this origin
rather than Google Fonts. That divergence is asserted explicitly, and
`src/styles/tokens/` is excluded from Prettier so the rest stays byte-identical.

**Never write a literal where a token exists.** Not a color, not a spacing
value, not a radius, a shadow, a font size, a duration or an easing curve.
`tests/architecture/design-system.test.ts` fails the build on any raw color in
`src/components/`, `src/layouts/` or `src/pages/`. A literal is a value that
belongs to one theme only, and it is invisible in review because it looks
correct in whichever theme the author was viewing.

Layout values with no token — `flex: 1`, `overflow: hidden`, `aspect-ratio` —
are fine.

### Fonts

Geist and Geist Mono, self-hosted from `public/fonts/`, vendored by
`scripts/vendor-fonts.mjs` out of the `@fontsource` packages. Run it after
bumping either package; the output is committed. Weights: sans 400/500/600,
mono 400/500. The token file also declares 300 and 700 — 300 is unused in
product UI and 700 is reserved. Do not include them.

## Themes

Both themes are authored; neither is an inversion. `[data-theme]` on `<html>`
selects one.

The value is resolved server-side from a `theme` cookie and rendered into the
first response. A visitor with no cookie gets no attribute, and a pre-paint
script in `<head>` resolves `prefers-color-scheme` before anything is drawn.
**Never add client-side theme detection that runs after paint** — a flash of
the wrong theme over a price comparison is a defect, not a polish item.

Read and write the cookie through `src/lib/http/theme.ts`. `readThemeCookie` is
a sanitiser: the value is caller-controlled and lands in an HTML attribute, so
it answers only with a member of a closed set or `null`.

Check both themes before you call a component done. `design/system/guidelines/governance.md`
has the full review checklist; the short version is: does it work in both
themes, survive greyscale, survive a 35% longer string, and hold at 200% zoom
and 375px wide?

## Components

`src/components/<group>/`, mirroring the handoff's grouping.

**Static `.astro` is the default.** A component becomes a React island only
when it genuinely needs browser state, and the handoff tabulates which ones do.
Server-rendered HTML is a product requirement — pages must be readable
without JavaScript and fast on a slow connection — and
the split is a performance decision, not a style preference. `AppHeader` is the only island on a page, and the only
`client:` directive in the tree. Anything below the fold that needs one should
use `client:visible`.

Built so far — only primitives with a consumer in the current product:

| Static                                                                                                                                                                                                              | Island                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `foundation/Icon`, `feedback/InlineMessage`, `feedback/EmptyState`, `layout/PageContainer`, `game/Price`, `game/DiscountBadge`, `game/FreshnessIndicator`, `game/StoreIdentity`, `game/OfferTable`, `game/GameCard` | `navigation/AppHeader` |

The remaining components arrive with the features that render them. Most encode
price and freshness semantics and have no data to display yet.

### The client JavaScript budget

**One island per page.** Today that is `AppHeader`, and it costs about 205 KB
raw — 55 KB over the wire — of React and its runtime, which is 59% of the
weight of a page. That buys a theme toggle and a menu disclosure.

That ratio is stated here rather than left to be discovered, because the second
island is the decision that matters and it should be a decision. Adding one
costs nothing extra in framework bytes, since React already ships; adding the
_first_ one to a page that had none costs all of it. So the question for any new
island is not "is this component interactive" but "does this page need to load a
framework at all".

A component becomes an island when it needs browser state that no server render
can supply. It does not become one because it would be tidier, because the
reference implementation used `useState` for a hover, or because a form would
be nicer without a round trip.

### Rules that look like styling and are not

Each of these traces to a product rule recorded in the private product
definition. A competent developer will break them
without meaning to.

- **A price is never coloured for cheapness.** `--color-price-current` is ink.
  Green prices are prohibited. Hue marks direction of change and the observed
  low, nothing else.
- **No discount without a reference price.** If the store did not supply one,
  render no discount anywhere in that row. Do not derive one.
- **No historical claim outside the fixed vocabulary** — _observed_,
  _recorded_, _since_. "All-time low" is prohibited.
- **Every historical claim carries its observation window.** "Lowest price
  observed by LUDWISE since May 2026" — the _since_ clause is what makes it
  true.
- **Missing is not zero.** `Not provided`, `Unavailable`, `No history collected
yet`. Never `0`, `—` or `N/A`.
- **Never color alone.** Every state carries a glyph, a shape, a dash pattern
  or a word as well. `design/system/guidelines/accessibility.md` tabulates the
  carrier for each state. The handoff calls this the system's hardest rule and
  the one most often lost in reimplementation.
- **Retailer color touches the 3px identity rule and the retailer's own logo,
  nothing else.** A LUDWISE page must still read as LUDWISE with every retailer
  color removed.
- **Ads live only in `PromoSlot`.** Never inside a content component, never
  between comparison rows.

## Accessibility

Target is WCAG 2.2 AA, built into the tokens rather than added per page.
`design/system/guidelines/accessibility.md` is authoritative.

**There is exactly one `:focus-visible` rule**, in `tokens/base.css`. No
component overrides it — `tests/architecture/design-system.test.ts` fails the
build if one does. A per-component focus ring produces an indicator that
changes shape as a keyboard operator moves through the page.

Touch targets: 40px on pointer surfaces, 44px on touch, 24px only for a control
nested inside a larger target. `prefers-reduced-motion` is handled once,
globally, in `tokens/motion.css` — no component needs its own query.

`tests/e2e/shell.spec.ts` runs axe over the shell in both themes.

## Additions beyond the handoff

The handoff has genuine gaps, confirmed by reading all six guideline documents.
These are additions, recorded here rather than invented silently:

- **`layout/PageContainer`** — implements the three page-width archetypes from
  `guidelines/layout.md` (wide 1440, standard 1200, reading 720) and the
  16/24/32 gutters. The rules are the handoff's; the component is not.
- **A skip link** — no landmark or skip-link guidance appears anywhere in the
  bundle. It clips itself rather than reusing `.lw-visually-hidden`, because it
  has to become visible on `:focus` and that utility has no focus state.
- **404 and 500 page compositions** — the bundle documents four product screens
  and no error pages. Composed from `EmptyState` and `InlineMessage` using the
  error-wording patterns in `guidelines/content-style.md`.
- **A favicon** — the bundle ships `assets/logo-mark.svg` and never says what
  a browser tab should show. `public/favicon.svg` is that file copied
  verbatim, pinned to it by `tests/integration/design/asset-parity.test.ts`
  the same way the token layer is pinned. The color mark rather than the mono
  one: `logo-mark-mono.svg` fills itself with `currentColor`, which resolves
  against nothing when a browser fetches an icon outside any document.
  SVG only, with no `.ico` or apple-touch variant, because producing those
  needs a rasterisation step and an image dependency; a browser that cannot
  read an SVG icon shows the same default glyph it showed before.
- **No footer** — the bundle specifies none, only an unfilled region in a
  layout diagram. Inventing one would be redesigning the product.
- **`game/GameCard` renders one variant and four fewer props.** The handoff's
  card carries artwork, a rating summary and a price signal; none of those
  exists in the canonical model, and the product rules forbid rendering a value
  that is not there, so each is absent rather than stubbed with a placeholder.
  Only the `standard` variant is built, because the handoff is explicit that
  exactly three exist and a fourth needs a system change — the other two arrive
  with a surface that renders them. It adds two things: freshness, which the
  handoff puts on `GameRow` and not on `GameCard`, because every number on a
  sale card is commercial data and §55 requires that a visitor is not misled
  into thinking stale data was freshly verified; and an edition label, because
  one game can carry several offers and the card shows one of them (§37).
  Its quiet lines use `--color-text-secondary` rather than the tertiary the
  handoff's mock uses: at caption size, tertiary on the default surface
  measures 4.19:1, below WCAG 1.4.3's 4.5:1.
- **No `PromoSlot` and no affiliate disclosure on `/sales`.** The handoff's
  sales page has an ad unit in its aside. There is no advertising integration
  and there are no affiliate links, so an empty promo box would be decoration
  and a disclosure describing a relationship that does not exist would be a
  false statement. The aside keeps only the "Legitimate stores only" note,
  which is a claim the data actually supports.
- **No grid and list density toggle on `/sales`.** The handoff's page has one.
  It needs either a second React island on a page that otherwise loads no
  framework, or a full page load per toggle, and it changes nothing factual.

## When a new token or component is justified

`design/system/guidelines/governance.md` is the authority. Summarised:

A **new token** needs a role no existing semantic token covers, at least two
uses, a name describing role rather than appearance, and both a light and a
dark value, both contrast-checked. A new shade of an existing role does not
count.

A **new component** needs the pattern to appear on at least two surfaces, to be
impossible to compose from existing ones without duplicating logic that must
stay consistent, or to encode a product rule that would otherwise be re-argued
each time.

A fourth variant added to dodge a layout problem needs a system change, not a
prop.
