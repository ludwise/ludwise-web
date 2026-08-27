---
ste-prose: descriptive
---

# Game primitives

Reference specifications for `components/game/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `DiscountBadge`, `FreshnessIndicator`, `GameArtwork`, `GameCard`, `GameRow`, `OfferRow`, `Price`, `PriceSignal`, `ProvenanceNote`, `Rating`, `StoreIdentity`.

---

## DiscountBadge

A neutral, quiet percentage-off marker that sits beside a price without competing with it.

```jsx
<DiscountBadge percentage={50} />
<DiscountBadge percentage={67} emphasis="strong" />
```

**WHEN** rendering a discount, **USE** the neutral surface **BECAUSE** a saturated red or green badge is an emotional cue, and LUDWISE sells comprehension rather than urgency.

- Renders `−50%` with a true minus sign (U+2212), not a hyphen, so it aligns in a tabular column.
- Returns `null` for a missing or zero discount. Never render `−0%` or "No discount".
- `emphasis="strong"` may appear at most once per comparison set.

### Prop contract

```ts
import * as React from "react";

export interface DiscountBadgeProps {
  /** Whole or fractional percent off, derived from referencePrice and price.
   *  Renders nothing at all when null or <= 0. */
  percentage?: number | null;
  size?: "sm" | "md";
  /** "strong" tints the badge amber. Reserve it for the single best comparable
   *  offer in a comparison set — never as a general attention grab. */
  emphasis?: "default" | "strong";
}

export declare function DiscountBadge(props: DiscountBadgeProps): React.ReactElement | null;
```

### Reference implementation

```jsx
import React from "react";

export function DiscountBadge({ percentage, size = "md", emphasis = "default", style }) {
  if (percentage == null || percentage <= 0) return null;
  const value = Math.round(percentage);
  const strong = emphasis === "strong";
  const compact = size === "sm";
  return (
    <span
      aria-label={value + " percent off"}
      style={{
        display: "inline-flex", alignItems: "center",
        height: compact ? 20 : 24, padding: compact ? "0 var(--space-2)" : "0 var(--space-2)",
        borderRadius: "var(--radius-badge)",
        background: strong ? "var(--color-accent-quiet)" : "var(--color-discount-surface)",
        border: "var(--border-width-hairline) solid " + (strong ? "var(--color-accent-border)" : "var(--color-discount-border)"),
        color: strong ? "var(--color-accent-text)" : "var(--color-discount-text)",
        font: compact ? "var(--text-label-sm)" : "var(--text-label-md)",
        letterSpacing: "var(--letter-spacing-label)",
        fontVariantNumeric: "tabular-nums lining-nums", whiteSpace: "nowrap", ...style
      }}
    >{"\u2212" + value + "%"}</span>
  );
}
```

---

## FreshnessIndicator

Says how recently LUDWISE verified the commercial data on screen.

```jsx
<FreshnessIndicator level="fresh" label="Updated 8 min ago" absolute="21 Aug 2026, 15:12 CEST" />
<FreshnessIndicator level="stale" label="Last checked 3 days ago" absolute="18 Aug 2026, 09:40 CEST" />
<FreshnessIndicator level="unavailable" label="Steam not responding — showing last known price" />
```

**WHEN** a price is on screen, **USE** a freshness indicator within the same visual group **BECAUSE** a price with no verification time invites the user to treat stale data as current.

- Each level is distinguished by glyph shape *and* colour: filled dot, hollow dot, dashed ring, clock, alert. Greyscale must still read.
- Relative wording up to 7 days; past that use an absolute date. `absolute` is always available on hover and to assistive tech.
- Never suppress the indicator to make a page look tidier. Freshness is product data.

### Prop contract

```ts
import * as React from "react";

export type FreshnessLevel = "fresh" | "aging" | "stale" | "unknown" | "unavailable";

export interface FreshnessIndicatorProps {
  /** fresh < 1h · aging 1–24h · stale > 24h · unknown no timestamp ·
   *  unavailable the provider is currently failing. */
  level?: FreshnessLevel;
  /** Relative wording, e.g. "Updated 8 min ago". Falls back to a safe default. */
  label?: string;
  /** Full ISO or localised timestamp, exposed on hover and to screen readers.
   *  Always supply it when a timestamp exists. */
  absolute?: string;
  size?: "sm" | "md";
}

