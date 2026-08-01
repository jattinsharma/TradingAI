/**
 * TradingAI V2 — AI Coach Service
 *
 * Post-trade analysis and improvement system. After every completed trade:
 *   - Analyzes entry quality, timing, exit quality
 *   - Detects mistakes (moved SL, entered late, oversized, revenge traded)
 *   - Tracks long-term statistics (win rate trend, avg R:R, best/worst days)
 *   - Generates personalized improvement suggestions via LLM
 *   - Updates Memory Engine with learnings
 *
 * @module coach
 */
import { Injectable, Logger } from '@nestjs/common';
import { MemoryService } from '../memory/memory.service';
import { LlmProviderService } from '../multi-agent/llm/llm-provider.service';
import { TradeMemory } from '../memory/schemas/memory.schema';

/** Trade review result */
export interface TradeReview {
  tradeId: string;
  symbol: string;
  side: string;
  result: string;

  /** Quality scores 0-100 */
  entryQuality: number;
  exitQuality: number;
  timingQuality: number;
  riskManagementQuality: number;
  overallGrade: string; // A+ through F

  /** Detected mistakes */
  mistakes: string[];

  /** What the trader did well */
  strengths: string[];

  /** Personalized improvement advice */
  advice: string[];

  /** Key lesson from this trade */
  keyLesson: string;

  /** Performance trend */
  performanceTrend: 'IMPROVING' | 'DECLINING' | 'STABLE';

  /** Statistics snapshot */
  stats: {
    recentWinRate: number;
    avgRR: number;
    currentStreak: string;
    totalTradesReviewed: number;
  };
}

/** Coaching insights (proactive, not tied to a specific trade) */
export interface CoachInsights {
  /** Top 3 strengths */
  strengths: string[];

  /** Top 3 areas for improvement */
  improvements: string[];

  /** Behavioral patterns detected */
  patterns: string[];

  /** Specific actionable advice */
  actionItems: string[];

  /** Trading psychology assessment */
  psychologyNote: string;

  /** Overall performance grade */
  grade: string;
}

@Injectable()
export class CoachService {
  private readonly logger = new Logger(CoachService.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmProvider: LlmProviderService,
  ) {}

  /**
   * Review a completed trade and generate coaching feedback.
   */
  async reviewTrade(
    userId: string,
    tradeData: Partial<TradeMemory>,
  ): Promise<TradeReview> {
    this.logger.log(
      `Reviewing trade: ${tradeData.symbol} ${tradeData.side} ${tradeData.result}`,
    );

    // 1. Record the trade in memory
    const recordedTrade = await this.memoryService.recordTrade({
      ...tradeData,
      userId,
    });

    // 2. Get context for the review
    const [symbolHistory, recentTrades, psychology] = await Promise.all([
      this.memoryService.getSymbolHistory(userId, tradeData.symbol || ''),
      this.memoryService.getTradeMemories(userId, { limit: 20 }),
      this.memoryService.getPsychologyMarkers(userId),
    ]);

    // 3. Detect mistakes
    const mistakes = this.detectMistakes(tradeData, psychology);

    // 4. Score the trade
    const scores = this.scoreTrade(tradeData);

    // 5. Calculate performance trend
    const performanceTrend = this.calculateTrend(recentTrades);

    // 6. Generate personalized advice via LLM
    const llmAdvice = await this.generateAdvice(
      tradeData,
      mistakes,
      scores,
      symbolHistory,
      recentTrades,
    );

    // 7. Recompute preferences periodically
    if (recentTrades.length % 10 === 0) {
      await this.memoryService.recomputePreferences(userId);
    }

    // 8. Build recent stats
    const closed = recentTrades.filter(
      (t) => t.result === 'WIN' || t.result === 'LOSS' || t.result === 'BREAK_EVEN',
    );
    const wins = closed.filter((t) => t.result === 'WIN');
    const recentWinRate =
      closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

    const rrValues = recentTrades
      .filter((t) => t.riskRewardAchieved)
      .map((t) => t.riskRewardAchieved!);
    const avgRR =
      rrValues.length > 0
        ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length
        : 0;

    // Current streak
    let streakType = recentTrades[0]?.result || 'NONE';
    let streakCount = 0;
    for (const t of recentTrades) {
      if (t.result === streakType) streakCount++;
      else break;
    }

    return {
      tradeId: recordedTrade._id?.toString() || '',
      symbol: tradeData.symbol || '',
      side: tradeData.side || '',
      result: tradeData.result || '',
      entryQuality: scores.entryQuality,
      exitQuality: scores.exitQuality,
      timingQuality: scores.timingQuality,
      riskManagementQuality: scores.riskManagement,
      overallGrade: this.computeGrade(
        (scores.entryQuality +
          scores.exitQuality +
          scores.timingQuality +
          scores.riskManagement) /
          4,
      ),
      mistakes,
      strengths: llmAdvice.strengths,
      advice: llmAdvice.advice,
      keyLesson: llmAdvice.keyLesson,
      performanceTrend,
      stats: {
        recentWinRate: Number(recentWinRate.toFixed(1)),
        avgRR: Number(avgRR.toFixed(2)),
        currentStreak: `${streakCount} ${streakType}`,
        totalTradesReviewed: recentTrades.length,
      },
    };
  }

