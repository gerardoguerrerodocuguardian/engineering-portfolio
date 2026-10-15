export interface BackoffOptions {
  baseMs: number;
  capMs: number;
  /** Injectable for deterministic tests. Must return a number in [0, 1). */
  random?: () => number;
}

/**
 * "Equal jitter" exponential backoff: half of the exponential step is fixed, the other half is random.
 * The fixed half keeps a floor under the delay (no hot reconnect loop); the random half de-synchronises
 * thousands of clients that were dropped at the same instant (no thundering herd).
 */
export function backoffDelay(attempt: number, { baseMs, capMs, random = Math.random }: BackoffOptions): number {
  const step = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(step / 2 + random() * (step / 2));
}
