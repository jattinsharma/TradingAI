// ── Shared Types ──
// These types are used by the popup, overlay, background, and orchestrator.

export interface EngineResult {
  signal: string;
  strength: number;
}

export interface EngineTechnicalResult extends EngineResult {
  indicators: Record<string, number>;
}

export interface EnginePatternResult extends EngineResult {
  pattern: string;
  confidence: number;
}

export interface EngineSupportResistanceResult extends EngineResult {
  levels: {
    resistance1: number;
    resistance2: number;
    support1: number;
    support2: number;
    currentPrice: number;
  };
}

export interface EngineNewsResult extends EngineResult {
  articles: unknown[];
  sentiment: number;
}

export interface EngineRiskResult extends EngineResult {
  riskLevel: string;
  riskScore: number;
  metrics: {
    volatility: number;
    maxDrawdown: number;
    sharpeRatio: number;
    valueAtRisk95: number;
    beta: number;
    correlationToMarket: number;
  };
}

export interface EngineTradePlanningResult extends EngineResult {
  confidence: number;
  tradeSetup: {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
    positionSizeSuggestion: number;
    maxHoldTime: string;
  } | null;
  reasoning: string;
}

export interface EngineAIExplanationResult extends EngineResult {
  explanation: string;
  confidence: number;
  keyFactors: string[];
  risks: string[];
  timeframeSuitability: string;
}

export interface AnalysisEngines {
  technical: EngineTechnicalResult;
  pattern: EnginePatternResult;
  trend: EngineResult;
  supportResistance: EngineSupportResistanceResult;
  volume: EngineResult;
  momentum: EngineResult;
  news: EngineNewsResult;
  sentiment: EngineResult;
  risk: EngineRiskResult;
  portfolio: EngineResult;
  tradePlanning: EngineTradePlanningResult;
  aiExplanation: EngineAIExplanationResult;
}

export interface AnalysisResult {
  symbol: string;
  timeframe: string;
  timestamp: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-100
  indicators: {
    trend: { signal: 'UP' | 'DOWN' | 'NEUTRAL'; strength: number };
    momentum: { signal: 'UP' | 'DOWN' | 'NEUTRAL'; strength: number };
    volume: { signal: 'HIGH' | 'LOW' | 'NEUTRAL'; strength: number };
    volatility: { signal: 'HIGH' | 'LOW' | 'NEUTRAL'; strength: number };
  };
  reasoning: string;
  currentPrice?: number;
  riskLevel?: string;
  entryPrice?: number;
  stopLoss?: number | { price: number; label?: string };
  takeProfit?: number;
  riskRewardRatio?: number;
  // Legacy engines object — populated by AnalysisOrchestrator for backward compatibility
  engines: AnalysisEngines;
  // V2 TradeRecommendation fields
  signal?: string;
  signalStrength?: string;
  entry?: { price: number; label?: string };
  takeProfit1?: { price: number; label?: string };
  takeProfit2?: { price: number; label?: string };
  riskReward?: number;
  holdingPeriod?: string;
  reasons?: string[];
  contradictingEvidence?: string[];
  alternativeScenario?: string;
  probability?: number;
  tradeQualityScore?: number;
  agentReasoningChain?: Array<{
    agent: string;
    signal: string;
    confidence: number;
    keyPoints: string[];
    latencyMs: number;
  }>;
  debate?: {
    rounds: unknown[];
    verdict: {
      signal: string;
      strength: string;
      confidence: number;
      consensus: boolean;
      consensusSummary: string;
    };
    bullScore: number;
    bearScore: number;
  };
}

export interface PlatformCapabilities {
  supportsIntervals: boolean;
  supportsDrawingTools: boolean;
  supportsIndicators: boolean;
  supportsAlerts: boolean;
  supportsTrading: boolean;
  chartSelector: string;
  symbolSelector: string;
  timeframeSelector: string;
}

export interface ChartData {
  symbol: string;
  timeframe: string;
  price: number;
  timestamp: number;
  // Additional chart-specific data can be added here
}

export interface ExtensionMessage<T = unknown> {
  type: string;
  payload?: T;
}

// ── Market Data Types ──

export interface TradingViewDOMData {
  symbol: string;
  timeframe: string;
  currentPrice: number | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  marketStatus: string | null;
  source: 'tradingview_dom';
  extractedAt: number;
}

export interface OHLCVData {
  timestamps: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  symbol: string;
  timeframe: string;
  currentPrice: number;
  source: string;
}

export interface MarketDataResult {
  dom: TradingViewDOMData;
  ohlcv: OHLCVData;
  symbol: string;
  timeframe: string;
  currentPrice: number;
  collectedAt: number;
  sources: string[];
}

export interface ChartChangeEvent {
  type: 'symbol' | 'timeframe' | 'price' | 'candle' | 'unknown';
  symbol: string;
  timeframe: string;
  currentPrice: number | null;
  timestamp: number;
}
