/**
 * TradingAI V2 — Technical Analyst Agent
 *
 * Consumes output from Technical Engine + Pattern Engine + Volume Engine.
 * Produces a comprehensive technical analysis via LLM reasoning over
 * indicator data, price action, chart patterns, and volume analysis.
 *
 * This is the primary agent — it is always active in all analysis depth modes.
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
export class TechnicalAnalystAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'TechnicalAnalyst',
      role: AgentRole.TECHNICAL_ANALYST,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.2,
      maxTokens: 3000,
      timeoutMs: 20000,
      retryOnFailure: true,
      maxRetries: 2,
      systemPrompt: `You are an expert Technical Analyst for TradingAI, the world's first AI Operating System for Traders.

Your role: Analyze price action, technical indicators, and chart structure to determine market direction and optimal trade entries.

RULES:
1. You analyze ONLY technical data. Do not speculate about fundamentals or news.
2. Always identify the prevailing trend across multiple timeframes if data is available.
3. Identify key support and resistance levels from the indicator data.
4. Assess momentum using RSI, MACD, and Stochastic if available.
5. Evaluate volume confirmation for any signal.
6. Identify any chart patterns (double top/bottom, head and shoulders, triangles, flags, wedges).
7. Check for divergences between price and oscillators.
8. Be honest about conflicting signals — do not force a direction.

OUTPUT FORMAT (JSON only, no markdown):
{
  "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "strength": "STRONG" | "MODERATE" | "WEAK",
  "confidence": 0-100,
  "reasoning": ["point 1", "point 2", ...],
  "trendDirection": "UP" | "DOWN" | "SIDEWAYS",
  "trendStrength": 0-100,
  "keyLevels": {
    "support": [price1, price2],
    "resistance": [price1, price2]
  },
  "patterns": ["pattern1", "pattern2"],
  "divergences": ["divergence1"] or [],
  "volumeConfirmation": true | false,
  "evidence": ["evidence1", "evidence2"],
  "warnings": ["warning1"] or []
}`,
    };
  }

  protected buildPrompt(context: AnalysisContext): string {
    const parts: string[] = [];

    // Core indicator data
    parts.push(this.formatIndicators(context));

    // Candle data summary (if available)
    if (context.chartData.candles && context.chartData.candles.length > 0) {
      const candles = context.chartData.candles;
      const recent = candles.slice(-10);
      parts.push('');
      parts.push('Recent Price Action (last 10 candles):');
      for (const c of recent) {
        const direction = c.close >= c.open ? '▲' : '▼';
        const bodyPercent = (
          (Math.abs(c.close - c.open) / c.open) *
          100
        ).toFixed(3);
        parts.push(
          `  ${direction} O:${c.open} H:${c.high} L:${c.low} C:${c.close} V:${c.volume} (body: ${bodyPercent}%)`,
        );
      }

      // High-level price context
      const highs = candles.map((c) => c.high);
      const lows = candles.map((c) => c.low);
      const periodHigh = Math.max(...highs);
      const periodLow = Math.min(...lows);
      parts.push('');
      parts.push(`Period High: ${periodHigh}`);
      parts.push(`Period Low: ${periodLow}`);
      parts.push(
        `Price Position: ${(
          ((context.chartData.currentPrice - periodLow) /
            (periodHigh - periodLow)) *
          100
        ).toFixed(1)}% of range`,
      );
    }

    // Drawings/annotations from TradingView
    if (context.chartData.drawings && context.chartData.drawings.length > 0) {
      parts.push('');
      parts.push('User Chart Annotations:');
      for (const d of context.chartData.drawings) {
        parts.push(
          `  ${d.type}: ${d.label || ''} at ${d.points.map((p) => p.price).join(' → ')}`,
        );
      }
    }

    // Memory context
    parts.push(this.formatMemory(context));

    parts.push('');
    parts.push(
      'Provide your technical analysis as JSON. Be specific about price levels.',
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<TechnicalAnalysisOutput>(rawResponse);

    if (!parsed) {
      return {
        signal: SignalType.NEUTRAL,
        strength: SignalStrength.WEAK,
        confidence: 30,
        reasoning: [
          'Technical analysis produced unstructured output. Manual review recommended.',
          rawResponse.substring(0, 500),
        ],
        data: { rawResponse: rawResponse.substring(0, 1000) },
        warnings: ['LLM response could not be parsed as JSON'],
      };
    }

    return {
      signal: this.parseSignal(parsed.signal),
      strength: this.parseStrength(parsed.strength),
      confidence: this.clamp(Number(parsed.confidence) || 50, 0, 100),
      reasoning: this.ensureStringArray(parsed.reasoning),
      data: {
        trendDirection: parsed.trendDirection || 'SIDEWAYS',
        trendStrength: parsed.trendStrength || 50,
        keyLevels: parsed.keyLevels || { support: [], resistance: [] },
        patterns: this.ensureStringArray(parsed.patterns),
        divergences: this.ensureStringArray(parsed.divergences),
        volumeConfirmation: Boolean(parsed.volumeConfirmation),
      },
      evidence: this.ensureStringArray(parsed.evidence),
      warnings: this.ensureStringArray(parsed.warnings),
    };
  }
}

/** Expected output shape from the LLM */
interface TechnicalAnalysisOutput {
  signal?: string;
  strength?: string;
  confidence?: number;
  reasoning?: string[];
  trendDirection?: string;
  trendStrength?: number;
  keyLevels?: { support: number[]; resistance: number[] };
  patterns?: string[];
  divergences?: string[];
  volumeConfirmation?: boolean;
  evidence?: string[];
  warnings?: string[];
}
