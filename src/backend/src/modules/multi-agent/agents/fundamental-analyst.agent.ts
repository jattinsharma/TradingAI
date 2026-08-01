/**
 * TradingAI V2 — Fundamental Analyst Agent
 *
 * Evaluates company fundamentals, earnings data, financial ratios,
 * and valuation metrics via LLM reasoning.
 *
 * Primarily relevant for stocks and ETFs. For crypto/forex, this agent
 * adapts to on-chain metrics and macro fundamentals respectively.
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
export class FundamentalAnalystAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'FundamentalAnalyst',
      role: AgentRole.FUNDAMENTAL_ANALYST,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.3,
      maxTokens: 2500,
      timeoutMs: 15000,
      retryOnFailure: true,
      maxRetries: 1,
      systemPrompt: `You are an expert Fundamental Analyst for TradingAI, the world's first AI Operating System for Traders.

Your role: Evaluate the fundamental value of the asset being analyzed.

FOR STOCKS:
- Assess earnings growth, revenue trends, P/E ratio, P/S ratio, debt levels
- Check for insider buying/selling patterns
- Evaluate competitive positioning and moat
- Assess upcoming earnings dates and guidance

FOR CRYPTO:
- Evaluate on-chain metrics (TVL, active addresses, developer activity)
- Assess tokenomics (supply, inflation rate, staking yield)
- Review protocol upgrades and roadmap
- Check for regulatory developments

FOR FOREX:
- Evaluate interest rate differentials
- Assess trade balance and current account
- Review central bank policy direction
- Check for geopolitical factors

RULES:
1. Focus only on fundamentals. Do not perform technical analysis.
2. If fundamental data is limited, lower your confidence.
3. Identify the key fundamental driver for this asset right now.
4. Be honest about data limitations.

OUTPUT FORMAT (JSON only, no markdown):
{
  "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "strength": "STRONG" | "MODERATE" | "WEAK",
  "confidence": 0-100,
  "reasoning": ["point 1", "point 2", ...],
  "assetType": "STOCK" | "CRYPTO" | "FOREX" | "COMMODITY" | "INDEX",
  "valuationAssessment": "UNDERVALUED" | "FAIRLY_VALUED" | "OVERVALUED" | "UNKNOWN",
  "keyDriver": "description of the primary fundamental driver",
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

    // Determine asset type from symbol
    const assetType = this.detectAssetType(context.symbol);
    parts.push(`Detected Asset Type: ${assetType}`);

    // Market data context
    parts.push(this.formatMarketContext(context));
    parts.push(this.formatNews(context));
    parts.push(this.formatMemory(context));

    parts.push('');
    parts.push(
      `Analyze the fundamentals of ${context.symbol} as a ${assetType} and provide your assessment as JSON. If fundamental data is limited, acknowledge this and lower confidence.`,
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    _context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<FundamentalOutput>(rawResponse);

    if (!parsed) {
      return {
        signal: SignalType.NEUTRAL,
        strength: SignalStrength.WEAK,
        confidence: 20,
        reasoning: ['Fundamental analysis could not be parsed.'],
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
        assetType: parsed.assetType || 'UNKNOWN',
        valuationAssessment: parsed.valuationAssessment || 'UNKNOWN',
        keyDriver: parsed.keyDriver || 'Not identified',
      },
      evidence: this.ensureStringArray(parsed.evidence),
      warnings: this.ensureStringArray(parsed.warnings),
    };
  }

  /**
   * Detect asset type from symbol conventions.
   */
  private detectAssetType(symbol: string): string {
    const upper = symbol.toUpperCase();

    // Crypto pairs
    if (
      upper.endsWith('USDT') ||
      upper.endsWith('USD') ||
      upper.endsWith('BTC') ||
      upper.endsWith('ETH') ||
      ['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'XRP', 'DOGE'].includes(upper)
    ) {
      return 'CRYPTO';
    }

    // Forex pairs
    if (
      upper.match(
        /^(EUR|USD|GBP|JPY|AUD|NZD|CAD|CHF)(EUR|USD|GBP|JPY|AUD|NZD|CAD|CHF)$/,
      )
    ) {
      return 'FOREX';
    }

    // Commodities
    if (['XAUUSD', 'XAGUSD', 'GOLD', 'SILVER', 'WTICOUSD', 'BRENT', 'CL1!', 'GC1!'].includes(upper)) {
      return 'COMMODITY';
    }

    // Indices
    if (
      ['SPX', 'SPY', 'QQQ', 'DIA', 'IWM', 'ES1!', 'NQ1!', 'YM1!', 'DXY', 'VIX'].includes(upper)
    ) {
      return 'INDEX';
    }

    return 'STOCK';
  }
}

interface FundamentalOutput {
  signal?: string;
  strength?: string;
  confidence?: number;
  reasoning?: string[];
  assetType?: string;
  valuationAssessment?: string;
  keyDriver?: string;
  evidence?: string[];
  warnings?: string[];
}
