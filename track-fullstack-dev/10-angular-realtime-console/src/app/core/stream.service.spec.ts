import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { AdEvent } from './models';
import { Opener, TRANSPORT_FACTORY, TransportHandlers } from './transport';
import { STREAM_OPTIONS, StreamService } from './stream.service';

const evt = (n: number, campaignId = 'cmp-a', type: AdEvent['type'] = 'IMPRESSION'): string =>
  JSON.stringify({ eventId: `id-${n}`, type, campaignId, costCents: 1, occurredAt: '2026-01-01T00:00:00.000Z' });

describe('StreamService', () => {
  let handlers: TransportHandlers[];
  let svc: StreamService;

  const setup = (maxLogRowsPerFlush = 2500) => {
    handlers = [];
    const opener: Opener = (h) => {
      handlers.push(h);
      return () => {};
    };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: TRANSPORT_FACTORY, useValue: () => opener },
        { provide: STREAM_OPTIONS, useValue: { flushMs: 100, maxLogRowsPerFlush, logCapacity: 1000, backoff: { baseMs: 1000, capMs: 8000 } } },
      ],
    });
    svc = TestBed.inject(StreamService);
    svc.connect('ws');
    handlers[0].open();
  };
  const cur = () => handlers[handlers.length - 1];

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    TestBed.resetTestingModule();
    jest.useRealTimers();
  });

  it('batches many messages into a single log update per flush window', () => {
    setup();
    const versionBefore = svc.logVersion();
    for (let i = 0; i < 50; i++) cur().message(evt(i));
    expect(svc.logSize()).toBe(0); // nothing visible until the window closes
    jest.advanceTimersByTime(100);
    expect(svc.logSize()).toBe(50);
    expect(svc.logVersion()).toBe(versionBefore + 1);
    expect(svc.received()).toBe(50);
  });

  it('drops malformed payloads and de-duplicates by eventId (at-least-once delivery)', () => {
    setup();
    cur().message('not json');
    cur().message(JSON.stringify({ eventId: 1 }));
    cur().message(evt(1));
    cur().message(evt(1));
    jest.advanceTimersByTime(100);
    expect(svc.logSize()).toBe(1);
    expect(svc.duplicates()).toBe(1);
  });

  it('applies backpressure: the log is sampled above the per-flush cap but the counters stay exact', () => {
    setup(10);
    for (let i = 0; i < 100; i++) cur().message(evt(i));
    jest.advanceTimersByTime(100);
    expect(svc.logSize()).toBe(10);
    expect(svc.sampledOut()).toBe(90);
    expect(svc.received()).toBe(100);
  });

  it('freezes the views while paused and catches up on resume', () => {
    setup();
    cur().message(evt(1));
    jest.advanceTimersByTime(100);
    const v = svc.logVersion();
    svc.setPaused(true);
    cur().message(evt(2));
    jest.advanceTimersByTime(100);
    expect(svc.logVersion()).toBe(v); // view frozen
    expect(svc.received()).toBe(2); // ...but data keeps flowing in
    svc.setPaused(false);
    expect(svc.logVersion()).toBe(v + 1);
    expect(svc.log.size).toBe(2);
  });

  it('reflects drops as reconnecting and recovers with a new connection after backoff', () => {
    setup();
    expect(svc.connection().state).toBe('open');
    cur().close();
    expect(svc.connection()).toMatchObject({ state: 'reconnecting', attempt: 1 });
    const delay = svc.connection().delayMs!;
    expect(delay).toBeGreaterThanOrEqual(500);
    expect(delay).toBeLessThanOrEqual(1000);
    jest.advanceTimersByTime(delay);
    expect(handlers).toHaveLength(2);
    handlers[1].open();
    expect(svc.connection()).toMatchObject({ state: 'open', attempt: 0 });
  });

  it('disconnect() stops everything', () => {
    setup();
    svc.disconnect();
    expect(svc.connection().state).toBe('idle');
    jest.advanceTimersByTime(60_000);
    expect(handlers).toHaveLength(1);
  });
});
