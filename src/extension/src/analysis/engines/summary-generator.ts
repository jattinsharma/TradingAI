/**
 * Summary Generator
 *
 * Generates three levels of explanation from the AnalysisOutput:
 * 1. Summary — concise one-paragraph overview
 * 2. Beginner explanation — plain English, no jargon
 * 3. Professional explanation — technical, indicator-specific
 *
 * Fully deterministic: same input → same output always.
 * Every sentence is grounded in actual indicator values.
 */

import { AnalysisOutput } from './technical-analysis-engine';
import { SignalScore } from './signal-scoring-engine';
import { ReasonFactors } from './reason-builder';

export interface GeneratedSummaries {
  summary: string;
  beginnerExplanation: string;
  professionalExplanation: string;
  tradeQuality: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'AVOID';
  qualityReason: string;
}

export class SummaryGenerator {
  generate(output: AnalysisOutput, score: SignalScore, factors: ReasonFactors): GeneratedSummaries {
    const ind = output.indicatorSummary;
    const rec = output.recommendation;
    const conf = output.confidence;

    // ── Trade quality assessment ──
    const tradeQuality = this.assessQuality(output, score, factors);
    const qualityReason = this.qualityReasonText(tradeQuality, output, score);

    // ── Summary ──
    const summary = this.buildSummary(output, score, factors);

    // ── Beginner explanation ──
    const beginnerExplanation = this.buildBeginnerExplanation(output, factors);

    // ── Professional explanation ──
    const professionalExplanation = this.buildProfessionalExplanation(output, score);

    return {
      summary,
      beginnerExplanation,
      professionalExplanation,
      tradeQuality,
      qualityReason,
    };
  }

  private assessQuality(output: AnalysisOutput, score: SignalScore, factors: ReasonFactors): 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' | 'AVOID' {
    const conf = output.confidence;
    const rsi = output.indicatorSummary.rsi;
    const adx = output.indicatorSummary.adx;
    const rec = output.recommendation;

    // Excellent: strong conviction, strong trend, good R:R, low risk
    if (
      (rec === 'STRONG_BUY' || rec === 'STRONG_SELL') &&
      conf >= 80 &&
      isFinite(adx) && adx > 30 &&
      factors.conflicting.length <= 1 &&
      output.riskReward >= 2.0 &&
      isFinite(rsi) && rsi > 25 && rsi < 75
    ) {
      return 'EXCELLENT';
    }

    // Good: clear signal, moderate trend, acceptable R:R
    if (
      (rec === 'BUY' || rec === 'SELL') &&
      conf >= 60 &&
      isFinite(adx) && adx >= 20 &&
      output.riskReward >= 1.5 &&
      factors.conflicting.length <= 2
    ) {
      return 'GOOD';
    }

    // Poor: conflicting signals, weak trend, low confidence
    if (
      rec === 'HOLD' ||
      conf < 40 ||
      factors.conflicting.length >= 3 ||
      output.riskReward < 1.0
    ) {
      return 'POOR';
    }

    // Avoid: extreme conditions
    if (
      (isFinite(rsi) && (rsi > 90 || rsi < 10)) ||
      output.volatility === 'HIGH' && conf < 50
    ) {
      return 'AVOID';
    }

