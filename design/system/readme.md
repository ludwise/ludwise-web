# LUDWISE Design System

**LUDWISE** is a global PC game discovery, legitimate-store price-comparison, sale-discovery and price-history platform. Its one-sentence definition, taken from the product's own canonical document:

> LUDWISE helps people discover PC games and compare trustworthy, legitimate storefront offers using transparent current and historical market data.

Steam is the first provider. Steam is **not** the domain model. Everything in this system is built so a second, fifth and tenth storefront can join without a visual redesign, and so no single retailer's brand can take the page over.

---

## Sources this system was built from

| Source | Link | What was used |
| --- | --- | --- |
| LUDWISE repository (private) | `https://github.com/daniel-kindl/ludwise` — branch `main` | `PRODUCT.md` (canonical product definition, 200 numbered sections), `README.md`, `ARCHITECTURE.md`, `ROADMAP.md` |
| Lucide icons | `https://github.com/lucide-icons/lucide` — branch `main`, ISC licence | 49 SVGs copied verbatim into `assets/icons/` |
| Geist & Geist Mono | `https://fonts.google.com/specimen/Geist` · `https://fonts.google.com/specimen/Geist+Mono` — SIL OFL 1.1 | The whole typographic system |

Read the LUDWISE repository if you have access — `PRODUCT.md` in particular. It is unusually complete, and it is the authority behind almost every rule in this document. Where this design system and `PRODUCT.md` disagree, `PRODUCT.md` wins.

**What did not exist in the source.** At the time of writing, the repository is an engineering foundation only: no product UI, no components, no colour tokens, no typography decision, no logo, no artwork. `ARCHITECTURE.md` states plainly under *What is deliberately absent*: "No component library or design tokens." The visual language in this system was therefore **designed from the product definition**, not recovered from existing code. Two consequences:

1. **The logo was designed here, not recovered.** The repository ships no mark, so one was explored (`guidelines/logo-exploration.html`, six directions) and adopted: an amber tile carrying a descending three-step path, beside the split `LUD`/`WISE` wordmark. The step is the same shape `PriceHistoryChart` draws, and it reads as an L. It is original — nothing traced or approximated. Source files `assets/logo-mark.svg` and `assets/logo-mark-mono.svg`; components `Wordmark` and `LudwiseMark`. These are sketches in code, not finished curve work; hand the direction to an identity designer before production.
2. **There is no game artwork and there are no retailer logos.** Every `GameArtwork` in the UI kit renders its designed "No artwork available" state, and `StoreIdentity` uses a neutral storefront glyph.

---

## 1. Design direction

Three directions were considered against the product brief.

**A — Editorial gaming intelligence.** A premium publication about games: large display type, generous measure, controlled imagery, strong article hierarchy. *Strength:* immediate credibility and a distinctive voice. *Weakness:* editorial layouts are built for reading one thing, and LUDWISE's core job is comparing many things at once. A price table does not want an editorial measure.

**B — Modern gaming utility.** Application-shaped: compact, fast, toolbar-driven, filter-heavy, close to a desktop app. *Strength:* excellent at the comparison task. *Weakness:* it looks like a tool rather than a place, gives artwork nowhere to live, and makes a game discovery page feel like a spreadsheet — the "enterprise database" failure mode the brief explicitly names.

**C — Market intelligence.** The vocabulary of financial and market-data products: ink-on-paper prices, tabular figures everywhere, restrained accent, charts that state observations rather than decorate them. *Strength:* it is honest about what LUDWISE actually is — an instrument for reading a market. *Weakness:* on its own it is cold, and gaming is not a cold subject.

**The chosen direction is C, warmed by A, with B's density available as a switch.**

Concretely: the surface language and data treatment come from market intelligence — flat panels, hairline borders, almost no shadow, ink prices, tabular numerals, step charts. The typographic warmth and the confidence of the headline scale come from the editorial direction. B survives as the `compact` density token rather than as a whole visual language, so a comparison table can tighten without the product turning into an application shell.

**Why amber.** The accent is `#E8A33D` — a warm signal amber.

