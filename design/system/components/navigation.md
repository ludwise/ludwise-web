# Navigation

Reference specifications for `components/navigation/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `AppHeader`, `Breadcrumbs`, `Pagination`, `Tabs`.

---

## AppHeader

The global header: wordmark, primary destinations, search, market, theme, account. Sticky, 60px, one hairline bottom border and no shadow.

```jsx
<AppHeader
  activeId="sales"
  items={[{ id: "games", label: "Games" }, { id: "sales", label: "Sales" }, { id: "stores", label: "Stores" }]}
  onNavigate={setRoute}
  searchValue={q} onSearchChange={setQ} marketLabel="EUR · Eurozone" theme={theme} onThemeToggle={toggle}
/>
```

- Primary destinations stay at three to five. Everything else lives one level down.
- The market control is always visible. A user must be able to see which market's prices they are reading without opening a menu.
- **The collapse is built in.** Below `--breakpoint-lg` (1024) the header switches shape by itself, via `useIsCompactHeader`: the nav moves behind the menu button into a panel below the bar, search takes its own full-width row, the market control moves into the menu, and the theme and account buttons grow to the 44px touch size. The wordmark, theme and account controls stay in the bar at every width. Pass `compact` only to force the layout in a test or a specimen.

### Prop contract

```ts
import * as React from "react";

export interface NavItem { id: string; label: string; href?: string }

export interface AppHeaderProps {
  items: NavItem[];
  activeId?: string;
  /** Called with the item id when a nav link is clicked; the default anchor
   *  navigation is prevented. Omit for a real multi-page app, where the href
   *  should navigate normally. */
  onNavigate?: (id: string) => void;
  searchValue?: string;
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchClear?: () => void;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
  /** Current commercial market and currency, e.g. "EUR · Eurozone". Distinct
   *  from UI language — never conflate the two. */
  marketLabel?: string;
  /** Called with the new open state when the compact menu button is pressed.
   *  The header manages its own menu panel; this is only for host-side effects
   *  such as locking body scroll. */
  onMenu?: (open: boolean) => void;
  authed?: boolean;
  /** Forces the layout. Omit in product code — the header observes
   *  --breakpoint-lg (1024) itself. Supply it only in tests and specimens. */
  compact?: boolean;
}

/** Returns true below the given breakpoint (default 1024). Exported so a host
 *  can keep its own layout in step with the header's. */
export declare function useIsCompactHeader(breakpoint?: number): boolean;

export declare function AppHeader(props: AppHeaderProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Wordmark } from "../foundation/Wordmark.jsx";
import { SearchField } from "../forms/SearchField.jsx";
import { IconButton } from "../actions/IconButton.jsx";
import { Button } from "../actions/Button.jsx";

/* The header is the one component that must change shape, not just size, at a
   breakpoint. Inline styles cannot express a media query, so the breakpoint is
   observed in JS against --breakpoint-lg (1024) and drives a layout switch:

     >= lg   one row: wordmark · nav · search · market/theme/account
     <  lg   two rows: wordmark · market/theme/account/menu
                       full-width search
             nav collapses behind the menu button */

export function useIsCompactHeader(breakpoint = 1024) {
  const [compact, setCompact] = React.useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width:" + (breakpoint - 0.02) + "px)");
    const on = e => setCompact(e.matches);
    setCompact(mq.matches);
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on); };
  }, [breakpoint]);
  return compact;
}

