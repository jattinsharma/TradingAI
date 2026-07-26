import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiAnalysisRequest {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  indicators: {
    rsi?: number;
    macd?: { macd: number; signal: number; histogram: number };
    ema20?: number;
    ema50?: number;
    ema200?: number;
    atr?: number;
    volume?: number;
    trend?: string;
    support?: number;
    resistance?: number;
  };
  news?: Array<{ title: string; sentiment: string }>;
  marketContext?: {
    fearGreed?: number;
    btcDominance?: number;
    volume24h?: number;
  };
}

export interface AiAnalysisResponse {
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
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

export interface AiProvider {
  name: string;
  model: string;
  baseUrl: string;
}

const PROVIDERS: AiProvider[] = [
  { name: 'Llama 3', model: 'llama3.1:latest', baseUrl: 'http://localhost:11434' },
  { name: 'Qwen 2.5', model: 'qwen2.5:latest', baseUrl: 'http://localhost:11434' },
  { name: 'Mistral', model: 'mistral:latest', baseUrl: 'http://localhost:11434' },
  { name: 'DeepSeek', model: 'deepseek-r1:latest', baseUrl: 'http://localhost:11434' },
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private activeModel: AiProvider;
  private ollamaAvailable = false;

  constructor(private configService: ConfigService) {
    const modelName = this.configService.get<string>('OLLAMA_MODEL', 'llama3.1:latest');
    this.activeModel =
      PROVIDERS.find((p) => p.model === modelName) ||
      PROVIDERS[0];

    this.checkAvailability();
  }

  private async checkAvailability(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.activeModel.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        this.ollamaAvailable = true;
        this.logger.log(`Ollama available at ${this.activeModel.baseUrl}`);
      } else {
        this.ollamaAvailable = false;
        this.logger.warn('Ollama service responded with error');
      }
    } catch (err) {
      this.ollamaAvailable = false;
      this.logger.warn(
        `Ollama not available at ${this.activeModel.baseUrl}. Start Ollama or install from https://ollama.com`,
      );
    }
  }

  isAvailable(): boolean {
    return this.ollamaAvailable;
  }

  getActiveModel(): AiProvider {
    return this.activeModel;
  }

  getAvailableModels(): AiProvider[] {
    return PROVIDERS.filter((p) => p.model !== this.activeModel.model);
  }

  async setModel(modelName: string): Promise<boolean> {
    const provider = PROVIDERS.find((p) => p.model === modelName);
    if (!provider) {
      this.logger.warn(`Unknown model: ${modelName}`);
      return false;
    }
    this.activeModel = provider;
    this.logger.log(`Switched AI model to ${provider.name} (${provider.model})`);
    await this.checkAvailability();
    return true;
  }

  async analyze(request: AiAnalysisRequest): Promise<AiAnalysisResponse> {
    if (!this.ollamaAvailable) {
      throw new Error(
        'Ollama is not available. Please ensure Ollama is running (ollama serve) and the model is pulled (ollama pull ' +
          this.activeModel.model +
          '). Download from https://ollama.com',
      );
    }

    const prompt = this.buildAnalysisPrompt(request);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(`${this.activeModel.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
          },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return this.parseResponse(result.response);
    } catch (err) {
      this.logger.error(`AI analysis failed for ${request.symbol}: ${(err as Error).message}`);
      throw err;
    }
  }

  private buildAnalysisPrompt(request: AiAnalysisRequest): string {
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
    ? `Recent News:\n${request.news.map((n) => `- ${n.title} (Sentiment: ${n.sentiment})`).join('\n')}`
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
  "invalidationLevel": "price level that invalidates the setup"
}`;
  }

  private parseResponse(text: string): AiAnalysisResponse {
    try {
      // Try direct JSON parse first
      const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

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
    } catch {
      // Fallback: extract JSON from the text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            recommendation: ['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'].includes(parsed.recommendation)
              ? parsed.recommendation
              : 'HOLD',
            confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
            reasoning: parsed.reasoning || text.substring(0, 500),
            keyRisks: Array.isArray(parsed.keyRisks) ? parsed.keyRisks : [],
            alternativeScenario: parsed.alternativeScenario || '',
            invalidationLevel: parsed.invalidationLevel || '',
          };
        } catch {
          // ignore nested error
        }
      }

      return {
        recommendation: 'HOLD',
        confidence: 50,
        reasoning: 'AI analysis failed to produce structured output. Raw response: ' + text.substring(0, 300),
        keyRisks: ['Analysis could not be completed'],
        alternativeScenario: 'Unavailable',
        invalidationLevel: 'Unavailable',
      };
    }
  }
}
