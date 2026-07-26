// AI Explanation Engine
export class AIExplanationEngine {
  async analyze(
    symbol: string,
    timeframe: string,
    analysisResults: {
      technical: any;
      pattern: any;
      trend: any;
      supportResistance: any;
      volume: any;
      momentum: any;
      risk: any;
      portfolio: any;
      tradePlanning: any;
    }
  ): Promise<any> {
    // Simulate AI explanation generation
    await new Promise(resolve => setTimeout(resolve, 60));

    // Generate a comprehensive explanation based on all analyses
    const explanation = this.generateComprehensiveExplanation(
      symbol,
      timeframe,
      analysisResults
    );

    // Generate a confidence score based on agreement between analyses
    const consensusScore = this.calculateConsensusScore(analysisResults);

    return {
      explanation,
      confidence: consensusScore,
      keyFactors: this.extractKeyFactors(analysisResults),
      risks: this.identifyRisks(analysisResults),
      timeframeSuitability: this.assessTimeframeSuitability(
        timeframe,
        analysisResults
      )
    };
  }

  private generateComprehensiveExplanation(
    symbol: string,
    timeframe: string,
    results: any
  ): string {
    const {
      technical,
      pattern,
      trend,
      supportResistance,
      volume,
      momentum,
      risk,
      portfolio
    } = results;

    // Safely access levels (supportResistance.levels is the correct path)
    const srLevels = supportResistance?.levels || {};
    const safeResistance1 = srLevels.resistance1;
    const safeSupport1 = srLevels.support1;

    let explanation = `Analysis for ${symbol} on ${timeframe} timeframe:\n\n`;

    // Technical summary
    explanation += `Technical Indicators: ${technical.signal} signal with ${
      Math.round(technical.strength * 100)
    }% strength. `;

    // Trend summary
    explanation += `Trend: ${trend.signal} with ${
      Math.round(trend.strength * 100)
    }% strength. `;

    // Momentum summary
    explanation += `Momentum: ${momentum.signal} with ${
      Math.round(momentum.strength * 100)
    }% strength. `;

    // Volume confirmation
    explanation += `Volume: ${volume.signal} (${Math.round(
      volume.strength * 100
    )}% strength), which `;
    explanation +=
      volume.signal === 'HIGH'
        ? 'confirms the price movement.'
        : volume.signal === 'LOW'
          ? 'suggests weak conviction behind the move.'
          : 'is at average levels.';

    // Support/Resistance
    explanation += ` Key levels: Resistance at ${
      typeof safeResistance1 === 'number' && Number.isFinite(safeResistance1) ? safeResistance1.toFixed(2) : 'N/A'
    }, Support at ${
      typeof safeSupport1 === 'number' && Number.isFinite(safeSupport1) ? safeSupport1.toFixed(2) : 'N/A'
    }.`;

    // Risk assessment
    explanation += `\n\nRisk Assessment: ${risk.riskLevel} risk level (${
      Math.round(risk.riskScore * 100)
    }% risk score). `;

    // Portfolio fit
    explanation += `Portfolio Fit: ${portfolio.signal} signal for diversification with ${
      Math.round(portfolio.strength * 100)
    }% strength.`;

    // Overall summary
    explanation += `\n\nBased on the confluence of factors, the overall bias is `;
    explanation += this.calculateOverallBias(results) + `.`;

    return explanation;
  }

  private calculateConsensusScore(results: any): number {
    // Calculate how much the different analyses agree with each other
    const signals = [
      results.technical.signal,
      results.pattern.signal,
      results.trend.signal,
      results.momentum.signal
    ];

    // Count bullish vs bearish signals
    let bullishCount = 0;
    let bearishCount = 0;

    signals.forEach(signal => {
      if (signal === 'BUY' || signal === 'UP') bullishCount++;
      if (signal === 'SELL' || signal === 'DOWN') bearishCount++;
    });

    const totalSignals = signals.length;
    const consensus = Math.max(bullishCount, bearishCount) / totalSignals;

    // Convert to confidence score (0.5 = no consensus, 1.0 = full consensus)
    return 0.5 + consensus * 0.5;
  }

  private extractKeyFactors(results: any): string[] {
    const factors: string[] = [];

    // Add factors from each analysis that have strong signals
    if (results.technical.strength > 0.7) {
      factors.push(
        `Strong technical signal: ${results.technical.signal} (${
          Math.round(results.technical.strength * 100)
        }% strength)`
      );
    }

    if (results.trend.strength > 0.7) {
      factors.push(
        `Strong trend: ${results.trend.signal} (${
          Math.round(results.trend.strength * 100)
        }% strength)`
      );
    }

    if (results.momentum.strength > 0.7) {
      factors.push(
        `Strong momentum: ${results.momentum.signal} (${
          Math.round(results.momentum.strength * 100)
        }% strength)`
      );
    }

    if (results.volume.signal === 'HIGH' && results.volume.strength > 0.6) {
      factors.push(
        `High volume confirmation: ${Math.round(
          results.volume.strength * 100
        )}% strength`
      );
    }

    if (results.pattern.signal !== 'NEUTRAL' && results.pattern.strength > 0.6) {
      factors.push(
        `Pattern recognition: ${results.pattern.signal} pattern detected (${
          Math.round(results.pattern.strength * 100)
        }% confidence)`
      );
    }

    return factors;
  }