export function AppHeader({
  items = [], activeId, onNavigate, searchValue, onSearchChange, onSearchClear,
  theme = "light", onThemeToggle, marketLabel, onMenu, authed = false, compact, style
}) {
  const auto = useIsCompactHeader();
  const isCompact = compact != null ? compact : auto;
  const [menuOpen, setMenuOpen] = React.useState(false);

  const navLinks = (
    <nav aria-label="Primary" style={{
      display: "flex", gap: "var(--space-1)", minWidth: 0,
      flexDirection: isCompact ? "column" : "row",
      alignItems: isCompact ? "stretch" : "center"
    }}>
      {items.map(it => {
        const active = it.id === activeId;
        return (
          <a key={it.id} href={it.href || "#"} aria-current={active ? "page" : undefined}
            onClick={onNavigate ? e => { e.preventDefault(); onNavigate(it.id); setMenuOpen(false); } : undefined}
            style={{
              display: "inline-flex", alignItems: "center",
              height: isCompact ? "var(--target-min-touch)" : 36,
              padding: "0 var(--space-3)",
              borderRadius: "var(--radius-sm)", textDecoration: "none",
              font: active ? "var(--text-label-lg)" : "var(--text-body-md)",
              fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-regular)",
              color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              background: active ? "var(--color-background-tertiary)" : "transparent",
              whiteSpace: "nowrap"
            }}>{it.label}</a>
        );
      })}
    </nav>
  );

  const marketButton = marketLabel && (
    <button type="button" style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-1)", height: 36,
      padding: "0 var(--space-3)", flex: "none",
      border: "var(--border-width-hairline) solid var(--color-border-default)", borderRadius: "var(--radius-sm)",
      background: "transparent", color: "var(--color-text-secondary)", font: "var(--text-label-md)",
      cursor: "pointer", whiteSpace: "nowrap"
    }}>{marketLabel}</button>
  );

  const utilities = (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", flex: "none" }}>
      {!isCompact && marketButton}
      <IconButton
        icon={theme === "dark" ? "sun" : "moon"}
        label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        size={isCompact ? "lg" : "md"} onClick={onThemeToggle} />
      {authed
        ? <IconButton icon="user" label="Account" size={isCompact ? "lg" : "md"} />
        : <Button variant="secondary" size="sm">Sign in</Button>}
      {isCompact && (
        <IconButton icon={menuOpen ? "x" : "menu"} label={menuOpen ? "Close menu" : "Menu"} size="lg"
          pressed={menuOpen}
          onClick={() => { setMenuOpen(!menuOpen); onMenu && onMenu(!menuOpen); }} />
      )}
    </div>
  );

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "var(--color-background-primary)",
      borderBottom: "var(--border-width-hairline) solid var(--color-border-default)", ...style
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: isCompact ? "var(--space-3)" : "var(--space-5)",
        height: "var(--layout-header-height)", maxWidth: "var(--layout-max-width-wide)",
        margin: "0 auto",
        padding: isCompact ? "0 var(--layout-gutter-mobile)" : "0 var(--layout-gutter-desktop)"
      }}>
        <div style={{ flex: "none" }}><Wordmark size="md" href="#" /></div>
        {!isCompact && navLinks}
        {!isCompact && (
          <div style={{ flex: "1 1 0", minWidth: 0, maxWidth: 420, marginLeft: "auto" }}>
            <SearchField value={searchValue} onChange={onSearchChange} onClear={onSearchClear} size="sm" />
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", minWidth: 0 }}>{utilities}</div>
      </div>

      {isCompact && (
        <div style={{
          padding: "0 var(--layout-gutter-mobile) var(--space-3)",
          maxWidth: "var(--layout-max-width-wide)", margin: "0 auto"
        }}>
          <SearchField value={searchValue} onChange={onSearchChange} onClear={onSearchClear} size="md" />
        </div>
      )}

      {isCompact && menuOpen && (
        <div style={{
          padding: "var(--space-2) var(--layout-gutter-mobile) var(--space-4)",
          borderTop: "var(--border-width-hairline) solid var(--color-border-subtle)",
          maxWidth: "var(--layout-max-width-wide)", margin: "0 auto"
        }}>
          {navLinks}
          {marketLabel && <div style={{ marginTop: "var(--space-3)" }}>{marketButton}</div>}
        </div>
      )}
    </header>
  );
}
```

---

## Breadcrumbs

Shows where a page sits in the LUDWISE hierarchy. Present on game detail and any page more than one level below a top-level destination.

```jsx
<Breadcrumbs items={[{ label: "Games", href: "/games" }, { label: "RPG", href: "/games/rpg" }, { label: "Cyberpunk 2077" }]} />
```

- The last item is the current page: not a link, marked `aria-current="page"`.
- Breadcrumbs mirror the URL structure. They never show a store as a level — LUDWISE's hierarchy is its own, not a storefront's.

### Prop contract

```ts
import * as React from "react";

export interface BreadcrumbItem { label: string; href?: string }

export interface BreadcrumbsProps { items: BreadcrumbItem[] }