export declare function FreshnessIndicator(props: FreshnessIndicatorProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const freshnessConfig = {
  fresh: { color: "var(--color-freshness-fresh)", glyph: "solid", icon: null, fallback: "Checked recently" },
  aging: { color: "var(--color-freshness-aging)", glyph: "hollow", icon: null, fallback: "Checked a while ago" },
  stale: { color: "var(--color-freshness-stale)", glyph: "hollow", icon: "clock-fading", fallback: "Price may be out of date" },
  unknown: { color: "var(--color-freshness-unknown)", glyph: "dashed", icon: "circle-question-mark", fallback: "Freshness unknown" },
  unavailable: { color: "var(--color-freshness-unavailable)", glyph: "dashed", icon: "circle-alert", fallback: "Store temporarily unavailable" }
};

export function FreshnessIndicator({ level = "fresh", label, absolute, size = "md", style }) {
  const cfg = freshnessConfig[level] || freshnessConfig.fresh;
  const text = label || cfg.fallback;
  const dot = (
    <span aria-hidden="true" style={{
      width: 8, height: 8, borderRadius: "var(--radius-full)", flex: "none",
      background: cfg.glyph === "solid" ? cfg.color : "transparent",
      border: cfg.glyph === "solid" ? "none" : "1.5px " + (cfg.glyph === "dashed" ? "dashed" : "solid") + " " + cfg.color
    }} />
  );
  return (
    <span title={absolute} style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
      font: size === "sm" ? "var(--text-caption)" : "var(--text-body-sm)",
      color: level === "fresh" || level === "aging" ? "var(--color-text-tertiary)" : cfg.color, ...style
    }}>
      {cfg.icon ? <Icon name={cfg.icon} size="sm" /> : dot}
      <span>{text}</span>
      {absolute && <span className="lw-visually-hidden">{"Exact time: " + absolute}</span>}
    </span>
  );
}
```

---

## GameArtwork

Renders provider artwork at a fixed LUDWISE aspect ratio, with designed loading and missing states.

```jsx
<GameArtwork src={game.capsule} title={game.title} ratio="capsule" />
<GameArtwork src={game.hero} title={game.title} ratio="hero" scrim />
<GameArtwork title={game.title} ratio="capsule" />   {/* no artwork from provider */}
```

**WHEN** artwork is missing or fails to load, **USE** the built-in placeholder **BECAUSE** provider coverage is uneven by design, and a broken image icon reads as a LUDWISE defect rather than an absent asset.

**WHEN** any text or badge overlays artwork, **USE** `scrim` **BECAUSE** game key art ranges from near-white snowfields to near-black horror and only a protection gradient guarantees the price stays legible.

- `objectFit: cover` inside a fixed ratio. Never letterbox, never distort, never crop to a ratio not in the list.
- `alt=""`: the artwork is decorative because the title is always rendered adjacent. Do not put the title in `alt` as well.
- Artwork is lazy-loaded and `decoding="async"`; a grid of 60 capsules must not block first paint.

### Prop contract

```ts
import * as React from "react";

export type ArtworkRatio = "capsule" | "header" | "hero" | "cover" | "screenshot";

export interface GameArtworkProps {
  /** Provider artwork URL. Omit or let it fail — the placeholder is a designed
   *  state, not a fallback of last resort. */
  src?: string;
  /** Game title. Used in the placeholder and as the artwork's context. The
   *  <img> itself is alt="" because the title always appears next to it. */
  title: string;
  /** capsule 3:2 grid cards · header 460:215 store art · hero 8:3 detail page ·
   *  cover 2:3 library · screenshot 16:9. Never crop outside these. */
  ratio?: ArtworkRatio;
  radius?: string;
  /** Adds the bottom-up protection gradient. Required whenever text is
   *  overlaid on artwork; forbidden when nothing sits on top. */
  scrim?: boolean;
  loading?: boolean;
}

export declare function GameArtwork(props: GameArtworkProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const artworkRatioMap = {
  capsule: "var(--aspect-capsule)",
  header: "var(--aspect-header)",
  hero: "var(--aspect-hero)",
  cover: "var(--aspect-cover)",
  screenshot: "var(--aspect-screenshot)"
};

export function GameArtwork({
  src, title, ratio = "capsule", radius = "var(--radius-artwork)",
  scrim = false, loading = false, style
}) {
  const [failed, setFailed] = React.useState(false);
  const missing = !src || failed;

  return (
    <div style={{
      position: "relative", width: "100%", aspectRatio: artworkRatioMap[ratio] || artworkRatioMap.capsule,
      borderRadius: radius, overflow: "hidden", background: "var(--color-background-tertiary)",
      border: "var(--border-width-hairline) solid var(--color-border-subtle)", flex: "none", ...style
    }}>
      {loading ? (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg,var(--color-background-tertiary) 0%,var(--color-background-secondary) 50%,var(--color-background-tertiary) 100%)",
          backgroundSize: "200% 100%", animation: "lw-shimmer var(--motion-duration-ambient) linear infinite"
        }} />
      ) : missing ? (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "var(--space-2)",
          padding: "var(--space-3)", textAlign: "center", color: "var(--color-text-tertiary)",
          backgroundImage: "repeating-linear-gradient(135deg,transparent,transparent 7px,var(--color-border-subtle) 7px,var(--color-border-subtle) 8px)"
        }}>
          <Icon name="image-off" size="lg" />
          <span style={{ font: "var(--text-label-md)", color: "var(--color-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{title}</span>
          <span style={{ font: "var(--text-caption)" }}>No artwork available</span>
        </div>
      ) : (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      )}
      {scrim && !missing && !loading && (
        <div aria-hidden="true" style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to top,rgba(11,11,10,.88) 0%,rgba(11,11,10,.45) 38%,rgba(11,11,10,0) 72%)"
        }} />
      )}
      <style>{"@keyframes lw-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}"}</style>
    </div>
  );
}
```

---

## GameCard

The discovery primitive: one game, its artwork, and its best current offer.

```jsx
<GameCard
  title="Cyberpunk 2077"
  artworkSrc={g.capsule}
  price={{ amount: 29.99, referenceAmount: 59.99, currency: "EUR" }}
  discountPercentage={50}
  storeCount={3}
  ratingSummary="Steam 91%"
