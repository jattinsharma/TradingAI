/**
 * TradingAI V2 — News Analyst Agent
 *
 * Consumes news data from the existing News Engine and interprets impact
 * via LLM reasoning. Evaluates headline sentiment, event significance,
 * and potential market-moving catalysts.
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
export class NewsAnalystAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'NewsAnalyst',
      role: AgentRole.NEWS_ANALYST,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.3,
      maxTokens: 2500,
      timeoutMs: 15000,
      retryOnFailure: true,
      maxRetries: 1,
      systemPrompt: `You are an expert News Analyst for TradingAI, the world's first AI Operating System for Traders.

Your role: Interpret news headlines, press releases, and announcements to assess their impact on the asset's price.

RULES:
1. Focus on NEWS only. Do not perform technical analysis.
2. Assess sentiment: is the overall news flow positive, negative, or neutral for this asset?
3. Identify market-moving catalysts (earnings, regulatory, M&A, partnerships, lawsuits).
4. Rate the significance of each news item (HIGH, MEDIUM, LOW impact).
5. Consider the timing — is the news already priced in or is it fresh?
6. Check for conflicting narratives in the news.
7. If no news is available, say so honestly and return NEUTRAL with low confidence.

OUTPUT FORMAT (JSON only, no markdown):
{
  "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "strength": "STRONG" | "MODERATE" | "WEAK",
  "confidence": 0-100,
  "reasoning": ["point 1", "point 2", ...],
  "overallSentiment": "POSITIVE" | "NEGATIVE" | "MIXED" | "NEUTRAL",
  "catalysts": [{"event": "...", "impact": "HIGH|MEDIUM|LOW", "sentiment": "POSITIVE|NEGATIVE"}],
  "pricedIn": true | false,
  "evidence": ["evidence1", "evidence2"],
  "warnings": ["warning1"] or []
}`,
    };
  }

  protected buildPrompt(context: AnalysisContext): string {
    const parts: string[] = [];

    parts.push(`Symbol: ${context.symbol}`);
    parts.push(`Current Price: ${context.chartData.currentPrice}`);
    parts.push(`Timeframe: ${context.timeframe}`);

    // News data
    parts.push(this.formatNews(context));

    // Market context
    if (context.marketData?.fearGreedIndex !== undefined) {
      parts.push('');
      parts.push(`Fear & Greed Index: ${context.marketData.fearGreedIndex}`);
    }

    if (!context.marketData?.news || context.marketData.news.length === 0) {
      parts.push('');
      parts.push(
        'No recent news data available. Provide a NEUTRAL assessment with low confidence.',
      );
    }

    parts.push('');
    parts.push(
      'Analyze the news and provide your assessment as JSON.',
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    _context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<NewsAnalysisOutput>(rawResponse);

    if (!parsed) {
      return {
        signal: SignalType.NEUTRAL,
        strength: SignalStrength.WEAK,
        confidence: 20,
        reasoning: ['News analysis could not be parsed.'],
        data: { rawResponse: rawResponse.substring(0, 1000) },
        warnings: ['LLM response could not be parsed as JSON'],
      };
    }

    return {
      signal: this.parseSignal(parsed.signal),
      strength: this.parseStrength(parsed.strength),
      confidence: this.clamp(Number(parsed.confidence) || 30, 0, 100),
      reasoning: this.ensureStringArray(parsed.reasoning),
      data: {
        overallSentiment: parsed.overallSentiment || 'NEUTRAL',
        catalysts: parsed.catalysts || [],
        pricedIn: Boolean(parsed.pricedIn),
      },
      evidence: this.ensureStringArray(parsed.evidence),
      warnings: this.ensureStringArray(parsed.warnings),
    };
  }
}

interface NewsAnalysisOutput {
  signal?: string;
  strength?: string;
  confidence?: number;
  reasoning?: string[];
  overallSentiment?: string;
  catalysts?: Array<{
    event: string;
    impact: string;
    sentiment: string;
  }>;
  pricedIn?: boolean;
  evidence?: string[];
  warnings?: string[];
}
