---
ste-prose: descriptive
---

# Overlays

Reference specifications for `components/overlays/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `Modal`, `Popover`, `Tooltip`.

---

## Modal

A focused interruption. Used sparingly: confirmations, the mobile filter sheet, sign-in, destructive actions.

```jsx
<Modal open={open} title="Delete this price alert?"
  description="You will stop receiving emails about Cyberpunk 2077."
  onClose={close}
  footer={<><Button onClick={close}>Cancel</Button><Button variant="danger" onClick={remove}>Delete alert</Button></>} />
```

**WHEN** an action is destructive or irreversible, **USE** a modal confirmation **BECAUSE** it is the only pattern that guarantees the user saw the consequence.

**WHEN** content is browsable, comparable or linkable, **DO NOT** use a modal — game detail, offers and history are pages with URLs, because SEO and sharing are product requirements.

- Closes on Escape and on scrim click. Focus moves in on open and returns to the trigger on close.
- Never nest modals. Never open a modal from a toast.
- On viewports under 768px the modal becomes a bottom sheet: full width, top corners `--radius-modal`, anchored to the bottom edge.

### Prop contract

```ts
import * as React from "react";

export interface ModalProps {
  open: boolean;
  /** Becomes the dialog's accessible name. Required. */
  title: string;
  description?: string;
  children?: React.ReactNode;
  /** Buttons, right-aligned. Cancel first, then the committing action. */
  footer?: React.ReactNode;
  onClose: () => void;
  width?: number;
}

export declare function Modal(props: ModalProps): React.ReactElement | null;
```

### Reference implementation

```jsx
import React from "react";
import { IconButton } from "../actions/IconButton.jsx";

export function Modal({ open, title, description, children, footer, onClose, width = 520, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => { if (ref.current) ref.current.focus(); }, 0);
    return () => { document.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, display: "flex",
      alignItems: "center", justifyContent: "center", padding: "var(--space-4)",
      background: "var(--color-surface-scrim)",
      animation: "lw-fade var(--motion-duration-normal) var(--motion-easing-enter)"
    }} onMouseDown={e => { if (e.target === e.currentTarget) onClose && onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}
        style={{
          width: "100%", maxWidth: width, maxHeight: "calc(100vh - var(--space-16))",
          display: "flex", flexDirection: "column",
          background: "var(--color-surface-overlay)",
          border: "var(--border-width-hairline) solid var(--color-border-default)",
          borderRadius: "var(--radius-modal)", boxShadow: "var(--elevation-2)", outline: "none", ...style
        }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-4)", padding: "var(--space-5) var(--space-5) var(--space-3)" }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <h2 style={{ font: "var(--text-heading-md)", letterSpacing: "var(--letter-spacing-heading)", color: "var(--color-text-primary)", margin: 0 }}>{title}</h2>
            {description && <p style={{ font: "var(--text-body-sm)", color: "var(--color-text-secondary)", margin: 0, textWrap: "pretty" }}>{description}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div style={{ padding: "0 var(--space-5)", overflowY: "auto", flex: 1 }}>{children}</div>
        {footer && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)", padding: "var(--space-4) var(--space-5) var(--space-5)" }}>
            {footer}
          </div>
        )}
        <style>{"@keyframes lw-fade{from{opacity:0}to{opacity:1}}"}</style>
      </div>
    </div>
  );
}
```

---

## Popover

The progressive-disclosure container. In LUDWISE its main job is provenance and freshness detail.

```jsx
<Popover trigger={<FreshnessIndicator level="fresh" label="Updated 8 min ago" />}>
  <ProvenanceNote items={[
    { label: "Source", value: "Steam Store API" },
    { label: "Observed", value: "21 Aug 2026, 15:12 CEST" }
  ]} />
</Popover>
```

- Closes on Escape and on outside click. Focus returns to the trigger.
- Works on touch, unlike `Tooltip` — so anything the user may genuinely need goes here.
- Also the home for sort menus, market pickers and account menus. Never for a form of more than three fields; that is a `Modal` or a page.

### Prop contract

```ts
import * as React from "react";

export interface PopoverProps {
  /** The control that opens it. Receives aria-expanded and aria-haspopup. */
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: "start" | "end";
  width?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export declare function Popover(props: PopoverProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";

export function Popover({ trigger, children, align = "start", width = 300, open: controlled, onOpenChange, style }) {
  const [internal, setInternal] = React.useState(false);
  const open = controlled != null ? controlled : internal;
  const set = v => { setInternal(v); onOpenChange && onOpenChange(v); };
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) set(false); };
    const onKey = e => { if (e.key === "Escape") set(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", ...style }}>
      <span onClick={() => set(!open)} style={{ display: "inline-flex" }}>
        {React.isValidElement(trigger) ? React.cloneElement(trigger, { "aria-expanded": open, "aria-haspopup": "dialog" }) : trigger}
      </span>
      {open && (
        <div role="dialog" style={{
          position: "absolute", zIndex: 50, top: "calc(100% + 6px)",
          left: align === "start" ? 0 : "auto", right: align === "end" ? 0 : "auto",
          width, padding: "var(--space-4)",
          background: "var(--color-surface-overlay)",
          border: "var(--border-width-hairline) solid var(--color-border-default)",
          borderRadius: "var(--radius-popover)", boxShadow: "var(--elevation-2)",
          animation: "lw-pop var(--motion-duration-normal) var(--motion-easing-enter)"
        }}>
          {children}
          <style>{"@keyframes lw-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}"}</style>
        </div>
      )}
    </span>
  );
}
```

---

## Tooltip

A one-line hint attached to a focusable control. Opens on hover **and** on keyboard focus.

```jsx
<Tooltip content="Prices as charged by the store, before local tax"><IconButton icon="circle-question-mark" label="About prices" /></Tooltip>
```

- Never the only route to essential information. A tooltip is unavailable on touch, so anything a user must read lives in the page or a `Popover`.
- Never put interactive content inside a tooltip — it is `pointer-events: none` by design.

### Prop contract

```ts
import * as React from "react";

export interface TooltipProps {
  /** Short. One line. A tooltip that needs a paragraph is a Popover. */
  content: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
  /** A single focusable element. It receives aria-describedby. */
  children: React.ReactElement;
}

export declare function Tooltip(props: TooltipProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";

export function Tooltip({ content, placement = "top", children, style }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const pos = {
    top: { bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 6px)", top: "50%", transform: "translateY(-50%)" }
  }[placement];

  return (
    <span
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
    >
      {React.isValidElement(children) ? React.cloneElement(children, { "aria-describedby": id }) : children}
      <span role="tooltip" id={id} style={{
        position: "absolute", zIndex: 40, ...pos,
        opacity: open ? 1 : 0, visibility: open ? "visible" : "hidden",
        pointerEvents: "none", whiteSpace: "nowrap", maxWidth: 280,
        padding: "var(--space-2) var(--space-3)",
        background: "var(--color-background-inverse)", color: "var(--color-text-inverse)",
        font: "var(--text-caption)", borderRadius: "var(--radius-sm)",
        transition: "opacity var(--motion-duration-fast) var(--motion-easing-standard)"
      }}>{content}</span>
    </span>
  );
}
```

---