    return 'AVERAGE';
  }

  private qualityReasonText(quality: string, output: AnalysisOutput, score: SignalScore): string {
    switch (quality) {
      case 'EXCELLENT':
        return `All indicators align in direction. Strong trend (ADX ${output.indicatorSummary.adx.toFixed(1)}), high confidence (${output.confidence}%), and ${output.riskReward.toFixed(1)}:1 risk-reward ratio.`;
      case 'GOOD':
        return `Clear directional bias with ${output.confidence}% confidence. ${output.riskReward.toFixed(1)}:1 risk-reward. ${'Strong directional bias with reasonable risk-reward ratio.'}`;
      case 'AVERAGE':
        return `Moderate signal strength. ${output.confidence}% confidence with ${score.breakdown.momentum.score > 0.3 ? 'momentum' : 'trend'} as the primary driver. Monitor for confirmation.`;
      case 'POOR':
        return `Conflicting signals or weak conviction (${output.confidence}% confidence). Several indicators disagree on direction. Consider waiting for clearer setup.`;
      case 'AVOID':
        return `Unfavorable conditions for entry. High volatility or extreme indicator readings make this setup risky. Wait for better conditions.`;
      default:
        return `Signal quality assessment based on ${output.confidence}% confidence and indicator agreement.`;
    }
  }

  private buildSummary(output: AnalysisOutput, score: SignalScore, factors: ReasonFactors): string {
    const rec = output.recommendation;
    const conf = output.confidence;
    const dir = rec === 'STRONG_BUY' || rec === 'BUY' ? 'bullish' :
                rec === 'STRONG_SELL' || rec === 'SELL' ? 'bearish' : 'neutral/hold';
    const rsi = isFinite(output.indicatorSummary.rsi) ? `RSI at ${output.indicatorSummary.rsi.toFixed(1)}` : 'No RSI data';
    const adx = isFinite(output.indicatorSummary.adx) ? `ADX at ${output.indicatorSummary.adx.toFixed(1)}` : 'No trend data';
    const bullishCount = factors.bullish.length;
    const bearishCount = factors.bearish.length;

    return `${output.symbol} on ${output.timeframe}: ${rec} (${conf}% confidence). ` +
           `Market bias is ${dir} with ${bullishCount} bullish and ${bearishCount} bearish signals. ` +
           `${rsi}. ${adx}. ` +
           (output.entryPrice > 0 && output.stopLoss > 0
             ? `Trade setup: entry at ${output.entryPrice}, stop at ${output.stopLoss}, target ${output.takeProfit1}. R:R ${output.riskReward.toFixed(1)}:1. `
             : `No trade setup generated — ${output.recommendation === 'HOLD' ? 'action is wait' : 'insufficient levels'}. `) +
           `Volatility: ${output.volatility}. ` +
           (output.risks.length > 0 ? `${output.risks.length} risk factor${output.risks.length !== 1 ? 's' : ''} identified.` : '');
  }

  private buildBeginnerExplanation(output: AnalysisOutput, factors: ReasonFactors): string {
    const rec = output.recommendation;
    const dir = rec === 'STRONG_BUY' || rec === 'BUY' ? 'up' :
                rec === 'STRONG_SELL' || rec === 'SELL' ? 'down' : 'sideways';

    if (dir === 'up') {
      let explanation = `The market for ${output.symbol} is currently moving upward. ` +
        `Our analysis suggests that buyers have the upper hand right now, ` +
        `with a confidence level of ${output.confidence}%. `;

      if (output.entryPrice > 0 && output.stopLoss > 0) {
        explanation += `If you decide to trade, a reasonable entry point would be around ${output.entryPrice}, ` +
          `with a stop loss at ${output.stopLoss} to limit potential losses, ` +
          `and a target profit at ${output.takeProfit1}. `;
      }

      explanation += `The risk-reward ratio is ${output.riskReward.toFixed(1)}:1, ` +
        `meaning the potential profit is ${output.riskReward.toFixed(1)} times the potential loss. `;

      if (output.volatility === 'HIGH') {
        explanation += `However, volatility is currently high, which means prices can swing dramatically. ` +
          `Consider using smaller position sizes than usual. `;
      }

      explanation += `Remember: never risk more than you can afford to lose, and always use a stop loss.`;

      return explanation;
    }

    if (dir === 'down') {
      let explanation = `The market for ${output.symbol} is currently moving downward. ` +
        `Our analysis indicates that sellers are in control at the moment, ` +
        `with a confidence level of ${output.confidence}%. `;

      if (output.entryPrice > 0 && output.stopLoss > 0) {
        explanation += `If you decide to take a short position, a reasonable entry would be around ${output.entryPrice}, ` +
          `with a stop loss at ${output.stopLoss} and a profit target at ${output.takeProfit1}. `;
      }

      explanation += `The risk-reward ratio is ${output.riskReward.toFixed(1)}:1. `;

      if (output.volatility === 'HIGH') {
        explanation += `Volatility is elevated, so prices could move sharply. ` +
          `Consider reducing your position size. `;
      }

      explanation += `Always use stop losses and never risk more than you can afford to lose.`;

      return explanation;
    }

    // HOLD / neutral
    return `The market for ${output.symbol} does not have a clear direction right now. ` +
      `Our analysis shows ${factors.bullish.length} bullish signals and ${factors.bearish.length} bearish signals, ` +
      `but neither side has a strong advantage. ` +
      (output.confidence > 0
        ? `Confidence is at ${output.confidence}%, which is not high enough for a clear signal. `
        : ``) +
      `It's often best to wait on the sidelines until the market shows a clearer direction. ` +
      `This is normal — successful traders don't need to trade every opportunity. ` +
      `Patience is a key trading skill.`;
  }

  private buildProfessionalExplanation(output: AnalysisOutput, score: SignalScore): string {
    const ind = output.indicatorSummary;
    const parts: string[] = [];

    // Trend setup
    const trendParts: string[] = [];
    if (isFinite(ind.sma20) && isFinite(ind.sma50) && ind.sma50 > 0) {
      if (ind.sma20 > ind.sma50) trendParts.push('SMA20 above SMA50 (bullish MA alignment)');
      else trendParts.push('SMA20 below SMA50 (bearish MA alignment)');
    }
    if (isFinite(ind.ema12) && isFinite(ind.ema26) && ind.ema26 > 0) {
      if (ind.ema12 > ind.ema26) trendParts.push('EMA12 > EMA26 (bullish)');
      else if (ind.ema12 < ind.ema26) trendParts.push('EMA12 < EMA26 (bearish)');
    }
    if (trendParts.length > 0) {
      parts.push(`Trend structure: ${trendParts.join('; ')}.`);
    }

    // Momentum
    const momParts: string[] = [];
    if (isFinite(ind.rsi)) {
      momParts.push(`RSI(${ind.rsi.toFixed(1)})`);
    }
    if (isFinite(ind.macd) && isFinite(ind.macdSignal)) {
      momParts.push(`MACD ${ind.macd > ind.macdSignal ? '> signal (bullish)' : '< signal (bearish)'}`);
    }
    if (isFinite(ind.macdHistogram)) {
      momParts.push(`histogram ${ind.macdHistogram > 0 ? 'expanding' : 'contracting'}`);
    }
    if (isFinite(ind.stochK) && isFinite(ind.stochD)) {
      momParts.push(`Stoch(${ind.stochK.toFixed(0)}/${ind.stochD.toFixed(0)})`);
    }
    if (momParts.length > 0) {
      parts.push(`Momentum: ${momParts.join(', ')}.`);
    }

    // Volume
    if (isFinite(ind.volume) && isFinite(ind.avgVolume) && ind.avgVolume > 0) {
      const volRatio = ind.volume / ind.avgVolume;
      parts.push(`Volume at ${(volRatio * 100).toFixed(0)}% of 20-bar average.`);
    }

    // Volatility
    if (isFinite(ind.atr)) {
      const price = ind.ema26 || ind.sma20 || 1;
      const atrPct = (ind.atr / price) * 100;
      parts.push(`ATR(${atrPct.toFixed(2)}% of price) suggests ${atrPct > 2.5 ? 'elevated' : 'normal'} volatility.`);
    }

    // ADX trend strength
    if (isFinite(ind.adx)) {
      if (ind.adx > 40) {
        parts.push(`ADX(${ind.adx.toFixed(1)}) confirms very strong directional trend.`);
      } else if (ind.adx > 25) {
        parts.push(`ADX(${ind.adx.toFixed(1)}) confirms trending conditions.`);
      } else {
        parts.push(`ADX(${ind.adx.toFixed(1)}) suggests ranging/non-trending conditions.`);
      }
    }

    // Pattern
    if (output.patterns && output.patterns.patterns) {
      const patterns = output.patterns.patterns.filter(p => p !== 'NONE' && p !== 'INSUFFICIENT_DATA');
      if (patterns.length > 0) {
        parts.push(`Candlestick: ${patterns.join(', ')}.`);
      }
    }

    // Recommendation
    parts.push(`Overall: ${output.recommendation} with ${output.confidence}% confidence.`);
    parts.push(`Trade setup: ${output.riskReward.toFixed(1)}:1 R:R at ${output.entryPrice}, SL ${output.stopLoss}, TP ${output.takeProfit1}.`);

    return parts.join(' ');
  }
}
