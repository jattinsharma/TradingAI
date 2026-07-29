import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IndicatorStatsDocument = IndicatorStats & Document;

/**
 * Tracks how well each technical indicator predicts trade outcomes.
 * Updated incrementally after each prediction evaluation.
 */
@Schema({ timestamps: true, collection: 'indicator_stats' })
export class IndicatorStats {
  _id!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  /** Indicator name: 'RSI', 'MACD', 'EMA20', 'SMA50', 'ATR', 'ADX', 'VWAP', 'BOLLINGER', 'STOCHASTIC', 'OBV', 'PATTERN' */
  @Prop({ required: true, index: true })
  indicatorName!: string;

  /** The signal direction when this indicator was recorded: 'BULLISH' | 'BEARISH' | 'NEUTRAL' */
  @Prop({ required: true })
  signalDirection!: string;

  @Prop({ type: Number, default: 0 })
  totalPredictions!: number;

  @Prop({ type: Number, default: 0 })
  wins!: number;

  @Prop({ type: Number, default: 0 })
  losses!: number;

  @Prop({ type: Number, default: 0 })
  partialWins!: number;

  @Prop({ type: Number, default: 0 })
  noEntries!: number;

  /** Average confidence when this indicator was used. */
  @Prop({ type: Number, default: 0 })
  avgConfidence!: number;

  /** Sum of confidence for rolling average calculation. */
  @Prop({ type: Number, default: 0 })
  totalConfidence!: number;

  /** Market condition when this indicator performed best. */
  @Prop({ type: Object })
  bestCondition?: Record<string, unknown>;

  /** Market condition when this indicator performed worst. */
  @Prop({ type: Object })
  worstCondition?: Record<string, unknown>;

  @Prop()
  lastUpdated!: Date;
}

export const IndicatorStatsSchema = SchemaFactory.createForClass(IndicatorStats);

IndicatorStatsSchema.index({ userId: 1, indicatorName: 1, signalDirection: 1 }, { unique: true });
