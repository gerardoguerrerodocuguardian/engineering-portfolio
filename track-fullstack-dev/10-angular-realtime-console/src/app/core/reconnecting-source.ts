import { Observable } from 'rxjs';
import { BackoffOptions, backoffDelay } from './backoff';
import { Opener } from './transport';

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting';

export interface ConnectionStatus {
  state: ConnectionState;
  /** Consecutive failed attempts since the last successful open. */
  attempt: number;
  /** Delay before the next attempt, only while `reconnecting`. */
  delayMs?: number;
}

/**
 * A stream is the right tool here: values over time, with teardown, and a lifecycle (connect -> drop -> wait -> connect).
 * Subscribing opens the connection; unsubscribing closes it and cancels any pending retry timer.
 * The attempt counter resets on a successful open, so a long-lived connection that drops starts again from the base delay.
 */
export function reconnectingSource(
  opener: Opener,
  options: BackoffOptions,
  onStatus: (s: ConnectionStatus) => void = () => {},
): Observable<string> {
  return new Observable<string>((subscriber) => {
    let attempt = 0;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let dispose: (() => void) | undefined;

    const connect = () => {
      const mine = ++generation;
      onStatus({ state: 'connecting', attempt });
      dispose = opener({
        open: () => {
          if (mine !== generation) return;
          attempt = 0;
          onStatus({ state: 'open', attempt });
        },
        message: (data) => {
          if (mine === generation) subscriber.next(data);
        },
        close: () => {
          if (mine !== generation) return; // stale callback from an attempt we already abandoned
          generation++;
          dispose?.();
          dispose = undefined;
          const delayMs = backoffDelay(attempt, options);
          attempt++;
          onStatus({ state: 'reconnecting', attempt, delayMs });
          timer = setTimeout(connect, delayMs);
        },
      });
    };

    connect();
    return () => {
      generation++;
      clearTimeout(timer);
      dispose?.();
      onStatus({ state: 'idle', attempt: 0 });
    };
  });
}
