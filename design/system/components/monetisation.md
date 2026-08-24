# Monetisation

Reference specifications for `components/monetisation/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `AffiliateDisclosure`, `PromoSlot`.

---

## AffiliateDisclosure

The standing affiliate statement. Wherever LUDWISE may earn a commission, this is the wording.

```jsx
<AffiliateDisclosure />
<AffiliateDisclosure variant="short" />
```

The three clauses are fixed and must all appear in the `inline` variant: **LUDWISE may earn a commission**, **your price does not change**, **commission never affects ranking**. Do not paraphrase, shorten or split them.

- Quiet by design: caption size, tertiary colour. It is a disclosure, not a trust badge.
- Placed at the foot of the offer table, not floating over the page and not inside a modal the user has to open.

### Prop contract

```ts
import * as React from "react";

export interface AffiliateDisclosureProps {
  /** inline = the full three-clause statement, for the foot of an offer table
   *  or a game page. short = the one-line form, inside an OfferRow. */
  variant?: "inline" | "short";
}

export declare function AffiliateDisclosure(props: AffiliateDisclosureProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function AffiliateDisclosure({ variant = "inline", style }) {
  const text = "Some store links are affiliate links. LUDWISE may earn a commission. Your price does not change, and commission never affects ranking or which offers are shown.";
  if (variant === "short") {
    return <span style={{ font: "var(--text-caption)", color: "var(--color-promo-label)", ...style }}>Affiliate link · price unchanged · does not affect ranking</span>;
  }
  return (
    <p style={{
      display: "flex", gap: "var(--space-2)", alignItems: "flex-start",
      font: "var(--text-caption)", color: "var(--color-text-tertiary)",
      margin: 0, maxWidth: "62ch", textWrap: "pretty", ...style
    }}>
      <span style={{ marginTop: 1, flex: "none" }}><Icon name="info" size="sm" /></span>
      {text}
    </p>
  );
}
```

---

## PromoSlot

The only container in which advertising or sponsored content may appear.

```jsx
<PromoSlot height={250}>{adSlot}</PromoSlot>
```

Non-negotiable rules, all traceable to PRODUCT.md §72–§81:
1. A promo slot is **visually outside** the product surface ramp: a dashed border on `--color-promo-surface`, never a card, never a table row, never a game card.
2. It carries a permanent uppercase disclosure label. Never "Featured", "Recommended", "Partner" or any wording that implies editorial or ranking relevance.
3. It **never** appears inside an offer table, between comparison rows, or between a price and its store link.
4. It never contains anything shaped like a LUDWISE button, price or store row.
5. `height` reserves space up front. When the user has an ad-free entitlement the component is not rendered at all, and the surrounding layout must close up cleanly — never leave the reserved gap behind.

### Prop contract

```ts
import * as React from "react";

export interface PromoSlotProps {
  /** The disclosure label. "Advertisement" or "Sponsored". Never softened to
   *  "Partner", "Featured" or "Recommended". */
  label?: string;
  /** Reserved height. Set it to the ad unit's real height so an absent ad
   *  causes no layout shift and no dead whitespace. */
  height?: number;
  children?: React.ReactNode;
}

export declare function PromoSlot(props: PromoSlotProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";

export function PromoSlot({ label = "Advertisement", height = 250, children, style }) {
  return (
    <aside aria-label={label} style={{
      display: "flex", flexDirection: "column", gap: "var(--space-2)",
      padding: "var(--space-3)", background: "var(--color-promo-surface)",
      border: "var(--border-width-hairline) dashed var(--color-promo-border)",
      borderRadius: "var(--radius-md)", ...style
    }}>
      <span style={{
        font: "var(--text-label-sm)", letterSpacing: "var(--letter-spacing-caps)",
        textTransform: "uppercase", color: "var(--color-promo-label)"
      }}>{label}</span>
      <div style={{ minHeight: height, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-text-tertiary)", font: "var(--text-caption)" }}>
        {children}
      </div>
    </aside>
  );
}
```

---

