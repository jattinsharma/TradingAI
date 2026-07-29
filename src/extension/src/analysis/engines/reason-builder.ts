/**
 * Reason Builder
 *
 * Takes the AnalysisOutput indicator summary and builds structured lists
 * of bullish factors, bearish factors, and conflicting signals.
 *
 * Fully deterministic: same indicators → same factors always.
 * Every factor is grounded in actual data — never fabricated.
 */

import { AnalysisOutput } from './technical-analysis-engine';

export interface ReasonFactors {
  bullish: string[];
  bearish: string[];
  conflicting: string[];
  marketBias: 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL_BULLISH' | 'NEUTRAL' | 'NEUTRAL_BEARISH' | 'BEARISH' | 'STRONG_BEARISH';
  biasReason: string;
}

export class ReasonBuilder {
  build(output: AnalysisOutput): ReasonFactors {
    const bullish: string[] = [];
    const bearish: string[] = [];
    const conflicting: string[] = [];

    const ind = output.indicatorSummary;

    // ── Trend-based factors ──
    // Use the best available price proxy (ema26 → sma20 → 0)
    const price = ind.ema26 || ind.sma20 || 0;

    // Trend: Price vs SMA20
    if (isFinite(ind.sma20) && ind.sma20 > 0 && price > 0) {
      const pctAbove = ((price - ind.sma20) / ind.sma20) * 100;
      if (pctAbove > 2) {
        bullish.push(`Price ${pctAbove.toFixed(1)}% above SMA20 — strong bullish trend structure`);
      } else if (pctAbove > 0.5) {
        bullish.push(`Price ${pctAbove.toFixed(1)}% above SMA20 — bullish bias`);
      } else if (pctAbove < -2) {
        bearish.push(`Price ${Math.abs(pctAbove).toFixed(1)}% below SMA20 — strong bearish trend structure`);
      } else if (pctAbove < -0.5) {
        bearish.push(`Price ${Math.abs(pctAbove).toFixed(1)}% below SMA20 — bearish bias`);
      }
    }

    // Trend: SMA20 vs SMA50
    if (isFinite(ind.sma20) && isFinite(ind.sma50) && ind.sma50 > 0) {
      const maDiff = ((ind.sma20 - ind.sma50) / ind.sma50) * 100;
      if (maDiff > 1) {
        bullish.push(`SMA20 (${ind.sma20}) well above SMA50 (${ind.sma50}) — golden crossover`);
      } else if (maDiff > 0.1) {
        bullish.push('SMA20 above SMA50 — bullish moving average alignment');
      } else if (maDiff < -1) {
        bearish.push(`SMA20 (${ind.sma20}) well below SMA50 (${ind.sma50}) — death crossover`);
      } else if (maDiff < -0.1) {
        bearish.push('SMA20 below SMA50 — bearish moving average alignment');
      } else {
        conflicting.push('SMA20 and SMA50 closely aligned — no MA trend bias');
      }
    }

    // Trend: EMA cross
    if (isFinite(ind.ema12) && isFinite(ind.ema26) && ind.ema26 > 0) {
      const emaDiff = ((ind.ema12 - ind.ema26) / ind.ema26) * 100;
      if (emaDiff > 0.5) {
        bullish.push(`EMA12 above EMA26 — bullish EMA alignment`);
      } else if (emaDiff < -0.5) {
        bearish.push(`EMA12 below EMA26 — bearish EMA alignment`);
      }
    }

    // Price vs VWAP
    if (isFinite(ind.vwap) && ind.vwap > 0 && price > 0) {
      const vwapDiff = ((price - ind.vwap) / ind.vwap) * 100;
      if (vwapDiff > 1) {
        bullish.push(`Price ${vwapDiff.toFixed(1)}% above VWAP — bullish intraday bias`);
      } else if (vwapDiff < -1) {
        bearish.push(`Price ${Math.abs(vwapDiff).toFixed(1)}% below VWAP — bearish intraday bias`);
      }
    }

    // ── Momentum factors ──
    if (isFinite(ind.rsi)) {
      if (ind.rsi > 70) {
        bearish.push(`RSI ${ind.rsi.toFixed(1)} — overbought, potential reversal`);
        conflicting.push('Strong bullish momentum but overbought RSI suggests caution');
      } else if (ind.rsi < 30) {
        bullish.push(`RSI ${ind.rsi.toFixed(1)} — oversold, potential bounce/reversal`);
        conflicting.push('Bearish pressure but oversold RSI suggests potential reversal');
      } else if (ind.rsi > 60) {
        bullish.push(`RSI ${ind.rsi.toFixed(1)} — bullish momentum, room to run`);
      } else if (ind.rsi < 40) {
        bearish.push(`RSI ${ind.rsi.toFixed(1)} — bearish momentum`);
      } else {
        // 40-60 range — neutral
      }
    }

    // MACD
    if (isFinite(ind.macd) && isFinite(ind.macdSignal)) {
      if (ind.macd > ind.macdSignal) {
        bullish.push('MACD above signal line — bullish momentum');
      } else if (ind.macd < ind.macdSignal) {
        bearish.push('MACD below signal line — bearish momentum');
      }
    }

    if (isFinite(ind.macdHistogram)) {
      if (ind.macdHistogram > 0) {
        bullish.push('MACD histogram positive — momentum expanding');
      } else if (ind.macdHistogram < 0) {
        bearish.push('MACD histogram negative — momentum contracting');
      }
    }

    // Stochastic
    if (isFinite(ind.stochK) && isFinite(ind.stochD)) {
      if (ind.stochK > 80 && ind.stochD > 80) {
        bearish.push(`Stochastic overbought (K:${ind.stochK.toFixed(0)}) — potential reversal down`);
      } else if (ind.stochK < 20 && ind.stochD < 20) {
        bullish.push(`Stochastic oversold (K:${ind.stochK.toFixed(0)}) — potential reversal up`);
      }
    }

    // ── Volume factors ──
    if (isFinite(ind.volume) && isFinite(ind.avgVolume) && ind.avgVolume > 0) {
      const volRatio = ind.volume / ind.avgVolume;
      if (volRatio > 1.5) {
        bullish.push(`Volume ${(volRatio * 100).toFixed(0)}% of average — high participation`);
      } else if (volRatio < 0.5) {
        bearish.push(`Volume ${(volRatio * 100).toFixed(0)}% of average — low participation, weak conviction`);
      }
    }

    // ── Volatility factors ──
    if (isFinite(ind.atr) && price > 0) {
      const atrPct = (ind.atr / price) * 100;
      if (atrPct > 4) {
        bearish.push(`ATR ${atrPct.toFixed(2)}% — high volatility, wide stops required`);
      } else if (atrPct < 1) {
        bullish.push(`ATR ${atrPct.toFixed(2)}% — low volatility, favorable for trend following`);
      }
    }

    // ── Market structure factors ──
    if (isFinite(ind.adx)) {
      if (ind.adx > 40) {
        const isBullTrend = isFinite(ind.plusDI) && isFinite(ind.minusDI) && ind.plusDI > ind.minusDI;
        if (isBullTrend) {
          bullish.push(`ADX ${ind.adx.toFixed(1)} — very strong uptrend, high directional conviction`);
        } else {
          bearish.push(`ADX ${ind.adx.toFixed(1)} — very strong downtrend, high directional conviction`);
        }
      } else if (ind.adx > 25) {
        const isBullTrend = isFinite(ind.plusDI) && isFinite(ind.minusDI) && ind.plusDI > ind.minusDI;
        if (isBullTrend) {
          bullish.push(`ADX ${ind.adx.toFixed(1)} — moderate uptrend, trending conditions`);
        } else {
          bearish.push(`ADX ${ind.adx.toFixed(1)} — moderate downtrend, trending conditions`);
        }
      } else if (ind.adx < 20) {
        conflicting.push(`ADX ${ind.adx.toFixed(1)} — weak/no trend, market likely ranging`);
      }
    }

    if (isFinite(ind.plusDI) && isFinite(ind.minusDI)) {
      if (ind.plusDI > ind.minusDI + 10) {
        bullish.push(`+DI (${ind.plusDI.toFixed(1)}) significantly above -DI (${ind.minusDI.toFixed(1)}) — strong buying pressure`);
      } else if (ind.minusDI > ind.plusDI + 10) {
        bearish.push(`-DI (${ind.minusDI.toFixed(1)}) significantly above +DI (${ind.plusDI.toFixed(1)}) — strong selling pressure`);
      }
    }

    // Bollinger Band position
    if (isFinite(ind.bollingerUpper) && isFinite(ind.bollingerLower)) {
      const bbRange = ind.bollingerUpper - ind.bollingerLower;
      const upperDist = bbRange > 0 ? ((ind.bollingerUpper - price) / bbRange) * 100 : 50;
      const lowerDist = bbRange > 0 ? ((price - ind.bollingerLower) / bbRange) * 100 : 50;

      if (upperDist < 10) {
        conflicting.push('Price touching upper Bollinger Band — resistance may form');
      } else if (lowerDist < 10) {
        conflicting.push('Price touching lower Bollinger Band — support may form');
      }
    }

    // ── Pattern factors ──
    if (output.patterns && output.patterns.patterns) {
      const hasBullishPattern = output.patterns.signal === 'BULLISH';
      const hasBearishPattern = output.patterns.signal === 'BEARISH';

      if (hasBullishPattern) {
        bullish.push(`Candlestick pattern: ${output.patterns.patterns.filter(p => p !== 'NONE').join(', ')}`);
      } else if (hasBearishPattern) {
        bearish.push(`Candlestick pattern: ${output.patterns.patterns.filter(p => p !== 'NONE').join(', ')}`);
      }
    }

    // ── Determine market bias ──
    const bias = this.determineBias(bullish.length, bearish.length, output);
    const biasReason = this.biasReasonText(bullish, bearish, output);

    // Deduplicate
    const uniqueBullish = [...new Set(bullish)];
    const uniqueBearish = [...new Set(bearish)];
    const uniqueConflicting = [...new Set(conflicting)];

    return {
      bullish: uniqueBullish,
      bearish: uniqueBearish,
      conflicting: uniqueConflicting,
      marketBias: bias,
      biasReason,
    };
  }

