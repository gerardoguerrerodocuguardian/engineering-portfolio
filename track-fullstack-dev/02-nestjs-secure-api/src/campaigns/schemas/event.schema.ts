import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const EVENT_TYPES = ['IMPRESSION', 'CLICK'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Raw ad events; append-only, aggregated on demand for reports. */
@Schema({ collection: 'events' })
export class AdEvent {
  @Prop({ type: Types.ObjectId, required: true })
  campaignId!: Types.ObjectId;

  @Prop({ required: true, enum: EVENT_TYPES })
  type!: EventType;

  /** Amount charged for this event (cost-per-click model: clicks carry cost). */
  @Prop({ required: true, min: 0, default: 0 })
  costCents!: number;

  @Prop({ required: true, default: () => new Date() })
  occurredAt!: Date;
}

export type AdEventDocument = HydratedDocument<AdEvent>;
export const AdEventSchema = SchemaFactory.createForClass(AdEvent);

// Supports the report $match on campaignId (+ optional time ranges later).
AdEventSchema.index({ campaignId: 1, occurredAt: -1 });