/>
```

Content hierarchy inside the card, top to bottom and never reordered:
1. **Game identity** — artwork, then title.
2. **Purchasable state** — how many stores carry it.
3. **Price** — the largest text in the card body.
4. **Deal context** — discount, then any signal.
5. **Secondary metadata** — rating summary, quiet and attributed.

- Exactly three variants exist. A new variant needs a system change, not a prop.
- Title clamps at two lines. Longer titles and longer locales shrink nothing else.
- The whole card is one link. No nested interactive controls — a wishlist button inside a card creates a keyboard trap and an ambiguous click target.

### Prop contract

```ts
import * as React from "react";
import type { PriceProps } from "./Price";

export type GameCardVariant = "standard" | "compact" | "horizontal";

export interface GameCardProps {
  title: string;
  artworkSrc?: string;
  /** The best current comparable offer across all stores. */
  price: PriceProps;
  discountPercentage?: number | null;
  /** How many stores currently list the game. Omit when not yet known. */
  storeCount?: number;
  /** Short source-attributed summary, e.g. "Steam 91%". Never a bare number. */
  ratingSummary?: string;
  /** Optional <PriceSignal>. Only on cards in a deal or history context. */
  signal?: React.ReactNode;
  /** standard = discovery grid · compact = dense grid and sidebars ·
   *  horizontal = search results and wishlists. Three variants, no more. */
  variant?: GameCardVariant;
  href?: string;
}

export declare function GameCard(props: GameCardProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { GameArtwork } from "./GameArtwork.jsx";
import { Price } from "./Price.jsx";
import { DiscountBadge } from "./DiscountBadge.jsx";
import { Icon } from "../foundation/Icon.jsx";

export function GameCard({
  title, artworkSrc, price, discountPercentage, storeCount, ratingSummary,
  signal, variant = "standard", href = "#", onOpen, style
}) {
  const [hover, setHover] = React.useState(false);
  const horizontal = variant === "horizontal";
  const compact = variant === "compact";

  return (
    <a
      href={href} onClick={onOpen}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: horizontal ? "grid" : "flex",
        gridTemplateColumns: horizontal ? "160px 1fr" : undefined,
        flexDirection: "column", gap: horizontal ? "var(--space-4)" : 0,
        textDecoration: "none", color: "inherit",
        background: "var(--color-surface-default)",
        border: "var(--border-width-hairline) solid " + (hover ? "var(--color-border-strong)" : "var(--color-border-default)"),
        borderRadius: "var(--radius-card)", overflow: "hidden",
        transition: "var(--motion-transition-color)", ...style
      }}
    >
      <GameArtwork src={artworkSrc} title={title} ratio={horizontal ? "capsule" : "capsule"}
        radius="0" style={{ borderWidth: 0 }} />
      <div style={{
        display: "flex", flexDirection: "column", gap: compact ? "var(--space-1)" : "var(--space-2)",
        padding: horizontal ? "var(--space-3) var(--space-4) var(--space-3) 0" : compact ? "var(--space-3)" : "var(--space-4)",
        flex: 1, minWidth: 0
      }}>
        <h3 style={{
          font: compact ? "var(--text-label-lg)" : "var(--text-heading-sm)",
          letterSpacing: "var(--letter-spacing-heading)", color: "var(--color-text-primary)",
          margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          textWrap: "pretty"
        }}>{title}</h3>

        {!compact && (ratingSummary || storeCount != null) && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", font: "var(--text-caption)", color: "var(--color-text-tertiary)", flexWrap: "wrap" }}>
            {ratingSummary && <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}><Icon name="thumbs-up" size="xs" />{ratingSummary}</span>}
            {storeCount != null && <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)" }}><Icon name="store" size="xs" />{storeCount === 1 ? "1 store" : storeCount + " stores"}</span>}
          </div>
        )}

        <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "var(--space-2)", paddingTop: "var(--space-2)" }}>
          <Price {...price} size={compact ? "sm" : "md"} />
          <DiscountBadge percentage={discountPercentage} size={compact ? "sm" : "md"} />
        </div>
        {signal && <div>{signal}</div>}
      </div>
    </a>
  );
}
```

---

## GameRow

The list counterpart to `GameCard`: search results, wishlists, sale lists, mobile grids that have collapsed.

```jsx
<GameRow title="Baldur's Gate 3" subtitle="Larian Studios · 2023" price={{ amount: 47.99, currency: "EUR" }} discountPercentage={20} />
<GameRow density="compact" title="Hades II" price={{ amount: 24.99, currency: "EUR" }} />
```

- Price is right-aligned and tabular so a column of rows scans vertically.
- `compact` (40px) is for lists over ~25 rows. Below that use `comfortable`.
- On viewports under 768px, a `GameCard` grid becomes a `GameRow` list rather than a one-column stack of tall cards.

### Prop contract

```ts
import * as React from "react";
import type { PriceProps } from "./Price";
import type { FreshnessIndicatorProps } from "./FreshnessIndicator";

