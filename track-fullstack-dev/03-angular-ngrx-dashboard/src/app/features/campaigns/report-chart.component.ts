import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { CampaignReport } from '../../core/models';

/**
 * Dependency-free SVG funnel: impressions (100%) vs clicks (true proportion).
 * Accessible: role="img" with title/desc, direct labels, and the numbers are also
 * available as text in the report summary, so the chart never carries info alone.
 */
@Component({
  selector: 'app-report-chart',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 400 110" role="img" aria-labelledby="chart-title chart-desc" width="100%">
      <title id="chart-title">Impressions versus clicks</title>
      <desc id="chart-desc">{{ description() }}</desc>
      <text x="0" y="14" class="lbl">Impressions: {{ report().impressions | number }}</text>
      <rect x="0" y="20" width="400" height="22" fill="#c7cdf5" />
      <text x="0" y="68" class="lbl">Clicks: {{ report().clicks | number }}</text>
      <rect x="0" y="74" [attr.width]="clickWidth()" height="22" fill="#3342c4" />
    </svg>
  `,
  styles: `.lbl { font: 13px system-ui, sans-serif; fill: #15192b; }`,
})
export class ReportChartComponent {
  readonly report = input.required<CampaignReport>();

  /** Click bar width in viewBox units; at least 2 so a non-zero value stays visible. */
  readonly clickWidth = computed(() => {
    const { impressions, clicks } = this.report();
    if (impressions <= 0 || clicks <= 0) return 0;
    return Math.max(2, Math.min(400, (clicks / impressions) * 400));
  });

  readonly description = computed(() => {
    const r = this.report();
    return `${r.clicks} clicks out of ${r.impressions} impressions, a click-through rate of ${(r.ctr * 100).toFixed(2)} percent.`;
  });
}
