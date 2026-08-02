import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AnalysisRequest,
  AnalysisResult,
  SummarizeNewsRequest,
  CoachRequest,
  CoachResult,
  AIProvider
} from './ai-provider.interface';

// Define NVIDIA NIM API response types
interface NvidiaAnalysisResponse {
  recommendation: string;
  confidence: number;
  reasoning: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio?: number;
  keyRisks: string[];
  alternativeScenario: string;
  invalidationLevel: string;
}

interface NvidiaSummarizeNewsResponse {
  summary: string;
}

interface NvidiaCoachResponse {
  strengths: string[];
  advice: string[];
  keyLesson: string;
}

@Injectable()
export class NvidiaProvider implements AIProvider {
  private readonly logger = new Logger(NvidiaProvider.name);
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private availableModels: { name: string; model: string }[] = [];

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('NVIDIA_API_KEY') || '';
    this.baseUrl = this.configService.get<string>('NVIDIA_BASE_URL') || 'https://integrate.api.nvidia.com/v1';
    this.model = this.configService.get<string>('NVIDIA_MODEL') || 'nemotron-3-8b-chat';

    // Initialize available models (simplified - in reality these would come from API)
    this.availableModels = [
      { name: 'Nemotron 3 8B', model: 'nemotron-3-8b-chat' },
      { name: 'Nemotron 3 22B', model: 'nemotron-3-22b-chat' },
      { name: 'CodeLlama 70B', model: 'codellama-70b' },
    ];

