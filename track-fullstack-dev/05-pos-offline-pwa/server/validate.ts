import { MAX_BATCH, type Command } from '../src/shared/protocol';

const isStr = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function commandId(raw: unknown): string | undefined {
  return isObj(raw) && isStr(raw['id'], 100) ? raw['id'] : undefined;
}

/** Structural validation only. Business problems (price drift, unknown SKU) are flags, never rejections. */
export function parseCommand(raw: unknown): { ok: true; command: Command } | { ok: false; error: string } {
  if (!isObj(raw)) return { ok: false, error: 'command must be an object' };
  if (!isStr(raw['id'], 100)) return { ok: false, error: 'id (idempotency key) required' };
  if (!isStr(raw['deviceId'], 100)) return { ok: false, error: 'deviceId required' };
  if (!isInt(raw['seq'], 0, Number.MAX_SAFE_INTEGER)) return { ok: false, error: 'seq must be a non-negative integer' };
  if (!isIso(raw['createdAt'])) return { ok: false, error: 'createdAt must be an ISO date' };
  const p = raw['payload'];
  if (!isObj(p)) return { ok: false, error: 'payload required' };

  if (raw['type'] === 'CreateSale') {
    if (!isStr(p['saleId'], 100)) return { ok: false, error: 'payload.saleId required' };
    const lines = p['lines'];
    if (!Array.isArray(lines) || lines.length < 1 || lines.length > 100) return { ok: false, error: 'lines: 1..100 required' };
    for (const l of lines) {
      if (!isObj(l) || !isStr(l['sku'], 50) || !isInt(l['qty'], 1, 999) || !isInt(l['unitPriceCents'], 0, 100_000_000)
        || !isInt(l['catalogVersion'], 0, Number.MAX_SAFE_INTEGER)) {
        return { ok: false, error: 'invalid sale line' };
      }
    }
    const pay = p['payment'];
    if (!isObj(pay) || (pay['method'] !== 'cash' && pay['method'] !== 'card')) return { ok: false, error: 'payment.method must be cash|card' };
    if (p['note'] !== undefined && (typeof p['note'] !== 'string' || p['note'].length > 500)) return { ok: false, error: 'note too long' };
    return { ok: true, command: raw as unknown as Command };
  }
  if (raw['type'] === 'UpdateSaleNote') {
    if (!isStr(p['saleId'], 100)) return { ok: false, error: 'payload.saleId required' };
    if (typeof p['note'] !== 'string' || p['note'].length > 500) return { ok: false, error: 'note invalid' };
    if (!isIso(p['updatedAt'])) return { ok: false, error: 'payload.updatedAt must be an ISO date' };
    return { ok: true, command: raw as unknown as Command };
  }
  return { ok: false, error: 'unknown command type' };
}

export function validateBatchSize(commands: unknown): commands is unknown[] {
  return Array.isArray(commands) && commands.length <= MAX_BATCH;
}
