import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../internal/utils';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: ReactNode;
  description?: ReactNode;
  /** When set the field is marked invalid and the message is announced with the input. */
  error?: ReactNode;
}

/**
 * Native input wrapped with label, description and error wiring. Controlled (`value` + `onChange`)
 * and uncontrolled (`defaultValue`) usage both work because state lives in the native input.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, description, error, id, className, required, 'aria-describedby': describedBy, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-input`;
  const descId = `${inputId}-desc`;
  const errId = `${inputId}-err`;
  const ids = [describedBy, description ? descId : null, error ? errId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cx('adf-field', className)} data-invalid={error ? '' : undefined}>
      <label className="adf-field__label" htmlFor={inputId}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {description && (
        <div id={descId} className="adf-field__description">
          {description}
        </div>
      )}
      <input
        ref={ref}
        id={inputId}
        className="adf-field__input"
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={ids}
        {...rest}
      />
      {error && (
        <div id={errId} className="adf-field__error">
          {error}
        </div>
      )}
    </div>
  );
});
