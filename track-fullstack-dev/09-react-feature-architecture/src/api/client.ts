import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { clearSession, getRefreshToken, getSession, setSession } from '@/lib/session';

const baseUrl = import.meta.env.VITE_API_URL ?? window.location.origin;

/** Auth endpoints are NOT part of the campaign contract; they belong to the (mocked) identity service. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: { name: string; role: 'ADVERTISER' | 'ADMIN' };
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new ApiError(res.status, 'Invalid credentials');
  return (await res.json()) as TokenPair;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh: N parallel 401s trigger exactly one refresh call. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const pair = (await res.json()) as TokenPair;
      setSession({ accessToken: pair.accessToken, user: pair.user }, pair.refreshToken);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function withAuth(req: Request): Request {
  const token = getSession()?.accessToken;
  if (token) req.headers.set('Authorization', `Bearer ${token}`);
  return req;
}

const authFetch: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const retry = request.clone();
  const res = await fetch(withAuth(request));
  if (res.status !== 401) return res;
  if (await refreshSession()) return fetch(withAuth(retry));
  clearSession();
  return res;
};

export const api = createClient<paths>({ baseUrl, fetch: authFetch });

/** Unwraps an openapi-fetch result or throws a typed ApiError (so TanStack Query sees failures). */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.data === undefined) {
    const problem = result.error as { title?: string } | undefined;
    throw new ApiError(result.response.status, problem?.title ?? result.response.statusText);
  }
  return result.data;
}
