import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConsoleStore, TypeFilter } from '../core/console.store';
import { TransportKind } from '../core/transport';

@Component({
  selector: 'app-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel controls" aria-label="Stream controls and filters">
      <button
        type="button"
        class="primary"
        data-testid="pause"
        aria-keyshortcuts="P"
        [attr.aria-pressed]="store.stream.paused()"
        (click)="store.togglePause()"
      >
        {{ store.stream.paused() ? 'Resume display' : 'Pause display' }}
      </button>

      <label>Transport
        <select data-testid="transport" [value]="store.transport()" (change)="setTransport($event)">
          <option value="ws">WebSocket</option>
          <option value="sse">Server-sent events</option>
        </select>
      </label>

      <label>Server rate (events/s)
        <select data-testid="rate" [value]="store.rateEps() ?? ''" (change)="setRate($event)">
          @for (r of store.ratePresets(); track r) {
            <option [value]="r" [selected]="r === store.rateEps()">{{ r.toLocaleString('en-US') }}</option>
          }
        </select>
      </label>

      <label>Event type
        <select data-testid="type-filter" [value]="store.typeFilter()" (change)="setType($event)">
          <option value="ALL">All</option>
          <option value="IMPRESSION">Impressions</option>
          <option value="CLICK">Clicks</option>
        </select>
      </label>

      <label>Campaign
        <select data-testid="campaign-filter" [value]="store.campaignFilter()" (change)="setCampaign($event)">
          <option value="ALL">All campaigns</option>
          @for (c of store.campaignOptions(); track c) {
            <option [value]="c" [selected]="c === store.campaignFilter()">{{ c }}</option>
          }
        </select>
      </label>

      <button type="button" (click)="store.stream.clear()">Clear</button>
      <button type="button" data-testid="theme" [attr.aria-pressed]="store.theme() === 'dark'" (click)="store.toggleTheme()">
        Dark mode
      </button>
    </section>
  `,
  styles: `
    .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
    label { display: grid; gap: 2px; color: var(--muted); font-size: 12px; }
    button[aria-pressed='true']:not(.primary) { background: var(--accent); color: var(--accent-text); }
  `,
})
export class ControlsComponent {
  protected readonly store = inject(ConsoleStore);

  private value(e: Event): string {
    return (e.target as HTMLSelectElement).value;
  }
  protected setTransport(e: Event): void {
    this.store.transport.set(this.value(e) as TransportKind);
  }
  protected setRate(e: Event): void {
    void this.store.setRate(Number(this.value(e)));
  }
  protected setType(e: Event): void {
    this.store.typeFilter.set(this.value(e) as TypeFilter);
  }
  protected setCampaign(e: Event): void {
    this.store.campaignFilter.set(this.value(e));
  }
}