export declare function Breadcrumbs(props: BreadcrumbsProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function Breadcrumbs({ items = [], style }) {
  return (
    <nav aria-label="Breadcrumb" style={style}>
      <ol style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--space-1)", listStyle: "none" }}>
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", minWidth: 0 }}>
              {last || !it.href
                ? <span aria-current={last ? "page" : undefined} style={{ font: "var(--text-body-sm)", color: "var(--color-text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
                : <a href={it.href} style={{ font: "var(--text-body-sm)", color: "var(--color-text-secondary)", textDecoration: "none" }}>{it.label}</a>}
              {!last && <span aria-hidden="true" style={{ color: "var(--color-text-tertiary)", display: "inline-flex" }}><Icon name="chevron-right" size="xs" /></span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

---

## Pagination

Page-by-page navigation for result sets. LUDWISE prefers pagination to infinite scroll on indexable pages, because a crawler and a keyboard user both need a URL per page.

```jsx
<Pagination page={2} pageCount={61} onChange={setPage} totalLabel="49–96 of 2,914 games" />
```

- Prefer `totalLabel` with the real range and total. It answers "how much is left" better than a page number.
- Both controls carry text, not bare chevrons — chevron-only pagination fails at 200% zoom.

### Prop contract

```ts
import * as React from "react";

export interface PaginationProps {
  page: number;
  pageCount: number;
  onChange?: (page: number) => void;
  /** Overrides the default text, e.g. "1–48 of 2,914 games". Preferred, because
   *  the result count is more useful than the page count. */
  totalLabel?: string;
}

export declare function Pagination(props: PaginationProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function Pagination({ page = 1, pageCount = 1, onChange, totalLabel, style }) {
  const go = p => onChange && onChange(Math.min(Math.max(1, p), pageCount));
  const btn = (disabled) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "var(--space-1)",
    minHeight: "var(--target-min)", padding: "0 var(--space-3)",
    border: "var(--border-width-hairline) solid var(--color-border-default)",
    borderRadius: "var(--radius-button)", background: "var(--color-surface-default)",
    color: disabled ? "var(--color-text-disabled)" : "var(--color-text-primary)",
    font: "var(--text-label-md)", cursor: disabled ? "not-allowed" : "pointer"
  });
  return (
    <nav aria-label="Pagination" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap", ...style }}>
      <span className="lw-tabular" style={{ font: "var(--text-body-sm)", color: "var(--color-text-secondary)" }}>
        {totalLabel || "Page " + page + " of " + pageCount}
      </span>
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} style={btn(page <= 1)}>
          <Icon name="chevron-left" size="sm" />Previous
        </button>
        <button type="button" onClick={() => go(page + 1)} disabled={page >= pageCount} style={btn(page >= pageCount)}>
          Next<Icon name="chevron-right" size="sm" />
        </button>
      </div>
    </nav>
  );
}
```

---

## Tabs

Switches between peer views of the same subject: Offers / Price history / Editions / Ratings on a game page.

```jsx
<Tabs activeId={tab} onChange={setTab} tabs={[
  { id: "offers", label: "Offers", count: 4 },
  { id: "history", label: "Price history" },
  { id: "ratings", label: "Ratings", count: 2 }
]} />
```

- Active state is a 2px amber underline **and** a weight change, so it survives greyscale.
- Tabs never navigate to a different subject. Use the header nav for that.
- On narrow viewports the row scrolls horizontally; it never wraps to two lines.

### Prop contract

```ts
import * as React from "react";

export interface TabItem { id: string; label: string; count?: number; disabled?: boolean }

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange?: (id: string) => void;
  size?: "sm" | "md";
}

export declare function Tabs(props: TabsProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";

export function Tabs({ tabs = [], activeId, onChange, size = "md", style }) {
  return (
    <div role="tablist" style={{
      display: "flex", gap: "var(--space-1)", borderBottom: "var(--border-width-hairline) solid var(--color-border-default)",
      overflowX: "auto", ...style
    }}>
      {tabs.map(t => {
        const active = t.id === activeId;
        return (
          <button key={t.id} role="tab" type="button" aria-selected={active} disabled={t.disabled}
            onClick={() => onChange && onChange(t.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
              minHeight: size === "sm" ? 36 : "var(--target-min)", padding: "0 var(--space-3)",
              border: "none", borderBottom: "var(--border-width-strong) solid " + (active ? "var(--color-accent-primary)" : "transparent"),
              background: "transparent", cursor: t.disabled ? "not-allowed" : "pointer",
              font: active ? "var(--text-label-lg)" : "var(--text-body-md)",
              fontWeight: active ? "var(--font-weight-semibold)" : "var(--font-weight-regular)",
              color: t.disabled ? "var(--color-text-disabled)" : active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              marginBottom: -1, whiteSpace: "nowrap", transition: "var(--motion-transition-color)"
            }}>
            {t.label}
            {t.count != null && <span className="lw-tabular" style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
```

---