export interface GameRowProps {
  title: string;
  /** Developer, release year, or genre. One line only. */
  subtitle?: string;
  artworkSrc?: string;
  price: PriceProps;
  discountPercentage?: number | null;
  storeName?: string;
  freshness?: FreshnessIndicatorProps;
  /** comfortable 56px · compact 40px. Compact hides the freshness indicator. */
  density?: "comfortable" | "compact";
  href?: string;
}

export declare function GameRow(props: GameRowProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { GameArtwork } from "./GameArtwork.jsx";
import { Price } from "./Price.jsx";
import { DiscountBadge } from "./DiscountBadge.jsx";
import { FreshnessIndicator } from "./FreshnessIndicator.jsx";

export function GameRow({
  title, subtitle, artworkSrc, price, discountPercentage, storeName,
  freshness, density = "comfortable", href = "#", style
}) {
  const [hover, setHover] = React.useState(false);
  const compact = density === "compact";
  const thumb = compact ? 48 : 64;
  return (
    <a href={href}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "grid", gridTemplateColumns: thumb + "px 1fr auto", alignItems: "center",
        gap: compact ? "var(--space-3)" : "var(--space-4)",
        padding: compact ? "var(--space-2) var(--space-3)" : "var(--space-3) var(--space-4)",
        minHeight: compact ? "var(--density-row-height-compact)" : "var(--density-row-height-comfortable)",
        textDecoration: "none", color: "inherit",
        background: hover ? "var(--color-surface-interactive-hover)" : "transparent",
        borderBottom: "var(--border-width-hairline) solid var(--color-border-subtle)",
        transition: "var(--motion-transition-color)", ...style
      }}>
      <div style={{ width: thumb }}>
        <GameArtwork src={artworkSrc} title={title} ratio="capsule" radius="var(--radius-sm)" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ font: compact ? "var(--text-label-md)" : "var(--text-label-lg)", color: "var(--color-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        {subtitle && <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</span>}
        {storeName && <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{storeName}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifySelf: "end" }}>
        {freshness && !compact && <FreshnessIndicator {...freshness} size="sm" />}
        <DiscountBadge percentage={discountPercentage} size="sm" />
        <Price {...price} size={compact ? "sm" : "md"} align="end" />
      </div>
    </a>
  );
}
```

---

## OfferRow

One purchasable offer, in the offer table on a game page. Composes `StoreIdentity`, `Price`, `DiscountBadge` and `FreshnessIndicator`.

```jsx
<OfferRow
  best
  store={{ name: "Steam", verified: true }}
  edition="Standard Edition"
  price={{ amount: 29.99, referenceAmount: 59.99, currency: "EUR" }}
  freshness={{ level: "fresh", label: "Updated 8 min ago" }}
  signal={<PriceSignal kind="observed-low" observedSince="May 2026">Lowest observed</PriceSignal>}
/>
```

**WHEN** ordering offers, **USE** current comparable price ascending **BECAUSE** affiliate commission is prohibited as a ranking input by PRODUCT.md §69.

**WHEN** an offer is an affiliate link, **USE** `affiliate` **BECAUSE** the disclosure belongs at the point of the click, and it must state that the user's price is unchanged.

- `best` marks the cheapest *comparable* offer. A Ultimate Edition is not comparable to a Standard Edition; group them separately before choosing a best.
- The best offer gets an amber left rule and the only `primary` button in the table. Nothing else in the table may look like a call to action.
- Unavailable offers stay in the list at 60% opacity with a disabled action — removing them hides that the store carries the game at all.

### Prop contract

```ts
import * as React from "react";
import type { PriceProps } from "./Price";
import type { FreshnessIndicatorProps } from "./FreshnessIndicator";

export interface OfferStore { name: string; logoSrc?: string; verified?: boolean }

export interface OfferRowProps {
  store: OfferStore;
  /** The exact purchasable thing: "Standard Edition", "Ultimate Edition",
   *  "Franchise Bundle". Never blank — an unlabelled offer is uncomparable. */
  edition: string;
  price: PriceProps;
  freshness?: FreshnessIndicatorProps;
  /** A <PriceSignal> element, when this offer carries historical context. */
  signal?: React.ReactNode;
  /** Marks the best COMPARABLE offer. Exactly one per comparison set, chosen
   *  by price alone. Never by affiliate value. */
  best?: boolean;
  /** Renders the standing affiliate disclosure inside the row. */
  affiliate?: boolean;
  unavailable?: boolean;
  density?: "comfortable" | "compact";
  ctaLabel?: string;
  onOpen?: () => void;
}