  /**
   * Generate proactive coaching insights (not tied to a specific trade).
   */
  async getInsights(userId: string): Promise<CoachInsights> {
    const [stats, recentTrades, preferences, psychology] =
      await Promise.all([
        this.memoryService.getStats(userId),
        this.memoryService.getTradeMemories(userId, { limit: 50 }),
        this.memoryService.getPreferences(userId),
        this.memoryService.getPsychologyMarkers(userId),
      ]);

    const prompt = `You are an AI Trading Coach. Analyze this trader's data and provide actionable coaching insights.

Trading Statistics:
- Total trades: ${stats.totalTradesRecorded}
- Win rate: ${stats.overallWinRate}%
- Top pattern: ${stats.topPattern || 'None tracked'}
- Top mistake: ${stats.topMistake || 'None tracked'}
- Trading style: ${stats.tradingStyle || 'Unknown'}

Psychology:
- Losing streak: ${psychology?.isOnLosingStreak ? `Yes (${psychology.streakLength} trades)` : 'No'}
- Overtrading: ${psychology?.recentOvertradingDetected ? 'Yes' : 'No'}
- Revenge trade risk: ${psychology?.revengeTradeRisk || 0}%

Provide your response as JSON:
{
  "strengths": ["strength1", "strength2", "strength3"],
  "improvements": ["area1", "area2", "area3"],
  "patterns": ["behavioral pattern 1", "behavioral pattern 2"],
  "actionItems": ["specific action 1", "specific action 2"],
  "psychologyNote": "Assessment of trading psychology",
  "grade": "A+ through F"
}`;

    try {
      const response = await this.llmProvider.complete({
        systemPrompt:
          'You are a professional trading coach. Be honest, specific, and actionable.',
        userPrompt: prompt,
        temperature: 0.3,
        jsonMode: true,
      });

      const parsed = this.safeParseJson<CoachInsights>(response.content);
      if (parsed) return parsed;
    } catch (error) {
      this.logger.warn(
        `LLM coaching insights failed: ${(error as Error).message}`,
      );
    }

    // Fallback
    return {
      strengths: ['Data insufficient for strength analysis'],
      improvements: ['Record more trades for personalized coaching'],
      patterns: [],
      actionItems: ['Complete at least 10 trades to unlock coaching insights'],
      psychologyNote:
        psychology?.isOnLosingStreak
          ? 'You are on a losing streak. Consider reducing position size.'
          : 'Psychology data is limited.',
      grade: 'N/A',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  MISTAKE DETECTION
  // ─────────────────────────────────────────────────────────────────────────

  private detectMistakes(
    trade: Partial<TradeMemory>,
    psychology: NonNullable<Awaited<ReturnType<MemoryService['getPsychologyMarkers']>>> | undefined,
  ): string[] {
    const mistakes: string[] = [];

    // Revenge trade detection (trading immediately after a loss)
    if (psychology?.isOnLosingStreak && (psychology.streakLength ?? 0) >= 2) {
      mistakes.push('POTENTIAL_REVENGE_TRADE');
    }

    // Overtrading
    if (psychology?.recentOvertradingDetected) {
      mistakes.push('OVERTRADING');
    }

    // Poor R:R
    if (
      trade.riskRewardAchieved !== undefined &&
      trade.riskRewardAchieved < 1 &&
      trade.result === 'WIN'
    ) {
      mistakes.push('LOW_RISK_REWARD');
    }

    // User-declared mistakes
    if (trade.mistakes) {
      mistakes.push(...trade.mistakes);
    }

    return [...new Set(mistakes)]; // Deduplicate
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  TRADE SCORING
  // ─────────────────────────────────────────────────────────────────────────

  private scoreTrade(
    trade: Partial<TradeMemory>,
  ): {
    entryQuality: number;
    exitQuality: number;
    timingQuality: number;
    riskManagement: number;
  } {
    let entryQuality = 50;
    let exitQuality = 50;
    let timingQuality = 50;
    let riskManagement = 50;

    // Entry quality: based on R:R achieved
    if (trade.riskRewardAchieved) {
      if (trade.riskRewardAchieved >= 3) entryQuality = 90;
      else if (trade.riskRewardAchieved >= 2) entryQuality = 75;
      else if (trade.riskRewardAchieved >= 1.5) entryQuality = 60;
      else if (trade.riskRewardAchieved >= 1) entryQuality = 45;
      else entryQuality = 30;
    }

    // Exit quality: based on result
    if (trade.result === 'WIN') {
      exitQuality = trade.pnlPercent && trade.pnlPercent > 3 ? 85 : 70;
    } else if (trade.result === 'BREAK_EVEN') {
      exitQuality = 55;
    } else if (trade.result === 'LOSS') {
      exitQuality = trade.pnlPercent && Math.abs(trade.pnlPercent) < 2 ? 45 : 25;
    }

    // Timing: based on AI confidence alignment
    if (trade.aiConfidenceAtEntry) {
      if (trade.result === 'WIN' && trade.aiConfidenceAtEntry > 70)
        timingQuality = 85;
      else if (trade.result === 'WIN' && trade.aiConfidenceAtEntry > 50)
        timingQuality = 65;
      else if (trade.result === 'LOSS' && trade.aiConfidenceAtEntry < 40)
        timingQuality = 30;
    }

    // Risk management: based on loss size
    if (trade.result === 'LOSS' && trade.pnlPercent) {
      const lossSize = Math.abs(trade.pnlPercent);
      if (lossSize <= 1) riskManagement = 85;
      else if (lossSize <= 2) riskManagement = 65;
      else if (lossSize <= 3) riskManagement = 45;
      else riskManagement = 20;
    } else if (trade.result === 'WIN') {
      riskManagement = 70;
    }

    return { entryQuality, exitQuality, timingQuality, riskManagement };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  TREND CALCULATION
  // ─────────────────────────────────────────────────────────────────────────

  private calculateTrend(
    recentTrades: TradeMemory[],
  ): 'IMPROVING' | 'DECLINING' | 'STABLE' {
    if (recentTrades.length < 10) return 'STABLE';

    const firstHalf = recentTrades.slice(
      Math.floor(recentTrades.length / 2),
    );
    const secondHalf = recentTrades.slice(
      0,
      Math.floor(recentTrades.length / 2),
    );

    const firstWinRate =
      firstHalf.filter((t) => t.result === 'WIN').length / firstHalf.length;
    const secondWinRate =
      secondHalf.filter((t) => t.result === 'WIN').length /
      secondHalf.length;

    const diff = secondWinRate - firstWinRate;
    if (diff > 0.1) return 'IMPROVING';
    if (diff < -0.1) return 'DECLINING';
    return 'STABLE';
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  LLM ADVICE GENERATION
  // ─────────────────────────────────────────────────────────────────────────

  private async generateAdvice(
    trade: Partial<TradeMemory>,
    mistakes: string[],
    scores: { entryQuality: number; exitQuality: number; timingQuality: number; riskManagement: number },
    symbolHistory: Awaited<ReturnType<MemoryService['getSymbolHistory']>>,
    recentTrades: TradeMemory[],
  ): Promise<{ strengths: string[]; advice: string[]; keyLesson: string }> {
    const prompt = `Review this trade and provide coaching feedback.

Trade: ${trade.symbol} ${trade.side} → ${trade.result} (${trade.pnlPercent?.toFixed(2) || 0}%)
Entry: ${trade.entryPrice}, Exit: ${trade.exitPrice || 'N/A'}
R:R Achieved: ${trade.riskRewardAchieved || 'N/A'}
Mistakes: ${mistakes.length > 0 ? mistakes.join(', ') : 'None detected'}
Scores: Entry=${scores.entryQuality}, Exit=${scores.exitQuality}, Timing=${scores.timingQuality}, Risk=${scores.riskManagement}
History on ${trade.symbol}: ${symbolHistory?.totalTrades || 0} trades, ${symbolHistory?.winRate?.toFixed(1) || 0}% win rate
Recent streak: ${recentTrades.slice(0, 5).map((t) => t.result).join(', ')}

Respond as JSON:
{
  "strengths": ["what the trader did well"],
  "advice": ["specific improvement suggestion"],
  "keyLesson": "one-sentence key takeaway"
}`;

    try {
      const response = await this.llmProvider.complete({
        systemPrompt:
          'You are a professional trading coach. Be specific, honest, and encouraging.',
        userPrompt: prompt,
        temperature: 0.3,
        maxTokens: 1000,
        jsonMode: true,
      });

      const parsed = this.safeParseJson<{
        strengths: string[];
        advice: string[];
        keyLesson: string;
      }>(response.content);

      if (parsed) return parsed;
    } catch (error) {
      this.logger.warn(
        `LLM advice generation failed: ${(error as Error).message}`,
      );
    }

    return {
      strengths:
        trade.result === 'WIN'
          ? ['Trade was profitable']
          : ['Loss was controlled'],
      advice:
        mistakes.length > 0
          ? [`Focus on avoiding: ${mistakes[0]}`]
          : ['Continue following your trading plan'],
      keyLesson: 'Review and document every trade for continuous improvement.',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private computeGrade(avgScore: number): string {
    if (avgScore >= 90) return 'A+';
    if (avgScore >= 85) return 'A';
    if (avgScore >= 80) return 'A-';
    if (avgScore >= 75) return 'B+';
    if (avgScore >= 70) return 'B';
    if (avgScore >= 65) return 'B-';
    if (avgScore >= 60) return 'C+';
    if (avgScore >= 55) return 'C';
    if (avgScore >= 50) return 'C-';
    if (avgScore >= 40) return 'D';
    return 'F';
  }

  private safeParseJson<T>(raw: string): T | null {
    try {
      const cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      return JSON.parse(cleaned) as T;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as T;
        } catch {
          return null;
        }
      }
      return null;
    }
  }
}
