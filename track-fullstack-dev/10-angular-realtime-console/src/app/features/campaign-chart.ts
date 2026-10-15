import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConsoleStore } from '../core/console.store';

@Component({
  selector: 'app-campaign-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" aria-labelledby="ctr-h">
      <h2 id="ctr-h">CTR per campaign (rolling 30 s)</h2>
      <p class="hint">Computed in a Web Worker. Bars are decorative; the table carries the data.</p>
      <table>
        <thead>
          <tr><th scope="col">Campaign</th><th scope="col">Impr.</th><th scope="col">Clicks</th><th scope="col">CTR</th></tr>
        </thead>
        <tbody>
          @for (c of store.stream.snapshot().campaigns; track c.campaignId) {
            <tr>
              <th scope="row">{{ c.campaignId }}</th>
              <td>{{ c.impressions.toLocaleString('en-US') }}</td>
              <td>{{ c.clicks.toLocaleString('en-US') }}</td>
              <td class="ctr">
                <span class="bar" aria-hidden="true" [style.width.%]="(c.ctr / store.maxCtr()) * 100"></span>
                <span class="num">{{ (c.ctr * 100).toFixed(2) }}%</span>
              </td>
            </tr>
          } @empty {
            <tr><td colspan="4">Waiting for events...</td></tr>
          }
        </tbody>
      </table>
    </section>
  `,
  styles: `
    h2 { font-size: 1rem; }
    .hint { color: var(--muted); margin: 4px 0 8px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid var(--border); font-weight: normal; }
    thead th { color: var(--muted); font-size: 12px; }
    .ctr { position: relative; min-width: 110px; }
    .bar { position: absolute; left: 0; top: 4px; bottom: 4px; background: var(--bar); opacity: 0.25; border-radius: 3px; }
    .num { position: relative; }
  `,
})
export class CampaignChartComponent {
  protected readonly store = inject(ConsoleStore);
}
