/** Event shapes follow shared/contracts/ad-events.asyncapi.yaml (AdImpression | AdClick). */
export type EventType = 'IMPRESSION' | 'CLICK';

export interface AdEvent {
  eventId: string;
  type: EventType;
  campaignId: string;
  costCents: number;
  occurredAt: string;
}

/** What actually crosses the worker boundary: smaller than AdEvent, cheap to structured-clone. */
export interface CompactEvent {
  campaignId: string;
  click: boolean;
  costCents: number;
}

export interface CampaignStat {
  campaignId: string;
  impressions: number;
  clicks: number;
  /** clicks / impressions inside the rolling window (0 when there are no impressions). */
  ctr: number;
  spendCents: number;
}

export interface AggregateSnapshot {
  /** Events per second averaged over the short rate window. */
  eventsPerSec: number;
  totalEvents: number;
  windowSec: number;
  campaigns: CampaignStat[];
  /** Events per second for each of the last `windowSec` seconds, oldest first. */
  history: number[];
}

export const EMPTY_SNAPSHOT: AggregateSnapshot = {
  eventsPerSec: 0,
  totalEvents: 0,
  windowSec: 30,
  campaigns: [],
  history: [],
};

/** Defensive parse: network input is untrusted, so anything not matching the contract is dropped. */
export function parseAdEvent(raw: string): AdEvent | null {
  try {
    const v = JSON.parse(raw) as Partial<AdEvent>;
    if (
      typeof v.eventId === 'string' &&
      (v.type === 'IMPRESSION' || v.type === 'CLICK') &&
      typeof v.campaignId === 'string' &&
      typeof v.costCents === 'number' &&
      typeof v.occurredAt === 'string'
    ) {
      return v as AdEvent;
    }
    return null;
  } catch {
    return null;
  }
}

export function toCompact(e: AdEvent): CompactEvent {
  return { campaignId: e.campaignId, click: e.type === 'CLICK', costCents: e.costCents };
}
