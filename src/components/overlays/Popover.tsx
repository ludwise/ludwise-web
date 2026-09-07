/**
 * Reference: design/system/components/overlays.md § Popover — prop contract
 * ported verbatim, except that the Popover owns the control.
 *
 * The progressive-disclosure container. Its main job here is provenance and
 * freshness detail. It works on touch, unlike Tooltip, so anything a visitor
 * may genuinely need goes here. It closes on Escape and on outside click, and
 * Escape returns focus to the trigger.
 *
 * The reference clones `trigger` to give it aria-expanded and aria-haspopup.
 * An Astro host supplies the trigger as a slot, which arrives as rendered
 * markup. Cloning that sets the attributes on a wrapper no assistive
 * technology reads. So `trigger` is the label of the button this component
 * renders. Do not put a control inside it.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './Popover.css';

export interface PopoverProps {
  /** The label of the control that opens it. Markup, not a control. Supply it
   *  as a prop from React, or as the "trigger" slot from Astro. */
  trigger?: ReactNode | undefined;
  children: ReactNode;
  align?: 'start' | 'end' | undefined;
  width?: number | undefined;
  open?: boolean | undefined;
  onOpenChange?: ((open: boolean) => void) | undefined;
}

export function Popover({
  trigger,
  children,
  align = 'start',
  width = 300,
  open: controlledOpen,
  onOpenChange,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The trigger names the disclosure it opens, which is what a provenance
  // popover wants: "Updated 8 min ago" names the panel behind it. A dialog
  // with no accessible name fails WCAG 2.2 AA.
  const triggerId = useId();

  useEffect(() => {
    if (!open) return;

    const close = () => {
      setUncontrolledOpen(false);
      onOpenChange?.(false);
    };

    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      // Escape returns focus to the trigger. An outside click does not: focus
      // is already where the visitor put it.
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <span className="lw-popover" ref={rootRef}>
      <button
        type="button"
        className="lw-popover__trigger"
        id={triggerId}
        ref={triggerRef}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setUncontrolledOpen(!open);
          onOpenChange?.(!open);
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          className="lw-popover__panel"
          role="dialog"
          aria-labelledby={triggerId}
          data-align={align}
          style={{ width }}
        >
          {children}
        </div>
      )}
    </span>
  );
}
