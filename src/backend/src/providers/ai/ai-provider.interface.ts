export interface AnalysisRequest {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  indicators: {
    rsi?: number;
    macd?: { macd: number; signal: number; histogram: number };
    ema20?: number;
    ema50?: number;
    ema200?: number;
    atr?: number;
    volume?: number;
    trend?: string;
    support?: number;
    resistance?: number;
  };
  news?: Array<{ title: string; sentiment: string }>;
  marketContext?: {
    fearGreed?: number;
    btcDominance?: number;
    volume24h?: number;
  };
}

export interface AnalysisResult {
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  reasoning: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio?: number;
  keyRisks: string[];
  alternativeScenario: string;
  invalidationLevel: string;
}

export interface SummarizeNewsRequest {
  news: Array<{ title: string; content?: string; source?: string }>;
}

export interface CoachRequest {
  trade: any; // TradeMemory from memory module
}

export interface CoachResult {
  strengths: string[];
  advice: string[];
  keyLesson: string;
}

export interface AIProvider {
  name: string;

  analyze(request: AnalysisRequest): Promise<AnalysisResult>;

  summarizeNews(request: SummarizeNewsRequest): Promise<string>;

  coachTrade(request: CoachRequest): Promise<CoachResult>;

  /**
   * Health check method to determine if provider is available
   * Returns true if healthy, false otherwise
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get provider-specific error categorization
   * Returns true if error should trigger failover
   */
  shouldFailover(error: any): boolean;

  // Additional methods for compatibility with existing AiService
  isAvailable(): Promise<boolean>;
  getActiveModel(): any;
  getAvailableModels(): any[];
  setModel(modelName: string): Promise<boolean>;
}