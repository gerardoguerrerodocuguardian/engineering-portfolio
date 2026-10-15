import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Portal } from '../internal/Portal';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';
export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** ms before auto-dismiss; Infinity keeps it until dismissed. Default 5000. Pauses on hover/focus. */
  duration?: number;
}
interface ToastItem extends ToastOptions {
  id: number;
}
interface ToastApi {
  toast: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}
const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  const { id, duration = 5000, tone = 'info' } = item;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(duration);

  useEffect(() => {
    if (paused || !Number.isFinite(remaining.current)) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, id, onDismiss]);

  return (
    // role=alert interrupts (errors); role=status is polite. The wrapper only pauses the timer.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className="adf-toast"
      data-tone={tone}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="adf-toast__body">
        <strong className="adf-toast__title">{item.title}</strong>
        {item.description && <span className="adf-toast__description">{item.description}</span>}
      </div>
      <button type="button" className="adf-toast__close" aria-label={`Dismiss notification: ${item.title}`} onClick={() => onDismiss(id)}>
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}

export function ToastProvider({ children, label = 'Notifications' }: { children: ReactNode; label?: string }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const toast = useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { ...options, id }]);
    return id;
  }, []);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Portal>
        <section aria-label={label} className="adf-toast-viewport">
          {items.map((item) => (
            <ToastView key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </section>
      </Portal>
    </ToastContext.Provider>
  );
}
