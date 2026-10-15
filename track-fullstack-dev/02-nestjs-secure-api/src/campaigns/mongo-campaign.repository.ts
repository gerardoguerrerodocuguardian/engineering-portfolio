import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, Types } from 'mongoose';
import {
  CampaignEntity,
  CampaignPatch,
  CampaignRepository,
  NewCampaign,
  RawReport,
} from './campaign.repository';
import { Campaign, CampaignDocument, CampaignStatus } from './schemas/campaign.schema';
import { AdEvent, AdEventDocument } from './schemas/event.schema';

function toEntity(doc: CampaignDocument): CampaignEntity {
  return {
    id: doc.id as string,
    name: doc.name,
    status: doc.status,
    dailyBudgetCents: doc.dailyBudgetCents,
    maxBidCents: doc.maxBidCents,
    keywords: doc.keywords,
    ownerId: doc.ownerId,
    createdAt: doc.createdAt,
  };
}

@Injectable()
export class MongoCampaignRepository extends CampaignRepository {
  constructor(
    @InjectModel(Campaign.name) private readonly campaigns: Model<CampaignDocument>,
    @InjectModel(AdEvent.name) private readonly events: Model<AdEventDocument>,
  ) {
    super();
  }

  async create(data: NewCampaign): Promise<CampaignEntity> {
    return toEntity(await this.campaigns.create(data));
  }

  async findById(id: string): Promise<CampaignEntity | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.campaigns.findById(id).exec();
    return doc ? toEntity(doc) : null;
  }

  async findPage(
    page: number,
    pageSize: number,
    status?: CampaignStatus,
  ): Promise<{ items: CampaignEntity[]; total: number }> {
    const filter = status ? { status } : {};
    const [docs, total] = await Promise.all([
      this.campaigns
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .exec(),
      this.campaigns.countDocuments(filter).exec(),
    ]);
    return { items: docs.map(toEntity), total };
  }

  async update(id: string, patch: CampaignPatch): Promise<CampaignEntity | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await this.campaigns
      .findByIdAndUpdate(id, { $set: patch }, { new: true, runValidators: true })
      .exec();
    return doc ? toEntity(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const res = await this.campaigns.findByIdAndDelete(id).exec();
    if (res) await this.events.deleteMany({ campaignId: res._id }).exec();
    return !!res;
  }

  /** Single-pass aggregation: one $group per event type, folded into one report row. */
  async aggregateReport(id: string): Promise<RawReport> {
    const rows = await this.events
      .aggregate<{ _id: string; count: number; spend: number }>([
        { $match: { campaignId: new Types.ObjectId(id) } },
        { $group: { _id: '$type', count: { $sum: 1 }, spend: { $sum: '$costCents' } } },
      ])
      .exec();
    const by = (t: string) => rows.find((r) => r._id === t);
    return {
      impressions: by('IMPRESSION')?.count ?? 0,
      clicks: by('CLICK')?.count ?? 0,
      spendCents: rows.reduce((sum, r) => sum + r.spend, 0),
    };
  }
}
