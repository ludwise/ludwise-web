# Data display

Reference specifications for `components/display/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `Badge`, `Chip`, `DataTable`, `KeyValueList`.

---

## Badge

A non-interactive status marker: availability, offer state, entitlement, provider health.

```jsx
<Badge tone="neutral">Standard Edition</Badge>
<Badge tone="warning">Sale ends in 2 days</Badge>
<Badge tone="danger">Offer expired</Badge>
<Badge tone="accent">Early Supporter</Badge>
```

- Semantic tones ship a glyph by default, so meaning survives without colour.
- Badges are not buttons and never carry `onClick`. If it is clickable it is a `Chip`.
- "Sale ends in 2 days" is legitimate only when the store publishes an end time. A countdown LUDWISE invented is a dark pattern.

### Prop contract

```ts
import * as React from "react";
import type { IconName } from "../foundation/Icon";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

export interface BadgeProps {
  tone?: BadgeTone;
  /** Overrides the tone's default glyph. Pass null to remove it — only valid
   *  when the badge text alone is unambiguous. */
  icon?: IconName | null;
  size?: "sm" | "md";
  children: React.ReactNode;
}

export declare function Badge(props: BadgeProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const badgeToneMap = {
  neutral: { bg: "var(--color-status-neutral-surface)", fg: "var(--color-status-neutral-text)", bd: "var(--color-status-neutral-border)", icon: null },
  accent: { bg: "var(--color-accent-quiet)", fg: "var(--color-accent-text)", bd: "var(--color-accent-border)", icon: null },
  success: { bg: "var(--color-status-success-surface)", fg: "var(--color-status-success-text)", bd: "var(--color-status-success-border)", icon: "circle-check" },
  warning: { bg: "var(--color-status-warning-surface)", fg: "var(--color-status-warning-text)", bd: "var(--color-status-warning-border)", icon: "triangle-alert" },
  danger: { bg: "var(--color-status-danger-surface)", fg: "var(--color-status-danger-text)", bd: "var(--color-status-danger-border)", icon: "circle-alert" },
  info: { bg: "var(--color-status-info-surface)", fg: "var(--color-status-info-text)", bd: "var(--color-status-info-border)", icon: "info" }
};

export function Badge({ tone = "neutral", icon, children, size = "md", style }) {
  const t = badgeToneMap[tone] || badgeToneMap.neutral;
  const glyph = icon === null ? null : (icon || t.icon);
  const sm = size === "sm";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-1)",
      height: sm ? 20 : 24, padding: "0 var(--space-2)",
      background: t.bg, color: t.fg,
      border: "var(--border-width-hairline) solid " + t.bd,
      borderRadius: "var(--radius-badge)",
      font: sm ? "var(--text-label-sm)" : "var(--text-label-md)",
      letterSpacing: "var(--letter-spacing-label)", whiteSpace: "nowrap", ...style
    }}>
      {glyph && <Icon name={glyph} size="xs" />}
      {children}
    </span>
  );
}
```

---

## Chip

The interactive filter token: active filters above a result set, and quick toggles beside a search field.

```jsx
<Chip label="Discounted" selected onClick={toggle} />
<Chip label="GOG" onRemove={() => drop("gog")} />
<Chip label="RPG" count={412} onClick={toggle} />
```

- Every applied filter appears as a removable chip above the results. A filter the user cannot see is a filter they cannot undo.
- Chips are the only pill-shaped element in LUDWISE. Nothing else uses `--radius-full`.
- Pair a chip row with a single `Button variant="ghost"` labelled "Reset filters" — never an × on the row itself.

### Prop contract

```ts
import * as React from "react";

export interface ChipProps {
  label: string;
  /** Matching result count. Tabular, tertiary. */
  count?: number | string;
  selected?: boolean;
  /** Present = the chip is a removable active filter and grows an × button. */
  onRemove?: () => void;
  /** Present = the chip is a toggle. */
  onClick?: () => void;
  disabled?: boolean;
}

