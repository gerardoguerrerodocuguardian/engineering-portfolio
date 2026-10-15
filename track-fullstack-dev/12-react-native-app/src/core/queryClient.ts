import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';

export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Persisted entries must outlive the persister's maxAge or they are garbage collected first.
        gcTime: CACHE_MAX_AGE_MS,
        staleTime: 30_000,
        retry: 1,
        networkMode: 'offlineFirst',
      },
    },
  });
}

export function createPersister() {
  return createAsyncStoragePersister({ storage: AsyncStorage, key: 'adflow.query-cache', throttleTime: 1000 });
}