export declare function OfferRow(props: OfferRowProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Price } from "./Price.jsx";
import { DiscountBadge } from "./DiscountBadge.jsx";
import { StoreIdentity } from "./StoreIdentity.jsx";
import { FreshnessIndicator } from "./FreshnessIndicator.jsx";
import { Button } from "../actions/Button.jsx";

export function OfferRow({
  store, edition, price, freshness, signal, best = false, affiliate = false,
  unavailable = false, density = "comfortable", ctaLabel = "View offer", onOpen, style
}) {
  const [hover, setHover] = React.useState(false);
  const pad = density === "compact" ? "var(--space-2) var(--space-3)" : "var(--space-3) var(--space-4)";
  return (
    <div
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(150px,1.3fr) minmax(120px,1fr) auto auto",
        alignItems: "center", gap: "var(--space-4)", padding: pad,
        background: hover ? "var(--color-surface-interactive-hover)" : "var(--color-surface-default)",
        borderLeft: best ? "var(--border-width-identity) solid var(--color-accent-primary)" : "var(--border-width-identity) solid transparent",
        borderBottom: "var(--border-width-hairline) solid var(--color-border-subtle)",
        opacity: unavailable ? 0.6 : 1,
        transition: "var(--motion-transition-color)", ...style
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", minWidth: 0 }}>
        <StoreIdentity name={store.name} logoSrc={store.logoSrc} verified={store.verified} size="sm" />
        <span style={{ font: "var(--text-body-sm)", color: "var(--color-text-secondary)" }}>{edition}</span>
        {affiliate && (
          <span style={{ font: "var(--text-caption)", color: "var(--color-promo-label)" }}>
            Affiliate link · LUDWISE may earn a commission. Your price is unchanged.
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
        <Price {...price} size="md" />
        {freshness && <FreshnessIndicator {...freshness} size="sm" />}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {price && price.referenceAmount > price.amount && (
          <DiscountBadge percentage={Math.round((1 - price.amount / price.referenceAmount) * 100)} emphasis={best ? "strong" : "default"} />
        )}
        {signal}
      </div>
      <Button variant={best ? "primary" : "secondary"} size="sm" iconEnd="arrow-up-right" onClick={onOpen} disabled={unavailable}>
        {unavailable ? "Unavailable" : ctaLabel}
      </Button>
    </div>
  );
}
```

---

## Price

The most important primitive in LUDWISE. Renders a current price, its reference price, and the four non-price states.

```jsx
<Price amount={29.99} referenceAmount={59.99} currency="EUR" size="lg" kindLabel="Standard Edition" />
<Price amount={0} currency="EUR" state="free" />
<Price state="unavailable" kindLabel="Not sold in this market" />
<Price amount={499} currency="CZK" locale="cs-CZ" converted />
```

**WHEN** a store supplies both a current and a regular price, **USE** `amount` + `referenceAmount` **BECAUSE** the struck-through figure is what makes the discount checkable rather than asserted.

**WHEN** the reference price is unknown, **USE** `amount` alone and render no discount anywhere in that row **BECAUSE** a discount LUDWISE cannot derive from observed inputs is a fabricated claim.

- Prices are always `--color-price-current` (ink). Green or red prices are prohibited: hue in LUDWISE marks *direction of change*, never cheapness.
- Order is reference-then-current, left to right, so the eye lands last on the number that matters.
- `kindLabel` is mandatory the moment two offers appear together — an Ultimate Edition price beside a base-game price with no label is a comparison error.
- Never render a bare number. Currency and market travel with the amount everywhere, including tooltips and charts.

### Prop contract

```ts
import * as React from "react";

export type PriceState = "available" | "free" | "unavailable" | "unknown";

export interface PriceProps {
  /** Major-unit amount, e.g. 29.99. Required unless state is not "available". */
  amount?: number;
  /** ISO 4217 code. A price without a currency is not a price. */
  currency?: string;
  /** The store's regular/reference price. Rendered struck through, BEFORE the
   *  current price. Omit when the store does not supply one — never infer it. */
  referenceAmount?: number;
  /** BCP-47 tag. Drives symbol position and separators via Intl.NumberFormat. */
  locale?: string;
  size?: "sm" | "md" | "lg";
  state?: PriceState;
  /** True only for a LUDWISE-converted figure. Adds an explicit caption so a
   *  converted number is never mistaken for the store's own price. */
  converted?: boolean;
  /** What is being priced: "Standard Edition", "Deluxe Edition", "DLC",
   *  "Bundle". Required whenever more than one offer is on screen. */
  kindLabel?: string;
  align?: "start" | "end";
}

export declare function Price(props: PriceProps): React.ReactElement;
export declare function formatMoney(amount: number, currency: string, locale?: string): string | null;
```

### Reference implementation

```jsx
import React from "react";

const priceSizeMap = {
  sm: { current: "var(--text-numeric-sm)", ref: "var(--font-size-body-sm)" },
  md: { current: "var(--text-numeric-md)", ref: "var(--font-size-body-sm)" },
  lg: { current: "var(--text-numeric-lg)", ref: "var(--font-size-body-md)" }
};

/* Locale decides symbol position, separators and spacing. Never concatenate
   a symbol onto a number by hand. */
export function formatMoney(amount, currency, locale) {
  if (amount == null || !currency) return null;
  try {
    return new Intl.NumberFormat(locale || undefined, { style: "currency", currency }).format(amount);
  } catch (e) {
    return currency + " " + amount.toFixed(2);
  }
}

export function Price({
  amount, currency, referenceAmount, locale, size = "md",
  state = "available", converted = false, kindLabel, align = "start", style
}) {
  const s = priceSizeMap[size] || priceSizeMap.md;
  const wrap = { display: "flex", flexDirection: "column", gap: 2, alignItems: align === "end" ? "flex-end" : "flex-start", ...style };
  const numeric = { font: s.current, letterSpacing: "var(--letter-spacing-numeric)", fontVariantNumeric: "tabular-nums lining-nums" };

  if (state === "unavailable" || state === "unknown") {
    return (
      <span style={wrap}>
        <span style={{ ...numeric, color: "var(--color-price-unavailable)", fontWeight: "var(--font-weight-medium)" }}>
          {state === "unavailable" ? "Unavailable" : "Not provided"}
        </span>
        {kindLabel && <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{kindLabel}</span>}
      </span>
    );
  }

  if (state === "free") {
    return (
      <span style={wrap}>
        <span style={{ ...numeric, color: "var(--color-price-free)" }}>Free</span>
        {kindLabel && <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{kindLabel}</span>}
      </span>
    );
  }

  const current = formatMoney(amount, currency, locale);
  const reference = formatMoney(referenceAmount, currency, locale);
  const discounted = reference != null && referenceAmount > amount;

  return (
    <span style={wrap}>
      <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap",
        justifyContent: align === "end" ? "flex-end" : "flex-start" }}>
        {discounted && (
          <span aria-label={"Regular price " + reference} style={{
            fontSize: s.ref, color: "var(--color-price-reference)", textDecoration: "line-through",
            fontVariantNumeric: "tabular-nums lining-nums"
          }}>{reference}</span>
        )}
        <span style={{ ...numeric, color: "var(--color-price-current)" }}>{current}</span>
      </span>
      {(kindLabel || converted) && (
        <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
          {kindLabel}{kindLabel && converted ? " · " : ""}{converted ? "Converted from store currency" : ""}
        </span>
      )}
    </span>
  );
}
```

---

## PriceSignal

The factual deal-context marker. This is what LUDWISE has instead of a Deal Score.

```jsx
<PriceSignal kind="observed-low" observedSince="May 2026">Lowest price observed by LUDWISE</PriceSignal>
<PriceSignal kind="matches-low" observedSince="May 2026">Matches lowest observed price</PriceSignal>
<PriceSignal kind="above-low">€5.00 above observed low</PriceSignal>
<PriceSignal kind="no-history">No history collected yet</PriceSignal>
```

**WHEN** the current price equals the lowest LUDWISE has recorded within its own observation window, **USE** `kind="observed-low"` with `observedSince` set **BECAUSE** the window is what makes the claim true; without it the badge asserts an all-time low LUDWISE cannot prove.

**NEVER** write "All-time low", "Best price ever" or "Historic low" in this component. The permitted vocabulary is *observed*, *recorded*, *since*.

**WHEN** a game has fewer observations than the display threshold, **USE** `kind="no-history"` **BECAUSE** an absent history is a real, explainable state and must not be silently omitted.

- Every kind pairs a glyph with the text, so the meaning survives greyscale and colour-vision deficiency.
- Only `observed-low` and `matches-low` carry amber. Everything else is ink or grey.

### Prop contract

```ts
import * as React from "react";

