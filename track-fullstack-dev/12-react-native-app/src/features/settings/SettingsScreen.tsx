import { View } from 'react-native';
import { Button } from '@/components/Button';
import { useSignOut } from '@/features/auth/useSignOut';
import { NotificationPrompt } from '@/features/notifications/NotificationPrompt';

export function SettingsScreen() {
  const signOut = useSignOut();
  return (
    <View>
      <NotificationPrompt />
      <View style={{ marginHorizontal: 16 }}>
        <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
      </View>
    </View>
  );
}
