/**
 * Technical Analysis Engine
 *
 * The single source of truth for all market analysis.
 * Integrates SignalScoringEngine + TradeSetupEngine + ReasoningEngine + PatternRecognitionEngine.
 *
 * Rules:
 * - Every indicator value comes from real OHLCV data — never simulated
 * - Every numeric value is validated before use (isFinite check)
 * - Fully deterministic: same candles → same result every time
 * - No Math.random(), no placeholder confidence, no hardcoded recommendations
 * - If data is insufficient, returns NEUTRAL/HOLD with a clear reason
 *
 * Performance target: full analysis in < 200ms for 500+ candles
 */

import { TechnicalIndicators } from '../../utils/technical-indicators';
import { adapterManager } from '../../adapters';
import { SignalScoringEngine, IndicatorSnapshot } from './signal-scoring-engine';
import { TradeSetupEngine, TradeSetupInput } from './trade-setup-engine';
import { ReasoningEngine } from './reasoning-engine';
import { PatternRecognitionEngine, PatternResult } from './pattern-recognition-engine';

// ── Public output types ──

export interface AnalysisOutput {
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;           // 0-100
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  riskPercent: number;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volatility: 'HIGH' | 'LOW' | 'NORMAL';
  reasoning: string[];
  keyFactors: string[];
  risks: string[];
  patterns: PatternResult;
  indicatorSummary: {
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
    atr: number;
    adx: number;
    plusDI: number;
    minusDI: number;
    vwap: number;
    stochK: number;
    stochD: number;
    obv: number;
    volume: number;
    avgVolume: number;
  };
  candleCount: number;
  symbol: string;
  timeframe: string;
  dataSource: string;
}

export class TechnicalAnalysisEngine {
  private signalScoring: SignalScoringEngine;
  private tradeSetup: TradeSetupEngine;
  private reasoning: ReasoningEngine;
  private patternRecognition: PatternRecognitionEngine;

  constructor() {
    this.signalScoring = new SignalScoringEngine();
    this.tradeSetup = new TradeSetupEngine();
    this.reasoning = new ReasoningEngine();
    this.patternRecognition = new PatternRecognitionEngine();
  }

