import type { AdEvent } from './models';

/** Fixed-capacity ring buffer: O(1) append, oldest rows are overwritten, memory never grows past `capacity`. */
export class EventLog {
  private readonly items: (AdEvent | undefined)[];
  private head = 0; // next write position
  private count = 0;

  constructor(readonly capacity = 100_000) {
    this.items = new Array<AdEvent | undefined>(capacity);
  }

  get size(): number {
    return this.count;
  }

  push(e: AdEvent): void {
    this.items[this.head] = e;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  clear(): void {
    this.items.fill(undefined);
    this.head = 0;
    this.count = 0;
  }

  /** Newest first, optionally filtered. Allocates one array per call (the virtual scroller needs an array). */
  toArray(predicate?: (e: AdEvent) => boolean): AdEvent[] {
    const out: AdEvent[] = [];
    for (let i = 1; i <= this.count; i++) {
      const e = this.items[(this.head - i + this.capacity) % this.capacity]!;
      if (!predicate || predicate(e)) out.push(e);
    }
    return out;
  }
}

/**
 * Bounded "have I seen this eventId?" set. Delivery is at-least-once, so consumers must be idempotent.
 * Two generations: when the current one is full it becomes the previous one and the oldest is discarded,
 * which bounds memory without per-entry bookkeeping.
 */
export class RecentIds {
  private current = new Set<string>();
  private previous = new Set<string>();

  constructor(private readonly generationSize = 100_000) {}

  /** Returns true if the id was new, false if it is a duplicate. */
  add(id: string): boolean {
    if (this.current.has(id) || this.previous.has(id)) return false;
    if (this.current.size >= this.generationSize) {
      this.previous = this.current;
      this.current = new Set();
    }
    this.current.add(id);
    return true;
  }

  clear(): void {
    this.current.clear();
    this.previous.clear();
  }
}
