/**
 * Shared AnalysisResponse types
 *
 * This file defines the canonical interface for ALL analysis results
 * flowing from the analysis engines through to the UI.
 *
 * Both engine producers and UI consumers MUST use this interface.
 * Any deviation is a bug.
 */

/** The top-level analysis result sent from background to UI */
export interface AnalysisResponse {
  /** Trading symbol (e.g. 'BTCUSD', 'ETH-USD') */
  symbol: string;
  /** Timeframe (e.g. '1D', '4H', '1H') */
  timeframe: string;
  /** Unix timestamp of when the analysis was generated */
  timestamp: number;
  /** Final trading recommendation */
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  /** Confidence level 0-100 */
  confidence: number;
  /** Current market price (may be 0 if unavailable) */
  currentPrice: number;
  /** Human-readable analysis reasoning */
  reasoning: string;
  /** All engine outputs */
  engines: {
    technical: EngineTechnicalResult;
    pattern: EnginePatternResult;
    trend: EngineTrendResult;
    supportResistance: EngineSupportResistanceResult;
    volume: EngineVolumeResult;
    momentum: EngineMomentumResult;
    news: EngineNewsResult;
    sentiment: EngineSentimentResult;
    risk: EngineRiskResult;
    portfolio: EnginePortfolioResult;
    tradePlanning: EngineTradePlanningResult;
    aiExplanation: EngineAiExplanationResult;
  };
}

/** Base shape every engine must provide */
export interface BaseEngineResult {
  /** Engine signal identifier */
  signal: string;
  /** Signal strength 0-1 */
  strength: number;
}

/** Technical analysis engine output */
export interface EngineTechnicalResult extends BaseEngineResult {
  indicators: {
    sma20: number;
    sma50: number;
    ema12: number;
    ema26: number;
    rsi: number;
    macd: number;
    macdSignal: number;
    macdHistogram: number;
    bollingerUpper: number;
    bollingerMiddle: number;
    bollingerLower: number;
    adx: number;
    plusDI: number;
    minusDI: number;
    atr: number;
    vwap: number;
  };
}

/** Pattern recognition engine output */
export interface EnginePatternResult extends BaseEngineResult {
  pattern: string;
  confidence: number;
}

/** Trend analysis engine output */
export interface EngineTrendResult extends BaseEngineResult {
  // trend extends BaseEngineResult
}

/** Support/Resistance engine output */
export interface EngineSupportResistanceResult extends BaseEngineResult {
  levels: {
    resistance1: number;
    resistance2: number;
    support1: number;
    support2: number;
    currentPrice: number;
  };
}

/** Volume analysis engine output */
export interface EngineVolumeResult extends BaseEngineResult {
  // volume extends BaseEngineResult
}

/** Momentum analysis engine output */
export interface EngineMomentumResult extends BaseEngineResult {
  // momentum extends BaseEngineResult
}

/** News analysis engine output */
export interface EngineNewsResult extends BaseEngineResult {
  articles: unknown[];
  sentiment: number;
}

/** Sentiment analysis engine output */
export interface EngineSentimentResult extends BaseEngineResult {
  // sentiment extends BaseEngineResult
}

/** Risk analysis engine output */
export interface EngineRiskResult {
  signal: string;
  strength: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  riskScore: number;
  metrics?: {
    volatility: number;
    maxDrawdown: number;
    sharpeRatio: number;
    valueAtRisk95: number;
    beta: number;
    correlationToMarket: number;
  };
}

/** Portfolio analysis engine output */
export interface EnginePortfolioResult extends BaseEngineResult {
  // portfolio extends BaseEngineResult
}

/** Trade planning engine output */
export interface EngineTradePlanningResult extends BaseEngineResult {
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

/** AI explanation engine output */
export interface EngineAiExplanationResult {
  explanation: string;
  confidence: number;
  keyFactors: string[];
  risks: string[];
  timeframeSuitability: string;
}

/**
 * Validate an analysis response object.
 * Returns an array of missing/required field paths.
 * Empty array means the response is valid.
 */
export function validateAnalysisResponse(response: unknown): string[] {
  const errors: string[] = [];
  if (!response || typeof response !== 'object') {
    errors.push('root: not an object');
    return errors;
  }

  const r = response as Record<string, unknown>;

  // Required top-level fields
  const requiredFields = ['symbol', 'timeframe', 'recommendation', 'confidence', 'reasoning'];
  for (const field of requiredFields) {
    if (r[field] === undefined || r[field] === null) {
      errors.push(`top-level: missing '${field}'`);
    }
  }

  // Validate engines exist
  if (!r.engines || typeof r.engines !== 'object') {
    errors.push('engines: missing or not an object');
    return errors;
  }

  const e = r.engines as Record<string, unknown>;

  // Required engine fields
  const requiredEngines = [
    'technical', 'pattern', 'trend', 'supportResistance',
    'volume', 'momentum', 'news', 'sentiment',
    'risk', 'portfolio', 'tradePlanning', 'aiExplanation'
  ];

  for (const engine of requiredEngines) {
    if (!e[engine] || typeof e[engine] !== 'object') {
      errors.push(`engines.${engine}: missing or not an object`);
    }
  }

  // Validate nested tradeSetup
  const tp = e.tradePlanning as Record<string, unknown> | undefined;
  if (tp && typeof tp === 'object') {
    const ts = tp.tradeSetup as Record<string, unknown> | undefined;
    if (ts && typeof ts === 'object') {
      const numericFields = ['entryPrice', 'stopLoss', 'takeProfit', 'riskRewardRatio'];
      for (const field of numericFields) {
        const val = ts[field];
        if (val !== undefined && val !== null) {
          if (typeof val !== 'number' || !Number.isFinite(val)) {
            errors.push(`engines.tradePlanning.tradeSetup.${field}: not a finite number, got ${typeof val}=${JSON.stringify(val)}`);
          }
        }
      }
    }
  }

  return errors;
}
