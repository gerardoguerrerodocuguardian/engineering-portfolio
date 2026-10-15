import { useCallback, useEffect, useRef, useState, type MutableRefObject, type Ref } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Merge several refs (callback or object) into one callback ref. */
export function composeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as MutableRefObject<T | null>).current = node;
    }
  };
}

/** Call `ours` after `theirs`, unless `theirs` called preventDefault(). */
export function composeHandlers<E extends { defaultPrevented: boolean }>(theirs?: (event: E) => void, ours?: (event: E) => void) {
  return (event: E) => {
    theirs?.(event);
    if (!event.defaultPrevented) ours?.(event);
  };
}

interface ControllableOptions<T> {
  value?: T | undefined;
  defaultValue: T;
  onChange?: ((value: T) => void) | undefined;
}

/**
 * Controlled/uncontrolled state. If `value` is provided the component is controlled and only
 * reports changes through `onChange`; otherwise it keeps its own state seeded by `defaultValue`.
 */
export function useControllableState<T>({ value, defaultValue, onChange }: ControllableOptions<T>) {
  const [inner, setInner] = useState<T>(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });
  const currentRef = useRef(current);
  useEffect(() => {
    currentRef.current = current;
  });

  const set = useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      if (!Object.is(next, currentRef.current)) onChangeRef.current?.(next);
    },
    [controlled],
  );
  return [current, set] as const;
}

export const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
