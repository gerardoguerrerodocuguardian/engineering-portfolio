import type { CatalogItem, CatalogResponse, Command, CommandResult, SaleFlag } from '../src/shared/protocol';
import { commandId, parseCommand } from './validate';
import { seedCatalog } from './seed';

export interface ServerSale {
  saleId: string;
  deviceId: string;
  createdAt: string;
  receivedAt: string;
  lines: Array<{ sku: string; qty: number; unitPriceCents: number }>;
  /** What the customer was actually charged (the quoted prices). Never rewritten by the server. */
  chargedCents: number;
  /** What the same basket costs at current server prices; differs when prices drifted. */
  listCents: number;
  paymentMethod: 'cash' | 'card';
  note: string;
  noteUpdatedAt: string;
  flags: SaleFlag[];
}

export interface StoreOptions {
  now?: () => Date;
  /** Test/chaos hook: return true to make a command fail transiently ("retry"). */
  shouldFail?: (command: Command) => boolean;
}

/** In-memory source of truth for the demo. Swapping in SQLite/Postgres only touches this class. */
export class SyncStore {
  private catalog = new Map<string, CatalogItem>();
  private _version = 1;
  private results = new Map<string, CommandResult>();
  private salesById = new Map<string, ServerSale>();
  private listeners = new Set<(changed: CatalogItem[], version: number) => void>();
  private now: () => Date;

  constructor(private opts: StoreOptions = {}) {
    this.now = opts.now ?? (() => new Date());
    for (const i of seedCatalog()) this.catalog.set(i.sku, i);
  }

  get version(): number {
    return this._version;
  }

  onCatalogChange(fn: (changed: CatalogItem[], version: number) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getCatalog(since?: number): CatalogResponse {
    const all = [...this.catalog.values()];
    if (since === undefined || since <= 0) return { version: this._version, full: true, items: all };
    return { version: this._version, full: false, items: all.filter((i) => i.version > since) };
  }

  setPrice(sku: string, priceCents: number, active?: boolean): CatalogItem | undefined {
    const item = this.catalog.get(sku);
    if (!item) return undefined;
    this._version += 1;
    const next = { ...item, priceCents, active: active ?? item.active, version: this._version };
    this.catalog.set(sku, next);
    for (const l of this.listeners) l([next], this._version);
    return next;
  }

  sales(): ServerSale[] {
    return [...this.salesById.values()];
  }

  /**
   * Applies a batch in order. Guarantees:
   * - idempotent per command id (replays return the stored outcome as "duplicate");
   * - a valid sale is never dropped: price drift / unknown SKUs only add flags;
   * - after a transient failure the rest of the batch is deferred so ordering is preserved.
   */
  applyBatch(raws: unknown[]): CommandResult[] {
    const out: CommandResult[] = [];
    let deferring = false;
    for (const raw of raws) {
      const id = commandId(raw) ?? '';
      if (deferring) {
        out.push({ id, status: 'retry', flags: [], error: 'deferred: earlier command failed transiently' });
        continue;
      }
      const prior = id ? this.results.get(id) : undefined;
      if (prior) {
        out.push({ ...prior, status: 'duplicate' });
        continue;
      }
      const parsed = parseCommand(raw);
      if (!parsed.ok) {
        // Rejections are cached too, so a replay gets the same answer.
        const r: CommandResult = { id, status: 'rejected', flags: [], error: parsed.error };
        if (id) this.results.set(id, r);
        out.push(r);
        continue;
      }
      if (this.opts.shouldFail?.(parsed.command)) {
        out.push({ id, status: 'retry', flags: [], error: 'transient failure' });
        deferring = true;
        continue;
      }
      const r = this.apply(parsed.command);
      this.results.set(r.id, r);
      out.push(r);
    }
    return out;
  }

  private apply(cmd: Command): CommandResult {
    return cmd.type === 'CreateSale' ? this.createSale(cmd) : this.updateNote(cmd);
  }

  private createSale(cmd: Extract<Command, { type: 'CreateSale' }>): CommandResult {
    const existing = this.salesById.get(cmd.payload.saleId);
    if (existing) {
      // Same sale under a different idempotency key (client bug / data restore): still exactly-once per saleId.
      return { id: cmd.id, status: 'duplicate', flags: existing.flags };
    }
    const flags: SaleFlag[] = [];
    let listCents = 0;
    let chargedCents = 0;
    for (const l of cmd.payload.lines) {
      chargedCents += l.unitPriceCents * l.qty;
      const item = this.catalog.get(l.sku);
      if (!item) {
        flags.push({ code: 'unknown_sku', sku: l.sku, quotedCents: l.unitPriceCents });
        listCents += l.unitPriceCents * l.qty;
        continue;
      }
      listCents += item.priceCents * l.qty;
      if (!item.active) flags.push({ code: 'inactive_sku', sku: l.sku });
      if (item.priceCents !== l.unitPriceCents) {
        flags.push({ code: 'price_changed', sku: l.sku, quotedCents: l.unitPriceCents, currentCents: item.priceCents });
      }
    }
    const at = this.now().toISOString();
    this.salesById.set(cmd.payload.saleId, {
      saleId: cmd.payload.saleId,
      deviceId: cmd.deviceId,
      createdAt: cmd.createdAt,
      receivedAt: at,
      lines: cmd.payload.lines.map(({ sku, qty, unitPriceCents }) => ({ sku, qty, unitPriceCents })),
      chargedCents,
      listCents,
      paymentMethod: cmd.payload.payment.method,
      note: cmd.payload.note ?? '',
      noteUpdatedAt: cmd.createdAt,
      flags,
    });
    return { id: cmd.id, status: 'applied', flags };
  }

  private updateNote(cmd: Extract<Command, { type: 'UpdateSaleNote' }>): CommandResult {
    const sale = this.salesById.get(cmd.payload.saleId);
    if (!sale) return { id: cmd.id, status: 'rejected', flags: [], error: 'unknown sale' };
    // Last-writer-wins on the client-supplied timestamp (ties: later arrival wins).
    if (Date.parse(cmd.payload.updatedAt) < Date.parse(sale.noteUpdatedAt)) {
      return { id: cmd.id, status: 'applied', flags: [{ code: 'stale_note_ignored' }] };
    }
    sale.note = cmd.payload.note;
    sale.noteUpdatedAt = cmd.payload.updatedAt;
    return { id: cmd.id, status: 'applied', flags: [] };
  }
}
