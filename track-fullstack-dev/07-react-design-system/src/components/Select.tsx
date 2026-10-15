/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events --
   APG select-only combobox: <ul role=listbox>/<li role=option> are prescribed; keyboard handling lives on the combobox
   (aria-activedescendant), so options and the label carry pointer handlers only. */
import { forwardRef, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { composeRefs, cx, useControllableState } from '../internal/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label: ReactNode;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/**
 * Select-only combobox following the WAI-ARIA APG pattern: a focusable `role="combobox"` button that
 * owns a `role="listbox"`, with focus staying on the combobox and `aria-activedescendant` pointing
 * at the highlighted option. Supports Arrow/Home/End/PageUp/PageDown, Enter/Space, Escape and typeahead.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { label, options, value, defaultValue = '', onValueChange, placeholder = 'Select...', name, disabled, className, id },
  ref,
) {
  const autoId = useId();
  const baseId = id ?? autoId;
  const labelId = `${baseId}-label`;
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const [selected, setSelected] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', timer: 0 });

  const selectedIndex = options.findIndex((o) => o.value === selected);
  const selectedOption = options[selectedIndex];
  const enabled = (i: number) => options[i] !== undefined && !options[i]?.disabled;

  const move = (from: number, step: 1 | -1): number => {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (enabled(i)) return i;
    return from;
  };
  const edge = (end: boolean) => (end ? move(options.length, -1) : move(-1, 1));

  const openList = (index?: number) => {
    setActive(index ?? (selectedIndex >= 0 ? selectedIndex : edge(false)));
    setOpen(true);
  };
  const close = () => setOpen(false);
  const commit = (index: number) => {
    const option = options[index];
    if (option && !option.disabled) {
      setSelected(option.value);
      close();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
    // optionId is derived from baseId, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const { key } = event;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        event.preventDefault();
        openList();
      } else if (key === 'Home' || key === 'End') {
        event.preventDefault();
        openList(edge(key === 'End'));
      }
    } else if (key === 'ArrowDown') {
      event.preventDefault();
      setActive(move(active, 1));
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      setActive(move(active, -1));
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault();
      setActive(edge(key === 'End'));
    } else if (key === 'PageDown' || key === 'PageUp') {
      event.preventDefault();
      let next = active;
      for (let n = 0; n < 10; n++) next = move(next, key === 'PageDown' ? 1 : -1);
      setActive(next);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      commit(active);
    } else if (key === 'Escape') {
      event.preventDefault();
      close();
    } else if (key === 'Tab') {
      commit(active); // APG: Tab selects the highlighted option and moves on
    }

    if (key.length === 1 && key !== ' ' && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const ta = typeahead.current;
      window.clearTimeout(ta.timer);
      ta.text += key.toLowerCase();
      ta.timer = window.setTimeout(() => (ta.text = ''), 500);
      const from = open ? active : selectedIndex;
      const order = [...options.keys()];
      const rotated = [...order.slice(from + 1), ...order.slice(0, from + 1)];
      const hit = rotated.find((i) => enabled(i) && options[i]?.label.toLowerCase().startsWith(ta.text));
      if (hit !== undefined) {
        if (open) setActive(hit);
        else openList(hit);
      }
    }
  };

  return (
    <div ref={rootRef} className={cx('adf-select', className)}>
      <span
        id={labelId}
        className="adf-field__label"
        onClick={() => triggerRef.current?.focus()}
      >
        {label}
      </span>
      <button
        ref={composeRefs(ref, triggerRef)}
        type="button"
        role="combobox"
        id={`${baseId}-trigger`}
        className="adf-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${baseId}-trigger`}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        disabled={disabled}
        data-placeholder={selectedOption ? undefined : ''}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        onBlur={() => close()}
      >
        {selectedOption?.label ?? placeholder}
        <span aria-hidden="true" className="adf-select__chevron" />
      </button>
      <ul
        id={listId}
        role="listbox"
        aria-labelledby={labelId}
        className="adf-select__list"
        hidden={!open}
        // Keep focus on the combobox when clicking options.
        onMouseDown={(event) => event.preventDefault()}
      >
        {options.map((option, i) => (
          <li
            key={option.value}
            id={optionId(i)}
            role="option"
            aria-selected={option.value === selected}
            aria-disabled={option.disabled || undefined}
            data-active={i === active ? '' : undefined}
            className="adf-select__option"
            onClick={() => commit(i)}
            onMouseMove={() => enabled(i) && setActive(i)}
          >
            {option.label}
          </li>
        ))}
      </ul>
      {name && <input type="hidden" name={name} value={selected} />}
    </div>
  );
});
