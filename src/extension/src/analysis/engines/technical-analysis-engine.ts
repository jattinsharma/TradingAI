// Technical Analysis Engine
import { TechnicalIndicators } from '../../utils/technical-indicators';
import { adapterManager } from '../../adapters';

export class TechnicalAnalysisEngine {
  async analyze(symbol: string, timeframe: string, platform: string = ''): Promise<any> {
    // Get real data from the platform adapter
    // Pass the platform so the adapter manager can select the right adapter
    // (platform comes from the content script which detected it from the page)
    const adapter = await adapterManager.getCurrentAdapter(platform || undefined);

    // We MUST have an adapter with real data
    if (!adapter) {
      console.error('[Analysis Engine] No adapter available - cannot analyze without market data');
      throw new Error('No adapter available. Please navigate to a supported trading platform (e.g., TradingView) to analyze live market data.');
    }

    // Get chart data from the adapter — pass symbol and timeframe directly
    // The adapter receives these from the content script via the analysis pipeline
    let chartData;
    try {
      chartData = await adapter.getChartData(symbol, timeframe);
    } catch (error) {
      console.error('[Analysis Engine] Failed to get chart data from adapter:', error);
      // Only fall back to simulated data if this is a dev/test context
      // In production, we throw to surface the error
      if (symbol === '__TEST__' || timeframe === '__TEST__') {
        console.warn('[Analysis Engine] Test mode detected, using simulated data');
        return this.analyzeWithSimulatedData(symbol, timeframe);
      }
      throw new Error('Failed to fetch live market data: ' + (error instanceof Error ? error.message : String(error)));
    }

    // Extract OHLCV data from chart data
    const { timestamps, open, high, low, close, volume } = chartData;
    // Void to indicate intentional omission if not used immediately
    (void timestamps, void open);

    // Validate we have sufficient data
    if (!close || close.length === 0) {
      console.error('[Analysis Engine] No price data available from adapter');
      throw new Error('No price data available from market data feed. The symbol may not be supported.');
    }

    console.log('[Analysis Engine] Analysis using live data:', {
      symbol,
      timeframe,
      dataSource: chartData.source || 'live',
      candleCount: close.length,
      latestClose: close[close.length - 1],
      latestVolume: volume ? volume[volume.length - 1] : 'N/A'
    });

    // Calculate all technical indicators using real data
    const sma20 = TechnicalIndicators.sma(close, 20);
    const sma50 = TechnicalIndicators.sma(close, 50);
    const ema12 = TechnicalIndicators.ema(close, 12);
    const ema26 = TechnicalIndicators.ema(close, 26);

    const rsi = TechnicalIndicators.rsi(close, 14);

    const macd = TechnicalIndicators.macd(close, 12, 26, 9);

    const bollinger = TechnicalIndicators.bollingerBands(close, 20, 2);

    const adxData = TechnicalIndicators.adx(high, low, close, 14);
    const atr = TechnicalIndicators.atr(high, low, close, 14);

    // Typical price for VWAP calculation: (high + low + close) / 3
    const typicalPrice = high.map((h: number, i: number) => (h + low[i] + close[i]) / 3);
    const vwap = TechnicalIndicators.vwap(typicalPrice, volume);

    // Determine signal based on multiple indicators
    const latestClose = close.length > 0 ? close[close.length - 1] : 0;
    const latestSMA20 = sma20.length > 0 ? sma20[sma20.length - 1] : 0;
    const latestSMA50 = sma50.length > 0 ? sma50[sma50.length - 1] : 0;
    const latestRSI = rsi.length > 0 ? rsi[rsi.length - 1] : 0;
    const latestMACD = macd.macd.length > 0 ? macd.macd[macd.macd.length - 1] : 0;
    const latestMACDSignal = macd.signal.length > 0 ? macd.signal[macd.signal.length - 1] : 0;
    const latestADX = adxData.adx.length > 0 ? adxData.adx[adxData.adx.length - 1] : 0;
    const latestPlusDI = adxData.plusDI.length > 0 ? adxData.plusDI[adxData.plusDI.length - 1] : 0;
    const latestMinusDI = adxData.minusDI.length > 0 ? adxData.minusDI[adxData.minusDI.length - 1] : 0;
    const latestATR = atr.length > 0 ? atr[atr.length - 1] : 0;
    const latestVWAP = vwap.length > 0 ? vwap[vwap.length - 1] : 0;

    // Determine signal direction and strength
    let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let strength = 0.5;

    // Trend based signals
    if (latestClose > latestSMA20 && latestSMA20 > latestSMA50) {
      // Uptrend
      signal = 'BUY';
      strength = 0.6;
    } else if (latestClose < latestSMA20 && latestSMA20 < latestSMA50) {
      // Downtrend
      signal = 'SELL';
      strength = 0.6;
    }

    // RSI signals
    if (!isNaN(latestRSI)) {
      if (latestRSI < 30 && signal !== 'SELL') {
        // Oversold - bullish
        signal = 'BUY';
        strength = Math.max(strength, 0.6);
      } else if (latestRSI > 70 && signal !== 'BUY') {
        // Overbought - bearish
        signal = 'SELL';
        strength = Math.max(strength, 0.6);
      }
    }

    // MACD signals
    if (!isNaN(latestMACD) && !isNaN(latestMACDSignal)) {
      if (latestMACD > latestMACDSignal && signal !== 'SELL') {
        // MACD bullish crossover
        signal = 'BUY';
        strength = Math.max(strength, 0.65);
      } else if (latestMACD < latestMACDSignal && signal !== 'BUY') {
        // MACD bearish crossover
        signal = 'SELL';
        strength = Math.max(strength, 0.65);
      }
    }

    // ADX for trend strength (values above 25 indicate strong trend)
    if (!isNaN(latestADX)) {
      if (latestADX > 25) {
        // Strong trend - increase confidence in current direction
        strength = Math.min(0.9, strength + 0.1);
      } else if (latestADX < 20) {
        // Weak trend - reduce confidence
        strength = Math.max(0.3, strength - 0.1);
      }
    }

    // Additional confirmation from price vs VWAP
    if (!isNaN(latestVWAP)) {
      if (latestClose > latestVWAP && signal === 'BUY') {
        // Price above VWAP adds confidence to buy signal
        strength = Math.min(0.95, strength + 0.05);
      } else if (latestClose < latestVWAP && signal === 'SELL') {
        // Price below VWAP adds confidence to sell signal
        strength = Math.min(0.95, strength + 0.05);
      }
    }

    return {
      signal,
      strength: Math.min(1.0, Math.max(0, strength)),
      indicators: {
        sma20: sma20.length > 0 ? sma20[sma20.length - 1] : 0,
        sma50: sma50.length > 0 ? sma50[sma50.length - 1] : 0,
        ema12: ema12.length > 0 ? ema12[ema12.length - 1] : 0,
        ema26: ema26.length > 0 ? ema26[ema26.length - 1] : 0,
        rsi: rsi.length > 0 ? rsi[rsi.length - 1] : 0,
        macd: macd.macd.length > 0 ? macd.macd[macd.macd.length - 1] : 0,
        macdSignal: macd.signal.length > 0 ? macd.signal[macd.signal.length - 1] : 0,
        macdHistogram: macd.histogram.length > 0 ? macd.histogram[macd.histogram.length - 1] : 0,
        bollingerUpper: bollinger.upper.length > 0 ? bollinger.upper[bollinger.upper.length - 1] : 0,
        bollingerMiddle: bollinger.middle.length > 0 ? bollinger.middle[bollinger.middle.length - 1] : 0,
        bollingerLower: bollinger.lower.length > 0 ? bollinger.lower[bollinger.lower.length - 1] : 0,
        adx: adxData.adx.length > 0 ? adxData.adx[adxData.adx.length - 1] : 0,
        plusDI: adxData.plusDI.length > 0 ? adxData.plusDI[adxData.plusDI.length - 1] : 0,
        minusDI: adxData.minusDI.length > 0 ? adxData.minusDI[adxData.minusDI.length - 1] : 0,
        atr: atr.length > 0 ? atr[atr.length - 1] : 0,
        vwap: vwap.length > 0 ? vwap[vwap.length - 1] : 0
      }
    };
  }

