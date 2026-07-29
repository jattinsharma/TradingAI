import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AnalysisDocument = Analysis & Document;

@Schema({ timestamps: true, collection: 'analyses' })
export class Analysis {
  _id!: string;

  @Prop({ required: true, index: true })
  symbol!: string;

  @Prop({ default: '1D' })
  timeframe!: string;

  @Prop({ type: Number, required: true })
  currentPrice!: number;

  @Prop({ required: true })
  recommendation!: string;

  @Prop({ type: Number, required: true })
  confidence!: number;

  @Prop({ type: Number })
  riskPercent?: number;

  @Prop({ type: Number })
  entryPrice?: number;

  @Prop({ type: Number })
  stopLoss?: number;

  @Prop({ type: Number })
  takeProfit?: number;

  @Prop({ type: Number })
  riskRewardRatio?: number;

  @Prop()
  tradeDuration?: string;

  @Prop({ type: Object })
  indicators?: Record<string, unknown>;

  @Prop({ type: Object })
  signals?: Record<string, unknown>;

  @Prop()
  reasoning?: string;

  @Prop()
  keyRisks?: string;

  @Prop()
  alternativeScenario?: string;

  @Prop()
  invalidationLevel?: string;

  @Prop()
  outcome?: string;

  @Prop()
  createdAt!: Date;
}

export const AnalysisSchema = SchemaFactory.createForClass(Analysis);

AnalysisSchema.index({ symbol: 1, createdAt: -1 });
AnalysisSchema.index({ createdAt: -1 });
