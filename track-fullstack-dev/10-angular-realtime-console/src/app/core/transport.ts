import { InjectionToken } from '@angular/core';

export type TransportKind = 'ws' | 'sse';

export interface TransportHandlers {
  open(): void;
  message(data: string): void;
  close(): void;
}

/** Opens one connection attempt and returns its disposer. Kept tiny so tests can fake it. */
export type Opener = (handlers: TransportHandlers) => () => void;
export type OpenerFactory = (kind: TransportKind, baseUrl: string) => Opener;

export const realOpenerFactory: OpenerFactory = (kind, baseUrl) =>
  kind === 'ws' ? wsOpener(baseUrl.replace(/^http/, 'ws') + '/ws') : sseOpener(baseUrl + '/sse');

function wsOpener(url: string): Opener {
  return (h) => {
    const ws = new WebSocket(url);
    ws.onopen = () => h.open();
    ws.onmessage = (e) => h.message(String(e.data));
    ws.onclose = () => h.close();
    return () => {
      ws.onopen = ws.onmessage = ws.onclose = null;
      ws.close();
    };
  };
}

function sseOpener(url: string): Opener {
  return (h) => {
    const es = new EventSource(url);
    es.onopen = () => h.open();
    es.onmessage = (e) => h.message(String(e.data));
    // EventSource would retry on its own with a fixed delay; we close it and apply our backoff instead.
    es.onerror = () => h.close();
    return () => {
      es.onopen = es.onmessage = es.onerror = null;
      es.close();
    };
  };
}

export const TRANSPORT_FACTORY = new InjectionToken<OpenerFactory>('TRANSPORT_FACTORY', {
  providedIn: 'root',
  factory: () => realOpenerFactory,
});

export const SERVER_BASE = new InjectionToken<string>('SERVER_BASE', {
  providedIn: 'root',
  factory: () =>
    (typeof location !== 'undefined' && new URLSearchParams(location.search).get('server')) || 'http://localhost:4310',
});
