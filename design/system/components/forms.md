---
ste-prose: descriptive
---

# Form controls

Reference specifications for `components/forms/`. For each component: the **prop contract** (the API you must preserve), the **usage rules**, and the **reference implementation**.

> The implementations are inline-styled React because that is what the design-system tooling required. In the LUDWISE codebase these become `.astro` components with scoped styles, or React islands where the README's island table says so. Preserve every prop name, variant name and default. Do not copy the inline styles.

Components in this group: `Checkbox`, `Radio`, `SearchField`, `Select`, `Switch`, `TextField`, `Textarea`.

---

## Checkbox

Multi-select control. In LUDWISE this is overwhelmingly a filter facet: store, genre, OS, discount band.

```jsx
<Checkbox label="GOG" count={1284} checked={on} onChange={toggle} />
<Checkbox label="All stores" indeterminate onChange={toggleAll} />
```

- The whole row is the hit target and is at least 40px tall.
- `count` is the number of results the facet would yield. If the count is not known, omit the prop; a `0` implies "no results", which is a different fact.

### Prop contract

```ts
import * as React from "react";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: React.ReactNode;
  description?: string;
  /** Facet result count, right-aligned and tabular. Omit when unknown —
   *  never render 0 as a placeholder for "not counted". */
  count?: number | string;
  indeterminate?: boolean;
}

export declare function Checkbox(props: CheckboxProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function Checkbox({ label, description, count, checked, indeterminate, disabled, onChange, id, style, ...rest }) {
  const auto = React.useId();
  const boxId = id || auto;
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate; }, [indeterminate]);
  const on = checked || indeterminate;

  return (
    <label htmlFor={boxId} style={{
      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
      minHeight: "var(--target-min)", padding: "var(--space-2) 0",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, ...style
    }}>
      <span style={{ position: "relative", display: "inline-flex", flex: "none", marginTop: 1 }}>
        <input ref={ref} id={boxId} type="checkbox" checked={checked} disabled={disabled} onChange={onChange}
          style={{ position: "absolute", opacity: 0, width: 18, height: 18, margin: 0, cursor: "inherit" }} {...rest} />
        <span aria-hidden="true" style={{
          width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center",
          borderRadius: "var(--radius-xs)",
          border: "var(--border-width-hairline) solid " + (on ? "var(--color-action-primary)" : "var(--color-border-strong)"),
          background: on ? "var(--color-action-primary)" : "var(--color-surface-default)",
          color: "var(--color-action-primary-text)", transition: "var(--motion-transition-color)"
        }}>
          {indeterminate ? <Icon name="minus" size={12} strokeWidth={2.5} /> : checked ? <Icon name="check" size={12} strokeWidth={2.5} /> : null}
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", gap: "var(--space-2)", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ font: "var(--text-body-md)", color: "var(--color-text-primary)" }}>{label}</span>
          {count != null && <span className="lw-tabular" style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{count}</span>}
        </span>
        {description && <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{description}</span>}
      </span>
    </label>
  );
}
```

---

## Radio

Single choice from a small mutually exclusive set. Wrap a group in `<fieldset>` with a `<legend>`.

```jsx
<fieldset style={{ border: 0, padding: 0, margin: 0 }}>
  <legend className="lw-text-label-md">Price display</legend>
  <Radio name="market" value="eur" label="EUR — Eurozone" checked={m === "eur"} onChange={set} />
  <Radio name="market" value="czk" label="CZK — Czechia" description="Prices as charged by the store" checked={m === "czk"} onChange={set} />
</fieldset>
```

- Use radios up to about 5 options; beyond that use `Select`.
- Never pre-select an option that costs the user money or changes their market silently — default to the detected market and say so in `description`.

### Prop contract

```ts
import * as React from "react";

export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: React.ReactNode;
  description?: string;
}

export declare function Radio(props: RadioProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";

export function Radio({ label, description, checked, disabled, name, value, onChange, id, style, ...rest }) {
  const auto = React.useId();
  const radioId = id || auto;
  return (
    <label htmlFor={radioId} style={{
      display: "flex", alignItems: "flex-start", gap: "var(--space-3)",
      minHeight: "var(--target-min)", padding: "var(--space-2) 0",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, ...style
    }}>
      <span style={{ position: "relative", display: "inline-flex", flex: "none", marginTop: 1 }}>
        <input id={radioId} type="radio" name={name} value={value} checked={checked} disabled={disabled} onChange={onChange}
          style={{ position: "absolute", opacity: 0, width: 18, height: 18, margin: 0, cursor: "inherit" }} {...rest} />
        <span aria-hidden="true" style={{
          width: 18, height: 18, borderRadius: "var(--radius-full)", display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: "var(--border-width-hairline) solid " + (checked ? "var(--color-action-primary)" : "var(--color-border-strong)"),
          background: "var(--color-surface-default)", transition: "var(--motion-transition-color)"
        }}>
          {checked && <span style={{ width: 9, height: 9, borderRadius: "var(--radius-full)", background: "var(--color-action-primary)" }} />}
        </span>
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ font: "var(--text-body-md)", color: "var(--color-text-primary)" }}>{label}</span>
        {description && <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{description}</span>}
      </span>
    </label>
  );
}
```

