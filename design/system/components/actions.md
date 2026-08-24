# Actions

Reference specifications for `components/actions/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `Button`, `IconButton`.

---

## Button

The committing-action primitive: use it for anything that changes state, submits, or navigates the user out of LUDWISE.

```jsx
<Button variant="primary" iconEnd="arrow-up-right">View on Steam</Button>
<Button variant="secondary" iconStart="bell">Track price</Button>
<Button variant="ghost" size="sm" iconStart="rotate-ccw">Reset filters</Button>
<Button variant="danger">Delete alert</Button>
<Button variant="primary" loading>Saving</Button>
```

- **One `primary` per view.** On a game page that is the store link for the best current offer, nothing else.
- **Loading keeps its label.** Never collapse a loading button to a bare spinner; the width change reflows the row.
- **Labels are verb-first and never truncate.** German runs ~35% longer than English — size by content, never a fixed `width`.
- Amber primary buttons carry near-black text, in both themes. Do not put white text on amber.

### Prop contract

```ts
import * as React from "react";
import type { IconName } from "../foundation/Icon";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * The single action primitive.
 */
export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  /** primary = the one committing action in a view. Never two per view.
   *  secondary = the default. ghost = tertiary/toolbar. danger = destructive only. */
  variant?: ButtonVariant;
  /** sm 32px is permitted only inside compact table rows and toolbars. */
  size?: ButtonSize;
  iconStart?: IconName;
  iconEnd?: IconName;
  /** Replaces iconStart with a spinner and blocks interaction. Keep the label. */
  loading?: boolean;
  disabled?: boolean;
  /** Mobile action bars and drawer footers only. */
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const buttonSizeMap = {
  sm: { height: 32, padX: "var(--space-3)", font: "var(--text-label-md)", gap: "var(--space-2)", icon: 14 },
  md: { height: 40, padX: "var(--space-4)", font: "var(--text-label-lg)", gap: "var(--space-2)", icon: 16 },
  lg: { height: 48, padX: "var(--space-5)", font: "var(--text-label-lg)", gap: "var(--space-2)", icon: 18 }
};

const buttonVariantMap = {
  primary: {
    background: "var(--color-action-primary)", color: "var(--color-action-primary-text)",
    borderColor: "transparent",
    hoverBackground: "var(--color-action-primary-hover)", activeBackground: "var(--color-action-primary-active)"
  },
  secondary: {
    background: "var(--color-surface-interactive)", color: "var(--color-action-secondary-text)",
    borderColor: "var(--color-border-default)",
    hoverBackground: "var(--color-surface-interactive-hover)", activeBackground: "var(--color-surface-interactive-active)"
  },
  ghost: {
    background: "transparent", color: "var(--color-action-secondary-text)",
    borderColor: "transparent",
    hoverBackground: "var(--color-surface-interactive-hover)", activeBackground: "var(--color-surface-interactive-active)"
  },
  danger: {
    background: "var(--color-action-danger)", color: "var(--color-action-danger-text)",
    borderColor: "transparent",
    hoverBackground: "var(--color-action-danger-hover)", activeBackground: "var(--color-action-danger-hover)"
  }
};

export function Button({
  variant = "secondary", size = "md", iconStart, iconEnd, loading = false,
  disabled = false, fullWidth = false, children, style, onClick, type = "button", ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const s = buttonSizeMap[size] || buttonSizeMap.md;
  const v = buttonVariantMap[variant] || buttonVariantMap.secondary;
  const inert = disabled || loading;

  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: s.gap, minHeight: s.height, padding: `0 ${s.padX}`,
    width: fullWidth ? "100%" : undefined,
    font: s.font, letterSpacing: "var(--letter-spacing-label)",
    borderRadius: "var(--radius-button)",
    border: `var(--border-width-hairline) solid ${v.borderColor}`,
    background: inert ? "var(--color-action-disabled-surface)" : (active ? v.activeBackground : hover ? v.hoverBackground : v.background),
    color: inert ? "var(--color-action-disabled-text)" : v.color,
    cursor: inert ? "not-allowed" : "pointer",
    transition: "var(--motion-transition-color)",
    textDecoration: "none", whiteSpace: "nowrap", position: "relative",
    ...style
  };

  return (
    <button
      type={type} disabled={inert} aria-busy={loading || undefined} style={base}
      onClick={inert ? undefined : onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)} onMouseUp={() => setActive(false)}
      {...rest}
    >
      {loading ? (
        <span style={{ display: "inline-flex", animation: "lw-spin 900ms linear infinite" }}>
          <Icon name="loader-circle" size={s.icon} />
        </span>
      ) : iconStart ? <Icon name={iconStart} size={s.icon} /> : null}
      <span>{children}</span>
      {!loading && iconEnd ? <Icon name={iconEnd} size={s.icon} /> : null}
      <style>{"@keyframes lw-spin{to{transform:rotate(360deg)}}"}</style>
    </button>
  );
}
```

---

## IconButton

A square, label-less button for toolbar and header actions where the glyph is unambiguous.

```jsx
<IconButton icon="moon" label="Switch to dark theme" />
<IconButton icon="grid-2x2" label="Grid view" pressed />
<IconButton icon="x" label="Close" size="sm" />
```

- `label` is mandatory and is the accessible name.
- Use it only for actions a gamer recognises without reading: close, menu, theme, view mode, wishlist. Anything else takes a `Button` with text.
- On touch surfaces use `size="lg"` (44px) — `sm` is below the LUDWISE touch minimum.

### Prop contract

```ts
import * as React from "react";
import type { IconName } from "../foundation/Icon";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required. Becomes both aria-label and the tooltip. An icon button with no
   *  label is a defect — screen readers announce nothing. */
  label: string;
  variant?: "ghost" | "secondary" | "primary";
  /** sm 32 desktop-toolbar only; md 40 default; lg 44 for touch surfaces. */
  size?: "sm" | "md" | "lg";
  /** Toggle buttons only (theme switch, view density, wishlist). */
  pressed?: boolean;
  disabled?: boolean;
}

export declare function IconButton(props: IconButtonProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const iconButtonSizeMap = { sm: 32, md: 40, lg: 44 };
const iconButtonGlyphMap = { sm: 14, md: 16, lg: 20 };

export function IconButton({
  icon, label, variant = "ghost", size = "md", disabled = false, pressed,
  style, onClick, ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const box = iconButtonSizeMap[size] || 40;
  const filled = variant === "primary";
  const outlined = variant === "secondary";

  return (
    <button
      type="button" aria-label={label} title={label} disabled={disabled}
      aria-pressed={pressed} onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: box, height: box, padding: 0,
        borderRadius: "var(--radius-button)",
        border: `var(--border-width-hairline) solid ${outlined ? "var(--color-border-default)" : "transparent"}`,
        background: disabled ? "transparent"
          : filled ? "var(--color-action-primary)"
          : pressed ? "var(--color-surface-selected)"
          : hover ? "var(--color-surface-interactive-hover)" : "transparent",
        color: disabled ? "var(--color-action-disabled-text)"
          : filled ? "var(--color-action-primary-text)" : "var(--color-text-secondary)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "var(--motion-transition-color)",
        ...style
      }}
      {...rest}
    >
      <Icon name={icon} size={iconButtonGlyphMap[size] || 16} />
    </button>
  );
}
```

---

