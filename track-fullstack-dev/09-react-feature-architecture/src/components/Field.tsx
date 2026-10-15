import { useId, type InputHTMLAttributes, type Ref } from 'react';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Labelled input wired for assistive tech: label, aria-invalid, aria-describedby, role=alert errors. */
export function Field({ label, error, ref, ...rest }: Props) {
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} ref={ref} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} {...rest} />
      {error ? (
        <p id={errId} role="alert" className="error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