---

## SearchField

The global game-search input. One per view, in the header or at the top of a results page.

```jsx
<SearchField value={q} onChange={e => setQ(e.target.value)} onClear={() => setQ("")} loading={pending} />
```

- While `loading`, keep the existing results rendered underneath. LUDWISE never flashes a populated list back to skeleton on refinement.
- Placeholder is a noun phrase ("Search games"), not an instruction ("Type to search…").
- The clear button appears only when there is a value, and is 24px — it is an inline control, exempt from the 40px minimum.

### Prop contract

```ts
import * as React from "react";

export interface SearchFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  value?: string;
  onClear?: () => void;
  /** Shows a spinner in place of the magnifier while results are in flight.
   *  The previous results stay on screen — never blank them. */
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  /** Accessible name. Defaults to "Search games". */
  label?: string;
}

export declare function SearchField(props: SearchFieldProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function SearchField({
  value, onChange, onClear, placeholder = "Search games", size = "md",
  loading = false, label = "Search games", style, ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const height = size === "lg" ? 48 : size === "sm" ? 36 : 40;
  const hasValue = value != null && String(value).length > 0;

  return (
    <div role="search" style={{
      display: "flex", alignItems: "center", gap: "var(--space-2)",
      height, padding: "0 var(--space-3)", width: "100%",
      background: "var(--color-surface-default)",
      border: "var(--border-width-hairline) solid " + (focus ? "var(--color-border-focus)" : "var(--color-border-default)"),
      boxShadow: focus ? "0 0 0 var(--focus-ring-width) var(--color-border-focus)" : "none",
      borderRadius: "var(--radius-input)", transition: "var(--motion-transition-color)", ...style
    }}>
      <span style={{ color: "var(--color-text-tertiary)" }}>
        {loading
          ? <span style={{ display: "inline-flex", animation: "lw-spin 900ms linear infinite" }}><Icon name="loader-circle" size="md" /></span>
          : <Icon name="search" size="md" />}
      </span>
      <input
        type="search" aria-label={label} placeholder={placeholder} value={value} onChange={onChange}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent",
          font: size === "lg" ? "var(--text-body-lg)" : "var(--text-body-md)", color: "var(--color-text-primary)" }}
        {...rest}
      />
      {hasValue && (
        <button type="button" aria-label="Clear search" onClick={onClear}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24,
            border: "none", background: "transparent", color: "var(--color-text-tertiary)", cursor: "pointer", borderRadius: "var(--radius-sm)" }}>
          <Icon name="x" size="sm" />
        </button>
      )}
      <style>{"@keyframes lw-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
```

---

## Select

A native `<select>` in LUDWISE clothing. Use for closed sets of 2–15 options: sort order, currency, market, store filter.

```jsx
<Select label="Sort by" options={[
  { value: "relevance", label: "Relevance" },
  { value: "price-asc", label: "Price, lowest first" },
  { value: "discount", label: "Discount, largest first" }
]} />
```

- Native on purpose: it is the only control that gets mobile's own picker, full keyboard support and text scaling for free.
- Over ~15 options, or when the user needs to type, use a combobox pattern built from `SearchField` + `Popover` instead.
- Option labels are sentence case and state the direction explicitly ("Price, lowest first"), never a bare "Price".

### Prop contract

