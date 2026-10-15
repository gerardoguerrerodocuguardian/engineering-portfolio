import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { useTheme } from '@/theme/theme';
import { useLoginForm } from './useLoginForm';

export function LoginScreen() {
  const theme = useTheme();
  const form = useLoginForm();
  const input = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface }];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        AdFlow Mobile
      </Text>
      <Text style={{ color: theme.textMuted }}>Demo sign-in: any email with the password adflow-demo.</Text>

      <TextInput
        style={input}
        accessibilityLabel="Email"
        placeholder="Email"
        placeholderTextColor={theme.textMuted}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={form.email}
        onChangeText={form.setEmail}
      />
      {form.errors.email ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{form.errors.email}</Text> : null}

      <TextInput
        style={input}
        accessibilityLabel="Password"
        placeholder="Password"
        placeholderTextColor={theme.textMuted}
        secureTextEntry
        autoComplete="password"
        value={form.password}
        onChangeText={form.setPassword}
        onSubmitEditing={() => void form.submit()}
      />
      {form.errors.password ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{form.errors.password}</Text> : null}
      {form.formError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{form.formError}</Text> : null}

      <Button title="Sign in" onPress={() => void form.submit()} loading={form.submitting} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 },
});
