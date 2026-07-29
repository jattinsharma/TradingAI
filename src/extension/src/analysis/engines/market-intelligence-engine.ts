/**
 * Market Intelligence Engine
 *
 * Converts technical analysis output into professional trading intelligence.
 * Explains WHY a trade exists instead of only giving BUY/SELL/HOLD.
 *
 * Integrates 4 sub-modules:
 *   ConfidenceExplainer   — explains how confidence was derived
 *   ReasonBuilder         — lists bullish/bearish factors
 *   RiskAnalyzer          — identifies specific risks and warnings
 *   SummaryGenerator      — generates summary, beginner & professional explanations
 *
 * Fully deterministic: same AnalysisOutput → same MarketIntelligenceOutput always.
 */

import { AnalysisOutput } from './technical-analysis-engine';
import { SignalScore } from './signal-scoring-engine';
import { ConfidenceExplainer, ConfidenceExplanation } from './confidence-explainer';
import { ReasonBuilder, ReasonFactors } from './reason-builder';
import { RiskAnalyzer, RiskAssessment } from './risk-analyzer';
import { SummaryGenerator, GeneratedSummaries } from './summary-generator';

export interface MarketIntelligenceOutput {
  summary: string;
  bullishFactors: string[];
  bearishFactors: string[];
  risks: string[];
  marketBias: ReasonFactors['marketBias'];
  biasReason: string;
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  volatilityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  tradeQuality: GeneratedSummaries['tradeQuality'];
  qualityReason: string;
  confidenceExplanation: ConfidenceExplanation;
  beginnerExplanation: string;
  professionalExplanation: string;
  warnings: RiskAssessment['warnings'];
  nextConfirmationNeeded: string[];
}

export class MarketIntelligenceEngine {
  private confidenceExplainer: ConfidenceExplainer;
  private reasonBuilder: ReasonBuilder;
  private riskAnalyzer: RiskAnalyzer;
  private summaryGenerator: SummaryGenerator;

  constructor() {
    this.confidenceExplainer = new ConfidenceExplainer();
    this.reasonBuilder = new ReasonBuilder();
    this.riskAnalyzer = new RiskAnalyzer();
    this.summaryGenerator = new SummaryGenerator();
  }

  /**
   * Generate complete market intelligence from technical analysis output.
   * @param output AnalysisOutput from TechnicalAnalysisEngine
   * @param score SignalScore from SignalScoringEngine (or build from output)
   */
  generate(output: AnalysisOutput, score?: SignalScore): MarketIntelligenceOutput {
    // Build a synthetic SignalScore if not provided (from output fields)
    const signalScore = score || this.buildSignalScoreFromOutput(output);

    // Step 1: Explain confidence in detail
    const confidenceExplanation = this.confidenceExplainer.explain(signalScore, output.indicatorSummary.adx);

    // Step 2: Build bullish/bearish factor lists
    const factors = this.reasonBuilder.build(output);

    // Step 3: Analyze risks
    const riskAssessment = this.riskAnalyzer.analyze(output);

    // Step 4: Generate summaries
    const summaries = this.summaryGenerator.generate(output, signalScore, factors);

    // Step 5: Determine trend strength
    const trendStrength = this.determineTrendStrength(output);

    // Step 6: Determine volatility level (compatible with existing output.volatility)
    const volatilityLevel = this.determineVolatilityLevel(output);

    return {
      summary: summaries.summary,
      bullishFactors: factors.bullish,
      bearishFactors: factors.bearish,
      risks: riskAssessment.specificRisks.map(r => `[${r.severity}] ${r.category}: ${r.description}`),
      marketBias: factors.marketBias,
      biasReason: factors.biasReason,
      trendStrength,
      volatilityLevel,
      tradeQuality: summaries.tradeQuality,
      qualityReason: summaries.qualityReason,
      confidenceExplanation,
      beginnerExplanation: summaries.beginnerExplanation,
      professionalExplanation: summaries.professionalExplanation,
      warnings: riskAssessment.warnings,
      nextConfirmationNeeded: riskAssessment.nextConfirmationNeeded,
    };
  }

