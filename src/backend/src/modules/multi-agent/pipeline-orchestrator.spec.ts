/**
 * TradingAI V2 — Pipeline Orchestrator & Memory Integration Tests
 *
 * Verifies end-to-end pipeline execution with mocked agents, depth selection,
 * status callbacks, memory hydration, and output validation bounds.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PipelineOrchestratorService } from './pipeline/pipeline-orchestrator.service';
import { TechnicalAnalystAgent } from './agents/technical-analyst.agent';
import { FundamentalAnalystAgent } from './agents/fundamental-analyst.agent';
import { NewsAnalystAgent } from './agents/news-analyst.agent';
import { SentimentAnalystAgent } from './agents/sentiment-analyst.agent';
import { MacroAnalystAgent } from './agents/macro-analyst.agent';
import { RiskManagerAgent } from './agents/risk-manager.agent';
import { PortfolioManagerAgent } from './agents/portfolio-manager.agent';
import { DebateOrchestratorService } from './debate/debate-orchestrator.service';
import { MemoryService } from '../memory/memory.service';
import {
  AnalysisContext,
  AnalysisDepth,
  SignalType,
  SignalStrength,
  AgentRole,
} from './types/agent.types';

describe('PipelineOrchestratorService Integration Tests', () => {
  let pipeline: PipelineOrchestratorService;
  let mockPortfolioManager: Partial<PortfolioManagerAgent>;

  beforeEach(async () => {
    const createMockAgent = (role: AgentRole) => ({
      analyze: jest.fn().mockResolvedValue({
        engine: role,
        role,
        confidence: 80,
        signal: SignalType.BULLISH,
        strength: SignalStrength.STRONG,
        reasoning: [`Mock reasoning for ${role}`],
        data: {},
        evidence: ['Strong volume'],
        warnings: [],
        tokensUsed: { prompt: 100, completion: 50, total: 150 },
        model: 'test-model',
        cached: false,
        latencyMs: 50,
        timestamp: new Date(),
      }),
    });

    mockPortfolioManager = {
      setAnalystResults: jest.fn(),
      setDebateOutcome: jest.fn(),
      analyze: jest.fn().mockResolvedValue({
        engine: AgentRole.PORTFOLIO_MANAGER,
        role: AgentRole.PORTFOLIO_MANAGER,
        confidence: 85,
        signal: SignalType.BULLISH,
        strength: SignalStrength.STRONG,
        reasoning: ['Strong bullish alignment across technicals and sentiment.'],
        data: {
          entry: { price: 65000, label: 'Optimal Limit Entry' },
          stopLoss: { price: 63500, label: 'ATR Invalidation' },
          takeProfit1: { price: 68000, label: 'Key Resistance 1' },
          riskReward: 2.0,
          tradeQualityScore: 88,
          probability: 75,
          holdingPeriod: '2D-4D',
          reasons: ['Bullish momentum confirmed'],
          contradictingEvidence: ['Slight overbought RSI on 15M'],
        },
        evidence: [],
        warnings: [],
        tokensUsed: { prompt: 200, completion: 100, total: 300 },
        model: 'test-model',
        cached: false,
        latencyMs: 120,
        timestamp: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineOrchestratorService,
        { provide: TechnicalAnalystAgent, useValue: createMockAgent(AgentRole.TECHNICAL_ANALYST) },
        { provide: FundamentalAnalystAgent, useValue: createMockAgent(AgentRole.FUNDAMENTAL_ANALYST) },
        { provide: NewsAnalystAgent, useValue: createMockAgent(AgentRole.NEWS_ANALYST) },
        { provide: SentimentAnalystAgent, useValue: createMockAgent(AgentRole.SENTIMENT_ANALYST) },
        { provide: MacroAnalystAgent, useValue: createMockAgent(AgentRole.MACRO_ANALYST) },
        { provide: RiskManagerAgent, useValue: createMockAgent(AgentRole.RISK_MANAGER) },
        { provide: PortfolioManagerAgent, useValue: mockPortfolioManager },
        {
          provide: DebateOrchestratorService,
          useValue: {
            runDebate: jest.fn().mockResolvedValue({
              rounds: [],
              verdict: { signal: SignalType.BULLISH, confidence: 82, consensusScore: 85 },
              bullArguments: ['Bullish structure'],
              bearArguments: ['Overbought RSI'],
              latencyMs: 100,
            }),
          },
        },
        {
          provide: MemoryService,
          useValue: {
            buildMemoryContext: jest.fn().mockResolvedValue({
              symbolHistory: { totalTrades: 12, wins: 9, losses: 3, winRate: 75 },
              patternEffectiveness: [{ pattern: 'Bullish Engulfing', successRate: 80, count: 5 }],
              psychologyMarkers: { isOnLosingStreak: false, streakLength: 0 },
            }),
          },
        },
      ],
    }).compile();

    pipeline = module.get<PipelineOrchestratorService>(PipelineOrchestratorService);
  });

  it('should execute QUICK depth pipeline successfully', async () => {
    const context: AnalysisContext = {
      symbol: 'BTCUSDT',
      timeframe: '4H',
      depth: AnalysisDepth.QUICK,
      chartData: {
        symbol: 'BTCUSDT',
        timeframe: '4H',
        currentPrice: 65000,
        indicators: { rsi: 55, macd: { macd: 0.5, signal: 0.3, histogram: 0.2 } },
      },
      requestId: 'test-req-123',
      requestedAt: new Date(),
    };

    const recommendation = await pipeline.analyze(context);

    expect(recommendation).toBeDefined();
    expect(recommendation.id).toBe('test-req-123');
    expect(recommendation.symbol).toBe('BTCUSDT');
    expect(recommendation.signal).toBe(SignalType.BULLISH);
    expect(recommendation.confidence).toBe(85);
    expect(recommendation.tradeQualityScore).toBe(88);
    expect(recommendation.agentReasoningChain.length).toBeGreaterThan(0);
    expect(recommendation.entry.price).toBe(65000);
    expect(recommendation.stopLoss.price).toBe(63500);
    expect(recommendation.takeProfit1.price).toBe(68000);
  });

  it('should hydrate memory context when userId is provided', async () => {
    const context: AnalysisContext = {
      symbol: 'ETHUSDT',
      timeframe: '1D',
      depth: AnalysisDepth.STANDARD,
      userId: 'user-777',
      chartData: {
        symbol: 'ETHUSDT',
        timeframe: '1D',
        currentPrice: 3400,
        indicators: {},
      },
      requestId: 'test-req-memory',
      requestedAt: new Date(),
    };

    const recommendation = await pipeline.analyze(context);

    expect(recommendation).toBeDefined();
    expect(recommendation.memoryInsights).toBeDefined();
    expect(recommendation.memoryInsights?.historicalWinRate).toBe(75);
  });

  it('should emit status callbacks progressively', async () => {
    const statusHistory: string[] = [];
    const context: AnalysisContext = {
      symbol: 'SOLUSDT',
      timeframe: '1H',
      depth: AnalysisDepth.QUICK,
      chartData: {
        symbol: 'SOLUSDT',
        timeframe: '1H',
        currentPrice: 140,
        indicators: {},
      },
      requestId: 'status-test',
      requestedAt: new Date(),
    };

    await pipeline.analyze(context, undefined, (status) => {
      statusHistory.push(status.stage);
    });

    expect(statusHistory.length).toBeGreaterThan(0);
    expect(statusHistory).toContain('COMPLETE');
  });
});
