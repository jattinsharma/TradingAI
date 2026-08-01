/**
 * TradingAI V2 — Memory Engine Schemas
 *
 * MongoDB schemas for the persistent AI memory system.
 * Stores trade history, pattern effectiveness, mistakes,
 * preferences, and session data per user.
 *
 * Inspired by Paperclip's workspace/context management,
 * rewritten for trading-specific use cases.
 *
 * @module memory
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// ═══════════════════════════════════════════════════════════════════════════════
//  TRADE MEMORY — Records of past trade outcomes for pattern learning
// ═══════════════════════════════════════════════════════════════════════════════

export type TradeMemoryDocument = TradeMemory & Document;

@Schema({ timestamps: true, collection: 'trade_memories' })
export class TradeMemory {
  _id?: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  symbol!: string;

  @Prop({ required: true })
  timeframe!: string;

  @Prop({ required: true })
  side!: string; // LONG | SHORT

  @Prop({ required: true })
  result!: string; // WIN | LOSS | BREAK_EVEN

  @Prop({ type: Number, required: true })
  entryPrice!: number;

  @Prop({ type: Number })
  exitPrice?: number;

  @Prop({ type: Number })
  pnlPercent?: number;

  @Prop({ type: Number })
  riskRewardAchieved?: number;

  @Prop()
  setupType?: string; // e.g., "breakout", "pullback", "reversal"

  @Prop({ type: [String] })
  patternsDetected?: string[];

  @Prop({ type: [String] })
  indicatorsAligned?: string[];

  @Prop({ type: Number })
  aiConfidenceAtEntry?: number;

  @Prop()
  aiSignalAtEntry?: string; // BULLISH | BEARISH | NEUTRAL

  @Prop({ type: Number })
  holdingDurationMinutes?: number;

  @Prop()
  session?: string; // LONDON | NEW_YORK | ASIAN | OVERLAP

  @Prop()
  dayOfWeek?: string;

  @Prop({ type: [String] })
  mistakes?: string[];

  @Prop({ type: [String] })
  lessonsLearned?: string[];

  @Prop()
  emotion?: string; // CALM | ANXIOUS | GREEDY | FEARFUL | EUPHORIC

  /** Reference to trade journal entry */
  @Prop()
  tradeJournalId?: string;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const TradeMemorySchema = SchemaFactory.createForClass(TradeMemory);

TradeMemorySchema.index({ userId: 1, symbol: 1, createdAt: -1 });
TradeMemorySchema.index({ userId: 1, result: 1 });
TradeMemorySchema.index({ userId: 1, setupType: 1 });

// ═══════════════════════════════════════════════════════════════════════════════
//  PATTERN MEMORY — Tracks which patterns work for this user
// ═══════════════════════════════════════════════════════════════════════════════

export type PatternMemoryDocument = PatternMemory & Document;

@Schema({ timestamps: true, collection: 'pattern_memories' })
export class PatternMemory {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  pattern!: string; // e.g., "double_bottom", "bull_flag", "head_and_shoulders"

  @Prop()
  symbol?: string; // Optional: pattern performance per symbol

  @Prop()
  timeframe?: string;

  @Prop({ type: Number, default: 0 })
  totalOccurrences!: number;

  @Prop({ type: Number, default: 0 })
  wins!: number;

  @Prop({ type: Number, default: 0 })
  losses!: number;

  @Prop({ type: Number, default: 0 })
  breakEvens!: number;

  @Prop({ type: Number, default: 0 })
  winRate!: number;

  @Prop({ type: Number, default: 0 })
  avgPnlPercent!: number;

  @Prop({ type: Number, default: 0 })
  avgRewardRisk!: number;

  @Prop({ type: Number, default: 0 })
  bestPnlPercent!: number;

  @Prop({ type: Number, default: 0 })
  worstPnlPercent!: number;

  @Prop()
  lastSeen?: Date;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const PatternMemorySchema =
  SchemaFactory.createForClass(PatternMemory);

PatternMemorySchema.index({ userId: 1, pattern: 1 }, { unique: true });
PatternMemorySchema.index({ userId: 1, winRate: -1 });

// ═══════════════════════════════════════════════════════════════════════════════
//  MISTAKE MEMORY — Tracks recurring mistakes for AI Coach
// ═══════════════════════════════════════════════════════════════════════════════

export type MistakeMemoryDocument = MistakeMemory & Document;

@Schema({ timestamps: true, collection: 'mistake_memories' })
export class MistakeMemory {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  mistakeType!: string;
  // Common types:
  //   MOVED_STOP_LOSS
  //   ENTERED_LATE
  //   EXITED_EARLY
  //   OVERSIZED_POSITION
  //   REVENGE_TRADE
  //   TRADED_AGAINST_TREND
  //   IGNORED_STOP_LOSS
  //   OVERTRADING
  //   FOMO_ENTRY
  //   NO_PLAN

