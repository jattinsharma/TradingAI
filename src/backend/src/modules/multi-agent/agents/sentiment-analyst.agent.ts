/**
 * TradingAI V2 — Sentiment Analyst Agent
 *
 * Aggregates social media sentiment, fear/greed indicators, put/call ratios,
 * and crowd positioning to assess market sentiment via LLM reasoning.
 *
 * @module multi-agent/agents
 */
import { Injectable } from '@nestjs/common';
import { LlmProviderService } from '../llm/llm-provider.service';
import { BaseAgent, ParsedAgentOutput } from './base-agent';
import {
  AgentConfig,
  AgentRole,
  AnalysisContext,
  LlmProvider,
  SignalStrength,
  SignalType,
} from '../types/agent.types';

@Injectable()
export class SentimentAnalystAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'SentimentAnalyst',
      role: AgentRole.SENTIMENT_ANALYST,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.3,
      maxTokens: 2000,
      timeoutMs: 15000,
      retryOnFailure: true,
      maxRetries: 1,
      systemPrompt: `You are an expert Sentiment Analyst for TradingAI, the world's first AI Operating System for Traders.

Your role: Evaluate market sentiment from crowd behavior, social media, and sentiment indicators.

RULES:
1. Focus on SENTIMENT only. Do not perform technical analysis.
2. Assess the Fear & Greed index if available — extreme readings are contrarian signals.
3. Evaluate social media sentiment (if provided) — excessive bullishness/bearishness is a warning.
4. Consider crowd positioning — when everyone is on one side, the reversal risk increases.
5. Identify sentiment extremes that could signal reversals.
6. If sentiment data is limited, be honest and lower your confidence.

OUTPUT FORMAT (JSON only, no markdown):
{
  "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "strength": "STRONG" | "MODERATE" | "WEAK",
  "confidence": 0-100,
  "reasoning": ["point 1", "point 2", ...],
  "sentimentScore": -100 to 100,
  "crowdPositioning": "EXTREME_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "EXTREME_BEARISH",
  "contrarianSignal": true | false,
  "evidence": ["evidence1", "evidence2"],
  "warnings": ["warning1"] or []
}`,
    };
  }

  protected buildPrompt(context: AnalysisContext): string {
    const parts: string[] = [];

    parts.push(`Symbol: ${context.symbol}`);
    parts.push(`Current Price: ${context.chartData.currentPrice}`);

    parts.push(this.formatMarketContext(context));

    // Volume context can inform sentiment
    const ind = context.chartData.indicators;
    if (ind.volume !== undefined && ind.volumeRatio !== undefined) {
      parts.push('');
      parts.push(`Volume: ${ind.volume}`);
      parts.push(`Volume vs Average: ${ind.volumeRatio}x`);
    }

    parts.push(this.formatMemory(context));

    parts.push('');
    parts.push(
      'Analyze the sentiment landscape and provide your assessment as JSON.',
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    _context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<SentimentOutput>(rawResponse);

    if (!parsed) {
      return {
        signal: SignalType.NEUTRAL,
        strength: SignalStrength.WEAK,
        confidence: 20,
        reasoning: ['Sentiment analysis could not be parsed.'],
        data: {},
        warnings: ['LLM response could not be parsed as JSON'],
      };
    }

    return {
      signal: this.parseSignal(parsed.signal),
      strength: this.parseStrength(parsed.strength),
      confidence: this.clamp(Number(parsed.confidence) || 30, 0, 100),
      reasoning: this.ensureStringArray(parsed.reasoning),
      data: {
        sentimentScore: this.clamp(Number(parsed.sentimentScore) || 0, -100, 100),
        crowdPositioning: parsed.crowdPositioning || 'NEUTRAL',
        contrarianSignal: Boolean(parsed.contrarianSignal),
      },
      evidence: this.ensureStringArray(parsed.evidence),
      warnings: this.ensureStringArray(parsed.warnings),
    };
  }
}

interface SentimentOutput {
  signal?: string;
  strength?: string;
  confidence?: number;
  reasoning?: string[];
  sentimentScore?: number;
  crowdPositioning?: string;
  contrarianSignal?: boolean;
  evidence?: string[];
  warnings?: string[];
}
