/**
 * Reference: design/system/components/display.md § Chip — prop contract ported
 * verbatim, plus the remove-control copy.
 *
 * The interactive filter token. design/README.md makes it an island, because a
 * chip is a live toggle or a removable filter. Chips are the only pill-shaped
 * element in LUDWISE.
 *
 * The reference builds the remove control's accessible name from an English
 * literal. It becomes a prop, because island copy must be resolved before
 * hydration.
 */
import { IconGlyph } from '../foundation/icon-glyph.js';
import './Chip.css';

interface ChipBase {
  label: string;
  /** Matching result count. Tabular, tertiary. */
  count?: number | string | undefined;
  selected?: boolean | undefined;
  /** Present = the chip is a toggle. */
  onClick?: (() => void) | undefined;
  disabled?: boolean | undefined;
}

/**
 * `onRemove` carries the name of the control it grows.
 *
 * The two travel together because the contract says the handler alone grows the
 * button, and an icon button with no accessible name is a defect.
 */
type ChipRemoval =
  /** Present = the chip is a removable active filter and grows an × button. */
  { onRemove: () => void; removeLabel: string } | { onRemove?: undefined; removeLabel?: undefined };

export type ChipProps = ChipBase & ChipRemoval;

export function Chip({
  label,
  count,
  selected = false,
  onRemove,
  onClick,
  disabled = false,
  removeLabel,
}: ChipProps) {
  return (
    <span
      className="lw-chip"
      data-selected={selected || undefined}
      data-removable={onRemove ? true : undefined}
    >
      {onClick ? (
        <button
          type="button"
          className="lw-chip__label"
          onClick={onClick}
          disabled={disabled}
          aria-pressed={selected}
        >
          {label}
        </button>
      ) : (
        <span className="lw-chip__label">{label}</span>
      )}
      {count != null && <span className="lw-chip__count lw-tabular">{count}</span>}
      {onRemove !== undefined && (
        <button
          type="button"
          className="lw-chip__remove"
          aria-label={removeLabel}
          onClick={onRemove}
          disabled={disabled}
        >
          <IconGlyph name="x" size={14} />
        </button>
      )}
    </span>
  );
}
