/**
 * Analysis Orchestrator
 *
 * Coordinates analysis by delegating to the TechnicalAnalysisEngine
 * and providing backward-compatible mapping to the legacy AnalysisResult format.
 *
 * Architecture:
 *   Orchestrator.analyze()
 *     └── TechnicalAnalysisEngine.analyze()  ← single real engine
 *           ├── SignalScoringEngine          ← weighted multi-indicator scoring
 *           ├── TradeSetupEngine             ← ATR-based entry/SL/TP/RR
 *           ├── ReasoningEngine              ← human-readable reasoning
 *           └── PatternRecognitionEngine     ← candlestick patterns from OHLCV
 *     └── mapToLegacyFormat()               ← backward-compatible shape for UI/background
 */

import { TechnicalAnalysisEngine, AnalysisOutput } from './engines/technical-analysis-engine';
import { EngineTechnicalResult } from '../shared/analysis-response.types';
import { MarketIntelligenceEngine, MarketIntelligenceOutput } from './engines/market-intelligence-engine';

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
  // Legacy engines object — populated for backward compatibility
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

export class AnalysisOrchestrator {
  private technicalEngine: TechnicalAnalysisEngine;
  private marketIntelligence: MarketIntelligenceEngine;

  constructor() {
    this.technicalEngine = new TechnicalAnalysisEngine();
    this.marketIntelligence = new MarketIntelligenceEngine();
  }

  async analyze(symbol: string, timeframe: string = '1D', platform: string = ''): Promise<AnalysisResult> {
    try {
      // ── Run the single real analysis engine ──
      const output = await this.technicalEngine.analyze(symbol, timeframe, platform);

      // ── Generate market intelligence from the analysis output ──
      const intelligence = this.marketIntelligence.generate(output);

      // ── Map to backward-compatible AnalysisResult ──
      return this.mapToLegacyFormat(output, intelligence);
    } catch (error) {
      console.error('[Orchestrator] Analysis failed:', error);
      return this.getDefaultAnalysis(symbol, timeframe);
    }
  }

  /** Expose market intelligence for direct access by UI components */
  async analyzeWithIntelligence(symbol: string, timeframe: string = '1D', platform: string = ''): Promise<{ analysis: AnalysisResult; intelligence: MarketIntelligenceOutput }> {
    const output = await this.technicalEngine.analyze(symbol, timeframe, platform);
    const intelligence = this.marketIntelligence.generate(output);
    return {
      analysis: this.mapToLegacyFormat(output, intelligence),
      intelligence,
    };
  }

