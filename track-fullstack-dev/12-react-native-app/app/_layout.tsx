import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { ServicesProvider, createDefaultServices } from '@/core/services';
import { CACHE_MAX_AGE_MS, createPersister, createQueryClient } from '@/core/queryClient';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme/theme';

function AuthGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    if (status === 'loading') return;
    const onLogin = segments[0] === 'login';
    if (status === 'signedOut' && !onLogin) router.replace(routes.login);
    if (status === 'signedIn' && onLogin) router.replace(routes.campaigns);
  }, [status, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [{ queryClient, persister, services }] = useState(() => {
    const client = createQueryClient();
    return {
      queryClient: client,
      persister: createPersister(),
      // A 401 clears cached data so the next user never sees the previous user's campaigns.
      services: createDefaultServices(() => client.clear()),
    };
  });

  return (
    <ServicesProvider services={services}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS }}>
        <AuthProvider>
          <StatusBar style="auto" />
          <AuthGate />
        </AuthProvider>
      </PersistQueryClientProvider>
    </ServicesProvider>
  );
}