  /**
   * Analyze a market using real OHLCV data.
   */
  async analyze(symbol: string, timeframe: string, platform: string = ''): Promise<AnalysisOutput> {
    // ── 1. Acquire real market data ──
    const { chartData, dataSource } = await this.fetchMarketData(symbol, timeframe, platform);

    const { close, high, low, volume, open, timestamps } = chartData;
    const candleCount = close.length;
    const currentPrice = close[candleCount - 1];

    console.log('[Analysis Engine] Analyzing:', { symbol, timeframe, candleCount, dataSource, currentPrice });

    // ── 2. Calculate ALL technical indicators ──
    const indicators = this.calculateAllIndicators(close, high, low, volume);

    // ── 3. Build indicator snapshot for scoring ──
    const snapshot = this.buildSnapshot(indicators, currentPrice);

    // ── 4. Score signals ──
    const signalScore = this.signalScoring.score(snapshot);

    // ── 5. Calculate trade setup (entry/SL/TP) ──
    const tradeSetup = this.tradeSetup.calculate({
      close: currentPrice,
      high: high[candleCount - 1],
      low: low[candleCount - 1],
      atr: indicators.atr,
      direction: signalScore.recommendation,
      bollingerUpper: indicators.bollingerUpper,
      bollingerLower: indicators.bollingerLower,
      sma20: indicators.sma20,
      sma50: indicators.sma50,
      sma200: isFinite(indicators.sma200) ? indicators.sma200 : 0,
      highest50: indicators.highest50,
      lowest50: indicators.lowest50,
    });

    // ── 6. Run pattern recognition on the same OHLCV data ──
    const patternsResult = await this.patternRecognition.analyze(symbol, timeframe, {
      open, high, low, close, volume,
    });

    // ── 7. Generate reasoning ──
    const reasoningResult = this.reasoning.generate(snapshot, signalScore.recommendation, signalScore.confidence);

    // ── 8. Determine trend and volatility labels ──
    const trend = this.determineTrend(snapshot, signalScore.recommendation);
    const volatility = this.determineVolatility(indicators.atr, currentPrice, indicators.bollingerWidth);

    return {
      recommendation: signalScore.recommendation,
      confidence: signalScore.confidence,
      entryPrice: tradeSetup.entry,
      stopLoss: tradeSetup.stopLoss,
      takeProfit1: tradeSetup.takeProfit1,
      takeProfit2: tradeSetup.takeProfit2,
      riskReward: tradeSetup.riskReward,
      riskPercent: tradeSetup.riskPercent,
      trend,
      volatility,
      reasoning: reasoningResult.reasons,
      keyFactors: reasoningResult.keyFactors,
      risks: reasoningResult.risks,
      patterns: patternsResult,
      indicatorSummary: {
        sma20: safeVal(indicators.sma20),
        sma50: safeVal(indicators.sma50),
        ema12: safeVal(indicators.ema12),
        ema26: safeVal(indicators.ema26),
        rsi: safeVal(indicators.rsi),
        macd: safeVal(indicators.macdLine),
        macdSignal: safeVal(indicators.macdSignal),
        macdHistogram: safeVal(indicators.macdHistogram),
        bollingerUpper: safeVal(indicators.bollingerUpper),
        bollingerMiddle: safeVal(indicators.bollingerMiddle),
        bollingerLower: safeVal(indicators.bollingerLower),
        atr: safeVal(indicators.atr),
        adx: safeVal(indicators.adx),
        plusDI: safeVal(indicators.plusDI),
        minusDI: safeVal(indicators.minusDI),
        vwap: safeVal(indicators.vwap),
        stochK: safeVal(indicators.stochK),
        stochD: safeVal(indicators.stochD),
        obv: safeVal(indicators.obv),
        volume: safeVal(indicators.latestVolume),
        avgVolume: safeVal(indicators.avgVolume),
      },
      candleCount,
      symbol,
      timeframe,
      dataSource,
    };
  }

  // ── Private helpers ──

  private async fetchMarketData(symbol: string, timeframe: string, platform: string): Promise<{ chartData: any; dataSource: string }> {
    const adapter = await adapterManager.getCurrentAdapter(platform || undefined);

    if (!adapter) {
      throw new Error('No market data adapter available. Open a supported trading platform (TradingView, Binance, etc.) to analyze live data.');
    }

    const chartData = await adapter.getChartData(symbol, timeframe);

    if (!chartData || !chartData.close || chartData.close.length === 0) {
      throw new Error(`No price data received from adapter for ${symbol}. The symbol may not be supported.`);
    }

    return {
      chartData,
      dataSource: chartData.source || 'live',
    };
  }