  /**
   * Map the new flat AnalysisOutput to the legacy AnalysisResult format.
   * All consumers (overlay, popup, background auto-save) expect the old shape.
   */
  private mapToLegacyFormat(output: AnalysisOutput, intelligence?: MarketIntelligenceOutput): AnalysisResult {
    const tech: EngineTechnicalResult = {
      signal: output.recommendation === 'STRONG_BUY' || output.recommendation === 'BUY'
        ? 'BUY'
        : output.recommendation === 'STRONG_SELL' || output.recommendation === 'SELL'
          ? 'SELL'
          : 'NEUTRAL',
      strength: output.confidence / 100,
      indicators: output.indicatorSummary as any,
    };

    const trendSignal = output.trend === 'BULLISH' ? 'UP' : output.trend === 'BEARISH' ? 'DOWN' : 'NEUTRAL';

    // Derive momentum signal from indicators
    const rsi = output.indicatorSummary.rsi;
    let momentumSignal: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
    let momentumStrength = 0.5;
    if (rsi > 0) {
      if (rsi > 60) { momentumSignal = 'UP'; momentumStrength = 0.6; }
      else if (rsi < 40) { momentumSignal = 'DOWN'; momentumStrength = 0.6; }
    }

    // Derive volume signal
    const vol = output.indicatorSummary.volume;
    const avgVol = output.indicatorSummary.avgVolume;
    let volumeSignal: 'HIGH' | 'LOW' | 'NEUTRAL' = 'NEUTRAL';
    let volumeStrength = 0.5;
    if (vol > 0 && avgVol > 0) {
      const ratio = vol / avgVol;
      if (ratio > 1.5) { volumeSignal = 'HIGH'; volumeStrength = 0.7; }
      else if (ratio < 0.5) { volumeSignal = 'LOW'; volumeStrength = 0.6; }
    }

    const volSignal = output.volatility;
    let volSignalEnum: 'HIGH' | 'LOW' | 'NEUTRAL' = 'NEUTRAL';
    let volStrength = 0.5;
    if (volSignal === 'HIGH') { volSignalEnum = 'HIGH'; volStrength = 0.7; }
    else if (volSignal === 'LOW') { volSignalEnum = 'LOW'; volStrength = 0.6; }

    return {
      symbol: output.symbol,
      timeframe: output.timeframe,
      timestamp: Date.now(),
      recommendation: output.recommendation,
      confidence: output.confidence,
      currentPrice: output.indicatorSummary.ema26 || output.entryPrice || 0,
      riskLevel: this.inferRiskLevel(output),
      entryPrice: output.entryPrice,
      stopLoss: output.stopLoss,
      takeProfit: output.takeProfit1,
      riskRewardRatio: output.riskReward,
      reasoning: output.reasoning.join('. ') || 'Analysis completed.',
      indicators: {
        trend: { signal: trendSignal, strength: this.trendStrength(output) },
        momentum: { signal: momentumSignal, strength: momentumStrength },
        volume: { signal: volumeSignal, strength: volumeStrength },
        volatility: { signal: volSignalEnum, strength: volStrength },
      },
      engines: {
        technical: tech,
        pattern: {
          signal: output.patterns.signal === 'BULLISH' ? 'BUY' : output.patterns.signal === 'BEARISH' ? 'SELL' : 'NEUTRAL',
          strength: output.patterns.strength,
          pattern: output.patterns.patterns[0] || 'NONE',
          confidence: output.patterns.strength,
        },
        trend: {
          signal: trendSignal,
          strength: this.trendStrength(output),
        },
        supportResistance: {
          signal: 'NEUTRAL',
          strength: 0.5,
          levels: {
            resistance1: safeFloor(output.indicatorSummary.bollingerUpper),
            resistance2: 0,
            support1: safeFloor(output.indicatorSummary.bollingerLower),
            support2: 0,
            currentPrice: safeFloor(output.indicatorSummary.ema26 || output.entryPrice),
          },
        },
        volume: { signal: volumeSignal, strength: volumeStrength },
        momentum: { signal: momentumSignal, strength: momentumStrength },
        news: { signal: 'NEUTRAL', strength: 0.5, articles: [], sentiment: 0 },
        sentiment: { signal: 'NEUTRAL', strength: 0.5 },
        risk: {
          signal: output.risks.length > 0 ? 'CAUTION' : 'NEUTRAL',
          strength: output.risks.length > 0 ? 0.6 : 0.4,
          riskLevel: this.inferRiskLevel(output),
          riskScore: this.inferRiskScore(output),
          metrics: {
            volatility: safeFloor(output.indicatorSummary.atr),
            maxDrawdown: 0,
            sharpeRatio: 0,
            valueAtRisk95: 0,
            beta: 1.0,
            correlationToMarket: 0.5,
          },
        },
        portfolio: { signal: 'NEUTRAL', strength: 0.5 },
        tradePlanning: {
          signal: output.recommendation === 'HOLD' ? 'WAIT' : output.recommendation,
          confidence: output.confidence / 100,
          tradeSetup: {
            entryPrice: safeFloor(output.entryPrice),
            stopLoss: safeFloor(output.stopLoss),
            takeProfit: safeFloor(output.takeProfit1),
            riskRewardRatio: output.riskReward,
            positionSizeSuggestion: 0,
            maxHoldTime: this.inferHoldTime(output.timeframe),
          },
          reasoning: output.reasoning.join('. ') || 'Analysis completed.',
        },
        aiExplanation: {
          explanation: output.reasoning.join('\n') || 'Analysis completed.',
          confidence: output.confidence / 100,
          keyFactors: output.keyFactors,
          risks: output.risks,
          timeframeSuitability: this.inferTimeframeSuitability(output),
          // Add market intelligence to the result for UI consumption
          marketIntelligence: intelligence || null,
        },
      },
    };
  }

