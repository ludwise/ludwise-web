/**
 * Reference: design/system/components/overlays.md § Tooltip — prop contract
 * ported verbatim, except for how the control is described.
 *
 * A one-line hint on a focusable control. It opens on hover and on keyboard
 * focus. It holds no interactive content, which is why it is
 * pointer-events: none.
 *
 * The reference clones `children` to give the control aria-describedby. An
 * Astro host supplies rendered markup, which cloning cannot reach. So the
 * attribute goes onto the first focusable descendant instead, after this
 * island starts. A tooltip is never the only route to essential information,
 * which is what makes that delay acceptable.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import './Tooltip.css';

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]';

export interface TooltipProps {
  /** Short. One line. A tooltip that needs a paragraph is a Popover. */
  content: ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | undefined;
  /** A single focusable element. It receives aria-describedby. */
  children: ReactNode;
}

export function Tooltip({ content, placement = 'top', children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const control = rootRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    control?.setAttribute('aria-describedby', tooltipId);
  }, [tooltipId]);

  return (
    <span
      className="lw-tooltip"
      ref={rootRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <span
        role="tooltip"
        id={tooltipId}
        className="lw-tooltip__bubble"
        data-placement={placement}
        data-open={open || undefined}
      >
        {content}
      </span>
    </span>
  );
}
