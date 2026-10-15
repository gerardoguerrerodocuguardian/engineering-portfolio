import { redirect } from 'react-router';
import { z } from 'zod';
import { login, refreshSession } from '@/api/client';
import { getSession, setSession, clearSession } from '@/lib/session';

export const loginSchema = z.object({
  email: z.email('form.error.email'),
  password: z.string().min(1, 'form.error.required'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export async function signIn(values: LoginValues) {
  const pair = await login(values.email, values.password);
  setSession({ accessToken: pair.accessToken, user: pair.user }, pair.refreshToken);
}

export const signOut = clearSession;

/**
 * Route guard used by the app shell. A reload loses the in-memory access token,
 * so we first try to restore it from the refresh token before redirecting.
 */
export async function requireAuth(request: Request) {
  if (getSession()) return;
  if (await refreshSession()) return;
  const url = new URL(request.url);
  throw redirect(`/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
}
