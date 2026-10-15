import * as SecureStore from 'expo-secure-store';
import { createMemoryTokenStore, createSecureTokenStore } from './tokenStore';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'stored'),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

describe('token stores', () => {
  it('delegates to expo-secure-store under a namespaced key', async () => {
    const store = createSecureTokenStore();
    expect(await store.get()).toBe('stored');
    await store.set('abc');
    await store.clear();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('adflow.session-token', 'abc');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('adflow.session-token');
  });

  it('memory store round-trips', async () => {
    const store = createMemoryTokenStore();
    expect(await store.get()).toBeNull();
    await store.set('t');
    expect(await store.get()).toBe('t');
    await store.clear();
    expect(await store.get()).toBeNull();
  });
});
