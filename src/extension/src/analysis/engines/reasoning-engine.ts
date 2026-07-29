/**
 * Reasoning Engine
 *
 * Generates human-readable reasoning from actual indicator values.
 * No templates. No simulated reasoning. Every line is built from real data.
 *
 * Deterministic: same IndicatorSnapshot → same reasoning array always.
 */

import { IndicatorSnapshot } from './signal-scoring-engine';

export interface ReasoningResult {
  reasons: string[];
  keyFactors: string[];
  risks: string[];
}

export class ReasoningEngine {
  generate(snapshot: IndicatorSnapshot, direction: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL', confidence: number): ReasoningResult {
    const reasons: string[] = [];
    const keyFactors: string[] = [];
    const risks: string[] = [];

    // ── Trend reasons ──
    if (isFinite(snapshot.sma20) && snapshot.sma20 > 0) {
      const priceVsSMA20 = ((snapshot.close - snapshot.sma20) / snapshot.sma20) * 100;
      if (priceVsSMA20 > 2) {
        reasons.push(`Price is ${priceVsSMA20.toFixed(1)}% above SMA20 — strong bullish trend structure`);
        keyFactors.push('Bullish trend structure');
      } else if (priceVsSMA20 > 0.5) {
        reasons.push(`Price is ${priceVsSMA20.toFixed(1)}% above SMA20 — moderate bullish bias`);
      } else if (priceVsSMA20 < -2) {
        reasons.push(`Price is ${Math.abs(priceVsSMA20).toFixed(1)}% below SMA20 — strong bearish trend structure`);
        keyFactors.push('Bearish trend structure');
      } else if (priceVsSMA20 < -0.5) {
        reasons.push(`Price is ${Math.abs(priceVsSMA20).toFixed(1)}% below SMA20 — moderate bearish bias`);
      } else {
        reasons.push(`Price near SMA20 (${priceVsSMA20.toFixed(1)}%) — neutral trend`);
      }
    }

    if (isFinite(snapshot.sma50) && snapshot.sma50 > 0 && isFinite(snapshot.sma20) && snapshot.sma20 > 0) {
      const maCrossover = ((snapshot.sma20 - snapshot.sma50) / snapshot.sma50) * 100;
      if (maCrossover > 1) {
        reasons.push(`SMA20 (${snapshot.sma20.toFixed(2)}) well above SMA50 (${snapshot.sma50.toFixed(2)}) — golden crossover zone`);
      } else if (maCrossover > 0.1) {
        reasons.push(`SMA20 above SMA50 — bullish moving average alignment`);
      } else if (maCrossover < -1) {
        reasons.push(`SMA20 (${snapshot.sma20.toFixed(2)}) well below SMA50 (${snapshot.sma50.toFixed(2)}) — death crossover zone`);
      } else if (maCrossover < -0.1) {
        reasons.push(`SMA20 below SMA50 — bearish moving average alignment`);
      }
    }

    if (isFinite(snapshot.ema12) && isFinite(snapshot.ema26) && snapshot.ema26 > 0) {
      const emaCrossover = ((snapshot.ema12 - snapshot.ema26) / snapshot.ema26) * 100;
      if (emaCrossover > 0.5) {
        reasons.push(`EMA12 (${snapshot.ema12.toFixed(2)}) above EMA26 (${snapshot.ema26.toFixed(2)}) — bullish EMA alignment`);
      } else if (emaCrossover < -0.5) {
        reasons.push(`EMA12 (${snapshot.ema12.toFixed(2)}) below EMA26 (${snapshot.ema26.toFixed(2)}) — bearish EMA alignment`);
      }
    }

    if (isFinite(snapshot.vwap) && snapshot.vwap > 0) {
      const vwapDiff = ((snapshot.close - snapshot.vwap) / snapshot.vwap) * 100;
      if (Math.abs(vwapDiff) > 1) {
        reasons.push(`Price ${vwapDiff > 0 ? 'above' : 'below'} VWAP by ${Math.abs(vwapDiff).toFixed(1)}%`);
      }
    }

    // ── Momentum reasons ──
    if (isFinite(snapshot.rsi)) {
      if (snapshot.rsi > 70) {
        reasons.push(`RSI at ${snapshot.rsi.toFixed(1)} — overbought territory (bullish momentum but caution warranted)`);
        risks.push('RSI in overbought zone (>70) — potential reversal or pullback');
      } else if (snapshot.rsi < 30) {
        reasons.push(`RSI at ${snapshot.rsi.toFixed(1)} — oversold territory (bearish momentum but reversal possible)`);
        risks.push('RSI in oversold zone (<30) — potential reversal or bounce');
        keyFactors.push('RSI oversold — reversal potential');
      } else if (snapshot.rsi > 60) {
        reasons.push(`RSI at ${snapshot.rsi.toFixed(1)} — bullish momentum, not yet overbought`);
      } else if (snapshot.rsi < 40) {
        reasons.push(`RSI at ${snapshot.rsi.toFixed(1)} — bearish momentum, not yet oversold`);
      } else {
        reasons.push(`RSI at ${snapshot.rsi.toFixed(1)} — neutral momentum range`);
      }
    }

    if (isFinite(snapshot.macdHistogram)) {
      const histPct = (snapshot.macdHistogram / snapshot.close) * 100;
      if (Math.abs(histPct) > 0.1) {
        if (snapshot.macdHistogram > 0) {
          reasons.push(`MACD histogram positive (${histPct.toFixed(2)}% of price) — bullish momentum increasing`);
          if (histPct > 0.5) keyFactors.push('Strong MACD bullish momentum');
        } else {
          reasons.push(`MACD histogram negative (${Math.abs(histPct).toFixed(2)}% of price) — bearish momentum increasing`);
          if (Math.abs(histPct) > 0.5) keyFactors.push('Strong MACD bearish momentum');
        }
      }
    }

    if (isFinite(snapshot.macd) && isFinite(snapshot.macdSignal)) {
      if (snapshot.macd > snapshot.macdSignal) {
        reasons.push('MACD above signal line — bullish crossover active');
      } else if (snapshot.macd < snapshot.macdSignal) {
        reasons.push('MACD below signal line — bearish crossover active');
      }
    }

    if (isFinite(snapshot.stochK) && isFinite(snapshot.stochD)) {
      if (snapshot.stochK > 80 && snapshot.stochD > 80) {
        reasons.push(`Stochastic overbought (K:${snapshot.stochK.toFixed(0)}, D:${snapshot.stochD.toFixed(0)})`);
      } else if (snapshot.stochK < 20 && snapshot.stochD < 20) {
        reasons.push(`Stochastic oversold (K:${snapshot.stochK.toFixed(0)}, D:${snapshot.stochD.toFixed(0)})`);
      }
    }

    // ── Volume reasons ──
    if (isFinite(snapshot.volume) && isFinite(snapshot.avgVolume) && snapshot.avgVolume > 0) {
      const volRatio = snapshot.volume / snapshot.avgVolume;
      if (volRatio > 1.5) {
        reasons.push(`Volume ${(volRatio * 100).toFixed(0)}% of average — unusually high volume confirms conviction`);
        keyFactors.push('High volume confirmation');
      } else if (volRatio > 1.2) {
        reasons.push(`Volume ${(volRatio * 100).toFixed(0)}% of average — above average volume`);
      } else if (volRatio < 0.5) {
        reasons.push(`Volume ${(volRatio * 100).toFixed(0)}% of average — low volume, weak conviction`);
      }
    }

    // ── Volatility reasons ──
    if (isFinite(snapshot.atr) && snapshot.close > 0) {
      const atrPct = (snapshot.atr / snapshot.close) * 100;
      if (atrPct > 4) {
        reasons.push(`ATR at ${atrPct.toFixed(2)}% of price — high volatility, wider stops recommended`);
        risks.push('High volatility may lead to false breakouts');
      } else if (atrPct < 1) {
        reasons.push(`ATR at ${atrPct.toFixed(2)}% of price — low volatility environment`);
      } else {
        reasons.push(`ATR at ${atrPct.toFixed(2)}% of price — normal volatility`);
      }
    }

    if (isFinite(snapshot.bollingerWidth)) {
      if (snapshot.bollingerWidth < 0.1) {
        reasons.push('Bollinger Bands unusually narrow — squeeze pattern, potential breakout');
        keyFactors.push('Bollinger Band squeeze — breakout imminent');
      } else if (snapshot.bollingerWidth > 0.5) {
        reasons.push('Bollinger Bands wide — high volatility, trend likely established');
      }
    }

    // ── Market structure reasons ──
    if (isFinite(snapshot.adx)) {
      if (snapshot.adx > 40) {
        reasons.push(`ADX at ${snapshot.adx.toFixed(1)} — very strong trend, follow trend direction`);
        keyFactors.push('Strong trend (ADX > 40)');
      } else if (snapshot.adx > 25) {
        reasons.push(`ADX at ${snapshot.adx.toFixed(1)} — moderate trend strength`);
      } else if (snapshot.adx < 20) {
        reasons.push(`ADX at ${snapshot.adx.toFixed(1)} — weak/no trend, range-bound conditions`);
        risks.push('ADX below 20 — weak/no trend direction');
      }
    }

    if (isFinite(snapshot.plusDI) && isFinite(snapshot.minusDI)) {
      if (snapshot.plusDI > snapshot.minusDI + 5) {
        reasons.push(`+DI (${snapshot.plusDI.toFixed(1)}) significantly above -DI (${snapshot.minusDI.toFixed(1)}) — strong buying pressure`);
      } else if (snapshot.minusDI > snapshot.plusDI + 5) {
        reasons.push(`-DI (${snapshot.minusDI.toFixed(1)}) significantly above +DI (${snapshot.plusDI.toFixed(1)}) — strong selling pressure`);
      }
    }

    if (isFinite(snapshot.bollingerUpper) && isFinite(snapshot.bollingerLower)) {
      const bbRange = snapshot.bollingerUpper - snapshot.bollingerLower;
      const upperDist = ((snapshot.bollingerUpper - snapshot.close) / bbRange) * 100;
      const lowerDist = ((snapshot.close - snapshot.bollingerLower) / bbRange) * 100;

      if (upperDist < 10) {
        reasons.push('Price near upper Bollinger Band — potential resistance zone');
      } else if (lowerDist < 10) {
        reasons.push('Price near lower Bollinger Band — potential support zone');
      }
    }

    // ── Overall summary ──
    if (reasons.length === 0) {
      reasons.push('Insufficient indicator data to generate detailed reasoning.');
    }

    // ── Key risks based on direction ──
    if (direction === 'BUY' || direction === 'STRONG_BUY') {
      if (isFinite(snapshot.rsi) && snapshot.rsi > 70) {
        risks.push('Overbought RSI may limit upside potential');
      }
      if (isFinite(snapshot.adx) && snapshot.adx < 20) {
        risks.push('Weak trend direction (low ADX) — trend may reverse or stall');
      }
      risks.push('Always use stop loss — market conditions can change rapidly');
    } else if (direction === 'SELL' || direction === 'STRONG_SELL') {
      if (isFinite(snapshot.rsi) && snapshot.rsi < 30) {
        risks.push('Oversold RSI may limit downside potential');
      }
      if (isFinite(snapshot.adx) && snapshot.adx < 20) {
        risks.push('Weak trend direction (low ADX) — trend may reverse or stall');
      }
      risks.push('Always use stop loss — market conditions can change rapidly');
    } else {
      risks.push('Conflicting signals across indicators — wait for clearer setup');
      risks.push('No dominant trend direction detected');
    }

    // Deduplicate
    const uniqueReasons = [...new Set(reasons)].slice(0, 10);
    const uniqueFactors = [...new Set(keyFactors)].slice(0, 5);
    const uniqueRisks = [...new Set(risks)].slice(0, 5);

    return {
      reasons: uniqueReasons,
      keyFactors: uniqueFactors,
      risks: uniqueRisks,
    };
  }
}
