import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { CampaignReport } from '@/api/types';
import { useTheme } from '@/theme/theme';
import { buildFunnel, describeFunnel, formatCount, formatMoney, formatPercent } from './domain';

const WIDTH = 300;
const BAR_HEIGHT = 20;

export function ReportChart({ report }: { report: CampaignReport }) {
  const theme = useTheme();
  const bars = buildFunnel(report);
  const summary = `${describeFunnel(bars)}. Click-through rate ${formatPercent(report.ctr)}. Spend ${formatMoney(report.spendCents)}.`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Report chart. ${summary}`} style={styles.container}>
      {bars.map((bar, i) => (
        <View key={bar.key} style={styles.barBlock}>
          <View style={styles.legend}>
            <Text style={{ color: theme.textMuted }}>{bar.label}</Text>
            <Text style={{ color: theme.text, fontWeight: '600' }}>{formatCount(bar.value)}</Text>
          </View>
          <Svg width="100%" height={BAR_HEIGHT} viewBox={`0 0 ${WIDTH} ${BAR_HEIGHT}`} preserveAspectRatio="none">
            <Rect x={0} y={0} width={WIDTH} height={BAR_HEIGHT} rx={4} fill={theme.border} />
            <Rect x={0} y={0} width={WIDTH * bar.ratio} height={BAR_HEIGHT} rx={4} fill={i === 0 ? theme.bar : theme.barAlt} />
          </Svg>
        </View>
      ))}
      <Text style={{ color: theme.textMuted }}>
        CTR {formatPercent(report.ctr)}  |  Spend {formatMoney(report.spendCents)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  barBlock: { gap: 4 },
  legend: { flexDirection: 'row', justifyContent: 'space-between' },
});