- It is nobody's storefront. Steam blue, GOG purple, Epic black, Humble red and Green Man green are all far away in hue, so LUDWISE never reads as an extension of the store it is quoting.
- It is not gamer neon. Amber is the colour of instruments, market boards and warning lights on good machines — attentive rather than aggressive.
- It behaves identically in both themes. Amber is a "dark text on it" colour: near-black on `#E8A33D` clears 9:1, in light mode and dark mode alike, so the primary button is the same object in both themes rather than two designs.
- It reserves the loudest colour in the palette for facts, not feelings. Amber marks *the lowest price LUDWISE has observed* and the *one* committing action. It never marks "cheap".

The trade-off is deliberate: amber's usual job as a warning colour has been taken away from it. Caution states in LUDWISE — stale data, expiring offers, provider trouble — are carried by **glyph plus wording plus neutral or clay**, never by an amber wash. This is better for the product anyway, because in a price comparison an amber alarm reads as commercial pressure.

---

## 2. Brand personality

| Trait | What it means in the interface |
| --- | --- |
| **Intelligent** | The page answers a question, then offers the evidence behind the answer one interaction away. |
| **Transparent** | Every number says where it came from and when it was checked. Derived values say they are derived. |
| **Independent** | No retailer gets a bigger card, a brighter colour or a better position. Commission is invisible to ranking. |
| **Calm** | Dense, but never loud. One accent, three elevation levels, no gradients, no glow. |
| **Precise** | Tabular figures, real currency formatting, real minus signs, exact timestamps behind relative ones. |
| **Gamer-aware** | Artwork is given real space and real aspect ratios. The vocabulary is a player's vocabulary — editions, bundles, sales, wishlists. |
| **Trustworthy** | Nothing on the page is engineered to make you hurry. |

---

## 3. Design principles

1. **Information before decoration.** Artwork enriches; prices, freshness and provenance stay readable over any artwork. If a decorative element competes with a price, the decoration loses.
2. **Say what is known, and how it is known.** A value on screen carries its source and its age. A derived value says LUDWISE derived it.
3. **Never claim more history than was observed.** The permitted vocabulary is *observed*, *recorded*, *since*. "All-time low" is prohibited unless the underlying data proves it.
4. **Colour states, never emotions.** Prices are ink. Hue marks direction of change, the observed low, and system status. Green never means cheap.
5. **Non-colour redundancy is mandatory.** Every state carries a glyph, a shape, a dash pattern or a word in addition to its colour.
6. **Retailers are named, not branded.** A retailer colour may tint a 3px rule and the retailer's own logo. Nothing else.
7. **Monetisation lives outside the content ramp.** Ads and affiliate links get their own container and their own disclosure. Neither may ever look like ranked content.
8. **Progressive disclosure.** One line on the surface, the detail in a popover. Simple at first glance, powerful when explored.
9. **Refresh in place.** Content that already exists is dimmed while it updates, never replaced with skeletons.
10. **Compose before you invent.** A new token or component needs a justification; see `guidelines/governance.md`.

---

## 4. Content fundamentals

The voice is the same voice as the LUDWISE repository's own documentation: declarative, specific, unhurried, allergic to filler. Read `PRODUCT.md` and you will hear it — short sentences, concrete nouns, an explicit reason attached to each rule.

**Person.** Address the user as *you*. Refer to the product as *LUDWISE*, never *we* in product UI ("LUDWISE has recorded 412 observations", not "we've tracked 412 prices"). *We* is acceptable only in a direct promise about an action LUDWISE will take on the user's behalf: "We will email you when the price drops below €25.00."

**Casing.** Sentence case for everything: headings, buttons, labels, menu items, table headers rendered in `label-sm` are the one uppercase exception, and only because they are structural.

**Tone.** Matter of fact. No exclamation marks. No hype adjectives — *amazing*, *insane*, *unbeatable*, *huge* are all out. No urgency the data does not support.

**Numbers.** Always formatted for the user's locale via `Intl`. Always with their currency. Always tabular. A real minus sign (−) in a discount, never a hyphen.

