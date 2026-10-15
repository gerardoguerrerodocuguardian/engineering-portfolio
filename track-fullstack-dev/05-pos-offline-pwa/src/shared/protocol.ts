// Wire contract shared by the PWA and the sync server. Money is always integer cents.

export type PaymentMethod = 'cash' | 'card';

export interface SaleLine {
  sku: string;
  qty: number;
  /** Price the cashier actually quoted/charged, taken from the local catalog. */
  unitPriceCents: number;
  /** Local catalog version the price was read from. */
  catalogVersion: number;
}

export interface CreateSaleCommand {
  /** Idempotency key: the server applies a given id at most once. */
  id: string;
  type: 'CreateSale';
  deviceId: string;
  /** Per-device monotonically increasing sequence; the server applies in batch order. */
  seq: number;
  createdAt: string;
  payload: { saleId: string; lines: SaleLine[]; payment: { method: PaymentMethod }; note?: string };
}

export interface UpdateSaleNoteCommand {
  id: string;
  type: 'UpdateSaleNote';
  deviceId: string;
  seq: number;
  createdAt: string;
  payload: { saleId: string; note: string; /** client clock, ISO; last-writer-wins key */ updatedAt: string };
}

export type Command = CreateSaleCommand | UpdateSaleNoteCommand;

export type FlagCode = 'price_changed' | 'unknown_sku' | 'inactive_sku' | 'stale_note_ignored';

export interface SaleFlag {
  code: FlagCode;
  sku?: string;
  quotedCents?: number;
  currentCents?: number;
}

/**
 * applied   - processed now
 * duplicate - this idempotency key was already processed; original outcome returned
 * rejected  - permanently invalid; retrying will never help (client parks it for review)
 * retry     - transient failure or deferred (ordering); client keeps it queued
 */
export type ResultStatus = 'applied' | 'duplicate' | 'rejected' | 'retry';

export interface CommandResult {
  id: string;
  status: ResultStatus;
  flags: SaleFlag[];
  error?: string;
}

export interface SyncRequest {
  deviceId: string;
  commands: unknown[];
}
export interface SyncResponse {
  results: CommandResult[];
  catalogVersion: number;
}

export interface CatalogItem {
  sku: string;
  barcode: string;
  name: string;
  priceCents: number;
  active: boolean;
  /** Catalog version at which this item last changed. */
  version: number;
}
export interface CatalogResponse {
  version: number;
  /** true when `items` is the entire catalog, false when it is a delta since `since`. */
  full: boolean;
  items: CatalogItem[];
}

export type PushMessage =
  | { type: 'hello'; version: number }
  | { type: 'catalog'; version: number; changed: CatalogItem[] };

export const MAX_BATCH = 100;
