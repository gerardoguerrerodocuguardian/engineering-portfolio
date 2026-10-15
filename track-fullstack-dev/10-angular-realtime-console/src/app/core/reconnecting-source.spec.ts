import { ConnectionStatus, reconnectingSource } from './reconnecting-source';
import { Opener, TransportHandlers } from './transport';

class FakeNet {
  handlers: TransportHandlers[] = [];
  disposed = 0;
  opener: Opener = (h) => {
    this.handlers.push(h);
    return () => this.disposed++;
  };
  get current(): TransportHandlers {
    return this.handlers[this.handlers.length - 1];
  }
}

describe('reconnectingSource', () => {
  const opts = { baseMs: 1000, capMs: 8000, random: () => 0 }; // deterministic: delay = step / 2
  let net: FakeNet;
  let statuses: ConnectionStatus[];
  let received: string[];

  beforeEach(() => {
    jest.useFakeTimers();
    net = new FakeNet();
    statuses = [];
    received = [];
  });
  afterEach(() => jest.useRealTimers());

  const subscribe = () => reconnectingSource(net.opener, opts, (s) => statuses.push(s)).subscribe((m) => received.push(m));

  it('connects on subscribe and forwards messages', () => {
    subscribe();
    net.current.open();
    net.current.message('a');
    expect(received).toEqual(['a']);
    expect(statuses.map((s) => s.state)).toEqual(['connecting', 'open']);
  });

  it('reconnects with exponentially growing delays while the server keeps failing', () => {
    subscribe();
    const delays: number[] = [];
    for (let i = 0; i < 4; i++) {
      net.current.close();
      delays.push(statuses[statuses.length - 1].delayMs!);
      jest.advanceTimersByTime(statuses[statuses.length - 1].delayMs!);
    }
    expect(delays).toEqual([500, 1000, 2000, 4000]);
    expect(net.handlers).toHaveLength(5);
    expect(statuses.filter((s) => s.state === 'reconnecting').map((s) => s.attempt)).toEqual([1, 2, 3, 4]);
  });

  it('does not reconnect before the delay has elapsed', () => {
    subscribe();
    net.current.close();
    jest.advanceTimersByTime(499);
    expect(net.handlers).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(net.handlers).toHaveLength(2);
  });

  it('resets the backoff after a successful open', () => {
    subscribe();
    net.current.close();
    jest.advanceTimersByTime(500);
    net.current.close();
    jest.advanceTimersByTime(1000);
    net.current.open(); // healthy again
    net.current.close();
    expect(statuses[statuses.length - 1]).toMatchObject({ state: 'reconnecting', attempt: 1, delayMs: 500 });
  });

  it('ignores callbacks from an attempt that was already abandoned', () => {
    subscribe();
    const first = net.current;
    first.close();
    first.close(); // duplicate close must not schedule a second timer
    first.message('late');
    jest.advanceTimersByTime(60_000);
    expect(net.handlers).toHaveLength(2);
    expect(received).toEqual([]);
  });

  it('teardown cancels the pending retry and disposes the live connection', () => {
    const sub = subscribe();
    net.current.close();
    sub.unsubscribe();
    jest.advanceTimersByTime(60_000);
    expect(net.handlers).toHaveLength(1);

    const net2 = new FakeNet();
    const sub2 = reconnectingSource(net2.opener, opts).subscribe();
    sub2.unsubscribe();
    expect(net2.disposed).toBe(1);
  });
});
