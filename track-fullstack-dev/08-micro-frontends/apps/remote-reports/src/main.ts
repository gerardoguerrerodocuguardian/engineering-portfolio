import { getEventBus, type TokenProvider } from '@adflow/shared-contracts';

// Synthetic report numbers derived from the campaign id; no network.
export function fakeReport(campaignId: string) {
  const seed = [...campaignId].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { impressions: 10000 + seed * 137, clicks: 200 + seed * 3, ctr: ((200 + seed * 3) / (10000 + seed * 137)) * 100 };
}

export class AdflowReports extends HTMLElement {
  tokenProvider?: TokenProvider;
  private offs: Array<() => void> = [];
  private root = this.attachShadow({ mode: 'open' });
  private campaign?: { campaignId: string; name: string };
  private notes: string[] = [];

  connectedCallback() {
    const bus = getEventBus();
    this.campaign = bus.last('campaign:selected');
    this.offs.push(bus.on('campaign:selected', (d) => { this.campaign = d; this.render(); }));
    this.offs.push(bus.on('campaign:status-changed', (d) => { this.notes.unshift(`${d.campaignId} is now ${d.status}`); this.notes = this.notes.slice(0, 3); this.render(); }));
    this.render();
  }
  disconnectedCallback() { this.offs.forEach((o) => o()); this.offs = []; }

  private render() {
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const r = this.campaign ? fakeReport(this.campaign.campaignId) : null;
    this.root.innerHTML = `
      <style>
        :host { display: block; font-family: var(--adflow-font, sans-serif); color: var(--adflow-color-text, #222); }
        .card { background: var(--adflow-color-surface, #fff); border: 1px solid var(--adflow-color-border, #ccc); border-radius: var(--adflow-radius, 8px); padding: var(--adflow-space-3, 16px); }
        .muted { color: var(--adflow-color-muted, #666); }
      </style>
      <section class="card" aria-labelledby="h">
        <h2 id="h">Reports</h2>
        ${r && this.campaign
          ? `<p data-testid="report-campaign">Report for <strong>${esc(this.campaign.name)}</strong></p>
             <p>Impressions: ${r.impressions.toLocaleString('en-US')} | Clicks: ${r.clicks} | CTR: ${r.ctr.toFixed(2)}%</p>`
          : `<p class="muted" data-testid="report-empty">Select a campaign in Campaigns to see its report.</p>`}
        ${this.notes.length ? `<ul>${this.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
      </section>`;
  }
}
if (!customElements.get('adflow-reports')) customElements.define('adflow-reports', AdflowReports);