  private getDefaultAnalysis(symbol: string, timeframe: string): AnalysisResult {
    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      recommendation: 'HOLD',
      confidence: 0,
      indicators: {
        trend: { signal: 'NEUTRAL', strength: 0 },
        momentum: { signal: 'NEUTRAL', strength: 0 },
        volume: { signal: 'NEUTRAL', strength: 0 },
        volatility: { signal: 'NEUTRAL', strength: 0 },
      },
      reasoning: 'Insufficient data for analysis.',
      engines: {
        technical: { signal: 'NEUTRAL', strength: 0, indicators: {} },
        pattern: { signal: 'NEUTRAL', strength: 0, pattern: 'NONE', confidence: 0 },
        trend: { signal: 'NEUTRAL', strength: 0 },
        supportResistance: { signal: 'NEUTRAL', strength: 0, levels: {} },
        volume: { signal: 'NEUTRAL', strength: 0 },
        momentum: { signal: 'NEUTRAL', strength: 0 },
        news: { signal: 'NEUTRAL', strength: 0, articles: [], sentiment: 0 },
        sentiment: { signal: 'NEUTRAL', strength: 0 },
        risk: { riskLevel: 'UNKNOWN', riskScore: 0 },
        portfolio: { signal: 'NEUTRAL', strength: 0 },
        tradePlanning: { signal: 'WAIT', confidence: 0, tradeSetup: null, reasoning: '' },
        aiExplanation: { explanation: 'Insufficient data for analysis.', confidence: 0, keyFactors: [], risks: [] },
      },
    };
  }

  // ── Helpers ──

  private trendStrength(output: AnalysisOutput): number {
    const rsi = output.indicatorSummary.rsi;
    if (!isFinite(rsi)) return 0.5;
    const trend = output.trend;
    if (trend === 'BULLISH') return 0.5 + (rsi > 50 ? (rsi - 50) / 100 : 0);
    if (trend === 'BEARISH') return 0.5 + (rsi < 50 ? (50 - rsi) / 100 : 0);
    return 0.5;
  }

  private inferRiskLevel(output: AnalysisOutput): string {
    if (output.risks.length >= 3 || output.volatility === 'HIGH') return 'HIGH';
    if (output.risks.length >= 1 || output.confidence < 40) return 'MEDIUM';
    return 'LOW';
  }

  private inferRiskScore(output: AnalysisOutput): number {
    if (output.volatility === 'HIGH') return 0.7;
    if (output.confidence > 70) return 0.2;
    if (output.confidence > 40) return 0.5;
    return 0.8;
  }

  private inferHoldTime(timeframe: string): string {
    switch (timeframe.toUpperCase()) {
      case '1M': case '5M': case '15M': return 'minutes';
      case '30M': case '1H': case '2H': case '4H': return 'hours';
      case '1D': return 'days';
      case '1W': return 'weeks';
      default: return 'N/A';
    }
  }

  private inferTimeframeSuitability(output: AnalysisOutput): string {
    const rsi = output.indicatorSummary.rsi;
    if (!isFinite(rsi)) return 'Neutral suitability';
    const tf = output.timeframe.toUpperCase();
    if (['15M', '30M', '1H'].includes(tf)) {
      return rsi > 40 && rsi < 60 ? 'Well-suited for short-term trading' : 'Momentum moderate for short-term';
    }
    if (['4H', '1D'].includes(tf)) {
      return output.trend !== 'NEUTRAL' ? 'Good trend alignment for medium-term' : 'Unclear trend for medium-term';
    }
    return 'Neutral suitability for this timeframe';
  }
}

function safeFloor(v: number): number {
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
