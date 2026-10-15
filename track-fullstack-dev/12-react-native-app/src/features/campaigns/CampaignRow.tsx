import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { Campaign } from '@/api/types';
import { useTheme } from '@/theme/theme';
import { formatMoney } from './domain';
import { StatusBadge } from './StatusBadge';

interface Props {
  campaign: Campaign;
  onPress: (id: string) => void;
}

function CampaignRowBase({ campaign, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${campaign.name}, ${campaign.status.toLowerCase()}, daily budget ${formatMoney(campaign.dailyBudgetCents)}`}
      accessibilityHint="Opens campaign details"
      onPress={() => onPress(campaign.id)}
      style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Text style={[styles.name, { color: theme.text }]}>{campaign.name}</Text>
      <StatusBadge status={campaign.status} />
      <Text style={{ color: theme.textMuted }}>Daily budget {formatMoney(campaign.dailyBudgetCents)}</Text>
    </Pressable>
  );
}

export const CampaignRow = memo(CampaignRowBase);

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6, marginHorizontal: 16, marginVertical: 6, minHeight: 48 },
  name: { fontSize: 16, fontWeight: '600' },
});
