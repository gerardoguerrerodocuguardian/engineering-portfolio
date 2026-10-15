/**
 * Auth contract. The shell owns the session; remotes only ever see this read-only interface,
 * so a remote never imports shell code and never stores credentials itself.
 */
export interface TokenProvider {
  /** Returns a bearer token or null when signed out. May refresh internally. */
  getToken(): Promise<string | null>;
  /** Minimal identity for display; never contains the token. */
  getUser(): { id: string; name: string } | null;
}

/** Props every React remote component accepts. */
export interface RemoteProps {
  tokenProvider: TokenProvider;
}

export const staticTokenProvider = (token: string | null, user: { id: string; name: string } | null): TokenProvider => ({
  getToken: async () => token,
  getUser: () => user,
});
