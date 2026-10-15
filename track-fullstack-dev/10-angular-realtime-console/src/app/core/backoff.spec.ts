import { backoffDelay } from './backoff';

describe('backoffDelay', () => {
  const o = { baseMs: 500, capMs: 8000 };

  it('doubles the step per attempt up to the cap (no jitter = upper half boundary)', () => {
    const zero = (a: number) => backoffDelay(a, { ...o, random: () => 0 });
    expect([0, 1, 2, 3, 4, 5, 9].map(zero)).toEqual([250, 500, 1000, 2000, 4000, 4000, 4000]);
  });

  it('adds up to the other half as jitter, never exceeding the step', () => {
    const max = (a: number) => backoffDelay(a, { ...o, random: () => 0.999999 });
    expect(max(0)).toBe(500);
    expect(max(2)).toBe(2000);
    expect(max(20)).toBe(8000);
  });

  it('stays within [step/2, step] for random input', () => {
    for (let i = 0; i < 200; i++) {
      const d = backoffDelay(3, o);
      expect(d).toBeGreaterThanOrEqual(2000);
      expect(d).toBeLessThanOrEqual(4000);
    }
  });
});