    if (!this.apiKey) {
      this.logger.warn('NVIDIA API key not configured');
    }
  }

  name = 'NVIDIA NIM';

  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    if (!this.apiKey) {
      throw new Error('NVIDIA API key not configured');
    }

    const prompt = this.buildAnalysisPrompt(request);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a professional trading analyst. Provide trading analysis in JSON format.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '{}';

      // Parse the JSON response
      const parsed = JSON.parse(content);

      return this.parseAnalysisResponse(parsed);
    } catch (err) {
      this.logger.error(`NVIDIA analysis failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async summarizeNews(request: SummarizeNewsRequest): Promise<string> {
    if (!this.apiKey) {
      throw new Error('NVIDIA API key not configured');
    }

    const newsList = request.news.map(item => `- ${item.title}`).join('\n');
    const prompt = `Summarize the following financial news items in 2-3 sentences:\n\n${newsList}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a financial news summarizer.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 200,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return result.choices?.[0]?.message?.content || 'Unable to generate summary';
    } catch (err) {
      this.logger.error(`NVIDIA news summarization failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async coachTrade(request: CoachRequest): Promise<CoachResult> {
    if (!this.apiKey) {
      throw new Error('NVIDIA API key not configured');
    }

    const prompt = this.buildCoachPrompt(request.trade);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'You are a professional trading coach. Provide coaching feedback in JSON format.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '{}';

      // Parse the JSON response
      const parsed = JSON.parse(content);

      return {
        strengths: parsed.strengths || [],
        advice: parsed.advice || [],
        keyLesson: parsed.keyLesson || 'Review and document every trade for continuous improvement.'
      };
    } catch (err) {
      this.logger.error(`NVIDIA coaching failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);
      return response.ok;
    } catch (err) {
      this.logger.warn(`NVIDIA health check failed: ${(err as Error).message}`);
      return false;
    }
  }

  shouldFailover(error: any): boolean {
    // Failover conditions: rate limiting, server errors, timeouts, network issues
    if (!error) return false;

    const message = error.message?.toLowerCase() || '';
    const status = error.status || 0;

    // Always failover on these HTTP status codes
    if (status === 429) return true; // Rate limit
    if (status >= 500 && status <= 599) return true; // Server errors

    // Failover on network-related errors
    if (message.includes('timeout') ||
        message.includes('network') ||
        message.includes('failed to fetch') ||
        message.includes('connection')) {
      return true;
    }

    // Do NOT failover on authentication or bad request errors
    if (status === 401 || status === 403) return false; // Auth errors
    if (status === 400) return false; // Bad request

    // Default to failover for unknown errors to be safe
    return true;
  }

  // Compatibility methods for existing AiService interface
  async isAvailable(): Promise<boolean> {
    return this.isHealthy();
  }

  getActiveModel() {
    return {
      name: this.availableModels.find(m => m.model === this.model)?.name || this.model,
      model: this.model,
      baseUrl: this.baseUrl
    };
  }

  getAvailableModels() {
    return this.availableModels.map(model => ({
      name: model.name,
      model: model.model,
      baseUrl: this.baseUrl
    }));
  }

  async setModel(modelName: string): Promise<boolean> {
    const modelInfo = this.availableModels.find(m =>
      m.name.toLowerCase() === modelName.toLowerCase() ||
      m.model.toLowerCase() === modelName.toLowerCase()
    );

    if (modelInfo) {
      this.model = modelInfo.model;
      this.logger.log(`Switched AI model to ${modelInfo.name} (${this.model})`);
      return true;
    }

    this.logger.warn(`Unknown model: ${modelName}`);
    return false;
  }

  private buildAnalysisPrompt(request: AnalysisRequest): string {
    return `You are a professional trading analyst. Analyze the following market data and provide a trading recommendation.

Symbol: ${request.symbol}
Timeframe: ${request.timeframe}
Current Price: ${request.currentPrice}

Technical Indicators:
- RSI (14): ${request.indicators.rsi ?? 'N/A'}
- EMA 20: ${request.indicators.ema20 ?? 'N/A'}
- EMA 50: ${request.indicators.ema50 ?? 'N/A'}
- EMA 200: ${request.indicators.ema200 ?? 'N/A'}
- ATR: ${request.indicators.atr ?? 'N/A'}
- Volume: ${request.indicators.volume ?? 'N/A'}
- Trend: ${request.indicators.trend ?? 'N/A'}
- Support: ${request.indicators.support ?? 'N/A'}
- Resistance: ${request.indicators.resistance ?? 'N/A'}

MACD:
- MACD Line: ${request.indicators.macd?.macd ?? 'N/A'}
- Signal Line: ${request.indicators.macd?.signal ?? 'N/A'}
- Histogram: ${request.indicators.macd?.histogram ?? 'N/A'}

${
  request.news && request.news.length > 0
    ? `Recent News:\n${request.news.map((n) => \`- ${n.title} (Sentiment: ${n.sentiment})\`).join('\n')}`
    : 'No recent news available.'
}

${
  request.marketContext
    ? `Market Context:\n- Fear & Greed Index: ${request.marketContext.fearGreed ?? 'N/A'}\n- BTC Dominance: ${request.marketContext.btcDominance ?? 'N/A'}%\n- 24h Volume: ${request.marketContext.volume24h ?? 'N/A'}`
    : ''
}

Provide your analysis in this exact JSON format (no markdown, no code fences, raw JSON only):
{
  "recommendation": "STRONG_BUY | BUY | HOLD | SELL | STRONG_SELL",
  "confidence": 0-100,
  "reasoning": "Detailed analysis explaining the recommendation",
  "entryPrice": number or null,
  "stopLoss": number or null,
  "takeProfit": number or null,
  "riskRewardRatio": number or null,
  "keyRisks": ["risk1", "risk2"],
  "alternativeScenario": "What could invalidate this analysis",
  "invalidationLevel": "price level that invalidates the setup`
}`;
  }

  private buildCoachPrompt(trade: any): string {
    return `Review this trade and provide coaching feedback.

Trade: ${trade.symbol} ${trade.side} → ${trade.result} (${trade.pnlPercent?.toFixed(2) || 0}%)
Entry: ${trade.entry:entry}, Exit: ${trade.exitPrice || 'N/A'}
R:R Achieved: ${trade.riskRewardAchieved || 'N/A'}
Mistakes: ${trade.mistakes?.length > 0 ? trade.mistakes.join(', ') : 'None detected'}
Scores: Entry=${trade.entryQuality}, Exit=${trade.exitQuality}, Timing=${trade.timingQuality}, Risk=${trade.riskManagement}
History on ${trade.symbol}: ${trade.history?.totalTrades || 0} trades, ${trade.history?.winRate?.toFixed(1) || 0}% win rate
Recent streak: ${trade.recentStreak?.join(', ') || 'N/A'}

Respond as JSON:
{
  "strengths": ["what the trader did well"],
  "advice": ["specific improvement suggestion"],
  "keyLesson": "one-sentence key takeaway"
}`;
  }

  private parseAnalysisResponse(parsed: any): AnalysisResult {
    return {
      recommendation: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'].includes(parsed.recommendation)
        ? parsed.recommendation
        : 'HOLD',
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
      reasoning: parsed.reasoning || 'No reasoning provided',
      entryPrice: parsed.entryPrice ? Number(parsed.entryPrice) : undefined,
      stopLoss: parsed.stopLoss ? Number(parsed.stopLoss) : undefined,
      takeProfit: parsed.takeProfit ? Number(parsed.takeProfit) : undefined,
      riskRewardRatio: parsed.riskRewardRatio ? Number(parsed.riskRewardRatio) : undefined,
      keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [],
      alternativeScenario: parsed.alternativeScenario || 'No alternative scenario provided',
      invalidationLevel: parsed.invalidationLevel || 'Not specified',
    };
  }
}