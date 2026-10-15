import * as SecureStore from 'expo-secure-store';

/** Where the session token lives. The app only depends on this interface. */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

const KEY = 'adflow.session-token';

export function createSecureTokenStore(): TokenStore {
  return {
    get: () => SecureStore.getItemAsync(KEY),
    set: (token) => SecureStore.setItemAsync(KEY, token),
    clear: () => SecureStore.deleteItemAsync(KEY),
  };
}

export function createMemoryTokenStore(initial: string | null = null): TokenStore {
  let value = initial;
  return {
    get: async () => value,
    set: async (token) => {
      value = token;
    },
    clear: async () => {
      value = null;
    },
  };
}
