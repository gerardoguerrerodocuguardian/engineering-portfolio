import { render } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { Providers } from '@/app/App';
import { createTestRouter } from '@/app/router';
import { createQueryClient } from '@/lib/query-client';
import { setSession } from '@/lib/session';
import { expireAccessTokens } from '@/mocks/handlers';
import type { Locale } from '@/i18n';

export function signedIn() {
  setSession({ accessToken: 'access-1', user: { name: 'Ada Example', role: 'ADMIN' } }, 'refresh-1');
}

export { expireAccessTokens };

/** Renders the real route table (lazy chunks, loaders, guards) against the MSW server. */
export function renderApp(path: string, opts: { locale?: Locale } = {}) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const router = createTestRouter(client, [path]);
  const utils = render(
    <Providers client={client} locale={opts.locale ?? 'en'}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...utils, router, client };
}
