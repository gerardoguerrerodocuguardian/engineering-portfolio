import { Injectable, computed, effect, inject, linkedSignal, resource, signal, untracked } from '@angular/core';
import { AdEvent } from './models';
import { StreamService } from './stream.service';
import { SERVER_BASE, TransportKind } from './transport';

export type TypeFilter = 'ALL' | 'IMPRESSION' | 'CLICK';
export type Theme = 'light' | 'dark';

interface ServerConfig {
  campaigns: string[];
  rateEps: number;
  ratePresets: number[];
}
const FALLBACK_CONFIG: ServerConfig = { campaigns: [], rateEps: 50, ratePresets: [10, 100, 1000, 5000, 20000] };

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable (private mode); preferences just will not persist */
  }
};

/**
 * UI state for the console. Signals only: writable signals for user intent, `computed` for derivations,
 * `linkedSignal` for state that must reset when its source changes, `effect` strictly for side effects
 * that leave the signal graph (DOM attribute, localStorage, connection lifecycle, throttled announcements).
 */
@Injectable({ providedIn: 'root' })
export class ConsoleStore {
  readonly stream = inject(StreamService);
  private readonly base = inject(SERVER_BASE);

  // --- user intent ---------------------------------------------------------------------------------
  readonly transport = signal<TransportKind>(read('rt.transport') === 'sse' ? 'sse' : 'ws');
  readonly typeFilter = signal<TypeFilter>('ALL');
  readonly theme = signal<Theme>(
    (read('rt.theme') as Theme | null) ??
      (typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  );
  readonly rateEps = signal<number | null>(null);

  // --- server config: async state via resource() (loading / error / value for free, aborts on destroy) ---
  readonly config = resource({
    loader: async ({ abortSignal }): Promise<ServerConfig> => {
      try {
        const res = await fetch(`${this.base}/config`, { signal: abortSignal });
        return res.ok ? ((await res.json()) as ServerConfig) : FALLBACK_CONFIG;
      } catch {
        return FALLBACK_CONFIG; // console still works against any server; filters just fall back to what it sees
      }
    },
  });
  readonly ratePresets = computed(() => (this.config.hasValue() ? this.config.value().ratePresets : FALLBACK_CONFIG.ratePresets));

  readonly campaignOptions = computed(() => {
    const known = this.config.hasValue() ? this.config.value().campaigns : [];
    return known.length ? known : this.stream.snapshot().campaigns.map((c) => c.campaignId).sort();
  });

  /** Resets to ALL if the selected campaign disappears from the options; otherwise keeps the user's choice. */
  readonly campaignFilter = linkedSignal<string[], string>({
    source: this.campaignOptions,
    computation: (options, previous) => (previous && options.includes(previous.value) ? previous.value : 'ALL'),
  });

  // --- derivations ----------------------------------------------------------------------------------
  readonly rows = computed<AdEvent[]>(() => {
    this.stream.logVersion(); // dependency: the ring buffer mutates in place, this is its change notification
    const type = this.typeFilter();
    const campaign = this.campaignFilter();
    if (type === 'ALL' && campaign === 'ALL') return this.stream.log.toArray();
    return this.stream.log.toArray((e) => (type === 'ALL' || e.type === type) && (campaign === 'ALL' || e.campaignId === campaign));
  });

  readonly overallCtr = computed(() => {
    let imp = 0;
    let clk = 0;
    for (const c of this.stream.snapshot().campaigns) {
      imp += c.impressions;
      clk += c.clicks;
    }
    return imp === 0 ? 0 : clk / imp;
  });
  readonly maxCtr = computed(() => Math.max(0.0001, ...this.stream.snapshot().campaigns.map((c) => c.ctr)));

  readonly statusMessage = computed(() => {
    const c = this.stream.connection();
    const via = this.transport() === 'ws' ? 'WebSocket' : 'server-sent events';
    switch (c.state) {
      case 'open':
        return this.stream.paused() ? `Connected via ${via}. Display paused.` : `Connected via ${via}.`;
      case 'reconnecting':
        return `Connection lost. Reconnecting, attempt ${c.attempt}.`;
      case 'connecting':
        return 'Connecting.';
      default:
        return 'Disconnected.';
    }
  });

  /** Written by a throttled effect (every 5 s), read by the aria-live region. Never per event. */
  readonly announcement = signal('');

  constructor() {
    // Connection lifecycle follows the transport signal; cleanup tears the old socket down.
    effect((onCleanup) => {
      const kind = this.transport();
      untracked(() => this.stream.connect(kind));
      onCleanup(() => this.stream.disconnect());
    });

    effect(() => {
      document.documentElement.dataset['theme'] = this.theme();
      write('rt.theme', this.theme());
    });
    effect(() => write('rt.transport', this.transport()));

    effect(() => {
      const eps = this.stream.snapshot().eventsPerSec;
      document.title = `${eps.toLocaleString('en-US')} ev/s - AdFlow Realtime Console`;
    });

    // Screen readers: one summary every 5 s instead of announcing 20 000 events per second.
    effect((onCleanup) => {
      const id = setInterval(() => {
        if (this.stream.paused() || this.stream.connection().state !== 'open') return;
        const snap = this.stream.snapshot();
        this.announcement.set(
          `${Math.round(snap.eventsPerSec).toLocaleString('en-US')} events per second. ` +
            `Overall click-through rate ${(this.overallCtr() * 100).toFixed(2)} percent across ${snap.campaigns.length} campaigns.`,
        );
      }, 5000);
      onCleanup(() => clearInterval(id));
    });

    // Adopt the server rate once config arrives.
    effect(() => {
      if (this.config.hasValue() && untracked(this.rateEps) === null) this.rateEps.set(this.config.value().rateEps);
    });
  }

  togglePause(): void {
    this.stream.setPaused(!this.stream.paused());
  }
  toggleTheme(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  async setRate(eps: number): Promise<void> {
    this.rateEps.set(eps);
    try {
      await fetch(`${this.base}/rate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eps }),
      });
    } catch {
      /* the connection status already tells the user the server is unreachable */
    }
  }
}
