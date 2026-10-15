import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const CAMPAIGN_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED', 'EXHAUSTED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

@Schema({ collection: 'campaigns', timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } })
export class Campaign {
  @Prop({ required: true, trim: true, minlength: 3, maxlength: 120 })
  name!: string;

  @Prop({ required: true, enum: CAMPAIGN_STATUSES, default: 'DRAFT' })
  status!: CampaignStatus;

  @Prop({ required: true, min: 0 })
  dailyBudgetCents!: number;

  @Prop({ required: true, min: 1 })
  maxBidCents!: number;

  @Prop({ type: [String], default: [] })
  keywords!: string[];

  @Prop({ required: true })
  ownerId!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type CampaignDocument = HydratedDocument<Campaign>;
export const CampaignSchema = SchemaFactory.createForClass(Campaign);

// Listing: filter by status, newest first (equality field first, then sort key).
CampaignSchema.index({ status: 1, createdAt: -1 });
// "My campaigns" access pattern for advertisers.
CampaignSchema.index({ ownerId: 1, createdAt: -1 });
