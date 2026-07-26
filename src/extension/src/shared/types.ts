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