import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthProvider';

/** Signing out also wipes the persisted query cache so the next user starts clean. */
export function useSignOut() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  return async () => {
    await signOut();
    queryClient.clear();
  };
}
