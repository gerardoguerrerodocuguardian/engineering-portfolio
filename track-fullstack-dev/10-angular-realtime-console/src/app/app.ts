import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConsoleStore } from './core/console.store';
import { ControlsComponent } from './features/controls';
import { KpiStripComponent } from './features/kpi-strip';
import { CampaignChartComponent } from './features/campaign-chart';
import { EventLogComponent } from './features/event-log';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ControlsComponent, KpiStripComponent, CampaignChartComponent, EventLogComponent],
  host: { '(document:keydown)': 'onKey($event)' },
  template: `
    <a class="skip-link" href="#log">Skip to event log</a>

    <header>
      <h1>AdFlow Realtime Console</h1>
      <p class="status" data-testid="status" [attr.data-state]="store.stream.connection().state">
        <span class="dot" aria-hidden="true"></span>{{ store.statusMessage() }}
      </p>
    </header>

    <!-- Polite, low-frequency: connection changes and a 5 s summary. Never the event firehose. -->
    <div class="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{{ store.announcement() }}</div>

    <main>
      <app-controls />
      <app-kpi-strip />

      <div class="grid">
        @defer (on idle) {
          <app-campaign-chart />
        } @placeholder {
          <section class="panel" aria-busy="true">Loading campaign chart...</section>
        } @error {
          <section class="panel" role="alert">The campaign chart failed to load.</section>
        }

        @defer (on idle) {
          <app-event-log />
        } @placeholder {
          <section class="panel" aria-busy="true">Loading event log...</section>
        }
      </div>
    </main>
  `,
  styles: `
    :host { display: block; max-width: 1200px; margin: 0 auto; padding: 16px; }
    header { display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px; }
    h1 { font-size: 1.4rem; }
    .status { margin: 0; color: var(--muted); }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; background: var(--muted); }
    [data-state='open'] .dot { background: var(--ok); }
    [data-state='reconnecting'] .dot { background: var(--warn); }
    main { display: grid; gap: 12px; margin-top: 12px; }
    .grid { display: grid; gap: 12px; grid-template-columns: minmax(280px, 1fr) minmax(420px, 2fr); align-items: start; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
  `,
})
export class App {
  protected readonly store = inject(ConsoleStore);

  /** Global shortcut: P toggles pause (ignored while typing in a form control). */
  protected onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (e.key.toLowerCase() !== 'p' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (t && ['SELECT', 'INPUT', 'TEXTAREA'].includes(t.tagName)) return;
    this.store.togglePause();
  }
}
