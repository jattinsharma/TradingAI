/**
 * Risk Analyzer
 *
 * Analyzes specific risks from the AnalysisOutput:
 * - Volatility risk (ATR-based)
 * - Trend weakness (ADX-based)
 * - Conflicting signal risk
 * - Volume/liquidity risk
 * - Bollinger Band position risk
 * - Pattern reversal risk
 *
 * Fully deterministic: same input → same risks always.
 * Every warning is grounded in actual data.
 */

import { AnalysisOutput } from './technical-analysis-engine';

export interface RiskAssessment {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  score: number;           // 0-100
  specificRisks: {
    category: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
    value: string;
  }[];
  warnings: {
    type: 'VOLATILITY' | 'TREND' | 'CONFLICT' | 'LIQUIDITY' | 'LEVEL' | 'PATTERN' | 'GENERAL';
    severity: 'INFO' | 'WARNING' | 'ALERT';
    message: string;
  }[];
  nextConfirmationNeeded: string[];
  confidenceReliability: 'HIGH' | 'MEDIUM' | 'LOW';
}

export class RiskAnalyzer {
  analyze(output: AnalysisOutput): RiskAssessment {
    const specificRisks: RiskAssessment['specificRisks'] = [];
    const warnings: RiskAssessment['warnings'] = [];
    const nextConfirmations: string[] = [];
    const ind = output.indicatorSummary;

    // ── 1. Volatility risk ──
    if (isFinite(ind.atr)) {
      const price = ind.ema26 || ind.sma20 || 1;
      const atrPct = (ind.atr / price) * 100;
      if (atrPct > 4) {
        specificRisks.push({
          category: 'Volatility',
          severity: 'HIGH',
          description: `Extreme volatility: ATR is ${atrPct.toFixed(2)}% of price. Wide stop losses required. Risk of false breakouts.`,
          value: `${atrPct.toFixed(2)}%`,
        });
        warnings.push({
          type: 'VOLATILITY',
          severity: 'ALERT',
          message: `High volatility (ATR ${atrPct.toFixed(2)}%) — consider position size reduction`,
        });
      } else if (atrPct > 2.5) {
        specificRisks.push({
          category: 'Volatility',
          severity: 'MEDIUM',
          description: `Elevated volatility: ATR is ${atrPct.toFixed(2)}% of price. Use appropriate position sizing.`,
          value: `${atrPct.toFixed(2)}%`,
        });
        warnings.push({
          type: 'VOLATILITY',
          severity: 'WARNING',
          message: `Moderate-high volatility (ATR ${atrPct.toFixed(2)}%)`,
        });
      }
    }

    // ── 2. Trend weakness risk ──
    if (isFinite(ind.adx)) {
      if (ind.adx < 20) {
        specificRisks.push({
          category: 'Trend Strength',
          severity: 'HIGH',
          description: `ADX ${ind.adx.toFixed(1)} — no clear trend direction. Market may be ranging. Trend-following strategies may produce false signals.`,
          value: `${ind.adx.toFixed(1)}`,
        });
        warnings.push({
          type: 'TREND',
          severity: 'WARNING',
          message: `Low ADX (${ind.adx.toFixed(1)}) — ranging market, avoid trend-following entries`,
        });
        nextConfirmations.push('Wait for ADX to rise above 25 before entering trend trades');
      } else if (ind.adx > 40) {
        // Strong trend but overextended
        warnings.push({
          type: 'TREND',
          severity: 'INFO',
          message: `Strong trend (ADX ${ind.adx.toFixed(1)}) — trend may be overextended`,
        });
      }
    }

    // ── 3. Signal conflict risk ──
    const trendSignals = this.countTrendSignals(output);
    const momentumSignals = this.countMomentumSignals(output);
    const totalBullish = trendSignals.bullish + momentumSignals.bullish;
    const totalBearish = trendSignals.bearish + momentumSignals.bearish;

    if (trendSignals.bullish > 1 && momentumSignals.bearish > 1) {
      specificRisks.push({
        category: 'Signal Conflict',
        severity: 'MEDIUM',
        description: `Trend signals bullish (${trendSignals.bullish}) but momentum signals bearish (${momentumSignals.bearish}). Trend direction and momentum are diverging.`,
        value: `T:${trendSignals.bullish}B/${trendSignals.bearish}S | M:${momentumSignals.bullish}B/${momentumSignals.bearish}S`,
      });
      warnings.push({
        type: 'CONFLICT',
        severity: 'WARNING',
        message: 'Trend and momentum signals conflict — wait for alignment',
      });
      nextConfirmations.push('Wait for trend and momentum to align before entering');
    } else if (trendSignals.bearish > 1 && momentumSignals.bullish > 1) {
      specificRisks.push({
        category: 'Signal Conflict',
        severity: 'MEDIUM',
        description: `Trend signals bearish but momentum signals bullish. Potential trend reversal may be forming.`,
        value: `T:${trendSignals.bullish}B/${trendSignals.bearish}S | M:${momentumSignals.bullish}B/${momentumSignals.bearish}S`,
      });
      warnings.push({
        type: 'CONFLICT',
        severity: 'WARNING',
        message: 'Trend and momentum diverge — potential reversal zone',
      });
      nextConfirmations.push('Watch for trend confirmation before following momentum');
    }

    // ── 4. Volume/liquidity risk ──
    if (isFinite(ind.volume) && isFinite(ind.avgVolume) && ind.avgVolume > 0) {
      const volRatio = ind.volume / ind.avgVolume;
      if (volRatio < 0.5) {
        specificRisks.push({
          category: 'Liquidity',
          severity: 'HIGH',
          description: `Volume is ${(volRatio * 100).toFixed(0)}% of average — very low participation. Prices may not reflect true market value. Slippage risk.`,
          value: `${(volRatio * 100).toFixed(0)}%`,
        });
        warnings.push({
          type: 'LIQUIDITY',
          severity: 'ALERT',
          message: `Low volume (${(volRatio * 100).toFixed(0)}% of avg) — increased slippage risk`,
        });
      } else if (volRatio < 0.8) {
        warnings.push({
          type: 'LIQUIDITY',
          severity: 'INFO',
          message: `Below-average volume (${(volRatio * 100).toFixed(0)}% of avg)`,
        });
      }
    }

    // ── 5. Bollinger Band position risk ──
    if (isFinite(ind.bollingerUpper) && isFinite(ind.bollingerLower)) {
      const range = ind.bollingerUpper - ind.bollingerLower;
      if (range > 0) {
        const price = ind.ema26 || ind.sma20 || 0;
        const upperDist = ((ind.bollingerUpper - price) / range) * 100;
        const lowerDist = ((price - ind.bollingerLower) / range) * 100;

        if (upperDist < 5) {
          specificRisks.push({
            category: 'Resistance',
            severity: 'MEDIUM',
            description: `Price at upper Bollinger Band — risk of rejection/resistance. Wait for confirmed breakout.`,
            value: `${upperDist.toFixed(1)}% from upper band`,
          });
          warnings.push({
            type: 'LEVEL',
            severity: 'INFO',
            message: 'Price at upper Bollinger Band — resistance zone',
          });
          nextConfirmations.push('Wait for confirmed breakout above Bollinger upper band');
        } else if (lowerDist < 5) {
          specificRisks.push({
            category: 'Support',
            severity: 'MEDIUM',
            description: `Price at lower Bollinger Band — potential support bounce or breakdown.`,
            value: `${lowerDist.toFixed(1)}% from lower band`,
          });
          warnings.push({
            type: 'LEVEL',
            severity: 'INFO',
            message: 'Price at lower Bollinger Band — support zone',
          });
          nextConfirmations.push('Watch for bounce or continuation below lower band');
        }
      }
    }

    // ── 6. RSI extreme risk ──
    if (isFinite(ind.rsi)) {
      if (ind.rsi > 85) {
        warnings.push({
          type: 'GENERAL',
          severity: 'WARNING',
          message: `RSI ${ind.rsi.toFixed(0)} — deeply overbought, reversal likely`,
        });
        nextConfirmations.push('Wait for RSI to retreat below 70 before considering new entries in direction');
      } else if (ind.rsi < 15) {
        warnings.push({
          type: 'GENERAL',
          severity: 'WARNING',
          message: `RSI ${ind.rsi.toFixed(0)} — deeply oversold, bounce likely`,
        });
        nextConfirmations.push('Watch for RSI to exit oversold territory above 30 as confirmation');
      }
    }

    // ── 7. Pattern risk ──
    if (output.patterns && output.patterns.signal === 'BEARISH' && output.recommendation === 'BUY') {
      specificRisks.push({
        category: 'Pattern Divergence',
        severity: 'HIGH',
        description: `Bearish candlestick pattern (${output.patterns.patterns.filter(p => p !== 'NONE').join(', ')}) detected while recommendation is BUY. Pattern suggests caution.`,
        value: output.patterns.patterns.filter(p => p !== 'NONE').join(', '),
      });
      warnings.push({
        type: 'PATTERN',
        severity: 'WARNING',
        message: 'Bearish candlestick pattern contradicts buy signal',
      });
    } else if (output.patterns && output.patterns.signal === 'BULLISH' && output.recommendation === 'SELL') {
      specificRisks.push({
        category: 'Pattern Divergence',
        severity: 'HIGH',
        description: `Bullish candlestick pattern detected while recommendation is SELL. Pattern suggests caution.`,
        value: output.patterns.patterns.filter(p => p !== 'NONE').join(', '),
      });
      warnings.push({
        type: 'PATTERN',
        severity: 'WARNING',
        message: 'Bullish candlestick pattern contradicts sell signal',
      });
    }

    // ── Aggregate risk level ──
    const highCount = specificRisks.filter(r => r.severity === 'HIGH').length;
    const medCount = specificRisks.filter(r => r.severity === 'MEDIUM').length;
    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    let score: number;
    let confidenceReliability: 'HIGH' | 'MEDIUM' | 'LOW';

    if (highCount >= 3) {
      level = 'EXTREME';
      score = 85;
      confidenceReliability = 'LOW';
    } else if (highCount >= 1) {
      level = 'HIGH';
      score = 65;
      confidenceReliability = 'MEDIUM';
    } else if (medCount >= 2) {
      level = 'MEDIUM';
      score = 50;
      confidenceReliability = 'MEDIUM';
    } else if (medCount >= 1) {
      level = 'MEDIUM';
      score = 30;
      confidenceReliability = 'HIGH';
    } else {
      level = 'LOW';
      score = 15;
      confidenceReliability = 'HIGH';
    }

    // Deduplicate next confirmations
    const uniqueConfirmations = [...new Set(nextConfirmations)];

    return {
      level,
      score,
      specificRisks,
      warnings,
      nextConfirmationNeeded: uniqueConfirmations,
      confidenceReliability,
    };
  }

