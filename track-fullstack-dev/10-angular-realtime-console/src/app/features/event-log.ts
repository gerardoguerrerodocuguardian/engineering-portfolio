import { ScrollingModule } from '@angular/cdk/scrolling';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConsoleStore } from '../core/console.store';
import { AdEvent } from '../core/models';

@Component({
  selector: 'app-event-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollingModule],
  template: `
    <section class="panel" id="log" aria-labelledby="log-h">
      <h2 id="log-h">Event log <span class="count" data-testid="row-count">{{ store.rows().length.toLocaleString('en-US') }}</span> rows</h2>
      <p class="hint">Newest first. Only the visible rows exist in the DOM. Focus the list and use arrow keys, Page Up/Down, Home.</p>
      <div class="head" aria-hidden="true"><span>Time (UTC)</span><span>Type</span><span>Campaign</span><span>Cost</span><span>Event id</span></div>
      <cdk-virtual-scroll-viewport
        itemSize="28"
        minBufferPx="280"
        maxBufferPx="560"
        tabindex="0"
        role="table"
        aria-label="Ad events"
        [attr.aria-rowcount]="store.rows().length"
      >
        <div *cdkVirtualFor="let e of store.rows(); trackBy: trackById; let i = index" class="row" role="row" [attr.aria-rowindex]="i + 1" [attr.data-type]="e.type">
          <span role="cell">{{ time(e) }}</span>
          <span role="cell" class="type">{{ e.type }}</span>
          <span role="cell">{{ e.campaignId }}</span>
          <span role="cell">{{ (e.costCents / 100).toFixed(2) }}</span>
          <span role="cell" class="id">{{ e.eventId }}</span>
        </div>
      </cdk-virtual-scroll-viewport>
    </section>
  `,
  styles: `
    h2 { font-size: 1rem; }
    .hint { color: var(--muted); margin: 4px 0 8px; font-size: 12px; }
    cdk-virtual-scroll-viewport { height: 420px; border: 1px solid var(--border); border-radius: 6px; }
    .head, .row { display: grid; grid-template-columns: 100px 100px 140px 70px 1fr; gap: 8px; padding: 0 8px; align-items: center; }
    .head { color: var(--muted); font-size: 12px; padding-bottom: 4px; }
    .row { height: 28px; font-family: ui-monospace, monospace; font-size: 12px; white-space: nowrap; overflow: hidden; border-bottom: 1px solid var(--border); }
    .id { overflow: hidden; text-overflow: ellipsis; color: var(--muted); }
    .row[data-type='CLICK'] .type { color: var(--ok); font-weight: 700; }
  `,
})
export class EventLogComponent {
  protected readonly store = inject(ConsoleStore);
  protected readonly trackById = (_: number, e: AdEvent) => e.eventId;
  protected time(e: AdEvent): string {
    return e.occurredAt.slice(11, 23);
  }
}
