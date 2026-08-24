# Feedback

Reference specifications for `components/feedback/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `Banner`, `EmptyState`, `InlineMessage`, `Skeleton`, `Toast`.

---

## Banner

A full-width message about the whole application, pinned directly under the header.

```jsx
<Banner tone="warning">Price synchronisation is delayed. Some prices may be older than usual.</Banner>
```

- At most one banner at a time, and only for conditions that affect every page.
- Never a banner for marketing, Premium upsell or a cookie prompt dressed as a system message.

### Prop contract

```ts
import * as React from "react";

export interface BannerProps {
  tone?: "info" | "warning" | "danger";
  children: React.ReactNode;
  action?: React.ReactNode;
  /** Omit for conditions the user cannot dismiss, e.g. an active incident. */
  onDismiss?: () => void;
}

export declare function Banner(props: BannerProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";
import { IconButton } from "../actions/IconButton.jsx";

export function Banner({ tone = "info", children, action, onDismiss, style }) {
  const map = {
    info: { icon: "info", fg: "var(--color-status-info-text)", bg: "var(--color-status-info-surface)", bd: "var(--color-status-info-border)" },
    warning: { icon: "triangle-alert", fg: "var(--color-status-warning-text)", bg: "var(--color-status-warning-surface)", bd: "var(--color-status-warning-border)" },
    danger: { icon: "circle-alert", fg: "var(--color-status-danger-text)", bg: "var(--color-status-danger-surface)", bd: "var(--color-status-danger-border)" }
  };
  const t = map[tone] || map.info;
  return (
    <div role={tone === "danger" ? "alert" : "status"} style={{
      display: "flex", alignItems: "center", gap: "var(--space-3)",
      padding: "var(--space-3) var(--space-4)", background: t.bg,
      borderBottom: "var(--border-width-hairline) solid " + t.bd, width: "100%", ...style
    }}>
      <span style={{ color: t.fg, display: "inline-flex" }}><Icon name={t.icon} size="md" /></span>
      <div style={{ flex: 1, minWidth: 0, font: "var(--text-body-sm)", color: "var(--color-text-primary)" }}>{children}</div>
      {action}
      {onDismiss && <IconButton icon="x" label="Dismiss" size="sm" onClick={onDismiss} />}
    </div>
  );
}
```

---

## EmptyState

Explains an empty region. In LUDWISE emptiness is usually a legitimate data state, not a failure.

```jsx
<EmptyState icon="funnel" title="No games match these filters"
  action={<Button variant="secondary" iconStart="rotate-ccw">Reset filters</Button>}>
  Discount over 70% and price under €5 exclude each other in the current catalogue.
</EmptyState>

<EmptyState icon="chart-line" title="No price history yet">
  LUDWISE started observing this game on 4 August 2026. A chart appears once there are at least seven observations.
</EmptyState>
```

Every empty state answers three questions in order: **what happened**, **why the space is empty**, **what to do next**.

- One Lucide glyph at 24px. No illustrations — LUDWISE has no illustration language and a decorative drawing here adds nothing a sentence does not.
- Never blame the user, and never use "Oops".

### Prop contract

```ts
import * as React from "react";
import type { IconName } from "../foundation/Icon";

export interface EmptyStateProps {
  icon?: IconName;
  /** States the fact, e.g. "No games match these filters". */
  title: string;
  /** Explains why the space is empty and what changes it. */
  children: React.ReactNode;
  /** The action that resolves the emptiness. */
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  compact?: boolean;
}

export declare function EmptyState(props: EmptyStateProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function EmptyState({ icon = "search", title, children, action, secondaryAction, compact = false, style }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
      gap: "var(--space-3)", padding: compact ? "var(--space-8) var(--space-4)" : "var(--space-16) var(--space-6)",
      maxWidth: 480, margin: "0 auto", ...style
    }}>
      <span style={{ color: "var(--color-text-tertiary)" }}><Icon name={icon} size="xl" /></span>
      <span style={{ font: "var(--text-heading-sm)", letterSpacing: "var(--letter-spacing-heading)", color: "var(--color-text-primary)" }}>{title}</span>
      <span style={{ font: "var(--text-body-md)", color: "var(--color-text-secondary)", textWrap: "pretty" }}>{children}</span>
      {(action || secondaryAction) && (
        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap", justifyContent: "center" }}>
          {action}{secondaryAction}
        </div>
      )}
    </div>
  );
}
```

---

## InlineMessage

A message bound to the region it describes: a failed panel, a partial result, a stale section.

```jsx
<InlineMessage tone="warning" title="Showing last known prices"
  action={<Button size="sm" iconStart="refresh-cw">Retry</Button>}>
  Steam did not respond at 15:12 CEST. These prices were last verified 3 hours ago.
</InlineMessage>
```

**WHEN** one provider fails while others succeed, **USE** `tone="warning"` scoped to that section **BECAUSE** PRODUCT.md §56 requires a single provider failure not to present as a whole-platform outage.

Error copy rules:
- Name the actual condition. "Steam did not respond" beats "Something went wrong".
- Say what the user is looking at instead ("Showing last known prices").
- Offer the recovery action when one exists.
- Never expose stack traces, status codes or internal identifiers. A request id is acceptable when the user is being asked to report the problem.

### Prop contract

```ts
import * as React from "react";

export type MessageTone = "info" | "success" | "warning" | "danger" | "neutral";

export interface InlineMessageProps {
  tone?: MessageTone;
  /** One clause naming what happened. Not "Error". */
  title?: string;
  children: React.ReactNode;
  /** A single Button. Errors that can be retried must offer the retry here. */
  action?: React.ReactNode;
}

