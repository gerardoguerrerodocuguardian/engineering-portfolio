import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/theme';
import { usePushPermission } from './usePushPermission';

const COPY = {
  granted: 'Push notifications are on. You will be alerted when a campaign runs out of budget.',
  denied: 'Push notifications are off. You can enable them later in system settings.',
  undetermined: 'Get alerted when a campaign runs out of budget or is paused by policy.',
} as const;

export function NotificationPrompt() {
  const theme = useTheme();
  const { permission, canAsk, request } = usePushPermission();
  if (permission === 'loading') return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        Notifications
      </Text>
      <Text style={{ color: theme.textMuted }}>{COPY[permission]}</Text>
      {canAsk ? (
        <Button
          title="Enable notifications"
          onPress={() => void request()}
          accessibilityHint="Shows the system permission dialog"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12, margin: 16 },
  title: { fontSize: 18, fontWeight: '700' },
});
