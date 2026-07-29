import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnalyticsEventDocument = AnalyticsEvent & Document;

@Schema({ timestamps: true, collection: 'analytics_events' })
export class AnalyticsEvent {
  _id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  eventType!: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop()
  timestamp!: Date;
}

export const AnalyticsEventSchema = SchemaFactory.createForClass(AnalyticsEvent);

AnalyticsEventSchema.index({ userId: 1, timestamp: -1 });
AnalyticsEventSchema.index({ eventType: 1, timestamp: -1 });
