import { EventLog, RecentIds } from './event-log';
import { AdEvent } from './models';

const ev = (n: number): AdEvent => ({ eventId: `e${n}`, type: n % 2 ? 'CLICK' : 'IMPRESSION', campaignId: 'c', costCents: 0, occurredAt: '' });

describe('EventLog', () => {
  it('returns newest first and overwrites the oldest at capacity', () => {
    const log = new EventLog(3);
    [1, 2, 3, 4, 5].forEach((n) => log.push(ev(n)));
    expect(log.size).toBe(3);
    expect(log.toArray().map((e) => e.eventId)).toEqual(['e5', 'e4', 'e3']);
  });

  it('filters and clears', () => {
    const log = new EventLog(10);
    [1, 2, 3, 4].forEach((n) => log.push(ev(n)));
    expect(log.toArray((e) => e.type === 'CLICK').map((e) => e.eventId)).toEqual(['e3', 'e1']);
    log.clear();
    expect(log.toArray()).toEqual([]);
  });
});

describe('RecentIds', () => {
  it('detects duplicates and forgets the oldest generation to stay bounded', () => {
    const ids = new RecentIds(2);
    expect(ids.add('a')).toBe(true);
    expect(ids.add('a')).toBe(false);
    ids.add('b');
    ids.add('c'); // rotates: {a,b} -> previous
    expect(ids.add('a')).toBe(false);
    ids.add('d'); // rotates again: {a,b} dropped
    ids.add('e');
    expect(ids.add('a')).toBe(true);
  });
});