**Timestamps.** Relative up to seven days ("8 min ago", "3 days ago"), absolute after that ("18 Aug 2026"). The exact timestamp is always reachable — `title` attribute, popover, or screen-reader text.

**Historical wording.** Fixed forms, no paraphrase:
- `Lowest price observed by LUDWISE since May 2026`
- `Matches lowest observed price`
- `€5.00 above observed low`
- `No history collected yet`

**Missing data.** `Not provided` for a field a provider does not supply. `Unavailable` for an offer that cannot currently be bought. `No history collected yet` for an empty observation window. Never `0`, never `—`, never `N/A`.

**Errors.** Name the condition, say what the user is looking at instead, offer the recovery. "Steam did not respond at 15:12 CEST. These prices were last verified 3 hours ago." Never "Something went wrong". Never "Oops". Never a status code or a stack trace; a request id is acceptable when asking the user to report the problem.

**Affiliate wording.** Three clauses, always all three: LUDWISE may earn a commission · your price does not change · commission never affects ranking.

**Emoji.** Never. Not in UI, not in empty states, not in notifications. The icon set is Lucide.

---

## 5. Visual foundations

**Colour.** One accent (amber `#E8A33D`), one warm-graphite neutral ramp, and three restrained semantic hues: teal for positive/decrease, clay for negative/increase, azure for information. Warm neutrals are deliberate — a cool grey ramp makes amber read as dirty yellow. Light mode's page background is `#FBFAF8`, not white; dark mode's is `#0B0B0A`, not black. Both themes are authored independently; neither is an inversion of the other.

**Type.** Geist for everything, Geist Mono for identifiers and developer surfaces. Geist is a Swiss-derived neo-grotesque with genuinely good figures — it holds up at 11px in a table header and at 44px in a page title, has no italics to misuse, and supports the Latin coverage LUDWISE's localisation ambitions need. Prices, percentages, counts and dates always use `font-variant-numeric: tabular-nums lining-nums`, because a column of prices that shifts as digits change is unreadable. Headings carry negative tracking (−0.014em to −0.022em); `label-sm` carries +0.06em and uppercases.

**Spacing.** 4px base. `space.05` (2px) exists only for optical nudges inside chips and badges. Two densities: `comfortable` (56px rows) for reading and discovery, `compact` (40px rows) for comparison and lists over about 25 rows.

**Backgrounds.** Flat. No gradients anywhere in chrome — the only gradients in the entire system are the artwork protection scrim and the skeleton shimmer, and both are functional. No patterns, no textures, no illustrations. There is no illustration language, on purpose: LUDWISE has nothing to illustrate that a sentence does not say better.

**Imagery.** Provider artwork only, at five fixed ratios — capsule 3:2, header 460:215, hero 8:3, cover 2:3, screenshot 16:9. `object-fit: cover` inside the ratio; never letterboxed, never distorted, never cropped to an unlisted ratio. Game key art runs from snow-white to near-black, so any text over artwork requires the protection scrim (a bottom-up `rgba(11,11,10,.88)` → transparent gradient). Missing and broken artwork is a designed state, not a fallback.

**Cards.** `--radius-card` 10px, `--color-surface-default`, one hairline `--color-border-default`, **no shadow**. Hierarchy comes from layout and background first, borders second, shadow almost never. A LUDWISE page should not look like a pile of floating surfaces.

**Elevation.** Three levels. `elevation-0` for all page content. `elevation-1` for popovers and toasts. `elevation-2` for modals only.

**Borders.** `subtle` inside components (row dividers), `default` around components, `strong` for hover emphasis and form control edges. The 3px `--border-width-identity` has exactly two jobs: the retailer identity rule, and the amber left rule on the best comparable offer.

**Transparency and blur.** Effectively unused. The scrim behind a modal is `rgba(27,26,24,.48)` in light and `rgba(0,0,0,.64)` in dark. There is no glassmorphism, no `backdrop-filter`, anywhere.

**Radii.** 2 / 4 / 6 / 10 / 12 / full. Buttons and inputs 6, cards 10, badges 4, modals 12, chips full. Chips are the only pill in the system.

