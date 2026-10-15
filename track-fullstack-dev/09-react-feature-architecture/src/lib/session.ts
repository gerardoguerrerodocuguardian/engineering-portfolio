import { useSyncExternalStore } from 'react';

/**
 * Shared session store. Access token lives in memory only (not readable by
 * other tabs / persisted XSS loot); the refresh token is kept in sessionStorage
 * so a reload does not log the user out. A real deployment would prefer an
 * httpOnly refresh cookie - noted in the README trade-offs.
 */
export interface Session {
  accessToken: string;
  user: { name: string; role: 'ADVERTISER' | 'ADMIN' };
}

const REFRESH_KEY = 'adflow.refresh';
let session: Session | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

export const getSession = () => session;
export const getRefreshToken = () => sessionStorage.getItem(REFRESH_KEY);

export function setSession(next: Session, refreshToken: string) {
  session = next;
  sessionStorage.setItem(REFRESH_KEY, refreshToken);
  emit();
}

export function setAccessToken(accessToken: string, refreshToken?: string) {
  if (session) session = { ...session, accessToken };
  if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken);
  emit();
}

export function clearSession() {
  session = null;
  sessionStorage.removeItem(REFRESH_KEY);
  emit();
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useSessionState = () => useSyncExternalStore(subscribeSession, getSession);
