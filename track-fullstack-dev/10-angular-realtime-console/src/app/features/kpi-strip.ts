import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ConsoleStore } from '../core/console.store';

@Component({
  selector: 'app-kpi-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="kpis" aria-label="Key metrics">
      @for (k of items(); track k.label) {
        <div class="panel">
          <div class="label">{{ k.label }}</div>
          <div class="value" [attr.data-testid]="k.id">{{ k.value }}</div>
        </div>
      }
      <div class="panel spark">
        <div class="label">Events/s, last {{ store.stream.snapshot().windowSec }} s</div>
        <svg viewBox="0 0 120 32" preserveAspectRatio="none" role="img" [attr.aria-label]="'Events per second, latest ' + latest()">
          <polyline [attr.points]="points()" fill="none" stroke="var(--bar)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        </svg>
      </div>
    </section>
  `,
  styles: `
    .kpis { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    .label { color: var(--muted); font-size: 12px; }
    .value { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; }
    svg { width: 100%; height: 36px; }
  `,
})
export class KpiStripComponent {
  protected readonly store = inject(ConsoleStore);
  private readonly fmt = (n: number) => n.toLocaleString('en-US');

  protected readonly items = computed(() => {
    const s = this.store.stream;
    return [
      { id: 'eps', label: 'Events / second', value: this.fmt(s.snapshot().eventsPerSec) },
      { id: 'received', label: 'Received', value: this.fmt(s.received()) },
      { id: 'ctr', label: 'Overall CTR (30 s)', value: (this.store.overallCtr() * 100).toFixed(2) + '%' },
      { id: 'log-size', label: 'Log rows', value: `${this.fmt(s.logSize())} / ${this.fmt(s.log.capacity)}` },
      { id: 'sampled', label: 'Sampled out (backpressure)', value: this.fmt(s.sampledOut()) },
      { id: 'dups', label: 'Duplicates dropped', value: this.fmt(s.duplicates()) },
    ];
  });

  protected readonly latest = computed(() => this.store.stream.snapshot().history.at(-1) ?? 0);
  protected readonly points = computed(() => {
    const h = this.store.stream.snapshot().history;
    const max = Math.max(1, ...h);
    return h.map((v, i) => `${(i / Math.max(1, h.length - 1)) * 120},${30 - (v / max) * 28}`).join(' ');
  });
}
