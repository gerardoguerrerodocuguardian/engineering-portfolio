import { useState } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { RouterProvider, type DataRouter } from 'react-router';
import { I18nProvider, type Locale } from '@/i18n';
import { LiveRegionProvider } from '@/components/LiveRegion';
import { createQueryClient } from '@/lib/query-client';
import { createAppRouter } from './router';

export function Providers({ client, locale, children }: { client: QueryClient; locale?: Locale; children: React.ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <I18nProvider initial={locale}>
        <LiveRegionProvider>{children}</LiveRegionProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export function App() {
  const [{ client, router }] = useState<{ client: QueryClient; router: DataRouter }>(() => {
    const client = createQueryClient();
    return { client, router: createAppRouter(client) };
  });
  return (
    <Providers client={client}>
      <RouterProvider router={router} />
    </Providers>
  );
}
