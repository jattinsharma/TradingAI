/**
 * TradingAI V2 — Core Engine Types
 *
 * Defines the universal contract that every analysis engine in the TradingAI
 * pipeline must implement. Inspired by multi-agent architectures, but rewritten
 * cleanly for NestJS/TypeScript with strict typing and zero external dependencies.
 *
 * @module multi-agent/types
 */

// ═══════════════════════════════════════════════════════════════════════════════
//  ENUMERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/** Signal direction produced by any agent or engine */
export enum SignalType {
  BULLISH = 'BULLISH',
  BEARISH = 'BEARISH',
  NEUTRAL = 'NEUTRAL',
}

/** Strength qualifier for signals */
export enum SignalStrength {
  STRONG = 'STRONG',
  MODERATE = 'MODERATE',
  WEAK = 'WEAK',
}

/** Market regime classification */
export enum MarketRegime {
  TRENDING_UP = 'TRENDING_UP',
  TRENDING_DOWN = 'TRENDING_DOWN',
  RANGING = 'RANGING',
  VOLATILE = 'VOLATILE',
  LOW_VOLATILITY = 'LOW_VOLATILITY',
}

/** Timeframe categories */
export enum TimeframeCategory {
  SCALP = 'SCALP',       // 1m, 3m, 5m
  INTRADAY = 'INTRADAY', // 15m, 30m, 1h
  SWING = 'SWING',       // 4h, 1D
  POSITION = 'POSITION', // 1W, 1M
}

/** Agent role in the multi-agent system */
export enum AgentRole {
  TECHNICAL_ANALYST = 'TECHNICAL_ANALYST',
  FUNDAMENTAL_ANALYST = 'FUNDAMENTAL_ANALYST',
  NEWS_ANALYST = 'NEWS_ANALYST',
  SENTIMENT_ANALYST = 'SENTIMENT_ANALYST',
  MACRO_ANALYST = 'MACRO_ANALYST',
  RISK_MANAGER = 'RISK_MANAGER',
  BULL_RESEARCHER = 'BULL_RESEARCHER',
  BEAR_RESEARCHER = 'BEAR_RESEARCHER',
  PORTFOLIO_MANAGER = 'PORTFOLIO_MANAGER',
  COACH = 'COACH',
}

/** Health status of an engine or agent */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
}

/** Analysis depth mode — balances speed vs thoroughness */
export enum AnalysisDepth {
  QUICK = 'QUICK',         // 3 agents, no debate, 5-10s
  STANDARD = 'STANDARD',   // 6 agents, 1-round debate, 10-20s
  DEEP = 'DEEP',           // All agents, multi-round debate, 15-30s
}

/** LLM provider identifiers */
export enum LlmProvider {
  OLLAMA = 'OLLAMA',
  OPENAI = 'OPENAI',
  GEMINI = 'GEMINI',
  ANTHROPIC = 'ANTHROPIC',
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PRICE & MARKET DATA TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** A specific price level with context */
export interface PriceLevel {
  price: number;
  label?: string;          // e.g., "EMA 200", "Previous high", "Fibonacci 0.618"
  strength?: number;       // 0-100 how significant this level is
}

/** OHLCV candle data */
export interface Candle {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Chart data extracted from TradingView or market data providers */
export interface ChartData {
  symbol: string;
  timeframe: string;
  exchange?: string;
  currentPrice: number;
  candles?: Candle[];
  indicators: IndicatorData;
  drawings?: DrawingData[];
}

/** Technical indicator values from the chart */
export interface IndicatorData {
  rsi?: number;
  rsiPrevious?: number;
  macd?: {
    macd: number;
    signal: number;
    histogram: number;
  };
  ema20?: number;
  ema50?: number;
  ema200?: number;
  sma20?: number;
  sma50?: number;
  sma200?: number;
  atr?: number;
  atrPercent?: number;
  volume?: number;
  volumeAvg?: number;
  volumeRatio?: number;
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  stochastic?: {
    k: number;
    d: number;
  };
  adx?: number;
  obv?: number;
  vwap?: number;
  ichimoku?: {
    tenkan: number;
    kijun: number;
    senkouA: number;
    senkouB: number;
    chikou: number;
  };
  [key: string]: unknown; // Allow additional indicators
}

/** User drawings on the chart */
export interface DrawingData {
  type: string;          // trendline, horizontal, fibonacci, etc.
  points: { price: number; time: Date }[];
  label?: string;
}

/** External market data beyond the chart */
export interface MarketData {
  fearGreedIndex?: number;
  btcDominance?: number;
  volume24h?: number;
  marketCap?: number;
  sectorPerformance?: Record<string, number>;
  correlatedAssets?: Array<{ symbol: string; correlation: number; price: number }>;
  economicCalendar?: EconomicEvent[];
  news?: NewsItem[];
}

/** Economic calendar event */
export interface EconomicEvent {
  title: string;
  date: Date;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  forecast?: string;
  previous?: string;
  actual?: string;
  country: string;
  currency: string;
}

/** News item */
export interface NewsItem {
  title: string;
  source: string;
  url?: string;
  publishedAt: Date;
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  relevanceScore?: number;
  summary?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MEMORY CONTEXT TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Memory context injected into agent analysis */
export interface MemoryContext {
  /** Past trade performance on this symbol */
  symbolHistory?: {
    totalTrades: number;
    winRate: number;
    avgPnlPercent: number;
    lastTradeResult?: 'WIN' | 'LOSS' | 'BREAK_EVEN';
    bestSetup?: string;
    worstMistake?: string;
  };

