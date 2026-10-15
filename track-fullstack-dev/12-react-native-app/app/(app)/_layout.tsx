import { Stack, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { routes } from '@/navigation/routes';
import { useTheme } from '@/theme/theme';

export default function AppLayout() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        contentStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Campaigns',
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push(routes.settings)}>
              <Text style={{ color: theme.primary, fontSize: 16, padding: 8 }}>Settings</Text>
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="campaign/[id]" options={{ title: 'Campaign' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
