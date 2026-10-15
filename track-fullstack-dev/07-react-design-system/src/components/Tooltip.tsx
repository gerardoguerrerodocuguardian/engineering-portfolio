import { useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Slot } from '../internal/Slot';
import { cx } from '../internal/utils';

export interface TooltipProps {
  content: ReactNode;
  /** A single focusable element. It receives aria-describedby while the tooltip is visible. */
  children: ReactElement;
  /** Hover delay in ms (focus shows immediately). */
  delay?: number;
  className?: string;
}

/**
 * Supplementary text for a focusable trigger. Meets WCAG 1.4.13: dismissible (Escape), hoverable
 * (the pointer can move onto the tooltip) and persistent (until blur / pointer leave / Escape).
 * Never put essential or interactive content in a tooltip.
 */
export function Tooltip({ content, children, delay = 300, className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef(0);

  const show = useCallback((wait: number) => {
    window.clearTimeout(timer.current);
    if (wait <= 0) setOpen(true);
    else timer.current = window.setTimeout(() => setOpen(true), wait);
  }, []);
  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setOpen(false);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && hide();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hide]);

  return (
    // The wrapper only forwards pointer/focus events from the (interactive) child; it is not itself interactive.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <span
      className="adf-tooltip-wrap"
      onMouseEnter={() => show(delay)}
      onMouseLeave={hide}
      onFocus={() => show(0)}
      onBlur={hide}
    >
      <Slot aria-describedby={open ? id : undefined}>{children}</Slot>
      {open && (
        <span role="tooltip" id={id} className={cx('adf-tooltip', className)}>
          {content}
        </span>
      )}
    </span>
  );
}
