import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { expireAccessTokens } from '@/mocks/handlers';
import { getSession, setSession } from '@/lib/session';
import { api } from './client';

const signIn = () => setSession({ accessToken: 'access-1', user: { name: 'Ada', role: 'ADMIN' } }, 'refresh-1');

describe('api client token refresh', () => {
  it('refreshes once on 401 and retries the original request', async () => {
    signIn();
    expireAccessTokens();
    let refreshCalls = 0;
    server.use(
      http.post('*/auth/refresh', () => {
        refreshCalls++;
        return HttpResponse.json({ accessToken: 'access-2', refreshToken: 'refresh-1', user: { name: 'Ada', role: 'ADMIN' } });
      }),
    );
    const { data, response } = await api.GET('/v1/campaigns', { params: { query: { page: 1, pageSize: 2 } } });
    expect(response.status).toBe(200);
    expect(data?.items).toHaveLength(2);
    expect(getSession()?.accessToken).toBe('access-2');
    expect(refreshCalls).toBe(1);
  });

  it('shares one refresh between parallel 401s (single-flight)', async () => {
    signIn();
    expireAccessTokens();
    let refreshCalls = 0;
    server.use(
      http.post('*/auth/refresh', async () => {
        refreshCalls++;
        return HttpResponse.json({ accessToken: 'access-2', refreshToken: 'refresh-1', user: { name: 'Ada', role: 'ADMIN' } });
      }),
    );
    const results = await Promise.all([api.GET('/v1/campaigns', {}), api.GET('/v1/campaigns/{id}', { params: { path: { id: 'cmp-001' } } })]);
    expect(results.map((r) => r.response.status)).toEqual([200, 200]);
    expect(refreshCalls).toBe(1);
  });

  it('clears the session when the refresh token is rejected', async () => {
    signIn();
    server.use(http.post('*/auth/refresh', () => new HttpResponse(null, { status: 401 })));
    expireAccessTokens();
    const { response } = await api.GET('/v1/campaigns', {});
    expect(response.status).toBe(401);
    expect(getSession()).toBeNull();
  });
});
