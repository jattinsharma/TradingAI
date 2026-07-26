import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TradeJournalDocument = TradeJournal & Document;

@Schema({ timestamps: true, collection: 'trade_journal' })
export class TradeJournal {
  _id!: string;

  @Prop({ required: true, index: true })
  symbol!: string;

  @Prop()
  timeframe?: string;

  @Prop({ type: Number, required: true })
  entryPrice!: number;

  @Prop({ type: Number })
  exitPrice?: number;

  @Prop()
  side!: string;

  @Prop()
  reason?: string;

  @Prop()
  emotion?: string;

  @Prop()
  mistakes?: string;

  @Prop()
  lessons?: string;

  @Prop({ type: Object })
  aiRecommendation?: Record<string, unknown>;

  @Prop()
  actualResult?: string;

  @Prop({ type: Number })
  pnl?: number;

  @Prop({ type: Number })
  pnlPercent?: number;

  @Prop({ type: Number })
  rating?: number;

  @Prop({ type: [String] })
  screenshots?: string[];

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const TradeJournalSchema = SchemaFactory.createForClass(TradeJournal);