export type PriceSignalKind =
  | "observed-low" | "matches-low" | "above-low" | "no-history"
  | "price-decrease" | "price-increase" | "expired";

export interface PriceSignalProps {
  kind: PriceSignalKind;
  /** The claim, written in full. LUDWISE never abbreviates a historical claim
   *  into a bare word like "LOW". */
  children: React.ReactNode;
  /** Start of LUDWISE's observation window, e.g. "May 2026". Renders as a
   *  quiet "· since May 2026" suffix. Include it on every historical claim. */
  observedSince?: string;
}

export declare function PriceSignal(props: PriceSignalProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const priceSignalConfig = {
  "observed-low": { icon: "arrow-down", tone: "accent" },
  "matches-low": { icon: "arrow-up-down", tone: "accent" },
  "above-low": { icon: "arrow-up", tone: "neutral" },
  "no-history": { icon: "clock-fading", tone: "muted" },
  "price-decrease": { icon: "arrow-down", tone: "positive" },
  "price-increase": { icon: "arrow-up", tone: "negative" },
  "expired": { icon: "eye-off", tone: "muted" }
};

const priceSignalTone = {
  accent: { bg: "var(--color-signal-observed-low-surface)", fg: "var(--color-signal-observed-low-text)", bd: "var(--color-signal-observed-low-border)" },
  neutral: { bg: "transparent", fg: "var(--color-text-secondary)", bd: "var(--color-border-default)" },
  positive: { bg: "transparent", fg: "var(--color-price-decrease)", bd: "var(--color-border-default)" },
  negative: { bg: "transparent", fg: "var(--color-price-increase)", bd: "var(--color-border-default)" },
  muted: { bg: "transparent", fg: "var(--color-text-tertiary)", bd: "var(--color-border-subtle)" }
};

export function PriceSignal({ kind, children, observedSince, style }) {
  const cfg = priceSignalConfig[kind] || priceSignalConfig["above-low"];
  const tone = priceSignalTone[cfg.tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
      minHeight: 22, padding: "2px var(--space-2) 2px var(--space-1)",
      borderRadius: "var(--radius-badge)",
      background: tone.bg, border: "var(--border-width-hairline) solid " + tone.bd, color: tone.fg,
      font: "var(--text-label-md)", letterSpacing: "var(--letter-spacing-label)", ...style
    }}>
      <Icon name={cfg.icon} size="sm" />
      <span>{children}</span>
      {observedSince && (
        <span style={{ color: "var(--color-text-tertiary)", fontWeight: "var(--font-weight-regular)" }}>
          {"\u00b7 since " + observedSince}
        </span>
      )}
    </span>
  );
}
```

---

## ProvenanceNote

The disclosure body behind "Updated 8 min ago". It lives inside a `Popover` or a details panel, never inline on a card.

```jsx
<ProvenanceNote items={[
  { label: "Source", value: "Steam Store API" },
  { label: "Provider", value: "steam" },
  { label: "Observed", value: "21 Aug 2026, 15:12 CEST" },
  { label: "Last checked", value: "21 Aug 2026, 15:20 CEST" }
]} />
<ProvenanceNote derived items={[{ label: "Observed", value: "412 observations since 4 May 2026" }]} />
```

**WHEN** a value is computed by LUDWISE rather than supplied by a store, **USE** `derived` **BECAUSE** PRODUCT.md requires derived data to stay distinguishable from source data at the point of display.

- Progressive disclosure: the surface shows one line; this component holds the rest.
- Never show provenance for every field on a page. One group per data cluster (price, rating, metadata).

### Prop contract

```ts
import * as React from "react";