  /** Pattern effectiveness data for this user */
  patternEffectiveness?: Array<{
    pattern: string;
    winRate: number;
    sampleSize: number;
    avgReward: number;
  }>;

  /** User's trading psychology markers */
  psychologyMarkers?: {
    isOnLosingStreak?: boolean;
    streakLength?: number;
    recentOvertradingDetected?: boolean;
    emotionalState?: 'CALM' | 'TILTED' | 'EUPHORIC' | 'FEARFUL';
    revengeTradeRisk?: number; // 0-100
  };

  /** User's preferred session times */
  preferredSessions?: string[];

  /** User's typical risk profile */
  riskProfile?: {
    avgPositionSize: number;
    maxDrawdownTolerance: number;
    preferredRiskReward: number;
    maxConcurrentPositions: number;
  };
}

/** User profile for personalized analysis */
export interface UserProfile {
  userId: string;
  experience: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PROFESSIONAL';
  preferredTimeframes?: string[];
  preferredMarkets?: string[];
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  accountSize?: number;
  maxRiskPerTrade?: number; // percentage
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ENGINE & AGENT INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

/** Universal context object passed to every engine and agent */
export interface AnalysisContext {
  /** The target symbol being analyzed */
  symbol: string;

  /** Chart timeframe (e.g., "1H", "4H", "1D") */
  timeframe: string;

  /** The depth of analysis requested */
  depth: AnalysisDepth;

  /** Chart data extracted from TradingView or market data */
  chartData: ChartData;

  /** Additional market data from external providers */
  marketData?: MarketData;

  /** Historical memory for this user/symbol */
  memory?: MemoryContext;

  /** The user's profile and preferences */
  userProfile?: UserProfile;

  /** User ID if request is authenticated */
  userId?: string;

  /** Unique request ID for tracing */
  requestId: string;

  /** Timestamp when analysis was requested */
  requestedAt: Date;
}

/** Result produced by an individual analysis engine */
export interface EngineResult {
  /** Which engine produced this result */
  engine: string;

  /** Confidence in the analysis, 0-100 */
  confidence: number;

  /** Directional signal */
  signal: SignalType;

  /** Signal strength qualifier */
  strength: SignalStrength;

  /** Human-readable reasoning chain */
  reasoning: string[];

  /** Engine-specific data payload */
  data: Record<string, unknown>;

  /** Time taken to produce this result (ms) */
  latencyMs: number;

  /** Timestamp */
  timestamp: Date;
}

/**
 * IAnalysisEngine — The universal contract for every engine in TradingAI V2.
 *
 * Every engine (Technical, Pattern, Volume, News, Sentiment, etc.) implements
 * this interface. This enables hot-swapping, parallel execution, and the
 * multi-agent debate system.
 */
export interface IAnalysisEngine {
  /** Unique engine identifier */
  readonly name: string;

  /** Semantic version of this engine */
  readonly version: string;

  /** The role this engine plays */
  readonly role: AgentRole;

