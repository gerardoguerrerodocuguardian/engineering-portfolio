import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Portal } from '../internal/Portal';
import { Slot } from '../internal/Slot';
import { TABBABLE, composeHandlers, composeRefs, cx, useControllableState } from '../internal/utils';

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  hasDescription: boolean;
  setHasDescription: (value: boolean) => void;
}
const DialogContext = createContext<DialogContextValue | null>(null);
function useDialog(part: string) {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error(`<${part}> must be used inside <Dialog>`);
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** Compound modal dialog: Dialog, Dialog.Trigger, Dialog.Content, Dialog.Title, Dialog.Description, Dialog.Close. */
function DialogRoot({ open: openProp, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const baseId = useId();
  const [hasDescription, setHasDescription] = useState(false);
  const value = useMemo(
    () => ({ open, setOpen, titleId: `${baseId}-title`, descriptionId: `${baseId}-desc`, hasDescription, setHasDescription }),
    [open, setOpen, baseId, hasDescription],
  );
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

interface TriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}
const DialogTrigger = forwardRef<HTMLButtonElement, TriggerProps>(function DialogTrigger({ asChild, onClick, ...rest }, ref) {
  const { open, setOpen } = useDialog('Dialog.Trigger');
  const props = {
    ref,
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': open,
    onClick: composeHandlers(onClick, () => setOpen(true)),
    ...rest,
  };
  return asChild ? <Slot {...(props as object)} /> : <button type="button" {...props} />;
});

const DialogClose = forwardRef<HTMLButtonElement, TriggerProps>(function DialogClose({ asChild, onClick, ...rest }, ref) {
  const { setOpen } = useDialog('Dialog.Close');
  const props = { ref, onClick: composeHandlers(onClick, () => setOpen(false)), ...rest };
  return asChild ? <Slot {...(props as object)} /> : <button type="button" {...props} />;
});

const DialogTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(function DialogTitle({ className, ...rest }, ref) {
  const { titleId } = useDialog('Dialog.Title');
  // eslint-disable-next-line jsx-a11y/heading-has-content -- content is supplied by the consumer via children
  return <h2 ref={ref} id={titleId} className={cx('adf-dialog__title', className)} {...rest} />;
});

const DialogDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(function DialogDescription(
  { className, ...rest },
  ref,
) {
  const { descriptionId, setHasDescription } = useDialog('Dialog.Description');
  useEffect(() => {
    setHasDescription(true);
    return () => setHasDescription(false);
  }, [setHasDescription]);
  return <p ref={ref} id={descriptionId} className={cx('adf-dialog__description', className)} {...rest} />;
});

const DialogContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function DialogContent(
  { className, children, onKeyDown, ...rest },
  ref,
) {
  const { open, setOpen, titleId, descriptionId, hasDescription } = useDialog('Dialog.Content');
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus management: move focus in on open, restore it to the previously focused element on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = contentRef.current;
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(TABBABLE) ?? node;
    first?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden'; // scroll lock
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    // Focus trap: wrap Tab / Shift+Tab inside the dialog.
    const items = [...(contentRef.current?.querySelectorAll<HTMLElement>(TABBABLE) ?? [])];
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const activeEl = document.activeElement;
    if (event.shiftKey && (activeEl === first || activeEl === contentRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && activeEl === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <Portal>
      {/* Pointer-only affordance: Escape and the Close button are the keyboard equivalents. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="adf-dialog__overlay" onClick={(event) => event.target === event.currentTarget && setOpen(false)}>
        {/* Key handling (Escape, Tab trap) is the documented dialog behaviour. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <div
          ref={composeRefs(ref, contentRef)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={hasDescription ? descriptionId : undefined}
          tabIndex={-1}
          className={cx('adf-dialog', className)}
          onKeyDown={composeHandlers(onKeyDown, handleKeyDown)}
          {...rest}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
});

export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});