**Motion.** Four categories — instant 0ms, fast 120ms, normal 180ms, deliberate 240ms — plus `ambient` 600ms reserved for skeleton shimmer. Easing is `cubic-bezier(.2,0,.2,1)` standard, with enter/exit variants. Everything collapses to zero under `prefers-reduced-motion`, which the token file enforces globally. Nothing bounces. Nothing springs. No entrance animation on page content, and none on charts.

**Hover.** A background step (`surface.interactive-hover`) or a border step (`default` → `strong`). Never opacity, never a lift, never a scale, never a glow.

**Press.** A further background step (`surface.interactive-active`). No transform, because a shrinking button in a dense table is noise.

**Focus.** A 2px solid ring at 2px offset, in `--ludwise-amber-700` on light and `--ludwise-amber-400` on dark — both clear 3:1 against every surface they can appear on. Set once, globally, on `:focus-visible`.

**Fixed elements.** The header is sticky at 60px. Detail-page side rails and filter sidebars are sticky at `top: 80px`. Nothing else is fixed; there are no floating action buttons and no sticky footers.

---

## 6. Iconography

**Lucide**, ISC licensed, copied into `assets/icons/` and inlined into `components/foundation/Icon.jsx` so no icon costs a network request.

This is a **substitution and should be flagged**: the LUDWISE repository contains no icon set of its own, so Lucide was chosen as the closest fit — 24×24 grid, uniform stroke, geometric but not cold, and it survives at 12px. Stroke weight is normalised to **1.75** across every size, which is slightly heavier than Lucide's 2 at large sizes and reads better at 14px in a table cell.

- **Sizes.** `xs` 12 (inside badges and chips) · `sm` 14 (table cells, captions) · `md` 16 (default; buttons, labels) · `lg` 20 (header actions) · `xl` 24 (empty states).
- **Icon plus label.** The icon is `aria-hidden`. Only a standalone icon takes a `title`.
- **Standalone icon buttons** are 40px on pointer surfaces, 44px on touch, and always carry a `label` that becomes both `aria-label` and the tooltip.
- **Decorative icons** are tertiary text colour and never larger than the text beside them.
- **No custom icons** unless a product need has no Lucide equivalent, and then only through `Icon` so sizing and stroke stay consistent.
- **No emoji. No unicode glyphs as icons.** Two typographic exceptions are intentional and are characters, not icons: the true minus sign (−, U+2212) in discounts, and the middle dot (·, U+00B7) as a metadata separator.
- Retailer logos are **not** icons. They are images inside `StoreIdentity`, at the retailer's own artwork.

---

## 7. Components

43 exports across ten groups. Every component is inline-styled from CSS custom properties, imports React only, and has a sibling `.d.ts` contract and `.prompt.md` usage note.

**Foundation** — `Icon`, `Wordmark`, `LudwiseMark`
**Actions** — `Button`, `IconButton`
**Forms** — `TextField`, `SearchField`, `Select`, `Checkbox`, `Radio`, `Switch`, `Textarea`
**Navigation** — `AppHeader`, `Tabs`, `Pagination`, `Breadcrumbs`
**Data display** — `Badge`, `Chip`, `KeyValueList`, `DataTable`
**Game primitives** — `GameCard`, `GameRow`, `GameArtwork`, `Price`, `DiscountBadge`, `PriceSignal`, `FreshnessIndicator`, `StoreIdentity`, `Rating`, `OfferRow`, `ProvenanceNote`
**Feedback** — `InlineMessage`, `Banner`, `Toast`, `Skeleton`, `EmptyState`
**Overlays** — `Tooltip`, `Popover`, `Modal`
**Data visualisation** — `PriceHistoryChart`
**Monetisation** — `PromoSlot`, `AffiliateDisclosure`

`formatMoney` is exported from `components/game/Price.jsx` as the single money-formatting helper.

### Intentional additions

The source repository defines no component inventory, so this set was authored from `PRODUCT.md`'s product requirements. Two components exist purely to make product rules unbreakable rather than because a UI needed them:

- **`PromoSlot`** — so advertising can never be built out of content components.
- **`AffiliateDisclosure`** — so the three required disclosure clauses cannot be paraphrased away.

