import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Announce = (message: string) => void;
const Ctx = createContext<Announce>(() => {});

/** App-wide polite live region: mutation results are announced to screen readers and shown visually. */
export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const announce = useCallback<Announce>((m) => {
    setMessage('');
    // re-set on next tick so identical consecutive messages are announced again
    setTimeout(() => setMessage(m), 0);
  }, []);
  return (
    <Ctx.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" className="toast" data-testid="live-region">
        {message}
      </div>
    </Ctx.Provider>
  );
}

export const useAnnounce = () => useContext(Ctx);
