/**
 * TradingAI V2 — Pipeline Orchestrator
 *
 * The central orchestration service that drives the entire AI Engine V2 pipeline:
 *
 *   1. Receive analysis request with context
 *   2. Select agents based on AnalysisDepth (QUICK/STANDARD/DEEP)
 *   3. Run analyst agents in parallel
 *   4. Run adversarial debate (if enabled)
 *   5. Run Portfolio Manager to produce final recommendation
 *   6. Build the full TradeRecommendation output
 *
 * Supports progressive status updates via callback for UI streaming.
 *
 * @module multi-agent/pipeline
 */
import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MemoryService } from '../../memory/memory.service';
import {
  AnalysisContext,
  AnalysisDepth,
  AgentResult,
  AgentRole,
  AgentReasoning,
  TradeRecommendation,
  PipelineStatus,
  PipelineConfig,
  DEFAULT_PIPELINE_CONFIGS,
  SignalType,
  SignalStrength,
  PriceLevel,
  TrendAnalysis,
  MomentumAnalysis,
  MarketRegime,
} from '../types/agent.types';
import { TechnicalAnalystAgent } from '../agents/technical-analyst.agent';
import { FundamentalAnalystAgent } from '../agents/fundamental-analyst.agent';
import { NewsAnalystAgent } from '../agents/news-analyst.agent';
import { SentimentAnalystAgent } from '../agents/sentiment-analyst.agent';
import { MacroAnalystAgent } from '../agents/macro-analyst.agent';
import { RiskManagerAgent } from '../agents/risk-manager.agent';
import { PortfolioManagerAgent } from '../agents/portfolio-manager.agent';
import { DebateOrchestratorService } from '../debate/debate-orchestrator.service';

/** Callback for progressive status updates */
export type StatusCallback = (status: PipelineStatus) => void;

@Injectable()
export class PipelineOrchestratorService {
  private readonly logger = new Logger(PipelineOrchestratorService.name);

  constructor(
    private readonly technicalAnalyst: TechnicalAnalystAgent,
    private readonly fundamentalAnalyst: FundamentalAnalystAgent,
    private readonly newsAnalyst: NewsAnalystAgent,
    private readonly sentimentAnalyst: SentimentAnalystAgent,
    private readonly macroAnalyst: MacroAnalystAgent,
    private readonly riskManager: RiskManagerAgent,
    private readonly portfolioManager: PortfolioManagerAgent,
    private readonly debateOrchestrator: DebateOrchestratorService,
    @Optional() private readonly memoryService?: MemoryService,
  ) {}

