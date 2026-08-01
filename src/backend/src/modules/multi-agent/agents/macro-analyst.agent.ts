/**
 * TradingAI V2 — Macro Analyst Agent
 *
 * Monitors macroeconomic conditions: GDP, CPI, interest rates,
 * yield curves, DXY, and economic calendar events.
 *
 * This agent provides the "big picture" context that other agents lack.
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
export class MacroAnalystAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'MacroAnalyst',
      role: AgentRole.MACRO_ANALYST,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.3,
      maxTokens: 2500,
      timeoutMs: 15000,
      retryOnFailure: true,
      maxRetries: 1,
      systemPrompt: `You are an expert Macro Analyst for TradingAI, the world's first AI Operating System for Traders.

Your role: Assess the macroeconomic environment and its impact on the asset being analyzed.

FOCUS AREAS:
1. Monetary policy (interest rates, QE/QT, central bank rhetoric)
2. Inflation indicators (CPI, PPI, PCE)
3. Economic growth (GDP, PMI, employment data)
4. Currency strength (DXY, yield curves)
5. Risk appetite (VIX, credit spreads, safe haven flows)
6. Geopolitical factors
7. Upcoming economic calendar events and their potential impact

RULES:
1. Focus on MACRO only. Do not perform technical analysis.
2. Assess whether the macro environment favors risk-on or risk-off assets.
3. Identify the dominant macro theme (inflation, recession, growth, etc.).
4. Check for upcoming events that could cause volatility (FOMC, NFP, CPI releases).
5. If macro data is limited, acknowledge it honestly.

OUTPUT FORMAT (JSON only, no markdown):
{
  "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "strength": "STRONG" | "MODERATE" | "WEAK",
  "confidence": 0-100,
  "reasoning": ["point 1", "point 2", ...],
  "macroRegime": "RISK_ON" | "RISK_OFF" | "TRANSITIONING" | "UNCERTAIN",
  "dominantTheme": "description of the current macro theme",
  "upcomingRisks": [{"event": "...", "date": "...", "impact": "HIGH|MEDIUM|LOW"}],
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

    // Economic calendar
    if (
      context.marketData?.economicCalendar &&
      context.marketData.economicCalendar.length > 0
    ) {
      parts.push('');
      parts.push('Economic Calendar:');
      for (const ev of context.marketData.economicCalendar) {
        const actual = ev.actual ? ` Actual: ${ev.actual}` : '';
        parts.push(
          `  [${ev.impact}] ${ev.title} (${ev.country}/${ev.currency}) — ${ev.date.toISOString().split('T')[0]}${actual} Forecast: ${ev.forecast || 'N/A'} Previous: ${ev.previous || 'N/A'}`,
        );
      }
    }

    parts.push(this.formatMarketContext(context));
    parts.push(this.formatNews(context));

    parts.push('');
    parts.push(
      'Assess the macroeconomic environment and its impact on this asset. Provide your analysis as JSON.',
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    _context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<MacroOutput>(rawResponse);

    if (!parsed) {
      return {
        signal: SignalType.NEUTRAL,
        strength: SignalStrength.WEAK,
        confidence: 20,
        reasoning: ['Macro analysis could not be parsed.'],
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
        macroRegime: parsed.macroRegime || 'UNCERTAIN',
        dominantTheme: parsed.dominantTheme || 'Not identified',
        upcomingRisks: parsed.upcomingRisks || [],
      },
      evidence: this.ensureStringArray(parsed.evidence),
      warnings: this.ensureStringArray(parsed.warnings),
    };
  }
}

interface MacroOutput {
  signal?: string;
  strength?: string;
  confidence?: number;
  reasoning?: string[];
  macroRegime?: string;
  dominantTheme?: string;
  upcomingRisks?: Array<{
    event: string;
    date: string;
    impact: string;
  }>;
  evidence?: string[];
  warnings?: string[];
}
