import { StyleSheet, Text, View } from 'react-native';
import type { CampaignStatus } from '@/api/types';
import { useTheme } from '@/theme/theme';

const LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  EXHAUSTED: 'Budget exhausted',
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const theme = useTheme();
  const color = { DRAFT: theme.textMuted, ACTIVE: theme.success, PAUSED: theme.warning, EXHAUSTED: theme.danger }[status];
  return (
    <View style={[styles.badge, { borderColor: color }]} accessible accessibilityLabel={`Status: ${LABELS[status]}`}>
      <Text style={[styles.text, { color }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