export declare function InlineMessage(props: InlineMessageProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const inlineMessageToneMap = {
  info: { icon: "info", fg: "var(--color-status-info-text)", bg: "var(--color-status-info-surface)", bd: "var(--color-status-info-border)" },
  success: { icon: "circle-check", fg: "var(--color-status-success-text)", bg: "var(--color-status-success-surface)", bd: "var(--color-status-success-border)" },
  warning: { icon: "triangle-alert", fg: "var(--color-status-warning-text)", bg: "var(--color-status-warning-surface)", bd: "var(--color-status-warning-border)" },
  danger: { icon: "circle-alert", fg: "var(--color-status-danger-text)", bg: "var(--color-status-danger-surface)", bd: "var(--color-status-danger-border)" },
  neutral: { icon: "info", fg: "var(--color-status-neutral-text)", bg: "var(--color-status-neutral-surface)", bd: "var(--color-status-neutral-border)" }
};

export function InlineMessage({ tone = "info", title, children, action, style }) {
  const t = inlineMessageToneMap[tone] || inlineMessageToneMap.info;
  return (
    <div role={tone === "danger" ? "alert" : "status"} style={{
      display: "flex", gap: "var(--space-3)", padding: "var(--space-3) var(--space-4)",
      background: t.bg, border: "var(--border-width-hairline) solid " + t.bd,
      borderRadius: "var(--radius-md)", ...style
    }}>
      <span style={{ color: t.fg, marginTop: 2 }}><Icon name={t.icon} size="md" /></span>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", flex: 1, minWidth: 0 }}>
        {title && <span style={{ font: "var(--text-label-lg)", color: "var(--color-text-primary)" }}>{title}</span>}
        <div style={{ font: "var(--text-body-sm)", color: "var(--color-text-secondary)", textWrap: "pretty" }}>{children}</div>
        {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
      </div>
    </div>
  );
}
```

---

## Skeleton

A placeholder for content that has never been rendered yet. Shaped like the real thing, not a generic grey box.

```jsx
<Skeleton height={28} width="60%" />
<Skeleton height={12} width="40%" style={{ marginTop: "var(--space-2)" }} />
```

**WHEN** a region has no previous content, **USE** skeletons **BECAUSE** they preserve layout and prevent the reflow that comes with a spinner.

**WHEN** a region already has content and is refreshing, **DO NOT** use skeletons — dim the existing content instead (`DataTable loading`, `SearchField loading`). PRODUCT.md's performance stance and the LUDWISE loading rules both forbid flashing a populated view back to empty.

- Shimmer runs on `--motion-duration-ambient` and stops entirely under `prefers-reduced-motion`.
- Always `aria-hidden`; announce loading with a live region on the container, not on each bar.

### Prop contract

```ts
import * as React from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string;
}

export declare function Skeleton(props: SkeletonProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";

export function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)", style }) {
  return (
    <span aria-hidden="true" style={{
      display: "block", width, height, borderRadius: radius,
      background: "linear-gradient(90deg,var(--color-background-tertiary) 0%,var(--color-background-secondary) 50%,var(--color-background-tertiary) 100%)",
      backgroundSize: "200% 100%", animation: "lw-shimmer var(--motion-duration-ambient) linear infinite", ...style
    }}>
      <style>{"@keyframes lw-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}"}</style>
    </span>
  );
}
```

---

## Toast

Transient confirmation of a user-initiated action, bottom-right on desktop and bottom-centre on mobile.

```jsx
<Toast tone="success" title="Price alert created" action={<Button variant="ghost" size="sm">Undo</Button>}>
  We will email you when Cyberpunk 2077 drops below €25.00.
</Toast>
```

- Only for things the user did. System conditions use `Banner` or `InlineMessage`.
- `aria-live="polite"` — never `assertive` for a confirmation.
- Never stack more than three. Never use a toast to carry information the user must read.

### Prop contract

```ts
import * as React from "react";

export interface ToastProps {
  tone?: "neutral" | "success" | "danger";
  title: string;
  children?: React.ReactNode;
  /** An undo or a follow-up. Toasts with an action must not auto-dismiss
   *  before 10 seconds. */
  action?: React.ReactNode;
  onDismiss?: () => void;
}

export declare function Toast(props: ToastProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";
import { IconButton } from "../actions/IconButton.jsx";

export function Toast({ tone = "neutral", title, children, action, onDismiss, style }) {
  const map = {
    neutral: { icon: "info", fg: "var(--color-text-secondary)" },
    success: { icon: "circle-check", fg: "var(--color-status-success-text)" },
    danger: { icon: "circle-alert", fg: "var(--color-status-danger-text)" }
  };
  const t = map[tone] || map.neutral;
  return (
    <div role="status" aria-live="polite" style={{
      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
      minWidth: 280, maxWidth: 420, padding: "var(--space-3) var(--space-4)",
      background: "var(--color-surface-overlay)",
      border: "var(--border-width-hairline) solid var(--color-border-default)",
      borderRadius: "var(--radius-md)", boxShadow: "var(--elevation-2)", ...style
    }}>
      <span style={{ color: t.fg, marginTop: 2 }}><Icon name={t.icon} size="md" /></span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ font: "var(--text-label-lg)", color: "var(--color-text-primary)" }}>{title}</span>
        {children && <span style={{ font: "var(--text-body-sm)", color: "var(--color-text-secondary)" }}>{children}</span>}
        {action && <div style={{ marginTop: "var(--space-2)" }}>{action}</div>}
      </div>
      {onDismiss && <IconButton icon="x" label="Dismiss" size="sm" onClick={onDismiss} />}
    </div>
  );
}
```

---