  private countTrendSignals(output: AnalysisOutput): { bullish: number; bearish: number } {
    const ind = output.indicatorSummary;
    let bullish = 0;
    let bearish = 0;

    if (isFinite(ind.sma20) && isFinite(ind.sma50) && ind.sma50 > 0) {
      if (ind.sma20 > ind.sma50 * 1.001) bullish++;
      else if (ind.sma20 < ind.sma50 * 0.999) bearish++;
    }
    if (isFinite(ind.ema12) && isFinite(ind.ema26) && ind.ema26 > 0) {
      if (ind.ema12 > ind.ema26) bullish++;
      else if (ind.ema12 < ind.ema26) bearish++;
    }
    if (isFinite(ind.vwap) && output.indicatorSummary.ema26 > 0 && ind.vwap > 0) {
      const price = ind.ema26;
      if (price > ind.vwap) bullish++;
      else if (price < ind.vwap) bearish++;
    }

    return { bullish, bearish };
  }

  private countMomentumSignals(output: AnalysisOutput): { bullish: number; bearish: number } {
    const ind = output.indicatorSummary;
    let bullish = 0;
    let bearish = 0;

    if (isFinite(ind.rsi)) {
      if (ind.rsi > 60) bullish++;
      else if (ind.rsi < 40) bearish++;
    }
    if (isFinite(ind.macd) && isFinite(ind.macdSignal)) {
      if (ind.macd > ind.macdSignal) bullish++;
      else if (ind.macd < ind.macdSignal) bearish++;
    }
    if (isFinite(ind.macdHistogram)) {
      if (ind.macdHistogram > 0) bullish++;
      else if (ind.macdHistogram < 0) bearish++;
    }

    return { bullish, bearish };
  }
}
