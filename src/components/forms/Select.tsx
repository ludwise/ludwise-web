/**
 * Reference: design/system/components/forms.md § Select — prop contract ported
 * verbatim.
 *
 * A native <select> in LUDWISE clothing, for closed sets of 2 to 15 options.
 * Native on purpose: it is the only control that gets the mobile picker, full
 * keyboard support and text scaling for free.
 *
 * design/README.md lists it as a `client:visible` island. Its own note adds
 * that a form-submit Select is static, which is a composition decision and not
 * this component's.
 *
 * The reference extends `SelectHTMLAttributes`. The passthrough narrows to the
 * attributes a LUDWISE select uses.
 */
import { useId } from 'react';
import { IconGlyph } from '../foundation/icon-glyph.js';
import type { ChangeEvent } from 'react';
import './Select.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean | undefined;
}

export interface SelectProps {
  label?: string | undefined;
  hint?: string | undefined;
  /** Presence sets aria-invalid and swaps the border to danger. Always a
   *  sentence that says how to fix it, never "Invalid". */
  error?: string | undefined;
  options: SelectOption[];
  size?: 'sm' | 'md' | 'lg' | undefined;
  id?: string | undefined;
  name?: string | undefined;
  value?: string | undefined;
  defaultValue?: string | undefined;
  onChange?: ((event: ChangeEvent<HTMLSelectElement>) => void) | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
}

export function Select({
  label,
  hint,
  error,
  options,
  size = 'md',
  id,
  name,
  value,
  defaultValue,
  onChange,
  disabled = false,
  required = false,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;
  const errorId = `${selectId}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="lw-select" data-size={size}>
      {label && (
        <label className="lw-select__label" htmlFor={selectId}>
          {label}
        </label>
      )}
      <div className="lw-select__control" data-invalid={error ? true : undefined}>
        <select
          id={selectId}
          name={name}
          className="lw-select__native"
          disabled={disabled}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...(onChange === undefined ? { defaultValue } : { value, onChange })}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="lw-select__chevron" aria-hidden="true">
          <IconGlyph name="chevron-down" size={14} />
        </span>
      </div>
      {hint && !error && (
        <p id={hintId} className="lw-select__hint">
          {hint}
        </p>
      )}
      {/* The glyph and the sentence carry the error. The red border never
          carries it alone. */}
      {error && (
        <p id={errorId} className="lw-select__error">
          <IconGlyph name="circle-alert" size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}