### Hierarchy defaults

Where a component shows a game, the default priority is fixed:

1. Game identity (artwork, then title)
2. Current purchasable state (available / unavailable / how many stores)
3. Price
4. Deal context (discount, then historical signal)
5. Store
6. Secondary metadata (rating, genres, release)

Contexts may deviate, but must do so deliberately. On an offer table, store rises to position 1 because the store *is* the row's subject.

---

## 8. Repository index

| Path | What is there |
| --- | --- |
| `styles.css` | The single entry point consumers link. `@import` lines only. |
| `tokens/` | `fonts` · `color-primitives` · `color-semantic` · `typography` · `space` · `shape` · `elevation` · `layout` · `motion` · `base` |
| `components/` | Ten directories, one per group; each has a `@dsCard` HTML showing its states |
| `guidelines/` | Foundation specimen cards, plus the deep-dive documents below |
| `ui_kits/ludwise-web/` | Interactive four-screen recreation of the consumer web product |
| `assets/icons/` | 49 Lucide SVGs and the ISC licence |
| `thumbnail.html` | Homepage tile |
| `SKILL.md` | Agent-skill entry point |
| `github.md` | Source-repository association |

**Deep dives**

- [`guidelines/tokens.md`](guidelines/tokens.md) — the complete token reference, ready to convert to any token format
- [`guidelines/layout.md`](guidelines/layout.md) — grids, breakpoints, page regions, responsive behaviour
- [`guidelines/component-states.md`](guidelines/component-states.md) — the state matrix for every interactive component
- [`guidelines/accessibility.md`](guidelines/accessibility.md) — WCAG 2.2 AA requirements and how each is met
- [`guidelines/content-style.md`](guidelines/content-style.md) — UI writing, with the fixed strings
- [`guidelines/governance.md`](guidelines/governance.md) — when a new token or component is justified, and versioning
- [`guidelines/logo-exploration.html`](guidelines/logo-exploration.html) — the six logo directions considered, and why the adopted one won

---

## 9. Quality test

The brief's fifteen closing questions, answered against this system.

1. *Feels like LUDWISE, not Steam?* Amber accent, warm neutrals, flat panels, ink prices — nothing in the palette or shape language echoes a storefront.
2. *Hundreds of games without chaos?* One card, three variants, a compact row alternative, and a density switch.
3. *Dense pricing data?* Tabular figures throughout, 40px compact rows, tables that scroll rather than reflow.
4. *Multiple stores fairly?* Retailer colour is confined to a 3px rule; ordering is price-only; affiliate status is disclosed and never positional.
5. *Price history and uncertainty?* Step charts of observations, a fixed observed-since vocabulary, and an explicit "no history collected yet" state.
6. *Both themes?* Both authored, neither inverted; the primary button is identical in both.
7. *Mobile?* Documented per-component behaviour, 44px touch targets, tables that scroll, filters in a sheet.
8. *Accessible?* AA contrast throughout, non-colour redundancy as a system rule, focus set globally, reduced motion enforced in the token layer.
9. *B2B and developer surfaces?* `DataTable`, `KeyValueList`, `Badge` and Geist Mono cover an API console with no new primitives.
10. *Interpretable by an AI agent?* Every `.prompt.md` states rules as WHEN / USE / BECAUSE, and `.d.ts` comments carry the constraints.
11. *Artwork complements?* Fixed ratios, mandatory scrim under text, designed missing state.
12. *Monetisation separate from ranking?* `PromoSlot` sits outside the surface ramp; commission is prohibited as a ranking input.
13. *Communicates trust?* Freshness on every price, provenance one click away, disclosure at the point of the click.
14. *Avoids gamer clichés?* No neon, no glow, no gradients, no HUD, no glass.
15. *Survives well beyond MVP?* Nothing in the token or component layer is Steam-shaped.

### Known gaps

- The logo is an in-house sketch, not designer-finished artwork. No game artwork and no retailer logos — see the top of this document.
- Combobox, slider and date-range controls are described in `guidelines/governance.md` as extension points but are not built; no current product surface requires them.
- Mobile compositions are specified but not separately built as screens.
