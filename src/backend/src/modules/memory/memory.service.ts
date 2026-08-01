/**
 * TradingAI V2 — Memory Service
 *
 * Core service for the persistent AI memory system. Manages:
 *   - Trade history recall (win rate, loss rate per asset/timeframe/pattern)
 *   - Pattern effectiveness tracking
 *   - Mistake detection and tracking
 *   - Risk profile learning
 *   - Session preference learning
 *   - Trading psychology markers
 *   - Journal history integration
 *
 * Provides the MemoryContext that gets injected into every agent's analysis.
 *
 * Inspired by Paperclip's workspace/context management, rewritten for trading.
 *
 * @module memory
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TradeMemory,
  TradeMemoryDocument,
  PatternMemory,
  PatternMemoryDocument,
  MistakeMemory,
  MistakeMemoryDocument,
  PreferenceMemory,
  PreferenceMemoryDocument,
  SessionMemory,
  SessionMemoryDocument,
} from './schemas/memory.schema';
import { MemoryContext } from '../multi-agent/types/agent.types';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @InjectModel(TradeMemory.name)
    private readonly tradeMemoryModel: Model<TradeMemoryDocument>,
    @InjectModel(PatternMemory.name)
    private readonly patternMemoryModel: Model<PatternMemoryDocument>,
    @InjectModel(MistakeMemory.name)
    private readonly mistakeMemoryModel: Model<MistakeMemoryDocument>,
    @InjectModel(PreferenceMemory.name)
    private readonly preferenceMemoryModel: Model<PreferenceMemoryDocument>,
    @InjectModel(SessionMemory.name)
    private readonly sessionMemoryModel: Model<SessionMemoryDocument>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  //  MEMORY CONTEXT BUILDER (used by Pipeline Orchestrator)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build the complete MemoryContext for a given user and symbol.
   * This is the context that gets injected into every agent's analysis.
   */
  async buildMemoryContext(
    userId: string,
    symbol: string,
  ): Promise<MemoryContext> {
    const [
      symbolHistory,
      patternEffectiveness,
      psychologyMarkers,
      preferences,
    ] = await Promise.all([
      this.getSymbolHistory(userId, symbol),
      this.getPatternEffectiveness(userId),
      this.getPsychologyMarkers(userId),
      this.getPreferences(userId),
    ]);

    return {
      symbolHistory,
      patternEffectiveness,
      psychologyMarkers,
      preferredSessions: preferences?.bestSessions,
      riskProfile: preferences
        ? {
            avgPositionSize: preferences.typicalRiskPercent || 2,
            maxDrawdownTolerance: 10,
            preferredRiskReward: 2,
            maxConcurrentPositions: 3,
          }
        : undefined,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SYMBOL HISTORY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get trading history for a specific symbol.
   */
  async getSymbolHistory(
    userId: string,
    symbol: string,
  ): Promise<MemoryContext['symbolHistory']> {
    const trades = await this.tradeMemoryModel
      .find({ userId, symbol })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    if (trades.length === 0) return undefined;

    const wins = trades.filter((t) => t.result === 'WIN');
    const losses = trades.filter((t) => t.result === 'LOSS');
    const totalPnl = trades.reduce(
      (sum, t) => sum + (t.pnlPercent || 0),
      0,
    );

    // Find the most common setup type in winning trades
    const setupCounts: Record<string, number> = {};
    for (const w of wins) {
      if (w.setupType) {
        setupCounts[w.setupType] = (setupCounts[w.setupType] || 0) + 1;
      }
    }
    const bestSetup = Object.entries(setupCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];

    // Find the most common mistake in losing trades
    const mistakeCounts: Record<string, number> = {};
    for (const l of losses) {
      if (l.mistakes) {
        for (const m of l.mistakes) {
          mistakeCounts[m] = (mistakeCounts[m] || 0) + 1;
        }
      }
    }
    const worstMistake = Object.entries(mistakeCounts).sort(
      (a, b) => b[1] - a[1],
    )[0]?.[0];

    const lastTrade = trades[0];
    const closedTrades = trades.filter(
      (t) => t.result === 'WIN' || t.result === 'LOSS' || t.result === 'BREAK_EVEN',
    );

    return {
      totalTrades: trades.length,
      winRate:
        closedTrades.length > 0
          ? (wins.length / closedTrades.length) * 100
          : 0,
      avgPnlPercent:
        trades.length > 0 ? totalPnl / trades.length : 0,
      lastTradeResult: lastTrade?.result as
        | 'WIN'
        | 'LOSS'
        | 'BREAK_EVEN'
        | undefined,
      bestSetup,
      worstMistake,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PATTERN EFFECTIVENESS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the user's pattern effectiveness data (top patterns by win rate).
   */
  async getPatternEffectiveness(
    userId: string,
  ): Promise<MemoryContext['patternEffectiveness']> {
    const patterns = await this.patternMemoryModel
      .find({ userId, totalOccurrences: { $gte: 3 } }) // Only patterns with enough data
      .sort({ winRate: -1 })
      .limit(10)
      .exec();

    if (patterns.length === 0) return undefined;

    return patterns.map((p) => ({
      pattern: p.pattern,
      winRate: p.winRate,
      sampleSize: p.totalOccurrences,
      avgReward: p.avgRewardRisk,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PSYCHOLOGY MARKERS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute psychology markers from recent trading sessions.
   */
  async getPsychologyMarkers(
    userId: string,
  ): Promise<MemoryContext['psychologyMarkers']> {
    // Get last 10 trades
    const recentTrades = await this.tradeMemoryModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();

    if (recentTrades.length === 0) return undefined;

    // Detect losing streak
    let streakLength = 0;
    for (const t of recentTrades) {
      if (t.result === 'LOSS') {
        streakLength++;
      } else {
        break;
      }
    }

    // Detect overtrading (more than 5 trades in a single day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTrades = recentTrades.filter(
      (t) => t.createdAt >= today,
    );
    const recentOvertradingDetected = todayTrades.length > 5;

    // Calculate revenge trade risk
    let revengeTradeRisk = 0;
    if (streakLength >= 2) revengeTradeRisk += 30;
    if (streakLength >= 3) revengeTradeRisk += 20;
    if (recentOvertradingDetected) revengeTradeRisk += 25;
    const lastEmotion = recentTrades[0]?.emotion;
    if (lastEmotion === 'GREEDY' || lastEmotion === 'ANXIOUS')
      revengeTradeRisk += 15;

    // Detect emotional state
    let emotionalState: 'CALM' | 'TILTED' | 'EUPHORIC' | 'FEARFUL' = 'CALM';
    if (streakLength >= 3) emotionalState = 'TILTED';
    else if (lastEmotion === 'EUPHORIC') emotionalState = 'EUPHORIC';
    else if (lastEmotion === 'FEARFUL') emotionalState = 'FEARFUL';

    return {
      isOnLosingStreak: streakLength >= 2,
      streakLength,
      recentOvertradingDetected,
      emotionalState,
      revengeTradeRisk: Math.min(100, revengeTradeRisk),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PREFERENCES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the user's learned preferences.
   */
  async getPreferences(
    userId: string,
  ): Promise<PreferenceMemory | null> {
    return this.preferenceMemoryModel.findOne({ userId }).exec();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  TRADE MEMORY CRUD
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Record a new trade in memory.
   */
  async recordTrade(
    data: Partial<TradeMemory>,
  ): Promise<TradeMemory> {
    const created = new this.tradeMemoryModel(data);
    const saved = await created.save();

    this.logger.log(
      `Trade recorded: ${saved.symbol} ${saved.side} ${saved.result}`,
    );

    // Auto-update pattern memory if patterns were detected
    if (data.userId && data.patternsDetected) {
      for (const pattern of data.patternsDetected) {
        await this.updatePatternMemory(
          data.userId,
          pattern,
          data.result || 'BREAK_EVEN',
          data.pnlPercent || 0,
          data.riskRewardAchieved || 0,
        );
      }
    }

    // Auto-update mistake memory if mistakes were detected
    if (data.userId && data.mistakes) {
      for (const mistake of data.mistakes) {
        await this.updateMistakeMemory(
          data.userId,
          mistake,
          data.pnlPercent || 0,
          data.symbol,
        );
      }
    }

    return saved;
  }

  /**
   * Get all trade memories for a user.
   */
  async getTradeMemories(
    userId: string,
    filters?: {
      symbol?: string;
      result?: string;
      limit?: number;
    },
  ): Promise<TradeMemory[]> {
    const query: Record<string, unknown> = { userId };
    if (filters?.symbol) query.symbol = filters.symbol;
    if (filters?.result) query.result = filters.result;

    return this.tradeMemoryModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filters?.limit || 50)
      .exec();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PATTERN MEMORY UPDATES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update pattern effectiveness data incrementally.
   */
  private async updatePatternMemory(
    userId: string,
    pattern: string,
    result: string,
    pnlPercent: number,
    rewardRisk: number,
  ): Promise<void> {
    const existing = await this.patternMemoryModel
      .findOne({ userId, pattern })
      .exec();

    if (existing) {
      existing.totalOccurrences++;
      if (result === 'WIN') existing.wins++;
      else if (result === 'LOSS') existing.losses++;
      else existing.breakEvens++;

      existing.winRate =
        existing.totalOccurrences > 0
          ? (existing.wins / existing.totalOccurrences) * 100
          : 0;

      // Rolling average PnL
      existing.avgPnlPercent =
        (existing.avgPnlPercent * (existing.totalOccurrences - 1) +
          pnlPercent) /
        existing.totalOccurrences;

      // Rolling average R:R
      existing.avgRewardRisk =
        (existing.avgRewardRisk * (existing.totalOccurrences - 1) +
          rewardRisk) /
        existing.totalOccurrences;

      // Best/worst
      if (pnlPercent > existing.bestPnlPercent)
        existing.bestPnlPercent = pnlPercent;
      if (pnlPercent < existing.worstPnlPercent)
        existing.worstPnlPercent = pnlPercent;

      existing.lastSeen = new Date();
      await existing.save();
    } else {
      await this.patternMemoryModel.create({
        userId,
        pattern,
        totalOccurrences: 1,
        wins: result === 'WIN' ? 1 : 0,
        losses: result === 'LOSS' ? 1 : 0,
        breakEvens:
          result !== 'WIN' && result !== 'LOSS' ? 1 : 0,
        winRate: result === 'WIN' ? 100 : 0,
        avgPnlPercent: pnlPercent,
        avgRewardRisk: rewardRisk,
        bestPnlPercent: pnlPercent,
        worstPnlPercent: pnlPercent,
        lastSeen: new Date(),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MISTAKE MEMORY UPDATES
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update mistake tracking data incrementally.
   */
  private async updateMistakeMemory(
    userId: string,
    mistakeType: string,
    pnlImpact: number,
    symbol?: string,
  ): Promise<void> {
    const existing = await this.mistakeMemoryModel
      .findOne({ userId, mistakeType })
      .exec();

    if (existing) {
      const previousCount = existing.occurrenceCount;
      existing.occurrenceCount++;
      existing.totalPnlImpact += Math.abs(pnlImpact);
      existing.lastOccurrence = new Date();

      // Track associated symbols
      if (
        symbol &&
        existing.associatedSymbols &&
        !existing.associatedSymbols.includes(symbol)
      ) {
        existing.associatedSymbols.push(symbol);
      }

      // Check if improving (fewer mistakes recently)
      existing.improving = previousCount > existing.occurrenceCount;

      await existing.save();
    } else {
      await this.mistakeMemoryModel.create({
        userId,
        mistakeType,
        occurrenceCount: 1,
        totalPnlImpact: Math.abs(pnlImpact),
        associatedSymbols: symbol ? [symbol] : [],
        lastOccurrence: new Date(),
        improving: false,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  SESSION MEMORY
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Record or update a trading session.
   */
  async recordSession(
    data: Partial<SessionMemory>,
  ): Promise<SessionMemory> {
    const created = new this.sessionMemoryModel(data);
    return created.save();
  }

  /**
   * Get recent sessions for a user.
   */
  async getRecentSessions(
    userId: string,
    limit = 10,
  ): Promise<SessionMemory[]> {
    return this.sessionMemoryModel
      .find({ userId })
      .sort({ sessionDate: -1 })
      .limit(limit)
      .exec();
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  PREFERENCE LEARNING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Recompute and save user preferences from accumulated trade data.
   * This should be called periodically (e.g., after every session).
   */
  async recomputePreferences(userId: string): Promise<void> {
    const allTrades = await this.tradeMemoryModel
      .find({ userId })
      .exec();

    if (allTrades.length < 5) return; // Not enough data

    const wins = allTrades.filter((t) => t.result === 'WIN');

    // Best timeframes
    const timeframeCounts: Record<string, { wins: number; total: number }> = {};
    for (const t of allTrades) {
      if (!t.timeframe) continue;
      if (!timeframeCounts[t.timeframe])
        timeframeCounts[t.timeframe] = { wins: 0, total: 0 };
      timeframeCounts[t.timeframe].total++;
      if (t.result === 'WIN') timeframeCounts[t.timeframe].wins++;
    }
    const bestTimeframes = Object.entries(timeframeCounts)
      .filter(([, v]) => v.total >= 3)
      .sort((a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total)
      .slice(0, 3)
      .map(([k]) => k);

    // Best sessions
    const sessionCounts: Record<string, { wins: number; total: number }> = {};
    for (const t of allTrades) {
      if (!t.session) continue;
      if (!sessionCounts[t.session])
        sessionCounts[t.session] = { wins: 0, total: 0 };
      sessionCounts[t.session].total++;
      if (t.result === 'WIN') sessionCounts[t.session].wins++;
    }
    const bestSessions = Object.entries(sessionCounts)
      .filter(([, v]) => v.total >= 3)
      .sort((a, b) => b[1].wins / b[1].total - a[1].wins / a[1].total)
      .slice(0, 3)
      .map(([k]) => k);

    // Strong symbols (>60% win rate with 3+ trades)
    const symbolCounts: Record<string, { wins: number; total: number }> = {};
    for (const t of allTrades) {
      if (!symbolCounts[t.symbol])
        symbolCounts[t.symbol] = { wins: 0, total: 0 };
      symbolCounts[t.symbol].total++;
      if (t.result === 'WIN') symbolCounts[t.symbol].wins++;
    }
    const strongSymbols = Object.entries(symbolCounts)
      .filter(([, v]) => v.total >= 3 && v.wins / v.total >= 0.6)
      .map(([k]) => k);
    const weakSymbols = Object.entries(symbolCounts)
      .filter(([, v]) => v.total >= 3 && v.wins / v.total < 0.4)
      .map(([k]) => k);

    // Average hold time
    const holdTimes = allTrades
      .filter((t) => t.holdingDurationMinutes)
      .map((t) => t.holdingDurationMinutes!);
    const avgHoldTime =
      holdTimes.length > 0
        ? holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length
        : undefined;

    // Trading style detection
    let tradingStyle = 'DAY_TRADER';
    if (avgHoldTime) {
      if (avgHoldTime < 15) tradingStyle = 'SCALPER';
      else if (avgHoldTime < 240) tradingStyle = 'DAY_TRADER';
      else if (avgHoldTime < 2880) tradingStyle = 'SWING_TRADER';
      else tradingStyle = 'POSITION_TRADER';
    }

    // Upsert preferences
    await this.preferenceMemoryModel.findOneAndUpdate(
      { userId },
      {
        userId,
        bestTimeframes,
        bestSessions,
        strongSymbols,
        weakSymbols,
        avgHoldTime,
        tradingStyle,
      },
      { upsert: true, new: true },
    );

    this.logger.log(
      `Preferences recomputed for user ${userId}: style=${tradingStyle}, ${allTrades.length} trades analyzed`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  STATISTICS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get comprehensive memory statistics for a user.
   */
  async getStats(userId: string): Promise<{
    totalTradesRecorded: number;
    overallWinRate: number;
    patternsTracked: number;
    topPattern: string | null;
    mistakesTracked: number;
    topMistake: string | null;
    sessionsRecorded: number;
    tradingStyle: string | null;
  }> {
    const [tradeCount, patterns, mistakes, sessions, prefs] =
      await Promise.all([
        this.tradeMemoryModel.countDocuments({ userId }).exec(),
        this.patternMemoryModel
          .find({ userId })
          .sort({ winRate: -1 })
          .limit(1)
          .exec(),
        this.mistakeMemoryModel
          .find({ userId })
          .sort({ occurrenceCount: -1 })
          .limit(1)
          .exec(),
        this.sessionMemoryModel.countDocuments({ userId }).exec(),
        this.preferenceMemoryModel.findOne({ userId }).exec(),
      ]);

    const closedTrades = await this.tradeMemoryModel
      .find({
        userId,
        result: { $in: ['WIN', 'LOSS', 'BREAK_EVEN'] },
      })
      .exec();

    const wins = closedTrades.filter((t) => t.result === 'WIN').length;
    const winRate =
      closedTrades.length > 0
        ? (wins / closedTrades.length) * 100
        : 0;

    const patternCount = await this.patternMemoryModel
      .countDocuments({ userId })
      .exec();
    const mistakeCount = await this.mistakeMemoryModel
      .countDocuments({ userId })
      .exec();

    return {
      totalTradesRecorded: tradeCount,
      overallWinRate: Number(winRate.toFixed(1)),
      patternsTracked: patternCount,
      topPattern: patterns[0]?.pattern || null,
      mistakesTracked: mistakeCount,
      topMistake: mistakes[0]?.mistakeType || null,
      sessionsRecorded: sessions,
      tradingStyle: prefs?.tradingStyle || null,
    };
  }
}