export declare function Chip(props: ChipProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function Chip({ label, count, selected = false, onRemove, onClick, disabled, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const interactive = !!(onClick || onRemove);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "var(--space-2)",
      height: 32, padding: onRemove ? "0 var(--space-1) 0 var(--space-3)" : "0 var(--space-3)",
      borderRadius: "var(--radius-chip)",
      background: selected ? "var(--color-surface-selected)" : hover && interactive ? "var(--color-surface-interactive-hover)" : "var(--color-surface-default)",
      border: "var(--border-width-hairline) solid " + (selected ? "var(--color-accent-border)" : "var(--color-border-default)"),
      color: disabled ? "var(--color-text-disabled)" : "var(--color-text-primary)",
      font: "var(--text-label-md)", letterSpacing: "var(--letter-spacing-label)",
      transition: "var(--motion-transition-color)", ...style
    }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {onClick ? (
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
          style={{ border: "none", background: "transparent", padding: 0, font: "inherit", color: "inherit", cursor: disabled ? "not-allowed" : "pointer" }} {...rest}>
          {label}
        </button>
      ) : <span {...rest}>{label}</span>}
      {count != null && <span className="lw-tabular" style={{ color: "var(--color-text-tertiary)" }}>{count}</span>}
      {onRemove && (
        <button type="button" aria-label={"Remove filter " + label} onClick={onRemove}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
            border: "none", background: "transparent", color: "var(--color-text-tertiary)", cursor: "pointer", borderRadius: "var(--radius-full)" }}>
          <Icon name="x" size="sm" />
        </button>
      )}
    </span>
  );
}
```

---

## DataTable

The tabular primitive: price history, editions, store offers, B2B and developer surfaces.

```jsx
<DataTable
  caption="Observed price changes for Cyberpunk 2077 on Steam"
  columns={[
    { key: "date", header: "Observed" },
    { key: "store", header: "Store" },
    { key: "price", header: "Price", align: "end", sortable: true },
    { key: "change", header: "Change", align: "end" }
  ]}
  rows={observations}
  sortKey="price" sortDirection="asc" onSort={setSort}
/>
```

**WHEN** refreshing an already-populated table, **USE** `loading` **BECAUSE** it dims the existing rows in place; replacing them with skeletons throws away context the user was reading.

- Numeric columns are `align="end"` and tabular, always. Text columns are left-aligned, always.
- `aria-sort` is set on the active header, and the sort glyph changes shape, so sort state is not colour-only.
- Below 1024px the table scrolls horizontally inside its own border. It does not reflow into cards — a price comparison read as a stack of cards loses the comparison.
- Do not avoid tables because cards look more modern. Offers, editions and history are tabular data.

### Prop contract

```ts
import * as React from "react";

export interface DataTableColumn {
  key: string;
  header: React.ReactNode;
  /** "end" right-aligns AND applies tabular figures. Every numeric column. */
  align?: "start" | "end";
  sortable?: boolean;
  width?: string;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  rows: Array<Record<string, React.ReactNode> & { id?: string }>;
  /** Screen-reader caption. Required — a table with no caption is unnavigable. */
  caption?: string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (key: string) => void;
  density?: "comfortable" | "compact";
  /** Dims the body to 55% and keeps the previous rows in place during refresh. */
  loading?: boolean;
  /** An <EmptyState>, rendered in place of the table when rows is empty. */
  emptyState?: React.ReactNode;
}

