/**
 * Confidence Explainer
 *
 * Takes the SignalScore breakdown and produces a human-readable explanation
 * of how each category contributed to the final confidence score.
 *
 * Fully deterministic: same breakdown → same explanation always.
 * No templates. Every line is built from the actual scores.
 */

import { SignalScore } from './signal-scoring-engine';

export interface ConfidenceExplanation {
  summary: string;
  categoryScores: {
    trend: { raw: number; weighted: number; label: string };
    momentum: { raw: number; weighted: number; label: string };
    volume: { raw: number; weighted: number; label: string };
    volatility: { raw: number; weighted: number; label: string };
    marketStructure: { raw: number; weighted: number; label: string };
  };
  totalScore: number;
  adjustments: string[];
  finalConfidence: number;
}

export class ConfidenceExplainer {
  explain(score: SignalScore, adx: number): ConfidenceExplanation {
    const { breakdown, netScore, confidence } = score;

    const trend = this.explainCategory('Trend', breakdown.trend.score, breakdown.trend.weight);
    const momentum = this.explainCategory('Momentum', breakdown.momentum.score, breakdown.momentum.weight);
    const volume = this.explainCategory('Volume', breakdown.volume.score, breakdown.volume.weight);
    const volatility = this.explainCategory('Volatility', breakdown.volatility.score, breakdown.volatility.weight);
    const marketStructure = this.explainCategory('Market Structure', breakdown.marketStructure.score, breakdown.marketStructure.weight);

    const adjustments: string[] = [];

    // ADX adjustment explanation
    if (isFinite(adx)) {
      if (adx < 20) {
        adjustments.push(`ADX (${adx.toFixed(1)}) below 20: weak/no trend — confidence reduced by ~10%`);
      } else if (adx > 40) {
        adjustments.push(`ADX (${adx.toFixed(1)}) above 40: very strong trend — confidence maintained`);
      }
    }

    // Net score explanation
    const absScore = Math.abs(netScore);
    if (absScore < 0.10) {
      adjustments.push('Net score near zero: conflicting signals across categories — HOLD recommended');
    } else if (absScore < 0.25) {
      adjustments.push(`Net score ${netScore > 0 ? '+' : ''}${(netScore * 100).toFixed(0)}: moderate signal — directional bias present`);
    } else if (absScore > 0.40) {
      adjustments.push(`Net score ${netScore > 0 ? '+' : ''}${(netScore * 100).toFixed(0)}: strong signal — high conviction in direction`);
    }

    if (adjustments.length === 0) {
      adjustments.push('No significant adjustments — confidence reflects raw indicator agreement');
    }

    const totalRaw =
      trend.weighted +
      momentum.weighted +
      volume.weighted +
      volatility.weighted +
      marketStructure.weighted;

    return {
      summary: `Confidence of ${confidence}% derived from ${trend.label}, ${momentum.label}, ${volume.label}, ${volatility.label}, and ${marketStructure.label} indicators.`,
      categoryScores: {
        trend,
        momentum,
        volume,
        volatility,
        marketStructure,
      },
      totalScore: Math.round(totalRaw * 100),
      adjustments,
      finalConfidence: confidence,
    };
  }

  private explainCategory(name: string, rawScore: number, weight: number): { raw: number; weighted: number; label: string } {
    const raw = clampSigned(rawScore);
    const weighted = clampSigned(rawScore * weight / 0.2); // normalize to 0.2 avg weight

    let label: string;
    if (raw > 0.5) {
      label = `strongly ${name.toLowerCase() === 'volatility' ? 'favorable' : 'bullish'}`;
    } else if (raw > 0.15) {
      label = `moderately ${name.toLowerCase() === 'volatility' ? 'favorable' : 'bullish'}`;
    } else if (raw > -0.15) {
      label = 'neutral';
    } else if (raw > -0.5) {
      label = `moderately ${name.toLowerCase() === 'volatility' ? 'unfavorable' : 'bearish'}`;
    } else {
      label = `strongly ${name.toLowerCase() === 'volatility' ? 'unfavorable' : 'bearish'}`;
    }

    return {
      raw: Math.round(raw * 100) / 100,
      weighted: Math.round(weighted * 100) / 100,
      label,
    };
  }
}

function clampSigned(v: number): number {
  return Math.max(-1, Math.min(1, v));
}