export interface ProvenanceItem {
  /** One of the five permitted labels: Source, Provider, Observed, Updated,
   *  Last checked. Do not invent new ones without a system change. */
  label: "Source" | "Provider" | "Observed" | "Updated" | "Last checked" | string;
  value: string;
}

export interface ProvenanceNoteProps {
  items: ProvenanceItem[];
  /** Marks the whole group as LUDWISE-derived rather than provider-supplied. */
  derived?: boolean;
  compact?: boolean;
}

export declare function ProvenanceNote(props: ProvenanceNoteProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function ProvenanceNote({ items = [], derived = false, compact = false, style }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: compact ? "var(--space-1)" : "var(--space-2)",
      font: "var(--text-caption)", color: "var(--color-text-tertiary)", ...style
    }}>
      {derived && (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Icon name="info" size="sm" />
          <span>Derived by LUDWISE from the observations below</span>
        </div>
      )}
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "var(--space-4)", rowGap: compact ? 2 : "var(--space-1)", margin: 0 }}>
        {items.map(it => (
          <React.Fragment key={it.label}>
            <dt style={{ color: "var(--color-text-tertiary)" }}>{it.label}</dt>
            <dd style={{ margin: 0, color: "var(--color-text-secondary)", fontVariantNumeric: "tabular-nums" }}>{it.value}</dd>
          </React.Fragment>
        ))}
      </dl>
    </div>
  );
}
```

---

## Rating

Shows one rating from one source, with the source impossible to miss.

```jsx
<Rating sourceName="Steam" displayValue="91%" summary="Very Positive" reviewCount={125304} normalized={91} />
<Rating sourceName="GOG" displayValue="4.4/5" reviewCount={2810} normalized={88} />
<Rating sourceName="Epic Games Store" displayValue="Not provided" confidence="This store does not publish user scores" />
```

**WHEN** displaying any score, **USE** the source's own scale in `displayValue` **BECAUSE** 91% positive and 4.4/5 measure different things, and flattening them into one number makes unrelated scores look equivalent.

**WHEN** a normalised figure is useful for comparison, **USE** `normalized` **BECAUSE** it renders as a caption attributed to LUDWISE, which keeps derived data distinguishable from source data.

- One card per source. Never merge sources into a single averaged badge.
- Critic scores and user scores never share a card or a visual treatment.
- A source with no rating still gets a card saying so — silence reads as zero.

### Prop contract

```ts
import * as React from "react";

export interface RatingProps {
  /** The store or critic body that produced the score. Always visible. */
  sourceName: string;
  sourceLogoSrc?: string;
  /** The score EXACTLY as the source expresses it: "91%", "4.4/5", "82".
   *  Never converted before display. */
  displayValue: string;
  /** The source's own wording for that score, e.g. "Very Positive". */
  summary?: string;
  reviewCount?: number;
  /** LUDWISE's 0–100 normalisation. Rendered as a caption, clearly attributed
   *  to LUDWISE, never as the headline number. */
  normalized?: number;
  /** Free text such as "Few reviews — treat as indicative". */
  confidence?: string;
  locale?: string;
  size?: "sm" | "md";
}