  /** Run analysis and produce a result */
  analyze(context: AnalysisContext): Promise<EngineResult>;

  /** Health check for monitoring and circuit breaking */
  getHealth(): HealthStatus;

  /** Whether this engine requires LLM access */
  requiresLlm(): boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AGENT-SPECIFIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Configuration for an agent instance */
export interface AgentConfig {
  /** Agent name (matches AgentRole) */
  name: string;

  /** The role this agent plays */
  role: AgentRole;

  /** Which LLM provider to use */
  llmProvider: LlmProvider;

  /** Model identifier (e.g., "llama3.1:latest", "gpt-4o") */
  model: string;

  /** LLM temperature (lower = more deterministic) */
  temperature: number;

  /** Maximum tokens for the LLM response */
  maxTokens: number;

  /** System prompt for this agent */
  systemPrompt: string;

  /** Maximum time allowed for this agent (ms) */
  timeoutMs: number;

  /** Whether to retry on failure */
  retryOnFailure: boolean;

  /** Maximum retry attempts */
  maxRetries: number;
}

/** Result produced by an LLM-powered agent */
export interface AgentResult extends EngineResult {
  /** The agent's role */
  role: AgentRole;

  /** Tokens consumed by this agent */
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };

  /** The LLM model used */
  model: string;

  /** Whether the result was cached */
  cached: boolean;

  /** Key evidence points cited by the agent */
  evidence: string[];

  /** Specific concerns or warnings */
  warnings: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DEBATE SYSTEM TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** A single round in the bull/bear debate */
export interface DebateRound {
  /** Round number (1-based) */
  round: number;

  /** The bull researcher's argument for this round */
  bullArgument: {
    thesis: string;
    evidence: string[];
    rebuttal?: string;     // Rebuttal to bear's previous argument
    confidence: number;
  };

  /** The bear researcher's argument for this round */
  bearArgument: {
    thesis: string;
    evidence: string[];
    rebuttal?: string;     // Rebuttal to bull's previous argument
    confidence: number;
  };
}

/** The complete debate outcome */
export interface DebateOutcome {
  /** All rounds of the debate */
  rounds: DebateRound[];

  /** Synthesized verdict from the debate */
  verdict: {
    signal: SignalType;
    strength: SignalStrength;
    confidence: number;
    consensus: boolean;       // Did both sides agree?
    consensusSummary: string;
  };

  /** Bull case quality score, 0-100 */
  bullScore: number;

  /** Bear case quality score, 0-100 */
  bearScore: number;

  /** Key unresolved disagreements */
  unresolvedPoints: string[];

  /** Total tokens consumed by the debate */
  totalTokens: number;

  /** Total latency of the debate (ms) */
  latencyMs: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TRADE RECOMMENDATION (FINAL OUTPUT)
// ═══════════════════════════════════════════════════════════════════════════════

/** Trend analysis sub-component */
export interface TrendAnalysis {
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  strength: number;          // 0-100
  regime: MarketRegime;
  trendAge?: string;         // e.g., "3 days", "2 weeks"
  keyLevels: PriceLevel[];
}

/** Momentum analysis sub-component */
export interface MomentumAnalysis {
  direction: 'ACCELERATING' | 'DECELERATING' | 'NEUTRAL';
  rsiZone: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
  macdCrossover: 'BULLISH' | 'BEARISH' | 'NONE';
  divergence: 'BULLISH_DIVERGENCE' | 'BEARISH_DIVERGENCE' | 'NONE';
  score: number;             // 0-100
}

/** Individual agent's reasoning for the recommendation chain */
export interface AgentReasoning {
  agent: AgentRole;
  signal: SignalType;
  confidence: number;
  keyPoints: string[];
  latencyMs: number;
}

/**
 * TradeRecommendation — The full structured output of the AI Engine V2 pipeline.
 *
 * This is the final output that gets displayed in the overlay, stored in the
 * analysis history, and fed back into the Memory Engine for learning.
 *
 * IMPORTANT: This output NEVER says BUY/SELL/HOLD. It uses BULLISH/BEARISH/NEUTRAL
 * with structured data so the trader makes the final decision.
 */
export interface TradeRecommendation {
  /** Unique recommendation ID */
  id: string;

