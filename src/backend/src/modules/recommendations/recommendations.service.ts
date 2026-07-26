import { Injectable, Logger } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { NewsService } from '../news/news.service';

export interface AnalysisResult {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number; // 0-100
  indicators: {
    trend: { signal: 'UP' | 'DOWN' | 'NEUTRAL'; strength: number };
    momentum: { signal: 'UP' | 'DOWN' | 'NEUTRAL'; strength: number };
    volume: { signal: 'HIGH' | 'LOW' | 'NEUTRAL'; strength: number };
    volatility: { signal: 'HIGH' | 'LOW' | 'NEUTRAL'; strength: number };
  };
  reasoning: string;
}

export interface RecommendationHistory {
  id: string;
  symbol: string;
  timeframe: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  timestamp: Date;
  reasoning: string;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private history: RecommendationHistory[] = [];

  constructor(
    private marketDataService: MarketDataService,
    private newsService: NewsService,
  ) {}

  async analyze(symbol: string, timeframe: string = '1D', _analysisTypes: string[] = []): Promise<AnalysisResult> {
    this.logger.log(`Analyzing ${symbol} on ${timeframe} timeframe`);

    // Get market data
    const marketData = this.marketDataService.getCurrentPrice(symbol);
    if (!marketData) {
      // Return a default analysis if no market data
      return this.getDefaultAnalysis(symbol, timeframe);
    }

    // Get news for the symbol
    const news = await this.newsService.getNewsForSymbol(symbol, 5);

    // In a real implementation, we would run various analysis engines here
    // For now, we'll simulate the analysis results
    const analysis = this.performTechnicalAnalysis(symbol, timeframe, marketData, news);

    // Store in history
    const historyItem: RecommendationHistory = {
      id: Date.now().toString(),
      symbol,
      timeframe,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      timestamp: new Date(),
      reasoning: analysis.reasoning,
    };

    this.history.unshift(historyItem); // Add to beginning for newest first

    return analysis;
  }

  getHistory(symbol: string, limit: number = 100): RecommendationHistory[] {
    return this.history.filter((item) => item.symbol === symbol).slice(0, limit);
  }

  getLatest(symbol: string): RecommendationHistory | null {
    const history = this.getHistory(symbol, 1);
    return history.length > 0 ? history[0] : null;
  }

  private performTechnicalAnalysis(
    symbol: string,
    timeframe: string,
    marketData: unknown,
    news: unknown[],
  ): AnalysisResult {
    // Simulate analysis - in reality, this would call various analysis engines
    const trendSignals: Array<'UP' | 'DOWN' | 'NEUTRAL'> = ['UP', 'DOWN', 'NEUTRAL'];
    const volumeSignals: Array<'HIGH' | 'LOW' | 'NEUTRAL'> = ['HIGH', 'LOW', 'NEUTRAL'];
    const volatilitySignals: Array<'HIGH' | 'LOW' | 'NEUTRAL'> = ['HIGH', 'LOW', 'NEUTRAL'];

    // Randomly generate signals (in reality, these would come from actual analysis)
    const trendSignal = trendSignals[Math.floor(Math.random() * trendSignals.length)];
    const momentumSignal = trendSignals[Math.floor(Math.random() * trendSignals.length)];
    const volumeSignal = volumeSignals[Math.floor(Math.random() * volumeSignals.length)];
    const volatilitySignal = volatilitySignals[Math.floor(Math.random() * volatilitySignals.length)];

    // Generate strengths (0-1)
    const trendStrength = Math.random();
    const momentumStrength = Math.random();
    const volumeStrength = Math.random();
    const volatilityStrength = Math.random();

    // Determine overall recommendation based on signals
    let recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL' = 'HOLD';
    let confidence = 50; // Base confidence

    // Simple logic for demonstration
    const bullishSignals =
      (trendSignal === 'UP' ? trendStrength : 0) +
      (momentumSignal === 'UP' ? momentumStrength : 0) +
      (volumeSignal === 'HIGH' ? volumeStrength : 0);

    const bearishSignals =
      (trendSignal === 'DOWN' ? trendStrength : 0) +
      (momentumSignal === 'DOWN' ? momentumStrength : 0) +
      (volumeSignal === 'LOW' ? volumeStrength : 0);

    const netSignal = bullishSignals - bearishSignals;

    if (netSignal > 0.6) {
      recommendation = netSignal > 0.8 ? 'STRONG_BUY' : 'BUY';
      confidence = 50 + netSignal * 50;
    } else if (netSignal < -0.6) {
      recommendation = netSignal < -0.8 ? 'STRONG_SELL' : 'SELL';
      confidence = 50 + Math.abs(netSignal) * 50;
    } else {
      recommendation = 'HOLD';
      confidence = 50 - Math.abs(netSignal) * 30;
    }

    // Ensure confidence is between 0 and 100
    confidence = Math.max(0, Math.min(100, confidence));

    // Generate reasoning
    const reasoning = this.generateReasoning(
      trendSignal,
      trendStrength,
      momentumSignal,
      momentumStrength,
      volumeSignal,
      volumeStrength,
      volatilitySignal,
      volatilityStrength,
      netSignal,
      news,
    );

    return {
      symbol,
      timeframe,
      timestamp: new Date(),
      recommendation,
      confidence,
      indicators: {
        trend: { signal: trendSignal, strength: trendStrength },
        momentum: { signal: momentumSignal, strength: momentumStrength },
        volume: { signal: volumeSignal, strength: volumeStrength },
        volatility: { signal: volatilitySignal, strength: volatilityStrength },
      },
      reasoning,
    };
  }

