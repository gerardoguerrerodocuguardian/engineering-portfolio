import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/theme/theme';

interface Props {
  title: string;
  onPress: () => void;
  accessibilityHint?: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export function Button({ title, onPress, accessibilityHint, loading, disabled, variant = 'primary' }: Props) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: primary ? theme.primary : 'transparent', borderColor: theme.primary },
        inactive && styles.inactive,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? theme.primaryText : theme.primary} />
      ) : (
        <Text style={[styles.label, { color: primary ? theme.primaryText : theme.primary }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  label: { fontSize: 16, fontWeight: '600' },
  inactive: { opacity: 0.6 },
});
