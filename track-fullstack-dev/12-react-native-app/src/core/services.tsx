import { createContext, useContext, type ReactNode } from 'react';
import { createApiClient, type ApiClient } from '@/api/client';
import { createFakeServer, FAKE_TOKEN } from '@/api/fakeServer';
import { createMockAuthService, type AuthService } from '@/features/auth/authService';
import { createStubPushService, type PushService } from './pushService';
import { createSecureTokenStore, type TokenStore } from './tokenStore';

export interface Services {
  api: ApiClient;
  auth: AuthService;
  tokenStore: TokenStore;
  push: PushService;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside <ServicesProvider>');
  return services;
}

/**
 * Composition root. Without EXPO_PUBLIC_API_URL the app talks to the in-memory fake server
 * (synthetic data), which is the default for dev builds and the web export.
 */
export function createDefaultServices(onUnauthorized: () => void): Services {
  const tokenStore = createSecureTokenStore();
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  const fake = baseUrl ? undefined : createFakeServer();
  return {
    tokenStore,
    api: createApiClient({
      baseUrl: baseUrl ?? 'http://fake.local',
      fetchImpl: fake?.fetch,
      getToken: () => tokenStore.get(),
      onUnauthorized,
    }),
    auth: createMockAuthService(FAKE_TOKEN),
    push: createStubPushService(),
  };
}
