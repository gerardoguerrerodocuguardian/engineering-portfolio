import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '../internal/Slot';
import { cx } from '../internal/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Shows a spinner and blocks activation, but keeps the button focusable (aria-disabled). */
  loading?: boolean;
  /** Render the child element (e.g. a router link) instead of a <button>, keeping styles and behaviour. */
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, asChild = false, className, children, onClick, disabled, type, ...rest },
  ref,
) {
  const blocked = loading || disabled;
  const props = {
    ...rest,
    ref,
    className: cx('adf-button', className),
    'data-variant': variant,
    'data-size': size,
    'data-loading': loading || undefined,
    'aria-busy': loading || undefined,
    'aria-disabled': blocked || undefined,
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
      if (blocked) {
        event.preventDefault();
        return;
      }
      onClick?.(event);
    },
  };

  if (asChild) return <Slot {...(props as object)}>{children}</Slot>;
  return (
    <button {...props} type={type ?? 'button'}>
      {loading && <span className="adf-button__spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});
