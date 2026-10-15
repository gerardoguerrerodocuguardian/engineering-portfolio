import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  CampaignEntity,
  CampaignPatch,
  CampaignRepository,
  NewCampaign,
  RawReport,
} from './campaign.repository';
import { CampaignStatus } from './schemas/campaign.schema';
import { EventType } from './schemas/event.schema';

/**
 * In-memory repository for offline tests/demos (PERSISTENCE=memory). It mirrors the
 * behavior of the Mongo implementation but does NOT exercise the real aggregation pipeline.
 */
@Injectable()
export class InMemoryCampaignRepository extends CampaignRepository {
  private readonly rows = new Map<string, CampaignEntity>();
  private readonly events: { campaignId: string; type: EventType; costCents: number }[] = [];

  create(data: NewCampaign): Promise<CampaignEntity> {
    const entity: CampaignEntity = {
      status: 'DRAFT',
      ...data,
      id: new Types.ObjectId().toHexString(),
      createdAt: new Date(),
    };
    this.rows.set(entity.id, entity);
    return Promise.resolve({ ...entity });
  }

  findById(id: string): Promise<CampaignEntity | null> {
    const row = this.rows.get(id);
    return Promise.resolve(row ? { ...row } : null);
  }

  findPage(page: number, pageSize: number, status?: CampaignStatus) {
    const all = [...this.rows.values()].filter((r) => !status || r.status === status).reverse(); // insertion order == creation order; newest first
    return Promise.resolve({
      items: all.slice((page - 1) * pageSize, page * pageSize).map((r) => ({ ...r })),
      total: all.length,
    });
  }

  update(id: string, patch: CampaignPatch): Promise<CampaignEntity | null> {
    const row = this.rows.get(id);
    if (!row) return Promise.resolve(null);
    Object.assign(row, patch);
    return Promise.resolve({ ...row });
  }

  delete(id: string): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id));
  }

  aggregateReport(id: string): Promise<RawReport> {
    const mine = this.events.filter((e) => e.campaignId === id);
    return Promise.resolve({
      impressions: mine.filter((e) => e.type === 'IMPRESSION').length,
      clicks: mine.filter((e) => e.type === 'CLICK').length,
      spendCents: mine.reduce((s, e) => s + e.costCents, 0),
    });
  }

  /** Test helper: append an ad event. */
  addEvent(campaignId: string, type: EventType, costCents = 0): void {
    this.events.push({ campaignId, type, costCents });
  }
}