  private generateReasoning(
    trendSignal: string,
    trendStrength: number,
    momentumSignal: string,
    momentumStrength: number,
    volumeSignal: string,
    volumeStrength: number,
    volatilitySignal: string,
    volatilityStrength: number,
    netSignal: number,
    news: unknown[],
  ): string {
    let reasoning = '';

    if (trendSignal === 'UP') {
      reasoning += `Trend is bullish (strength: ${Math.round(trendStrength * 100)}%). `;
    } else if (trendSignal === 'DOWN') {
      reasoning += `Trend is bearish (strength: ${Math.round(trendStrength * 100)}%). `;
    } else {
      reasoning += `Trend is neutral. `;
    }

    if (momentumSignal === 'UP') {
      reasoning += `Momentum is bullish (strength: ${Math.round(momentumStrength * 100)}%). `;
    } else if (momentumSignal === 'DOWN') {
      reasoning += `Momentum is bearish (strength: ${Math.round(momentumStrength * 100)}%). `;
    } else {
      reasoning += `Momentum is neutral. `;
    }

    if (volumeSignal === 'HIGH') {
      reasoning += `Volume is above average (strength: ${Math.round(volumeStrength * 100)}%). `;
    } else if (volumeSignal === 'LOW') {
      reasoning += `Volume is below average (strength: ${Math.round(volumeStrength * 100)}%). `;
    } else {
      reasoning += `Volume is average. `;
    }

    if (volatilitySignal === 'HIGH') {
      reasoning += `Volatility is high (strength: ${Math.round(volatilityStrength * 100)}%). `;
    } else if (volatilitySignal === 'LOW') {
      reasoning += `Volatility is low (strength: ${Math.round(volatilityStrength * 100)}%). `;
    } else {
      reasoning += `Volatility is average. `;
    }

    if (news.length > 0) {
      reasoning += `Recent news: ${(news as Array<{ title: string }>).map((n) => n.title).join(', ')}. `;
    }

    reasoning += `Overall signal: ${netSignal > 0 ? 'bullish' : 'bearish'} (${Math.round(
      Math.abs(netSignal) * 100,
    )}% confidence).`;

    return reasoning;
  }

  private getDefaultAnalysis(symbol: string, timeframe: string): AnalysisResult {
    return {
      symbol,
      timeframe,
      timestamp: new Date(),
      recommendation: 'HOLD',
      confidence: 0,
      indicators: {
        trend: { signal: 'NEUTRAL', strength: 0 },
        momentum: { signal: 'NEUTRAL', strength: 0 },
        volume: { signal: 'NEUTRAL', strength: 0 },
        volatility: { signal: 'NEUTRAL', strength: 0 },
      },
      reasoning: 'No market data available for analysis.',
    };
  }
}