  /**
   * Generate a SignalScore from indicator values when the real score isn't available.
   * This provides a reasonable approximation from the AnalysisOutput fields.
   */
  private buildSignalScoreFromOutput(output: AnalysisOutput): SignalScore {
    const ind = output.indicatorSummary;

    // Calculate approximate category scores from indicator values
    const trendScore = this.approximateTrendScore(output);
    const momentumScore = this.approximateMomentumScore(output);
    const volumeScore = this.approximateVolumeScore(output);
    const volatilityScore = this.approximateVolatilityScore(output);
    const marketStructureScore = this.approximateMarketStructureScore(output);

    const weights = { trend: 0.30, momentum: 0.25, volume: 0.20, volatility: 0.15, marketStructure: 0.10 };

    const netScore =
      trendScore * weights.trend +
      momentumScore * weights.momentum +
      volumeScore * weights.volume +
      volatilityScore * weights.volatility +
      marketStructureScore * weights.marketStructure;

    const clampedNet = Math.max(-1, Math.min(1, netScore));

    return {
      netScore: clampedNet,
      confidence: output.confidence,
      recommendation: output.recommendation,
      breakdown: {
        trend: { score: trendScore, weight: weights.trend },
        momentum: { score: momentumScore, weight: weights.momentum },
        volume: { score: volumeScore, weight: weights.volume },
        volatility: { score: volatilityScore, weight: weights.volatility },
        marketStructure: { score: marketStructureScore, weight: weights.marketStructure },
      },
    };
  }

  private approximateTrendScore(output: AnalysisOutput): number {
    let score = 0;
    let count = 0;
    const ind = output.indicatorSummary;

    if (isFinite(ind.sma20) && isFinite(ind.sma50) && ind.sma50 > 0) {
      score += Math.max(-1, Math.min(1, ((ind.sma20 - ind.sma50) / ind.sma50) * 20));
      count++;
    }
    if (isFinite(ind.ema12) && isFinite(ind.ema26) && ind.ema26 > 0) {
      score += Math.max(-1, Math.min(1, ((ind.ema12 - ind.ema26) / ind.ema26) * 20));
      count++;
    }
    return count > 0 ? Math.max(-1, Math.min(1, score / count)) : 0;
  }

  private approximateMomentumScore(output: AnalysisOutput): number {
    let score = 0;
    let count = 0;
    const ind = output.indicatorSummary;

    if (isFinite(ind.rsi)) {
      score += ind.rsi < 50 ? (50 - ind.rsi) / 50 : -(ind.rsi - 50) / 50;
      count++;
    }
    if (isFinite(ind.macdHistogram)) {
      score += ind.macdHistogram > 0 ? 0.3 : -0.3;
      count++;
    }
    return count > 0 ? Math.max(-1, Math.min(1, score / count)) : 0;
  }

  private approximateVolumeScore(output: AnalysisOutput): number {
    const ind = output.indicatorSummary;
    if (isFinite(ind.volume) && isFinite(ind.avgVolume) && ind.avgVolume > 0) {
      const ratio = ind.volume / ind.avgVolume;
      if (ratio > 1.5) return 0.5;
      if (ratio < 0.5) return -0.3;
    }
    return 0;
  }

  private approximateVolatilityScore(output: AnalysisOutput): number {
    const ind = output.indicatorSummary;
    if (isFinite(ind.atr)) {
      const price = ind.ema26 || ind.sma20 || 1;
      const pct = ind.atr / price;
      if (pct > 0.04) return -0.5;
      if (pct < 0.01) return 0.3;
    }
    return 0;
  }

  private approximateMarketStructureScore(output: AnalysisOutput): number {
    let score = 0;
    let count = 0;
    const ind = output.indicatorSummary;

    if (isFinite(ind.adx) && isFinite(ind.plusDI) && isFinite(ind.minusDI)) {
      if (ind.adx > 25) {
        score += ((ind.plusDI - ind.minusDI) / 100) * Math.min(1, (ind.adx - 25) / 25);
      }
      count++;
    }
    return count > 0 ? Math.max(-1, Math.min(1, score / count)) : 0;
  }

  private determineTrendStrength(output: AnalysisOutput): 'STRONG' | 'MODERATE' | 'WEAK' {
    const adx = output.indicatorSummary.adx;
    if (!isFinite(adx)) return 'WEAK';
    if (adx > 35) return 'STRONG';
    if (adx > 20) return 'MODERATE';
    return 'WEAK';
  }

  private determineVolatilityLevel(output: AnalysisOutput): 'HIGH' | 'MEDIUM' | 'LOW' {
    const ind = output.indicatorSummary;
    if (!isFinite(ind.atr)) return 'MEDIUM';
    const price = ind.ema26 || ind.sma20 || 1;
    const pct = ind.atr / price;
    if (pct > 0.03) return 'HIGH';
    if (pct < 0.01) return 'LOW';
    return 'MEDIUM';
  }
}