```ts
import * as React from "react";

export interface SelectOption { value: string; label: string; disabled?: boolean }

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "children"> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  size?: "sm" | "md" | "lg";
}

export declare function Select(props: SelectProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const lwFieldLabel = { font: "var(--text-label-md)", letterSpacing: "var(--letter-spacing-label)", color: "var(--color-text-secondary)", display: "block", marginBottom: "var(--space-2)" };
const lwFieldHelp = { font: "var(--text-caption)", color: "var(--color-text-tertiary)", marginTop: "var(--space-2)" };
const lwFieldError = { font: "var(--text-caption)", color: "var(--color-status-danger-text)", marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-1)" };

export function Select({ label, hint, error, options = [], size = "md", disabled, id, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const auto = React.useId();
  const selectId = id || auto;
  const height = size === "sm" ? 32 : size === "lg" ? 48 : 40;

  return (
    <div style={style}>
      {label && <label htmlFor={selectId} style={lwFieldLabel}>{label}</label>}
      <div style={{
        display: "flex", alignItems: "center", height, padding: "0 var(--space-3)",
        background: disabled ? "var(--color-action-disabled-surface)" : "var(--color-surface-default)",
        border: "var(--border-width-hairline) solid " + (error ? "var(--color-status-danger-border)" : focus ? "var(--color-border-focus)" : "var(--color-border-default)"),
        boxShadow: focus ? "0 0 0 var(--focus-ring-width) var(--color-border-focus)" : "none",
        borderRadius: "var(--radius-input)", color: disabled ? "var(--color-text-disabled)" : "var(--color-text-primary)",
        transition: "var(--motion-transition-color)"
      }}>
        <select
          id={selectId} disabled={disabled} onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, appearance: "none", border: "none", outline: "none", background: "transparent",
            font: "var(--text-body-md)", color: "inherit", cursor: disabled ? "not-allowed" : "pointer", paddingRight: "var(--space-2)" }}
          {...rest}
        >
          {options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <span style={{ color: "var(--color-text-tertiary)", pointerEvents: "none" }}><Icon name="chevron-down" size="sm" /></span>
      </div>
      {hint && !error && <div style={lwFieldHelp}>{hint}</div>}
      {error && <div style={lwFieldError}><Icon name="circle-alert" size="sm" />{error}</div>}
    </div>
  );
}
```

---

## Switch

An immediate-effect setting toggle. Changing it applies at once — there is no Save.

```jsx
<Switch label="Email price alerts" description="One digest a day, never more" checked={on} onChange={set} />
```

- If the change needs a Save button, use `Checkbox`, not `Switch`.
- Never use a switch for a filter. Filters are checkboxes, because filters are a set.

### Prop contract

```ts
import * as React from "react";

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  label: React.ReactNode;
  description?: string;
}

export declare function Switch(props: SwitchProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";

export function Switch({ label, description, checked, disabled, onChange, id, style, ...rest }) {
  const auto = React.useId();
  const switchId = id || auto;
  return (
    <label htmlFor={switchId} style={{
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-4)",
      minHeight: "var(--target-min)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, ...style
    }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ font: "var(--text-body-md)", color: "var(--color-text-primary)" }}>{label}</span>
        {description && <span style={{ font: "var(--text-caption)", color: "var(--color-text-tertiary)" }}>{description}</span>}
      </span>
      <span style={{ position: "relative", display: "inline-flex", flex: "none" }}>
        <input id={switchId} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={onChange}
          style={{ position: "absolute", opacity: 0, width: 40, height: 24, margin: 0, cursor: "inherit" }} {...rest} />
        <span aria-hidden="true" style={{
          width: 40, height: 24, borderRadius: "var(--radius-full)", padding: 2, display: "flex",
          justifyContent: checked ? "flex-end" : "flex-start", alignItems: "center",
          background: checked ? "var(--color-action-primary)" : "var(--color-border-strong)",
          transition: "background-color var(--motion-duration-fast) var(--motion-easing-standard)"
        }}>
          <span style={{ width: 20, height: 20, borderRadius: "var(--radius-full)", background: "var(--ludwise-neutral-0)", boxShadow: "var(--elevation-1)" }} />
        </span>
      </span>
    </label>
  );
}
```

---

## TextField

A labelled single-line input. The base of every LUDWISE form field except search.

```jsx
<TextField label="Price ceiling" suffix="EUR" inputMode="decimal" defaultValue="20.00" />
<TextField label="Email" error="Enter an email address including the @." required />
```

- Errors never rely on the red border alone: the message and its `circle-alert` glyph carry the meaning.
- `hint` disappears when `error` appears — never stack both.
- Currency and market go in `suffix`, not baked into the label.

### Prop contract