  @Prop({ type: Number, default: 0 })
  occurrenceCount!: number;

  @Prop({ type: Number, default: 0 })
  totalPnlImpact!: number; // Cumulative PnL lost from this mistake

  @Prop({ type: [String] })
  associatedSymbols?: string[];

  @Prop({ type: [String] })
  associatedSessions?: string[];

  @Prop()
  lastOccurrence?: Date;

  @Prop()
  aiCoachAdvice?: string; // Personalized advice generated by AI Coach

  @Prop({ type: Boolean, default: false })
  improving!: boolean; // True if frequency is declining

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const MistakeMemorySchema =
  SchemaFactory.createForClass(MistakeMemory);

MistakeMemorySchema.index(
  { userId: 1, mistakeType: 1 },
  { unique: true },
);

// ═══════════════════════════════════════════════════════════════════════════════
//  PREFERENCE MEMORY — User trading preferences learned over time
// ═══════════════════════════════════════════════════════════════════════════════

export type PreferenceMemoryDocument = PreferenceMemory & Document;

@Schema({ timestamps: true, collection: 'preference_memories' })
export class PreferenceMemory {
  @Prop({ required: true, index: true, unique: true })
  userId!: string;

  /** Best-performing timeframes */
  @Prop({ type: [String] })
  bestTimeframes?: string[];

  /** Best-performing sessions */
  @Prop({ type: [String] })
  bestSessions?: string[];

  /** Best-performing days of the week */
  @Prop({ type: [String] })
  bestDays?: string[];

  /** Symbols with highest win rate */
  @Prop({ type: [String] })
  strongSymbols?: string[];

  /** Symbols with lowest win rate */
  @Prop({ type: [String] })
  weakSymbols?: string[];

  /** Average position hold time in minutes */
  @Prop({ type: Number })
  avgHoldTime?: number;

  /** Average trades per day */
  @Prop({ type: Number })
  avgTradesPerDay?: number;

  /** Typical risk per trade (% of account) */
  @Prop({ type: Number })
  typicalRiskPercent?: number;

  /** Preferred setup types */
  @Prop({ type: [String] })
  preferredSetups?: string[];

  /** Overall trading style detected */
  @Prop()
  tradingStyle?: string; // SCALPER | DAY_TRADER | SWING_TRADER | POSITION_TRADER

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const PreferenceMemorySchema =
  SchemaFactory.createForClass(PreferenceMemory);

// ═══════════════════════════════════════════════════════════════════════════════
//  SESSION MEMORY — Per-session statistics for psychology tracking
// ═══════════════════════════════════════════════════════════════════════════════

export type SessionMemoryDocument = SessionMemory & Document;

@Schema({ timestamps: true, collection: 'session_memories' })
export class SessionMemory {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true })
  sessionDate!: Date;

  @Prop({ type: Number, default: 0 })
  tradesCount!: number;

  @Prop({ type: Number, default: 0 })
  wins!: number;

  @Prop({ type: Number, default: 0 })
  losses!: number;

  @Prop({ type: Number, default: 0 })
  totalPnl!: number;

  @Prop({ type: Number, default: 0 })
  totalPnlPercent!: number;

  @Prop()
  startEmotion?: string;

  @Prop()
  endEmotion?: string;

  @Prop({ type: Boolean, default: false })
  overtradingDetected!: boolean;

  @Prop({ type: Boolean, default: false })
  revengeTradeDetected!: boolean;

  @Prop({ type: Number, default: 0 })
  consecutiveLosses!: number;

  @Prop({ type: [String] })
  mistakesMade?: string[];

  @Prop()
  aiCoachSummary?: string;

  @Prop()
  createdAt!: Date;

  @Prop()
  updatedAt!: Date;
}

export const SessionMemorySchema =
  SchemaFactory.createForClass(SessionMemory);

SessionMemorySchema.index({ userId: 1, sessionDate: -1 });
