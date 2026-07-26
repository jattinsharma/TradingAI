// Analysis orchestrator - coordinates different analysis engines
import { TechnicalAnalysisEngine } from './engines/technical-analysis-engine';
import { PatternRecognitionEngine } from './engines/pattern-recognition-engine';
import { TrendAnalysisEngine } from './engines/trend-analysis-engine';
import { SupportResistanceEngine } from './engines/support-resistance-engine';
import { VolumeAnalysisEngine } from './engines/volume-analysis-engine';
import { MomentumAnalysisEngine } from './engines/momentum-analysis-engine';
import { NewsAnalysisEngine } from './engines/news-analysis-engine';
import { SentimentAnalysisEngine } from './engines/sentiment-analysis-engine';
import { RiskAnalysisEngine } from './engines/risk-analysis-engine';
import { PortfolioAnalysisEngine } from './engines/portfolio-analysis-engine';
import { TradePlanningEngine } from './engines/trade-planning-engine';
import { AIExplanationEngine } from './engines/ai-explanation-engine';

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
  private patternEngine: PatternRecognitionEngine;
  private trendEngine: TrendAnalysisEngine;
  private srEngine: SupportResistanceEngine;
  private volumeEngine: VolumeAnalysisEngine;
  private momentumEngine: MomentumAnalysisEngine;
  private newsEngine: NewsAnalysisEngine;
  private sentimentEngine: SentimentAnalysisEngine;
  private riskEngine: RiskAnalysisEngine;
  private portfolioEngine: PortfolioAnalysisEngine;
  private tradePlanningEngine: TradePlanningEngine;
  private aiExplanationEngine: AIExplanationEngine;

  constructor() {
    this.technicalEngine = new TechnicalAnalysisEngine();
    this.patternEngine = new PatternRecognitionEngine();
    this.trendEngine = new TrendAnalysisEngine();
    this.srEngine = new SupportResistanceEngine();
    this.volumeEngine = new VolumeAnalysisEngine();
    this.momentumEngine = new MomentumAnalysisEngine();
    this.newsEngine = new NewsAnalysisEngine();
    this.sentimentEngine = new SentimentAnalysisEngine();
    this.riskEngine = new RiskAnalysisEngine();
    this.portfolioEngine = new PortfolioAnalysisEngine();
    this.tradePlanningEngine = new TradePlanningEngine();
    this.aiExplanationEngine = new AIExplanationEngine();
  }

  async analyze(symbol: string, timeframe: string = '1D', platform: string = ''): Promise<AnalysisResult> {
    try {
      // Run all analysis engines except AI explanation in parallel
      const [
        technicalResult,
        patternResult,
        trendResult,
        srResult,
        volumeResult,
        momentumResult,
        newsResult,
        sentimentResult,
        riskResult,
        portfolioResult,
        tradePlanningResult
      ] = await Promise.all([
        this.technicalEngine.analyze(symbol, timeframe, platform),
        this.patternEngine.analyze(symbol, timeframe),
        this.trendEngine.analyze(symbol, timeframe),
        this.srEngine.analyze(symbol, timeframe),
        this.volumeEngine.analyze(symbol, timeframe),
        this.momentumEngine.analyze(symbol, timeframe),
        this.newsEngine.analyze(symbol, timeframe),
        this.sentimentEngine.analyze(symbol, timeframe),
        this.riskEngine.analyze(symbol, timeframe),
        this.portfolioEngine.analyze(symbol, timeframe),
        this.tradePlanningEngine.analyze(symbol, timeframe)
      ]);

      // Run AI explanation engine with results from ALL engines including trade planning
      const aiExplanationResult = await this.aiExplanationEngine.analyze(symbol, timeframe, {
        technical: technicalResult,
        pattern: patternResult,
        trend: trendResult,
        supportResistance: srResult,
        volume: volumeResult,
        momentum: momentumResult,
        risk: riskResult,
        portfolio: portfolioResult,
        tradePlanning: tradePlanningResult
      });

      // Combine results into a final recommendation
      const combinedResult = this.combineAnalysisResults(
        symbol,
        timeframe,
        technicalResult,
        patternResult,
        trendResult,
        srResult,
        volumeResult,
        momentumResult,
        newsResult,
        sentimentResult,
        riskResult,
        portfolioResult,
        tradePlanningResult,
        aiExplanationResult
      );

      return combinedResult;
    } catch (error) {
      console.error('Analysis orchestration failed:', error);
      // Return a default/fallback analysis
      return this.getDefaultAnalysis(symbol, timeframe);
    }
  }

  private combineAnalysisResults(
    symbol: string,
    timeframe: string,
    technical: any,
    pattern: any,
    trend: any,
    sr: any,
    volume: any,
    momentum: any,
    news: any,
    sentiment: any,
    risk: any,
    portfolio: any,
    tradePlanning: any,
    aiExplanation: any
  ): AnalysisResult {
    // Weight different analysis types
    const weights = {
      technical: 0.15,
      trend: 0.15,
      momentum: 0.10,
      volume: 0.05,
      supportResistance: 0.10,
      pattern: 0.10,
      news: 0.05,
      sentiment: 0.05,
      risk: 0.05, // Risk is inversely weighted (lower risk = higher score)
      portfolio: 0.05,
      tradePlanning: 0.10,
      aiExplanation: 0.05
    };

    // Calculate weighted score for buy/sell signals
    let bullishScore = 0;
    let bearishScore = 0;

    // Technical analysis contribution
    if (technical.signal === 'BUY') bullishScore += technical.strength * weights.technical;
    if (technical.signal === 'SELL') bearishScore += technical.strength * weights.technical;

    // Trend analysis contribution
    if (trend.signal === 'UP') bullishScore += trend.strength * weights.trend;
    if (trend.signal === 'DOWN') bearishScore += trend.strength * weights.trend;

    // Momentum contribution
    if (momentum.signal === 'UP') bullishScore += momentum.strength * weights.momentum;
    if (momentum.signal === 'DOWN') bearishScore += momentum.strength * weights.momentum;

    // Volume confirmation
    if (volume.signal === 'HIGH') {
      // High volume confirms the direction of other signals
      if (bullishScore > bearishScore) bullishScore *= 1.1;
      else if (bearishScore > bullishScore) bearishScore *= 1.1;
    }

    // Support/Resistance
    if (sr.signal === 'BOUNCE_UP') bullishScore += sr.strength * weights.supportResistance;
    if (sr.signal === 'REJECT_DOWN') bearishScore += sr.strength * weights.supportResistance;

    // Pattern recognition
    if (pattern.signal === 'BULLISH') bullishScore += pattern.strength * weights.pattern;
    if (pattern.signal === 'BEARISH') bearishScore += pattern.strength * weights.pattern;

    // News sentiment
    if (news.signal === 'BULLISH') bullishScore += news.strength * weights.news;
    if (news.signal === 'BEARISH') bearishScore += news.strength * weights.news;

    // Overall sentiment
    if (sentiment.signal === 'BULLISH') bullishScore += sentiment.strength * weights.sentiment;
    if (sentiment.signal === 'BEARISH') bearishScore += sentiment.strength * weights.sentiment;

    // Risk (inverse weighting - lower risk = higher score)
    const riskScore = 1 - risk.riskScore; // Convert to safety score
    if (riskScore > 0.5) {
      // Favor the current direction if risk is low
      if (bullishScore > bearishScore) bullishScore += riskScore * weights.risk;
      else if (bearishScore > bullishScore) bearishScore += riskScore * weights.risk;
    }

    // Portfolio fit
    if (portfolio.signal === 'BULLISH') bullishScore += portfolio.strength * weights.portfolio;
    if (portfolio.signal === 'BEARISH') bearishScore += portfolio.strength * weights.portfolio;

    // Trade planning
    if (tradePlanning.signal === 'BUY') bullishScore += tradePlanning.confidence * weights.tradePlanning;
    if (tradePlanning.signal === 'SELL') bearishScore += tradePlanning.confidence * weights.tradePlanning;

    // AI explanation (use its confidence as a signal strength)
    if (aiExplanation.confidence > 0.5) {
      // Determine bias from AI explanation
      const explanation = aiExplanation.explanation || '';
      const bullishMentions = (explanation.match(/bullish/gi) || []).length;
      const bearishMentions = (explanation.match(/bearish/gi) || []).length;

      if (bullishMentions > bearishMentions) {
        bullishScore += aiExplanation.confidence * weights.aiExplanation;
      } else if (bearishMentions > bullishMentions) {
        bearishScore += aiExplanation.confidence * weights.aiExplanation;
      }
    }

    // Determine final recommendation
    const netScore = bullishScore - bearishScore;
    let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' = 'HOLD';
    let confidence = 50; // Base confidence

    if (netScore > 0.2) {
      recommendation = netScore > 0.4 ? 'STRONG_BUY' : 'BUY';
      confidence = 50 + (netScore * 125); // Scale to 50-100+
    } else if (netScore < -0.2) {
      recommendation = netScore < -0.4 ? 'STRONG_SELL' : 'SELL';
      confidence = 50 + (Math.abs(netScore) * 125); // Scale to 50-100+
    } else {
      recommendation = 'HOLD';
      confidence = 50 - (Math.abs(netScore) * 100); // Reduce confidence for neutral
    }

    // Ensure confidence is within bounds
    confidence = Math.max(0, Math.min(100, confidence));

    // Generate reasoning
    const reasoning = this.generateReasoning(
      technical, pattern, trend, sr, volume, momentum,
      news, sentiment, risk, portfolio, tradePlanning, aiExplanation, netScore
    );

    return {
      symbol,
      timeframe,
      timestamp: Date.now(),
      recommendation,
      confidence,
      indicators: {
        trend: { signal: trend.signal, strength: trend.strength },
        momentum: { signal: momentum.signal, strength: momentum.strength },
        volume: { signal: volume.signal, strength: volume.strength },
        volatility: { signal: 'NEUTRAL', strength: 0.5 } // Simplified for now
      },
      reasoning,
      engines: {
        technical,
        pattern,
        trend,
        supportResistance: sr,
        volume,
        momentum,
        news,
        sentiment,
        risk,
        portfolio,
        tradePlanning,
        aiExplanation
      }
    };
  }

  private generateReasoning(
    technical: any,
    pattern: any,
    trend: any,
    sr: any,
    volume: any,
    momentum: any,
    news: any,
    sentiment: any,
    risk: any,
    portfolio: any,
    tradePlanning: any,
    aiExplanation: any,
    netScore: number
  ): string {
    let reasoning = 'Analysis based on multiple factors: ';

    if (technical.signal !== 'NEUTRAL') {
      reasoning += `Technical shows ${technical.signal.toLowerCase()} signal (strength: ${Math.round(technical.strength * 100)}%). `;
    }

    if (trend.signal !== 'NEUTRAL') {
      reasoning += `Trend is ${trend.signal.toLowerCase()} (strength: ${Math.round(trend.strength * 100)}%). `;
    }

    if (momentum.signal !== 'NEUTRAL') {
      reasoning += `Momentum is ${momentum.signal.toLowerCase()} (strength: ${Math.round(momentum.strength * 100)}%). `;
    }

    if (volume.signal !== 'NEUTRAL') {
      reasoning += `Volume is ${volume.signal.toLowerCase()} (strength: ${Math.round(volume.strength * 100)}%). `;
    }

    if (sr.signal !== 'NEUTRAL') {
      reasoning += `Support/Resistance indicates ${sr.signal.replace('_', ' ').toLowerCase()} (strength: ${Math.round(sr.strength * 100)}%). `;
    }

    if (pattern.signal !== 'NEUTRAL') {
      reasoning += `Pattern recognition suggests ${pattern.signal.toLowerCase()} signal (strength: ${Math.round(pattern.strength * 100)}%). `;
    }

    if (news.signal !== 'NEUTRAL') {
      reasoning += `News sentiment is ${news.signal.toLowerCase()} (strength: ${Math.round(news.strength * 100)}%). `;
    }

    if (sentiment.signal !== 'NEUTRAL') {
      reasoning += `Overall sentiment is ${sentiment.signal.toLowerCase()} (strength: ${Math.round(sentiment.strength * 100)}%). `;
    }

    if (risk.riskLevel !== 'MEDIUM') {
      reasoning += `Risk level is ${risk.riskLevel.toLowerCase()} (score: ${Math.round(risk.riskScore * 100)}%). `;
    }

    if (portfolio.signal !== 'NEUTRAL') {
      reasoning += `Portfolio fit suggests ${portfolio.signal.toLowerCase()} (strength: ${Math.round(portfolio.strength * 100)}%). `;
    }

    if (tradePlanning.signal !== 'WAIT') {
      reasoning += `Trade planning suggests ${tradePlanning.signal.toLowerCase()} with ${Math.round(
        tradePlanning.confidence * 100
      )}% confidence. `;
    }

    reasoning += `Overall signal: ${netScore > 0 ? 'bullish' : 'bearish'} (${Math.round(Math.abs(netScore) * 100)}% confidence).`;

    return reasoning;
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
        volatility: { signal: 'NEUTRAL', strength: 0 }
      },
      reasoning: 'Insufficient data for analysis.',
      engines: {
        technical: { signal: 'NEUTRAL', strength: 0 },
        pattern: { signal: 'NEUTRAL', strength: 0 },
        trend: { signal: 'NEUTRAL', strength: 0 },
        supportResistance: { signal: 'NEUTRAL', strength: 0 },
        volume: { signal: 'NEUTRAL', strength: 0 },
        momentum: { signal: 'NEUTRAL', strength: 0 },
        news: { signal: 'NEUTRAL', strength: 0 },
        sentiment: { signal: 'NEUTRAL', strength: 0 },
        risk: { riskLevel: 'UNKNOWN', riskScore: 0 },
        portfolio: { signal: 'NEUTRAL', strength: 0 },
        tradePlanning: { signal: 'WAIT', confidence: 0 },
        aiExplanation: { explanation: 'Insufficient data for analysis.', confidence: 0 }
      }
    };
  }
}