  private determineBias(
    bullishCount: number,
    bearishCount: number,
    output: AnalysisOutput,
  ): 'STRONG_BULLISH' | 'BULLISH' | 'NEUTRAL_BULLISH' | 'NEUTRAL' | 'NEUTRAL_BEARISH' | 'BEARISH' | 'STRONG_BEARISH' {
    const rec = output.recommendation;

    if (rec === 'STRONG_BUY') return 'STRONG_BULLISH';
    if (rec === 'BUY') return 'BULLISH';
    if (rec === 'STRONG_SELL') return 'STRONG_BEARISH';
    if (rec === 'SELL') return 'BEARISH';

    // HOLD — check indicator lean
    const net = bullishCount - bearishCount;
    if (net >= 3) return 'NEUTRAL_BULLISH';
    if (net <= -3) return 'NEUTRAL_BEARISH';
    return 'NEUTRAL';
  }

  private biasReasonText(bullish: string[], bearish: string[], output: AnalysisOutput): string {
    if (output.recommendation === 'STRONG_BUY' || output.recommendation === 'BUY') {
      return `${bullish.length} bullish factor${bullish.length !== 1 ? 's' : ''} vs ${bearish.length} bearish — net bullish bias`;
    }
    if (output.recommendation === 'STRONG_SELL' || output.recommendation === 'SELL') {
      return `${bearish.length} bearish factor${bearish.length !== 1 ? 's' : ''} vs ${bullish.length} bullish — net bearish bias`;
    }
    return `${bullish.length} bullish, ${bearish.length} bearish — conflicting signals, net neutral`;
  }
}
