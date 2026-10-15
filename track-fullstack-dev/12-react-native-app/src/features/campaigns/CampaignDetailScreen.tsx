import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useTheme } from '@/theme/theme';
import { formatMoney, toggleLabel } from './domain';
import { useCampaign, useCampaignReport, useCampaignToggle } from './hooks';
import { ReportChart } from './ReportChart';
import { StatusBadge } from './StatusBadge';

export function CampaignDetailScreen({ id }: { id: string }) {
  const theme = useTheme();
  const campaign = useCampaign(id);
  const report = useCampaignReport(id);
  const toggle = useCampaignToggle(id, campaign.data?.status);

  if (campaign.isPending) return <LoadingView label="Loading campaign" />;
  if (campaign.isError || !campaign.data) {
    return <ErrorView message="Could not load this campaign." onRetry={() => void campaign.refetch()} />;
  }
  const data = campaign.data;
  const label = toggleLabel(data.status);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
        {data.name}
      </Text>
      <StatusBadge status={data.status} />
      <Text style={{ color: theme.textMuted }}>
        Daily budget {formatMoney(data.dailyBudgetCents)} | Max bid {formatMoney(data.maxBidCents)}
      </Text>

      {label && toggle.canToggle ? (
        <Button
          title={label}
          onPress={toggle.toggle}
          loading={toggle.isPending}
          accessibilityHint={`${label} this campaign`}
        />
      ) : null}
      {toggle.error ? (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {toggle.error}
        </Text>
      ) : null}

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text accessibilityRole="header" style={[styles.subtitle, { color: theme.text }]}>
          Performance
        </Text>
        {report.isPending ? <LoadingView label="Loading report" /> : null}
        {report.isError ? <ErrorView message="Could not load the report." onRetry={() => void report.refetch()} /> : null}
        {report.data ? <ReportChart report={report.data} /> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 18, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12, marginTop: 8 },
});
