/**
 * TradingAI V2 — Decision Service
 *
 * The Decision Engine serves as the unified entry point for the entire
 * AI Engine V2 system. It coordinates:
 *   1. Memory context loading
 *   2. Pipeline orchestration
 *   3. Result storage
 *   4. Coach notifications
 *
 * This is the service that the extension and frontend call.
 *
 * @module decision
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Analysis, AnalysisDocument } from '../../database/schemas/analysis.schema';
import { PipelineOrchestratorService } from '../multi-agent/pipeline/pipeline-orchestrator.service';
import { MemoryService } from '../memory/memory.service';
import {
  AnalysisContext,
  AnalysisDepth,
  ChartData,
  MarketData,
  TradeRecommendation,
  UserProfile,
} from '../multi-agent/types/agent.types';

/** Input for the decision engine */
export interface DecisionRequest {
  symbol: string;
  timeframe: string;
  depth?: AnalysisDepth;
  chartData: ChartData;
  marketData?: MarketData;
  userId?: string;
  userProfile?: UserProfile;
}

@Injectable()
export class DecisionService {
  private readonly logger = new Logger(DecisionService.name);

  constructor(
    private readonly pipeline: PipelineOrchestratorService,
    private readonly memoryService: MemoryService,
    @InjectModel(Analysis.name)
    private readonly analysisModel: Model<AnalysisDocument>,
  ) {}

  /**
   * Run a full AI Engine V2 analysis.
   *
   * This is the primary entry point that coordinates:
   * 1. Loading memory context (if userId is provided)
   * 2. Running the multi-agent pipeline
   * 3. Storing the result in the analysis collection
   * 4. Returning the full TradeRecommendation
   */
  async analyze(request: DecisionRequest): Promise<TradeRecommendation> {
    const requestId = uuidv4();
    const depth = request.depth || AnalysisDepth.STANDARD;

    this.logger.log(
      `Decision Engine: ${request.symbol} ${request.timeframe} [${depth}]${request.userId ? ` (user: ${request.userId})` : ''}`,
    );

    // 1. Load memory context if user is authenticated
    let memory;
    if (request.userId) {
      try {
        memory = await this.memoryService.buildMemoryContext(
          request.userId,
          request.symbol,
        );
        this.logger.log(
          `Memory loaded: ${memory.symbolHistory?.totalTrades || 0} past trades on ${request.symbol}`,
        );
      } catch (error) {
        this.logger.warn(
          `Memory loading failed: ${(error as Error).message}. Proceeding without memory.`,
        );
      }
    }

    // 2. Build the analysis context
    const context: AnalysisContext = {
      symbol: request.symbol.toUpperCase(),
      timeframe: request.timeframe,
      depth,
      chartData: request.chartData,
      marketData: request.marketData,
      memory,
      userProfile: request.userProfile,
      requestId,
      requestedAt: new Date(),
    };

    // 3. Run the multi-agent pipeline
    const recommendation = await this.pipeline.analyze(context);

    // 4. Store the result in the analysis collection
    try {
      await this.analysisModel.create({
        symbol: recommendation.symbol,
        timeframe: recommendation.timeframe,
        currentPrice: recommendation.currentPrice,
        recommendation: recommendation.signal,
        confidence: recommendation.confidence,
        entryPrice: recommendation.entry?.price,
        stopLoss: recommendation.stopLoss?.price,
        takeProfit: recommendation.takeProfit1?.price,
        riskRewardRatio: recommendation.riskReward,
        reasoning: recommendation.reasons.join(' | '),
        keyRisks: recommendation.contradictingEvidence.join(' | '),
        alternativeScenario: recommendation.alternativeScenario,
        indicators: {
          depth: recommendation.depth,
          tradeQualityScore: recommendation.tradeQualityScore,
          agentCount: recommendation.agentReasoningChain.length,
          debateHeld: !!recommendation.debate,
          totalLatencyMs: recommendation.totalLatencyMs,
        },
      });

      this.logger.log(
        `Analysis stored: ${recommendation.signal} ${recommendation.signalStrength} (${recommendation.confidence}%)`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to store analysis: ${(error as Error).message}`,
      );
    }

    return recommendation;
  }

  /**
   * Get recent analysis history.
   */
  async getRecentAnalyses(
    symbol?: string,
    limit = 20,
  ): Promise<Analysis[]> {
    const query = symbol ? { symbol: symbol.toUpperCase() } : {};
    return this.analysisModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
