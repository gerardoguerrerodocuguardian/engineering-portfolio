import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useServices } from '@/core/services';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: AuthStatus;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { auth, tokenStore } = useServices();
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    tokenStore.get().then((token) => {
      if (!cancelled) setStatus(token ? 'signedIn' : 'signedOut');
    });
    return () => {
      cancelled = true;
    };
  }, [tokenStore]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const token = await auth.login(email.trim(), password);
      await tokenStore.set(token);
      setStatus('signedIn');
    },
    [auth, tokenStore],
  );

  const signOut = useCallback(async () => {
    await tokenStore.clear();
    setStatus('signedOut');
  }, [tokenStore]);

  const value = useMemo(() => ({ status, signIn, signOut }), [status, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