export declare function DataTable(props: DataTableProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function DataTable({
  columns = [], rows = [], caption, sortKey, sortDirection = "asc", onSort,
  density = "comfortable", loading = false, emptyState, style
}) {
  const padY = density === "compact" ? "var(--density-cell-padding-y-compact)" : "var(--density-cell-padding-y-comfortable)";

  if (!loading && rows.length === 0 && emptyState) {
    return <div style={{ border: "var(--border-width-hairline) solid var(--color-border-default)", borderRadius: "var(--radius-card)", ...style }}>{emptyState}</div>;
  }

  return (
    <div style={{ overflowX: "auto", border: "var(--border-width-hairline) solid var(--color-border-default)", borderRadius: "var(--radius-card)", background: "var(--color-surface-default)", ...style }}>
      <table style={{ width: "100%", minWidth: 560 }}>
        {caption && <caption className="lw-visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map(col => {
              const active = sortKey === col.key;
              const numeric = col.align === "end";
              return (
                <th key={col.key} scope="col"
                  aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : col.sortable ? "none" : undefined}
                  style={{
                    textAlign: numeric ? "right" : "left", padding: padY + " var(--density-cell-padding-x)",
                    font: "var(--text-label-sm)", letterSpacing: "var(--letter-spacing-caps)", textTransform: "uppercase",
                    color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                    borderBottom: "var(--border-width-hairline) solid var(--color-border-default)",
                    background: "var(--color-surface-sunken)", whiteSpace: "nowrap", width: col.width
                  }}>
                  {col.sortable ? (
                    <button type="button" onClick={() => onSort && onSort(col.key)}
                      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-1)", flexDirection: numeric ? "row-reverse" : "row",
                        border: "none", background: "transparent", padding: 0, font: "inherit", letterSpacing: "inherit",
                        textTransform: "inherit", color: "inherit", cursor: "pointer" }}>
                      {col.header}
                      <Icon name={active ? (sortDirection === "asc" ? "arrow-up" : "arrow-down") : "arrow-up-down"} size="xs" />
                    </button>
                  ) : col.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody style={{ opacity: loading ? 0.55 : 1, transition: "opacity var(--motion-duration-normal) var(--motion-easing-standard)" }}>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map(col => (
                <td key={col.key} style={{
                  textAlign: col.align === "end" ? "right" : "left",
                  padding: padY + " var(--density-cell-padding-x)",
                  font: "var(--text-body-sm)", color: "var(--color-text-primary)",
                  fontVariantNumeric: col.align === "end" ? "tabular-nums lining-nums" : undefined,
                  borderBottom: "var(--border-width-hairline) solid var(--color-border-subtle)",
                  verticalAlign: "middle"
                }}>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## KeyValueList

Canonical game metadata: developer, publisher, release date, genres, operating systems.

```jsx
<KeyValueList columns={2} items={[
  { label: "Developer", value: "CD PROJEKT RED" },
  { label: "Publisher", value: "CD PROJEKT RED" },
  { label: "Released", value: "10 Dec 2020" },
  { label: "Critic score", value: null }
]} />
```

**WHEN** a provider does not supply a field, **USE** `value: null` **BECAUSE** "Not provided" is a true statement about provider coverage, whereas `0` or `—` reads as a measured value.

- Labels are uppercase label-sm; values are body-md. The label never competes with the value.
- Two columns from 768px, one below. Three columns only on a detail page above 1280px.

### Prop contract

```ts
import * as React from "react";

export interface KeyValueItem {
  label: string;
  /** null renders the literal "Not provided". Never pass 0, "-" or "N/A" to
   *  stand in for an unknown value. */
  value: React.ReactNode | null;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  columns?: 1 | 2 | 3;
  density?: "comfortable" | "compact";
}

export declare function KeyValueList(props: KeyValueListProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";

export function KeyValueList({ items = [], columns = 1, density = "comfortable", style }) {
  const gap = density === "compact" ? "var(--space-2)" : "var(--space-3)";
  return (
    <dl style={{
      display: "grid",
      gridTemplateColumns: "repeat(" + columns + ",minmax(0,1fr))",
      columnGap: "var(--space-8)", rowGap: gap, margin: 0, ...style
    }}>
      {items.map(it => (
        <div key={it.label} style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0,
          borderTop: "var(--border-width-hairline) solid var(--color-border-subtle)", paddingTop: gap }}>
          <dt style={{ font: "var(--text-label-sm)", letterSpacing: "var(--letter-spacing-caps)", textTransform: "uppercase", color: "var(--color-text-tertiary)" }}>{it.label}</dt>
          <dd style={{ margin: 0, font: "var(--text-body-md)", color: it.value == null ? "var(--color-text-tertiary)" : "var(--color-text-primary)", textWrap: "pretty" }}>
            {it.value == null ? "Not provided" : it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
```

---