  private calculateAllIndicators(close: number[], high: number[], low: number[], volume: number[]) {
    const sma20 = last(TechnicalIndicators.sma(close, 20));
    const sma50 = last(TechnicalIndicators.sma(close, 50));
    const sma200 = last(TechnicalIndicators.sma(close, 200));
    const ema12 = last(TechnicalIndicators.ema(close, 12));
    const ema26 = last(TechnicalIndicators.ema(close, 26));
    const rsi = last(TechnicalIndicators.rsi(close, 14));

    const macdResult = TechnicalIndicators.macd(close, 12, 26, 9);
    const macdLine = last(macdResult.macd);
    const macdSignal = last(macdResult.signal);
    const macdHistogram = last(macdResult.histogram);

    const bbResult = TechnicalIndicators.bollingerBands(close, 20, 2);
    const bollingerUpper = last(bbResult.upper);
    const bollingerMiddle = last(bbResult.middle);
    const bollingerLower = last(bbResult.lower);
    const bbMid = bollingerMiddle;
    const bollingerWidth = isFinite(bbMid) && bbMid > 0
      ? (bollingerUpper - bollingerLower) / bbMid
      : NaN;

    const atrArr = TechnicalIndicators.atr(high, low, close, 14);
    const atr = last(atrArr);

    const adxResult = TechnicalIndicators.adx(high, low, close, 14);
    const adx = last(adxResult.adx);
    const plusDI = last(adxResult.plusDI);
    const minusDI = last(adxResult.minusDI);

    const typicalPrice = high.map((h: number, i: number) => (h + low[i] + close[i]) / 3);
    const vwapArr = TechnicalIndicators.vwap(typicalPrice, volume);
    const vwap = last(vwapArr);

    const stochResult = TechnicalIndicators.stoch(high, low, close, 14, 3);
    const stochK = last(stochResult.k);
    const stochD = last(stochResult.d);

    const obvArr = TechnicalIndicators.obv(close, volume);
    const obv = last(obvArr);

    const latestVolume = last(volume);
    const avgVolume = close.length >= 20
      ? volume.slice(-20).reduce((a, b) => a + b, 0) / 20
      : NaN;

    const lookback = Math.min(50, close.length);
    const highest50 = Math.max(...high.slice(-lookback));
    const lowest50 = Math.min(...low.slice(-lookback));

    return {
      sma20, sma50, sma200, ema12, ema26,
      rsi, macdLine, macdSignal, macdHistogram,
      bollingerUpper, bollingerMiddle, bollingerLower, bollingerWidth,
      atr, adx, plusDI, minusDI, vwap,
      stochK, stochD, obv, latestVolume, avgVolume,
      highest50, lowest50,
    };
  }

  private buildSnapshot(ind: ReturnType<typeof this.calculateAllIndicators>, currentPrice: number): IndicatorSnapshot {
    return {
      close: currentPrice,
      sma20: ind.sma20, sma50: ind.sma50,
      ema12: ind.ema12, ema26: ind.ema26,
      rsi: ind.rsi,
      macd: ind.macdLine, macdSignal: ind.macdSignal, macdHistogram: ind.macdHistogram,
      bollingerUpper: ind.bollingerUpper, bollingerLower: ind.bollingerLower, bollingerWidth: ind.bollingerWidth,
      atr: ind.atr, adx: ind.adx, plusDI: ind.plusDI, minusDI: ind.minusDI,
      vwap: ind.vwap,
      stochK: ind.stochK, stochD: ind.stochD,
      obv: ind.obv,
      volume: ind.latestVolume, avgVolume: ind.avgVolume,
      highestHigh: ind.highest50, lowestLow: ind.lowest50,
    };
  }

  private determineTrend(snapshot: IndicatorSnapshot, recommendation: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    if (recommendation === 'STRONG_BUY' || recommendation === 'BUY') return 'BULLISH';
    if (recommendation === 'STRONG_SELL' || recommendation === 'SELL') return 'BEARISH';
    if (isFinite(snapshot.ema12) && isFinite(snapshot.ema26)) {
      if (snapshot.ema12 > snapshot.ema26) return 'BULLISH';
      if (snapshot.ema12 < snapshot.ema26) return 'BEARISH';
    }
    return 'NEUTRAL';
  }

  private determineVolatility(atr: number, price: number, bollingerWidth: number): 'HIGH' | 'LOW' | 'NORMAL' {
    if (!isFinite(atr) || !isFinite(price) || price <= 0) return 'NORMAL';
    const atrPct = atr / price;
    if (atrPct > 0.04) return 'HIGH';
    if (atrPct < 0.01 && isFinite(bollingerWidth) && bollingerWidth < 0.1) return 'LOW';
    return 'NORMAL';
  }
}

function last(arr: number[]): number {
  return arr.length > 0 ? arr[arr.length - 1] : NaN;
}

function safeVal(v: number): number {
  return isFinite(v) ? Math.round(v * 100) / 100 : 0;
}
