import { useCallback, useEffect, useState } from 'react';
import { useServices } from '@/core/services';
import type { PushPermission } from '@/core/pushService';

export function usePushPermission() {
  const { push } = useServices();
  const [permission, setPermission] = useState<PushPermission | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    push.getPermission().then((p) => {
      if (!cancelled) setPermission(p);
    });
    return () => {
      cancelled = true;
    };
  }, [push]);

  const request = useCallback(async () => setPermission(await push.requestPermission()), [push]);

  return {
    permission,
    /** Ask only while the OS can still show its dialog. */
    canAsk: permission === 'undetermined',
    request,
  };
}