  /**
   * Run the full AI Engine V2 pipeline.
   *
   * @param context         Analysis context (symbol, chart data, market data, memory)
   * @param configOverride  Optional pipeline config overrides
   * @param onStatus        Optional callback for progressive status updates
   */
  async analyze(
    context: AnalysisContext,
    configOverride?: Partial<PipelineConfig>,
    onStatus?: StatusCallback,
  ): Promise<TradeRecommendation> {
    const startTime = Date.now();
    const requestId = context.requestId || randomUUID();
    const config: PipelineConfig = {
      ...DEFAULT_PIPELINE_CONFIGS[context.depth],
      ...configOverride,
    };

    this.logger.log(
      `Pipeline started: ${context.symbol} ${context.timeframe} [${context.depth}] (request: ${requestId})`,
    );

    const status: PipelineStatus = {
      requestId,
      stage: 'ENGINES',
      progress: 0,
      completedAgents: [],
      pendingAgents: this.getAgentsForDepth(context.depth),
      elapsedMs: 0,
    };

    try {
      // ═══════════════════════════════════════════════════════════════════
      //  STAGE 0: Hydrate persistent AI memory (if user authenticated)
      // ═══════════════════════════════════════════════════════════════════
      if (context.userId && !context.memory && this.memoryService) {
        try {
          context.memory = await this.memoryService.buildMemoryContext(
            context.userId,
            context.symbol,
          );
          this.logger.log(`Memory context hydrated for user ${context.userId}`);
        } catch (memError) {
          this.logger.warn(`Failed to hydrate memory context: ${(memError as Error).message}`);
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      //  STAGE 1: Run analyst agents (parallel)
      // ═══════════════════════════════════════════════════════════════════
      status.stage = 'AGENTS';
      status.progress = 10;
      this.emitStatus(status, startTime, onStatus);

      const agents = this.selectAgents(context.depth);
      const analystResults = await this.runAgentsParallel(
        agents,
        context,
        status,
        startTime,
        onStatus,
      );

      this.logger.log(
        `Analysts complete: ${analystResults.length} results in ${Date.now() - startTime}ms`,
      );

      // ═══════════════════════════════════════════════════════════════════
      //  STAGE 2: Adversarial debate (if enabled)
      // ═══════════════════════════════════════════════════════════════════
      let debateOutcome = null;

      if (config.enableDebate && config.maxDebateRounds > 0) {
        status.stage = 'DEBATE';
        status.progress = 60;
        this.emitStatus(status, startTime, onStatus);

        debateOutcome = await this.debateOrchestrator.runDebate(
          context,
          analystResults,
          config.maxDebateRounds,
        );

        this.logger.log(
          `Debate complete: ${debateOutcome.verdict.signal} (${debateOutcome.verdict.confidence}%) in ${debateOutcome.latencyMs}ms`,
        );
      }

      // ═══════════════════════════════════════════════════════════════════
      //  STAGE 3: Portfolio Manager decision
      // ═══════════════════════════════════════════════════════════════════
      status.stage = 'DECISION';
      status.progress = 80;
      this.emitStatus(status, startTime, onStatus);

      this.portfolioManager.setAnalystResults(analystResults);
      this.portfolioManager.setDebateOutcome(debateOutcome);

      const pmResult = await this.portfolioManager.analyze(context);

      this.logger.log(
        `Portfolio Manager decision: ${pmResult.signal} ${pmResult.strength} (${pmResult.confidence}%) in ${pmResult.latencyMs}ms`,
      );

      // ═══════════════════════════════════════════════════════════════════
      //  STAGE 4: Build the final TradeRecommendation
      // ═══════════════════════════════════════════════════════════════════
      status.stage = 'COMPLETE';
      status.progress = 100;
      this.emitStatus(status, startTime, onStatus);

      const recommendation = this.buildRecommendation(
        context,
        analystResults,
        pmResult,
        debateOutcome,
        startTime,
      );

      this.logger.log(
        `Pipeline complete: ${recommendation.signal} ${recommendation.signalStrength} (${recommendation.confidence}%) — Quality: ${recommendation.tradeQualityScore}/100 — ${recommendation.totalLatencyMs}ms`,
      );

      return recommendation;
    } catch (error) {
      status.stage = 'ERROR';
      status.error = (error as Error).message;
      this.emitStatus(status, startTime, onStatus);

      this.logger.error(
        `Pipeline failed for ${context.symbol}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Select which agents to run based on analysis depth.
   */
  private selectAgents(
    depth: AnalysisDepth,
  ): Array<{ agent: { analyze: (ctx: AnalysisContext) => Promise<AgentResult> }; role: AgentRole }> {
    // QUICK: Technical, Sentiment, Risk only
    const quickAgents = [
      { agent: this.technicalAnalyst, role: AgentRole.TECHNICAL_ANALYST },
      { agent: this.sentimentAnalyst, role: AgentRole.SENTIMENT_ANALYST },
      { agent: this.riskManager, role: AgentRole.RISK_MANAGER },
    ];

    // STANDARD: Add News, Fundamental
    const standardAgents = [
      ...quickAgents,
      { agent: this.newsAnalyst, role: AgentRole.NEWS_ANALYST },
      { agent: this.fundamentalAnalyst, role: AgentRole.FUNDAMENTAL_ANALYST },
    ];

    // DEEP: All agents including Macro
    const deepAgents = [
      ...standardAgents,
      { agent: this.macroAnalyst, role: AgentRole.MACRO_ANALYST },
    ];

    switch (depth) {
      case AnalysisDepth.QUICK:
        return quickAgents;
      case AnalysisDepth.STANDARD:
        return standardAgents;
      case AnalysisDepth.DEEP:
        return deepAgents;
      default:
        return standardAgents;
    }
  }

  /**
   * Get the list of agent roles for a given depth.
   */
  private getAgentsForDepth(depth: AnalysisDepth): AgentRole[] {
    return this.selectAgents(depth).map((a) => a.role);
  }

  /**
   * Run multiple agents in parallel with status tracking.
   */
  private async runAgentsParallel(
    agents: Array<{ agent: { analyze: (ctx: AnalysisContext) => Promise<AgentResult> }; role: AgentRole }>,
    context: AnalysisContext,
    status: PipelineStatus,
    startTime: number,
    onStatus?: StatusCallback,
  ): Promise<AgentResult[]> {
    const promises = agents.map(async ({ agent, role }) => {
      try {
        const result = await agent.analyze(context);

        // Update status
        status.completedAgents.push(role);
        status.pendingAgents = status.pendingAgents.filter(
          (r) => r !== role,
        );
        status.progress =
          10 + (status.completedAgents.length / agents.length) * 50;
        this.emitStatus(status, startTime, onStatus);

        return result;
      } catch (error) {
        this.logger.error(
          `Agent ${role} failed: ${(error as Error).message}`,
        );
        // Return a degraded result instead of failing the whole pipeline
        return this.buildDegradedResult(role, error as Error);
      }
    });

    return Promise.all(promises);
  }

  /**
   * Build the final TradeRecommendation from all pipeline outputs.
   */
  private buildRecommendation(
    context: AnalysisContext,
    analystResults: AgentResult[],
    pmResult: AgentResult,
    debateOutcome: import('../types/agent.types').DebateOutcome | null,
    startTime: number,
  ): TradeRecommendation {
    const pmData = pmResult.data;

    // Build the agent reasoning chain
    const agentReasoningChain: AgentReasoning[] = analystResults.map(
      (r) => ({
        agent: r.role,
        signal: r.signal,
        confidence: r.confidence,
        keyPoints: r.reasoning.slice(0, 3),
        latencyMs: r.latencyMs,
      }),
    );

    // Extract entry/SL/TP from PM data, with sensible defaults
    const currentPrice = context.chartData.currentPrice;

    const entry = this.toPriceLevel(pmData.entry, currentPrice, 'Market');
    const stopLoss = this.toPriceLevel(pmData.stopLoss, null, 'Not set');
    const takeProfit1 = this.toPriceLevel(pmData.takeProfit1, null, 'Not set');
    const takeProfit2 = this.toPriceLevel(pmData.takeProfit2, null, 'Not set');

    // Calculate R:R
    let riskReward = Number(pmData.riskReward) || 0;
    if (
      riskReward === 0 &&
      entry.price &&
      stopLoss.price &&
      takeProfit1.price
    ) {
      const risk = Math.abs(entry.price - stopLoss.price);
      const reward = Math.abs(takeProfit1.price - entry.price);
      riskReward = risk > 0 ? Number((reward / risk).toFixed(2)) : 0;
    }

    // Build trend analysis
    const trendData = pmData.trend as {
      direction?: string;
      strength?: number;
      regime?: string;
    } | undefined;
    const trend: TrendAnalysis = {
      direction:
        (trendData?.direction as 'UP' | 'DOWN' | 'SIDEWAYS') || 'SIDEWAYS',
      strength: Number(trendData?.strength) || 50,
      regime:
        (trendData?.regime as MarketRegime) || MarketRegime.RANGING,
      keyLevels: [],
    };

    // Build momentum analysis
    const momData = pmData.momentum as {
      direction?: string;
      rsiZone?: string;
      macdCrossover?: string;
      divergence?: string;
      score?: number;
    } | undefined;
    const momentum: MomentumAnalysis = {
      direction:
        (momData?.direction as
          | 'ACCELERATING'
          | 'DECELERATING'
          | 'NEUTRAL') || 'NEUTRAL',
      rsiZone:
        (momData?.rsiZone as
          | 'OVERBOUGHT'
          | 'OVERSOLD'
          | 'NEUTRAL') || 'NEUTRAL',
      macdCrossover:
        (momData?.macdCrossover as
          | 'BULLISH'
          | 'BEARISH'
          | 'NONE') || 'NONE',
      divergence:
        (momData?.divergence as
          | 'BULLISH_DIVERGENCE'
          | 'BEARISH_DIVERGENCE'
          | 'NONE') || 'NONE',
      score: Number(momData?.score) || 50,
    };

    // Build support/resistance arrays
    const support = this.toPriceLevelArray(pmData.support);
    const resistance = this.toPriceLevelArray(pmData.resistance);

    // Memory insights
    const memoryInsights = context.memory
      ? {
          historicalWinRate: context.memory.symbolHistory?.winRate,
          patternReliability:
            context.memory.patternEffectiveness?.[0]?.pattern,
          psychologyWarning: context.memory.psychologyMarkers
            ?.isOnLosingStreak
            ? `Losing streak: ${context.memory.psychologyMarkers.streakLength} trades`
            : undefined,
          similarSetups:
            context.memory.symbolHistory?.totalTrades,
        }
      : undefined;

    return {
      id: context.requestId,
      symbol: context.symbol,
      timeframe: context.timeframe,
      currentPrice,
      signal: pmResult.signal,
      signalStrength: pmResult.strength,
      confidence: pmResult.confidence,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      riskReward,
      holdingPeriod: (pmData.holdingPeriod as string) || 'N/A',
      trend,
      momentum,
      support,
      resistance,
      reasons: pmResult.reasoning,
      contradictingEvidence: this.ensureStringArray(
        pmData.contradictingEvidence,
      ),
      alternativeScenario:
        (pmData.alternativeScenario as string) || 'Not provided',
      probability: Number(pmData.probability) || 50,
      tradeQualityScore: Number(pmData.tradeQualityScore) || 50,
      agentReasoningChain,
      debate: debateOutcome || undefined,
      memoryInsights,
      coachNote: (pmData.coachNote as string) || undefined,
      depth: context.depth,
      totalLatencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Helpers
  // ─────────────────────────────────────────────────────────────────────────

  private emitStatus(
    status: PipelineStatus,
    startTime: number,
    onStatus?: StatusCallback,
  ): void {
    status.elapsedMs = Date.now() - startTime;
    if (onStatus) {
      onStatus({ ...status });
    }
  }

  private buildDegradedResult(
    role: AgentRole,
    error: Error,
  ): AgentResult {
    return {
      engine: role,
      role,
      confidence: 0,
      signal: SignalType.NEUTRAL,
      strength: SignalStrength.WEAK,
      reasoning: [`Agent ${role} unavailable: ${error.message}`],
      data: {},
      evidence: [],
      warnings: [`${role} analysis unavailable`],
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      model: 'none',
      cached: false,
      latencyMs: 0,
      timestamp: new Date(),
    };
  }

  private toPriceLevel(
    raw: unknown,
    defaultPrice: number | null,
    defaultLabel: string,
  ): PriceLevel {
    if (raw && typeof raw === 'object' && 'price' in raw) {
      const obj = raw as { price: number; label?: string; strength?: number };
      return {
        price: Number(obj.price) || defaultPrice || 0,
        label: obj.label || defaultLabel,
        strength: obj.strength,
      };
    }
    return {
      price: defaultPrice || 0,
      label: defaultLabel,
    };
  }

  private toPriceLevelArray(raw: unknown): PriceLevel[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && typeof item === 'object' && 'price' in item)
      .map((item) => ({
        price: Number(item.price) || 0,
        label: item.label || '',
        strength: item.strength,
      }));
  }

  private ensureStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((v) => typeof v === 'string');
    }
    if (typeof value === 'string') return [value];
    return [];
  }
}