export declare function Rating(props: RatingProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function Rating({
  sourceName, sourceLogoSrc, displayValue, summary, reviewCount, normalized,
  confidence, locale, size = "md", style
}) {
  const count = reviewCount != null
    ? new Intl.NumberFormat(locale || undefined).format(reviewCount) + (reviewCount === 1 ? " review" : " reviews")
    : null;
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: "var(--space-1)",
      padding: "var(--space-3)", borderRadius: "var(--radius-md)",
      border: "var(--border-width-hairline) solid var(--color-border-default)",
      background: "var(--color-surface-default)", minWidth: 0, ...style
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--color-text-secondary)" }}>
        {sourceLogoSrc
          ? <img src={sourceLogoSrc} alt="" width={14} height={14} style={{ objectFit: "contain" }} />
          : <Icon name="store" size="sm" />}
        <span style={{ font: "var(--text-label-sm)", letterSpacing: "var(--letter-spacing-caps)", textTransform: "uppercase" }}>{sourceName}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <span style={{ font: size === "sm" ? "var(--text-numeric-sm)" : "var(--text-numeric-md)", letterSpacing: "var(--letter-spacing-numeric)", fontVariantNumeric: "tabular-nums lining-nums", color: "var(--color-text-primary)" }}>
          {displayValue}
        </span>
        {summary && <span style={{ font: "var(--text-body-sm)", color: "var(--color-text-secondary)" }}>{summary}</span>}
      </div>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>
        {count && <span className="lw-tabular">{count}</span>}
        {normalized != null && <span>{"LUDWISE normalised " + normalized + "/100"}</span>}
        {confidence && <span>{confidence}</span>}
      </div>
    </div>
  );
}
```

---

## StoreIdentity

Names the retailer behind an offer, rating or link, without letting the retailer's brand take over the page.

```jsx
<StoreIdentity name="Steam" logoSrc="/assets/stores/steam.svg" verified />
<StoreIdentity name="GOG" accentColor="var(--ludwise-store-gog)" showRule verified />
```

**WHEN** several stores appear in one list, **USE** `showRule` with the store's `accentColor` **BECAUSE** a 3px rule is enough to scan by, and anything larger turns the comparison into a collage of competing brands.

Retailer colour rules, in order of strictness:
1. Retailer colour may tint **only** the identity rule and the retailer's own logo.
2. Retailer colour is **never** a background, a button, a text colour or a border on a card.
3. A page must read as LUDWISE with every retailer colour removed. If it does not, the colours are doing too much work.

- No retailer is ever positioned, sized or ordered differently for commercial reasons.

### Prop contract

```ts
import * as React from "react";

export interface StoreIdentityProps {
  /** The retailer's own name, spelled as they spell it. Never translated. */
  name: string;
  /** Path to the retailer's mark. When absent a neutral storefront glyph is
   *  used — LUDWISE never draws an approximation of someone's logo. */
  logoSrc?: string;
  /** The retailer's brand colour, from the --ludwise-store-* primitives.
   *  Only ever applied to the 3px identity rule, never to a surface or text. */
  accentColor?: string;
  size?: "sm" | "md" | "lg";
  /** Adds the 3px retailer identity rule. Use in offer tables where several
   *  stores are stacked; omit everywhere a single store is already obvious. */
  showRule?: boolean;
  /** Marks the retailer as first-party or authorised. */
  verified?: boolean;
}

export declare function StoreIdentity(props: StoreIdentityProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function StoreIdentity({
  name, logoSrc, accentColor, size = "md", showRule = false, verified = false, style
}) {
  const box = size === "sm" ? 18 : size === "lg" ? 28 : 22;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
      paddingLeft: showRule ? "var(--space-2)" : 0,
      borderLeft: showRule ? "var(--border-width-identity) solid " + (accentColor || "var(--color-border-strong)") : "none",
      ...style
    }}>
      <span aria-hidden="true" style={{
        width: box, height: box, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: "var(--radius-xs)", overflow: "hidden",
        background: logoSrc ? "transparent" : "var(--color-background-tertiary)",
        color: "var(--color-text-tertiary)"
      }}>
        {logoSrc ? <img src={logoSrc} alt="" width={box} height={box} style={{ objectFit: "contain" }} /> : <Icon name="store" size={size === "sm" ? 12 : 14} />}
      </span>
      <span style={{ font: size === "sm" ? "var(--text-label-md)" : "var(--text-label-lg)", color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>{name}</span>
      {verified && (
        <span title="Legitimate first-party or authorised retailer" style={{ display: "inline-flex", color: "var(--color-status-success-text)" }}>
          <Icon name="shield-check" size="sm" title="Legitimate first-party or authorised retailer" />
        </span>
      )}
    </span>
  );
}
```

---

