/**
 * Reference: design/system/components/forms.md § SearchField — prop contract
 * ported verbatim, except for the copy.
 *
 * design/README.md makes this an island as part of AppHeader, which is where
 * the only current consumer sits. It works before hydration inside a native GET
 * form.
 *
 * The contract's `label` default and its `placeholder` are English literals.
 * They become required props instead, because island copy must be resolved
 * before hydration. tests/architecture/i18n.test.ts pins that rule for
 * AppHeader. It drops the raw HTML-attribute passthrough the reference
 * inherits from `InputHTMLAttributes`, which no caller here uses.
 */
import { IconGlyph } from '../foundation/icon-glyph.js';
import type { ChangeEvent } from 'react';
import './SearchField.css';

export interface SearchFieldProps {
  value?: string | undefined;
  onChange?: ((event: ChangeEvent<HTMLInputElement>) => void) | undefined;
  onClear?: (() => void) | undefined;
  /** Shows a spinner in place of the magnifier while results are in flight.
   *  The previous results stay on screen — never blank them. */
  loading?: boolean | undefined;
  size?: 'sm' | 'md' | 'lg' | undefined;
  /** A noun phrase, never an instruction. */
  placeholder: string;
  /** Accessible name. */
  label: string;
  clearLabel: string;
  name?: string | undefined;
}

export function SearchField({
  value,
  onChange,
  onClear,
  placeholder,
  label,
  clearLabel,
  size = 'md',
  loading = false,
  name = 'q',
}: SearchFieldProps) {
  const hasValue = value != null && value.length > 0;

  return (
    <div role="search" className="lw-search" data-size={size} aria-busy={loading || undefined}>
      <span className="lw-search__icon">
        {loading ? (
          <span className="lw-search__spinner">
            <IconGlyph name="loader-circle" size={16} />
          </span>
        ) : (
          <IconGlyph name="search" size={16} />
        )}
      </span>
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        name={name}
        {...(onChange === undefined ? { defaultValue: value } : { value, onChange })}
        className="lw-search__input"
      />
      {hasValue && onClear && (
        <button
          type="button"
          aria-label={clearLabel}
          onClick={onClear}
          className="lw-search__clear"
        >
          <IconGlyph name="x" size={14} />
        </button>
      )}
    </div>
  );
}
