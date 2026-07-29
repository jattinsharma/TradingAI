// Shared types for the extension

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
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio?: number;
  // Legacy engines object — populated by AnalysisOrchestrator for backward compatibility
  engines: {
    technical: any;
    pattern: any;
    trend: any;
    supportResistance: any;
    volume: any;
    momentum: any;
    news: any;
    sentiment: any;
    risk: any;
    portfolio: any;
    tradePlanning: any;
    aiExplanation: any;
  };
}

export interface EngineResult {
  signal: string;
  strength: number; // 0-1
  [key: string]: any;
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

export interface ExtensionMessage {
  type: string;
  payload?: any;
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