  // Fallback method for simulated data - only used in test/development mode
  private analyzeWithSimulatedData(symbol: string, timeframe: string): any {
    // Simulate delay for data processing
    return new Promise(resolve => setTimeout(resolve, 10)).then(() => {
      // Simulate delay for data processing

      // Placeholder data - in reality this comes from the chart adapter
      const closes = Array(50).fill(0).map((_, i) => 100 + Math.sin(i * 0.1) * 10 + Math.random() * 2);
      const highs = closes.map(c => c + Math.random() * 2);
      const lows = closes.map(c => c - Math.random() * 2);
      const volumes = Array(50).fill(0).map(() => 1000 + Math.random() * 1000);

      // Calculate all technical indicators
      const sma20 = TechnicalIndicators.sma(closes, 20);
      const sma50 = TechnicalIndicators.sma(closes, 50);
      const ema12 = TechnicalIndicators.ema(closes, 12);
      const ema26 = TechnicalIndicators.ema(closes, 26);

      const rsi = TechnicalIndicators.rsi(closes, 14);

      const macd = TechnicalIndicators.macd(closes, 12, 26, 9);

      const bollinger = TechnicalIndicators.bollingerBands(closes, 20, 2);
      const adxData = TechnicalIndicators.adx(highs, lows, closes, 14);
      const atr = TechnicalIndicators.atr(highs, lows, closes, 14);

      // Typical price for VWAP calculation: (high + low + close) / 3
      const typicalPrice = highs.map((h: number, i: number) => (h + lows[i] + closes[i]) / 3);
      const vwap = TechnicalIndicators.vwap(typicalPrice, volumes);

      // Determine signal based on multiple indicators
      const latestClose = closes.length > 0 ? closes[closes.length - 1] : 0;
      const latestSMA20 = sma20.length > 0 ? sma20[sma20.length - 1] : 0;
      const latestSMA50 = sma50.length > 0 ? sma50[sma50.length - 1] : 0;
      const latestRSI = rsi.length > 0 ? rsi[rsi.length - 1] : 0;
      const latestMACD = macd.macd.length > 0 ? macd.macd[macd.macd.length - 1] : 0;
      const latestMACDSignal = macd.signal.length > 0 ? macd.signal[macd.signal.length - 1] : 0;
      const latestADX = adxData.adx.length > 0 ? adxData.adx[adxData.adx.length - 1] : 0;

      // Determine signal direction and strength
      let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
      let strength = 0.5;

      // Trend based signals
      if (latestClose > latestSMA20 && latestSMA20 > latestSMA50) {
        // Uptrend
        signal = 'BUY';
        strength = 0.6;
      } else if (latestClose < latestSMA20 && latestSMA20 < latestSMA50) {
        // Downtrend
        signal = 'SELL';
        strength = 0.6;
      }

      // RSI signals
      if (!isNaN(latestRSI)) {
        if (latestRSI < 30 && signal !== 'SELL') {
          // Oversold - bullish
          signal = 'BUY';
          strength = Math.max(strength, 0.6);
        } else if (latestRSI > 70 && signal !== 'BUY') {
          // Overbought - bearish
          signal = 'SELL';
          strength = Math.max(strength, 0.6);
        }
      }

      // MACD signals
      if (!isNaN(latestMACD) && !isNaN(latestMACDSignal)) {
        if (latestMACD > latestMACDSignal && signal !== 'SELL') {
          // MACD bullish crossover
          signal = 'BUY';
          strength = Math.max(strength, 0.65);
        } else if (latestMACD < latestMACDSignal && signal !== 'BUY') {
          // MACD bearish crossover
          signal = 'SELL';
          strength = Math.max(strength, 0.65);
        }
      }

      // ADX for trend strength (values above 25 indicate strong trend)
      if (!isNaN(latestADX)) {
        if (latestADX > 25) {
          // Strong trend - increase confidence in current direction
          strength = Math.min(0.9, strength + 0.1);
        } else if (latestADX < 20) {
          // Weak trend - reduce confidence
          strength = Math.max(0.3, strength - 0.1);
        }
      }

      return {
        signal,
        strength: Math.min(1.0, Math.max(0, strength)),
        indicators: {
          sma20: sma20[sma20.length - 1],
          sma50: sma50[sma50.length - 1],
          ema12: ema12[ema12.length - 1],
          ema26: ema26[ema26.length - 1],
          rsi: rsi[rsi.length - 1],
          macd: macd.macd[macd.macd.length - 1],
          macdSignal: macd.signal[macd.signal.length - 1],
          macdHistogram: macd.histogram[macd.histogram.length - 1],
          bollingerUpper: bollinger.upper[bollinger.upper.length - 1],
          bollingerMiddle: bollinger.middle[bollinger.middle.length - 1],
          bollingerLower: bollinger.lower[bollinger.lower.length - 1],
          adx: adxData.adx[adxData.adx.length - 1],
          plusDI: adxData.plusDI[adxData.plusDI.length - 1],
          minusDI: adxData.minusDI[adxData.minusDI.length - 1],
          atr: atr[atr.length - 1],
          vwap: vwap[vwap.length - 1]
        }
      };
    });
  }
}