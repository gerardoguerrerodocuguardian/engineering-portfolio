import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ConsoleStore } from './console.store';
import { Opener, TRANSPORT_FACTORY, TransportHandlers } from './transport';

const msg = (n: number, campaignId: string, type: 'IMPRESSION' | 'CLICK') =>
  JSON.stringify({ eventId: `x${n}`, type, campaignId, costCents: 1, occurredAt: '2026-01-01T00:00:00.000Z' });

describe('ConsoleStore computed signals', () => {
  let handlers: TransportHandlers[];
  let store: ConsoleStore;

  beforeEach(async () => {
    jest.useFakeTimers();
    handlers = [];
    const opener: Opener = (h) => {
      handlers.push(h);
      return () => {};
    };
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: TRANSPORT_FACTORY, useValue: () => opener }],
    });
    store = TestBed.inject(ConsoleStore);
    TestBed.tick(); // runs the connect effect
    handlers[0].open();
    handlers[0].message(msg(1, 'a', 'IMPRESSION'));
    handlers[0].message(msg(2, 'a', 'CLICK'));
    handlers[0].message(msg(3, 'b', 'IMPRESSION'));
    jest.advanceTimersByTime(100);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    jest.useRealTimers();
  });

  it('rows are derived from the log and re-derive when filters change', () => {
    expect(store.rows().map((e) => e.eventId)).toEqual(['x3', 'x2', 'x1']);
    store.typeFilter.set('CLICK');
    expect(store.rows().map((e) => e.eventId)).toEqual(['x2']);
    store.typeFilter.set('ALL');
    store.campaignFilter.set('b');
    expect(store.rows().map((e) => e.eventId)).toEqual(['x3']);
  });

  it('derives campaign options from the live snapshot when the server gives no config', () => {
    expect(store.campaignOptions()).toEqual([]); // snapshot not delivered yet
    jest.advanceTimersByTime(500); // inline aggregator publishes
    expect(store.campaignOptions()).toEqual(['a', 'b']);
    expect(store.overallCtr()).toBeCloseTo(0.5); // 1 click / 2 impressions
  });

  it('linkedSignal resets the campaign filter when the selected campaign disappears', () => {
    jest.advanceTimersByTime(500);
    store.campaignFilter.set('b');
    expect(store.campaignFilter()).toBe('b');
    store.stream.clear(); // snapshot empties -> options empty -> 'b' is gone
    expect(store.campaignFilter()).toBe('ALL');
  });

  it('statusMessage follows connection state', () => {
    expect(store.statusMessage()).toBe('Connected via WebSocket.');
    store.togglePause();
    expect(store.statusMessage()).toContain('paused');
    handlers[0].close();
    expect(store.statusMessage()).toMatch(/Reconnecting, attempt 1/);
  });

  it('switching transport reconnects through the effect', () => {
    store.transport.set('sse');
    TestBed.tick();
    expect(handlers).toHaveLength(2);
  });

  it('announcement is throttled to one summary per 5 s', () => {
    jest.advanceTimersByTime(4000);
    expect(store.announcement()).toBe('');
    jest.advanceTimersByTime(1500);
    expect(store.announcement()).toMatch(/events per second\. Overall click-through rate 50\.00 percent across 2 campaigns/);
  });
});