```ts
import * as React from "react";
import type { IconName } from "../foundation/Icon";

export interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  /** Persistent helper text. Shown only while there is no error. */
  hint?: string;
  /** Error message. Presence sets aria-invalid and swaps the border to danger.
   *  Always a sentence that says how to fix it, never "Invalid". */
  error?: string;
  iconStart?: IconName;
  /** Trailing static text: a currency code, a unit, a character count. */
  suffix?: string;
  size?: "sm" | "md" | "lg";
}

export declare function TextField(props: TextFieldProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const lwFieldLabel = { font: "var(--text-label-md)", letterSpacing: "var(--letter-spacing-label)", color: "var(--color-text-secondary)", display: "block", marginBottom: "var(--space-2)" };
const lwFieldHelp = { font: "var(--text-caption)", color: "var(--color-text-tertiary)", marginTop: "var(--space-2)" };
const lwFieldError = { font: "var(--text-caption)", color: "var(--color-status-danger-text)", marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-1)" };

const textFieldSizeMap = { sm: 32, md: 40, lg: 48 };

export function TextField({
  label, hint, error, required, disabled, readOnly, iconStart, suffix,
  size = "md", id, style, ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const auto = React.useId();
  const inputId = id || auto;
  const describedBy = [hint ? inputId + "-hint" : null, error ? inputId + "-error" : null].filter(Boolean).join(" ") || undefined;

  return (
    <div style={{ display: "block", ...style }}>
      {label && (
        <label htmlFor={inputId} style={lwFieldLabel}>
          {label}{required && <span aria-hidden="true" style={{ color: "var(--color-status-danger-text)" }}> *</span>}
        </label>
      )}
      <div style={{
        display: "flex", alignItems: "center", gap: "var(--space-2)",
        minHeight: textFieldSizeMap[size], padding: "0 var(--space-3)",
        background: disabled ? "var(--color-action-disabled-surface)" : "var(--color-surface-default)",
        border: "var(--border-width-hairline) solid " + (error ? "var(--color-status-danger-border)" : focus ? "var(--color-border-focus)" : "var(--color-border-default)"),
        boxShadow: focus ? "0 0 0 var(--focus-ring-width) var(--color-border-focus)" : "none",
        borderRadius: "var(--radius-input)",
        color: disabled ? "var(--color-text-disabled)" : "var(--color-text-primary)",
        transition: "var(--motion-transition-color)"
      }}>
        {iconStart && <span style={{ color: "var(--color-text-tertiary)" }}><Icon name={iconStart} size="md" /></span>}
        <input
          id={inputId} disabled={disabled} readOnly={readOnly} required={required}
          aria-invalid={error ? true : undefined} aria-describedby={describedBy}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", font: "var(--text-body-md)", color: "inherit", padding: "var(--space-2) 0" }}
          {...rest}
        />
        {suffix && <span style={{ font: "var(--text-label-md)", color: "var(--color-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>{suffix}</span>}
      </div>
      {hint && !error && <div id={inputId + "-hint"} style={lwFieldHelp}>{hint}</div>}
      {error && <div id={inputId + "-error"} style={lwFieldError}><Icon name="circle-alert" size="sm" />{error}</div>}
    </div>
  );
}
```

---

## Textarea

Multi-line free text. Rare in LUDWISE — support messages, data-correction reports, B2B contact.

```jsx
<Textarea label="What looks wrong?" hint="Include the store and the price you saw." rows={5} />
```

- Vertically resizable, never horizontally.
- Do not use it for anything the product can capture as structured data.

### Prop contract

```ts
import * as React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export declare function Textarea(props: TextareaProps): React.ReactElement;
```

### Reference implementation

```jsx
import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const lwFieldLabel = { font: "var(--text-label-md)", letterSpacing: "var(--letter-spacing-label)", color: "var(--color-text-secondary)", display: "block", marginBottom: "var(--space-2)" };
const lwFieldHelp = { font: "var(--text-caption)", color: "var(--color-text-tertiary)", marginTop: "var(--space-2)" };
const lwFieldError = { font: "var(--text-caption)", color: "var(--color-status-danger-text)", marginTop: "var(--space-2)", display: "flex", alignItems: "center", gap: "var(--space-1)" };

export function Textarea({ label, hint, error, rows = 4, disabled, id, style, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  const auto = React.useId();
  const areaId = id || auto;
  return (
    <div style={style}>
      {label && <label htmlFor={areaId} style={lwFieldLabel}>{label}</label>}
      <textarea
        id={areaId} rows={rows} disabled={disabled}
        aria-invalid={error ? true : undefined}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        style={{
          width: "100%", resize: "vertical", padding: "var(--space-3)",
          font: "var(--text-body-md)", color: disabled ? "var(--color-text-disabled)" : "var(--color-text-primary)",
          background: disabled ? "var(--color-action-disabled-surface)" : "var(--color-surface-default)",
          border: "var(--border-width-hairline) solid " + (error ? "var(--color-status-danger-border)" : focus ? "var(--color-border-focus)" : "var(--color-border-default)"),
          boxShadow: focus ? "0 0 0 var(--focus-ring-width) var(--color-border-focus)" : "none",
          borderRadius: "var(--radius-input)", outline: "none", transition: "var(--motion-transition-color)"
        }}
        {...rest}
      />
      {hint && !error && <div style={lwFieldHelp}>{hint}</div>}
      {error && <div style={lwFieldError}><Icon name="circle-alert" size="sm" />{error}</div>}
    </div>
  );
}
```

---