  /** Symbol analyzed */
  symbol: string;

  /** Timeframe */
  timeframe: string;

  /** Current price at time of analysis */
  currentPrice: number;

  /** Directional signal: BULLISH, BEARISH, or NEUTRAL */
  signal: SignalType;

  /** Signal strength: STRONG, MODERATE, or WEAK */
  signalStrength: SignalStrength;

  /** Overall confidence score, 0-100 */
  confidence: number;

  /** Suggested entry price or zone */
  entry: PriceLevel;

  /** Stop loss level */
  stopLoss: PriceLevel;

  /** Primary take-profit target */
  takeProfit1: PriceLevel;

  /** Secondary take-profit target */
  takeProfit2: PriceLevel;

  /** Risk-to-reward ratio */
  riskReward: number;

  /** Suggested holding period (e.g., "4H-1D", "Intraday") */
  holdingPeriod: string;

  /** Trend analysis */
  trend: TrendAnalysis;

  /** Momentum analysis */
  momentum: MomentumAnalysis;

  /** Key support levels */
  support: PriceLevel[];

  /** Key resistance levels */
  resistance: PriceLevel[];

  /** Reasons supporting the signal (evidence FOR the trade) */
  reasons: string[];

  /** Contradicting evidence (reasons AGAINST the trade) */
  contradictingEvidence: string[];

  /** What would happen if the trade goes wrong */
  alternativeScenario: string;

  /** Probability estimate for the primary scenario, 0-100 */
  probability: number;

  /** Overall trade quality score, 0-100 */
  tradeQualityScore: number;

  /** Full reasoning chain from each agent */
  agentReasoningChain: AgentReasoning[];

  /** Debate outcome (if debate was conducted) */
  debate?: DebateOutcome;

  /** Memory-driven insights injected into the recommendation */
  memoryInsights?: {
    historicalWinRate?: number;
    patternReliability?: string;
    psychologyWarning?: string;
    similarSetups?: number;
  };

  /** AI Coach note (pre-trade warning if applicable) */
  coachNote?: string;

  /** Analysis depth that was used */
  depth: AnalysisDepth;

  /** Total pipeline latency (ms) */
  totalLatencyMs: number;

  /** Timestamp of the recommendation */
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LLM PROVIDER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Configuration for an LLM provider */
export interface LlmProviderConfig {
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  apiKey?: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

/** Standardized LLM request */
export interface LlmRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/** Standardized LLM response */
export interface LlmResponse {
  content: string;
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  latencyMs: number;
  cached: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PIPELINE ORCHESTRATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Pipeline execution status */
export interface PipelineStatus {
  requestId: string;
  stage: 'ENGINES' | 'AGENTS' | 'DEBATE' | 'DECISION' | 'COMPLETE' | 'ERROR';
  progress: number;          // 0-100
  completedAgents: AgentRole[];
  pendingAgents: AgentRole[];
  currentDebateRound?: number;
  elapsedMs: number;
  error?: string;
}

/** Pipeline configuration */
export interface PipelineConfig {
  depth: AnalysisDepth;
  enableDebate: boolean;
  maxDebateRounds: number;
  agentTimeoutMs: number;
  enableMemory: boolean;
  enableCoach: boolean;
  parallelAgents: boolean;
}

/** Default pipeline configurations per depth mode */
export const DEFAULT_PIPELINE_CONFIGS: Record<AnalysisDepth, PipelineConfig> = {
  [AnalysisDepth.QUICK]: {
    depth: AnalysisDepth.QUICK,
    enableDebate: false,
    maxDebateRounds: 0,
    agentTimeoutMs: 10000,
    enableMemory: true,
    enableCoach: false,
    parallelAgents: true,
  },
  [AnalysisDepth.STANDARD]: {
    depth: AnalysisDepth.STANDARD,
    enableDebate: true,
    maxDebateRounds: 1,
    agentTimeoutMs: 15000,
    enableMemory: true,
    enableCoach: true,
    parallelAgents: true,
  },
  [AnalysisDepth.DEEP]: {
    depth: AnalysisDepth.DEEP,
    enableDebate: true,
    maxDebateRounds: 3,
    agentTimeoutMs: 20000,
    enableMemory: true,
    enableCoach: true,
    parallelAgents: true,
  },
};
