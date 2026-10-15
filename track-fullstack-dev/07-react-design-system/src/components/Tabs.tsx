/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- APG: the tabpanel itself is focusable (tabindex=0) when it has no focusable content. */
import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { composeHandlers, composeRefs, cx, useControllableState } from '../internal/utils';

type Orientation = 'horizontal' | 'vertical';
interface TabsContextValue {
  value: string | undefined;
  select: (value: string) => void;
  baseId: string;
  orientation: Orientation;
  activation: 'automatic' | 'manual';
}
const TabsContext = createContext<TabsContextValue | null>(null);
function useTabs(part: string) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${part}> must be used inside <Tabs>`);
  return ctx;
}
const slug = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  value?: string;
  /** Required for uncontrolled use so exactly one tab is in the tab order from the start. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: Orientation;
  /** automatic: arrow keys select; manual: arrow keys move focus, Enter/Space select. */
  activationMode?: 'automatic' | 'manual';
}

/** Compound tabs (APG tabs pattern): Tabs, Tabs.List, Tabs.Trigger, Tabs.Content. */
function TabsRoot({
  value,
  defaultValue,
  onValueChange,
  orientation = 'horizontal',
  activationMode = 'automatic',
  className,
  ...rest
}: TabsProps) {
  const baseId = useId();
  const [current, setCurrent] = useControllableState<string | undefined>({ value, defaultValue, onChange: (v) => v !== undefined && onValueChange?.(v) });
  const ctx = useMemo<TabsContextValue>(
    () => ({ value: current, select: setCurrent, baseId, orientation, activation: activationMode }),
    [current, setCurrent, baseId, orientation, activationMode],
  );
  return (
    <TabsContext.Provider value={ctx}>
      <div className={cx('adf-tabs', className)} data-orientation={orientation} {...rest} />
    </TabsContext.Provider>
  );
}

const TabsList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function TabsList({ className, ...rest }, ref) {
  const { orientation } = useTabs('Tabs.List');
  return <div ref={ref} role="tablist" aria-orientation={orientation} className={cx('adf-tabs__list', className)} {...rest} />;
});

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}
const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(function TabsTrigger(
  { value, className, onClick, onKeyDown, disabled, ...rest },
  ref,
) {
  const ctx = useTabs('Tabs.Trigger');
  const selected = ctx.value === value;
  const own = useRef<HTMLButtonElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const horizontal = ctx.orientation === 'horizontal';
    const next = horizontal ? 'ArrowRight' : 'ArrowDown';
    const prev = horizontal ? 'ArrowLeft' : 'ArrowUp';
    if (![next, prev, 'Home', 'End'].includes(event.key)) return;
    const list = own.current?.closest('[role="tablist"]');
    const tabs = [...(list?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? [])];
    const index = tabs.indexOf(own.current!);
    let target: HTMLButtonElement | undefined;
    if (event.key === next) target = tabs[(index + 1) % tabs.length];
    else if (event.key === prev) target = tabs[(index - 1 + tabs.length) % tabs.length];
    else if (event.key === 'Home') target = tabs[0];
    else target = tabs[tabs.length - 1];
    event.preventDefault();
    target?.focus();
    if (ctx.activation === 'automatic') target?.click();
  };

  return (
    <button
      ref={composeRefs(ref, own)}
      type="button"
      role="tab"
      id={`${ctx.baseId}-tab-${slug(value)}`}
      aria-selected={selected}
      aria-controls={`${ctx.baseId}-panel-${slug(value)}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      data-state={selected ? 'active' : 'inactive'}
      className={cx('adf-tabs__trigger', className)}
      onClick={composeHandlers(onClick, () => ctx.select(value))}
      onKeyDown={composeHandlers(onKeyDown, handleKeyDown)}
      {...rest}
    />
  );
});

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}
const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(function TabsContent({ value, className, ...rest }, ref) {
  const ctx = useTabs('Tabs.Content');
  const selected = ctx.value === value;
  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${ctx.baseId}-panel-${slug(value)}`}
      aria-labelledby={`${ctx.baseId}-tab-${slug(value)}`}
      tabIndex={0}
      hidden={!selected}
      className={cx('adf-tabs__content', className)}
      {...rest}
    />
  );
});

export const Tabs = Object.assign(TabsRoot, { List: TabsList, Trigger: TabsTrigger, Content: TabsContent });
