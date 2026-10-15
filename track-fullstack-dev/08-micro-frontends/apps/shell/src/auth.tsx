import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { getEventBus, type TokenProvider } from '@adflow/shared-contracts';

interface AuthValue { provider: TokenProvider; signedIn: boolean; signIn(): void; signOut(): void }
const AuthContext = createContext<AuthValue | null>(null);

// Synthetic demo token. A real shell would obtain/refresh it via OIDC; remotes would not change.
const DEMO = { token: 'demo-adflow-token', user: { id: 'u-1', name: 'Demo Advertiser' } };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const value = useMemo<AuthValue>(() => {
    // Stable identity: remotes receive this object once and it reads the live session on each call.
    const state = { current: signedIn };
    const provider: TokenProvider = {
      getToken: async () => (state.current ? DEMO.token : null),
      getUser: () => (state.current ? DEMO.user : null),
    };
    return {
      provider, signedIn,
      signIn: () => { state.current = true; setSignedIn(true); },
      signOut: () => { state.current = false; setSignedIn(false); getEventBus().emit('auth:signed-out', {}); },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
