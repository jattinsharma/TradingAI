import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PredictionDocument = Prediction & Document;

/**
 * Stores every AI-generated trade analysis as a trackable prediction.
 * Evaluation fields are populated later by PredictionEvaluatorService
 * using live market prices.
 */
@Schema({ timestamps: true, collection: 'predictions' })
export class Prediction {
  _id!: string;

  // ── Identity ──────────────────────────────────────────────
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  platform!: string; // tradingview, binance, etc.

  @Prop({ required: true, index: true })
  symbol!: string;

  @Prop({ default: '1D' })
  timeframe!: string;

  // ── Prediction ────────────────────────────────────────────
  @Prop({ required: true })
  recommendation!: string; // STRONG_BUY | BUY | HOLD | SELL | STRONG_SELL

  @Prop({ type: Number, required: true })
  confidence!: number; // 0–100

  @Prop({ type: Number, required: true })
  currentPrice!: number;

  @Prop({ type: Number })
  entryPrice?: number;

  @Prop({ type: Number })
  stopLoss?: number;

  @Prop({ type: Number })
  takeProfit1?: number;

  @Prop({ type: Number })
  takeProfit2?: number;

  @Prop({ type: Number })
  riskRewardRatio?: number;

  @Prop({ type: Number })
  riskPercent?: number;

  @Prop()
  tradeDuration?: string; // e.g. "1-3 days"

  @Prop()
  tradeQuality?: string; // Excellent | Good | Average | Poor | Avoid

  @Prop()
  marketBias?: string; // STRONG_BULLISH | BULLISH | NEUTRAL | BEARISH | STRONG_BEARISH

  // ── Indicator Snapshot ────────────────────────────────────
  @Prop({ type: Object })
  indicatorSnapshot?: Record<string, unknown>;

  // ── Market Intelligence Snapshot ──────────────────────────
  @Prop()
  summary?: string;

  @Prop({ type: [String] })
  bullishFactors?: string[];

  @Prop({ type: [String] })
  bearishFactors?: string[];

  @Prop({ type: [String] })
  risks?: string[];

  @Prop()
  beginnerExplanation?: string;

  @Prop()
  professionalExplanation?: string;

  // ── Evaluation ────────────────────────────────────────────
  /** Current status of this prediction in the market. */
  @Prop({
    type: String,
    enum: ['OPEN', 'TP1_HIT', 'TP2_HIT', 'SL_HIT', 'NO_ENTRY', 'EXPIRED'],
    default: 'OPEN',
  })
  status!: string;

  /** Final result after evaluation. */
  @Prop({
    type: String,
    enum: ['WIN', 'LOSS', 'PARTIAL_WIN', 'NO_ENTRY', 'PENDING'],
    default: 'PENDING',
  })
  result!: string;

  @Prop({ type: Number })
  mfe?: number; // Maximum Favorable Excursion (%)

  @Prop({ type: Number })
  mae?: number; // Maximum Adverse Excursion (%)

  @Prop({ type: Boolean })
  entryTriggered?: boolean;

  @Prop()
  entryTriggeredAt?: Date;

  @Prop()
  slHitAt?: Date;

  @Prop()
  tp1HitAt?: Date;

  @Prop()
  tp2HitAt?: Date;

  @Prop()
  evaluatedAt?: Date; // Last evaluation timestamp

  // ── Timestamps (auto by Mongoose) ─────────────────────────
  createdAt!: Date;
  updatedAt!: Date;
}

export const PredictionSchema = SchemaFactory.createForClass(Prediction);

// Indexes for efficient querying
PredictionSchema.index({ userId: 1, createdAt: -1 });
PredictionSchema.index({ userId: 1, status: 1 });
PredictionSchema.index({ userId: 1, symbol: 1 });
PredictionSchema.index({ symbol: 1, createdAt: -1 });
PredictionSchema.index({ status: 1, evaluatedAt: 1 }); // For background job
