import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/theme';
import { Button } from './Button';

export function LoadingView({ label = 'Loading' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center} accessible accessibilityLabel={label} accessibilityRole="progressbar">
      <ActivityIndicator color={theme.primary} />
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Text accessibilityRole="alert" style={[styles.message, { color: theme.danger }]}>
        {message}
      </Text>
      <Button title="Try again" onPress={onRetry} variant="secondary" />
    </View>
  );
}

export function Banner({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: theme.surface, borderColor: theme.warning }]} accessibilityRole="alert">
      <Text style={{ color: theme.warning }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  message: { fontSize: 16, textAlign: 'center' },
  banner: { borderWidth: 1, borderRadius: 8, padding: 10, marginHorizontal: 16, marginTop: 8 },
});
