export type PushPermission = 'undetermined' | 'granted' | 'denied';

/**
 * Push notifications behind an interface. A production implementation would wrap
 * expo-notifications (permissions + device token registration); this app ships a stub.
 */
export interface PushService {
  getPermission(): Promise<PushPermission>;
  requestPermission(): Promise<PushPermission>;
}

/** In-memory stub. `willGrant` simulates the user's answer to the system dialog. */
export function createStubPushService(options: { initial?: PushPermission; willGrant?: boolean } = {}): PushService {
  let current: PushPermission = options.initial ?? 'undetermined';
  const willGrant = options.willGrant ?? true;
  return {
    getPermission: async () => current,
    requestPermission: async () => {
      // The OS only prompts once; afterwards the answer is final.
      if (current === 'undetermined') current = willGrant ? 'granted' : 'denied';
      return current;
    },
  };
}
