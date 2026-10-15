import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { createApiClient } from '@/api/client';
import { createFakeServer, FAKE_TOKEN, type FakeServer, type FakeServerOptions } from '@/api/fakeServer';
import { ServicesProvider, type Services } from '@/core/services';
import { createStubPushService } from '@/core/pushService';
import { createMemoryTokenStore } from '@/core/tokenStore';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { createMockAuthService } from '@/features/auth/authService';

export interface Harness {
  server: FakeServer;
  services: Services;
  queryClient: QueryClient;
  wrapper: (props: { children: ReactNode }) => ReactElement;
}

export function createHarness(
  serverOptions: FakeServerOptions = {},
  overrides: Partial<Services> = {},
  signedIn = true,
): Harness {
  const server = createFakeServer({ latencyMs: 0, ...serverOptions });
  const tokenStore = createMemoryTokenStore(signedIn ? FAKE_TOKEN : null);
  const services: Services = {
    tokenStore,
    api: createApiClient({ baseUrl: 'http://fake.local', fetchImpl: server.fetch, getToken: () => tokenStore.get() }),
    auth: createMockAuthService(FAKE_TOKEN),
    push: createStubPushService(),
    ...overrides,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServicesProvider services={services}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ServicesProvider>
  );
  return { server, services, queryClient, wrapper };
}

export function renderScreen(ui: ReactElement, harness: Harness) {
  return render(ui, { wrapper: harness.wrapper });
}

export function renderHookWith<T>(hook: () => T, harness: Harness) {
  return renderHook(hook, { wrapper: harness.wrapper });
}
