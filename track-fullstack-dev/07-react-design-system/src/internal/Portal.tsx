import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const subscribe = () => () => {};

/** Client-only portal to document.body (renders nothing during SSR). */
export function Portal({ children }: { children: ReactNode }) {
  // false on the server and during hydration, true afterwards, without an extra effect/render pass.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}
