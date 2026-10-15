import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { DecimalPipe, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CampaignActions } from '../../store/campaign.actions';
import { campaignsFeature } from '../../store/campaign.reducer';
import { ReportChartComponent } from './report-chart.component';

@Component({
  selector: 'app-campaign-report',
  imports: [ReportChartComponent, RouterLink, DecimalPipe, PercentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 tabindex="-1">Campaign report</h1>
    <p><a routerLink="/campaigns">Back to campaigns</a></p>
    @if (error(); as e) { <div class="alert" role="alert">{{ e }}</div> }
    <p aria-live="polite">@if (loading()) { Loading report... }</p>
    @if (report(); as r) {
      <section class="card" aria-labelledby="summary-title">
        <h2 id="summary-title">Summary</h2>
        <dl>
          <dt>Impressions</dt><dd>{{ r.impressions | number }}</dd>
          <dt>Clicks</dt><dd>{{ r.clicks | number }}</dd>
          <dt>Spend</dt><dd>{{ r.spendCents / 100 | number: '1.2-2' }} USD</dd>
          <dt>CTR</dt><dd>{{ r.ctr | percent: '1.2-2' }}</dd>
        </dl>
        <app-report-chart [report]="r" />
      </section>
    }
  `,
})
export class CampaignReportComponent {
  readonly id = input.required<string>();
  private readonly store = inject(Store);
  protected readonly report = this.store.selectSignal(campaignsFeature.selectReport);
  protected readonly loading = this.store.selectSignal(campaignsFeature.selectReportLoading);
  protected readonly error = this.store.selectSignal(campaignsFeature.selectError);

  constructor() {
    effect(() => this.store.dispatch(CampaignActions.reportRequested({ id: this.id() })));
  }
}