  private identifyRisks(results: any): string[] {
    const risks: string[] = [];

    // Risk from volatility
    if (results.risk.riskScore > 0.7) {
      risks.push(
        `High risk: ${Math.round(
          results.risk.riskScore * 100
        )}% risk score based on volatility and drawdown analysis`
      );
    }

    // Risk from poor risk-reward
    const tp = results.tradePlanning;
    const tradeSetup = tp?.tradeSetup;
    const riskRewardRatio =
      tradeSetup && typeof tradeSetup.riskRewardRatio === 'number' && Number.isFinite(tradeSetup.riskRewardRatio)
        ? tradeSetup.riskRewardRatio
        : null;
    if (riskRewardRatio !== null && riskRewardRatio < 1.5) {
      risks.push(
        `Unfavorable risk-reward ratio: ${riskRewardRatio.toFixed(2)}:1`
      );
    }

    // Risk from conflicting signals
    const signals = [
      results.technical.signal,
      results.pattern.signal,
      results.trend.signal,
      results.momentum.signal
    ];
    const bullish = signals.filter(
      s => s === 'BUY' || s === 'UP'
    ).length;
    const bearish = signals.filter(
      s => s === 'SELL' || s === 'DOWN'
    ).length;

    if (bullish > 0 && bearish > 0 && Math.abs(bullish - bearish) <= 1) {
      risks.push('Conflicting signals across different analysis methods');
    }

    // Risk from low volume
    if (results.volume.signal === 'LOW' && results.volume.strength > 0.6) {
      risks.push(
        `Low volume suggests weak conviction: ${Math.round(
          results.volume.strength * 100
        )}% strength`
      );
    }

    return risks;
  }

  private assessTimeframeSuitability(timeframe: string, results: any): string {
    // Assess how suitable the current signal is for the given timeframe
    const volatility = results.risk.metrics?.volatility || 0.02;

    // Short timeframes need higher volatility and momentum
    if (timeframe === '15m' || timeframe === '1h') {
      if (results.momentum.strength > 0.6 && volatility > 0.025) {
        return 'Well-suited for short-term trading';
      } else if (results.momentum.strength < 0.4) {
        return 'Weak momentum for short-term trading';
      }
    }
    // Medium timeframes
    else if (timeframe === '4h' || timeframe === '1D') {
      if (results.trend.strength > 0.5) {
        return 'Good trend alignment for medium-term';
      } else {
        return 'Unclear trend direction for medium-term holding';
      }
    }
    // Long timeframes
    else {
      if (
        results.fundamental &&
        results.fundamental.score > 0.6
      ) {
        return 'Strong fundamentals support long-term holding';
      } else if (results.volatility > 0.03) {
        return 'High volatility may be unsuitable for long-term holding';
      }
    }

    return 'Neutral suitability for this timeframe';
  }

  private calculateOverallBias(results: any): string {
    // Calculate overall bias from all signals
    let bullishScore = 0;
    let bearishScore = 0;

    // Technical
    if (results.technical.signal === 'BUY') {
      bullishScore += results.technical.strength * 0.2;
    } else if (results.technical.signal === 'SELL') {
      bearishScore += results.technical.strength * 0.2;
    }

    // Trend
    if (results.trend.signal === 'UP') {
      bullishScore += results.trend.strength * 0.25;
    } else if (results.trend.signal === 'DOWN') {
      bearishScore += results.trend.strength * 0.25;
    }

    // Momentum
    if (results.momentum.signal === 'UP') {
      bullishScore += results.momentum.strength * 0.2;
    } else if (results.momentum.signal === 'DOWN') {
      bearishScore += results.momentum.strength * 0.2;
    }

    // Volume (confirmatory)
    if (
      (results.volume.signal === 'HIGH' &&
       ((bullishScore > bearishScore && results.volume.signal !== 'NEUTRAL') ||
        (bearishScore > bullishScore && results.volume.signal !== 'NEUTRAL')))
    ) {
      const boost = results.volume.strength * 0.1;
      if (bullishScore > bearishScore) {
        bullishScore += boost;
      } else if (bearishScore > bullishScore) {
        bearishScore += boost;
      }
    }

    // Pattern
    if (results.pattern.signal === 'BULLISH') {
      bullishScore += results.pattern.strength * 0.15;
    } else if (results.pattern.signal === 'BEARISH') {
      bearishScore += results.pattern.strength * 0.15;
    }

    // Determine final bias
    const netScore = bullishScore - bearishScore;

    if (netScore > 0.2) {
      return 'bullish';
    } else if (netScore < -0.2) {
      return 'bearish';
    } else {
      return 'neutral/ mixed';
    }
  }
}