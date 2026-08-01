/**
 * TradingAI V2 — Risk Manager Agent
 *
 * Evaluates position sizing, correlation risk, portfolio heat, drawdown limits,
 * and overall trade viability from a risk management perspective.
 *
 * This agent acts as a safety gate — it can reduce confidence or flag warnings
 * even when other agents are bullish.
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
export class RiskManagerAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'RiskManager',
      role: AgentRole.RISK_MANAGER,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.2,
      maxTokens: 2500,
      timeoutMs: 15000,
      retryOnFailure: true,
      maxRetries: 1,
      systemPrompt: `You are an expert Risk Manager for TradingAI, the world's first AI Operating System for Traders.

Your role: Evaluate the risk profile of a potential trade. You are the safety gate — your job is to PROTECT the trader.

RULES:
1. Assess ATR-based stop loss placement. Is the stop too tight or too wide?
2. Calculate risk-to-reward ratio from the entry, stop loss, and take profit levels.
3. Check for upcoming high-impact economic events that could cause slippage.
4. Evaluate volatility conditions — is the market too volatile or too quiet for this trade?
5. Check the user's psychology markers — flag if they are on a losing streak or at risk of revenge trading.
6. Assess position sizing based on the user's risk profile (if available).
7. Identify correlation risks with other assets.
8. Be CONSERVATIVE. When in doubt, lower confidence. Your job is to protect capital.
9. If the risk is too high, signal NEUTRAL regardless of what other agents say.

OUTPUT FORMAT (JSON only, no markdown):
{
  "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "strength": "STRONG" | "MODERATE" | "WEAK",
  "confidence": 0-100,
  "reasoning": ["point 1", "point 2", ...],
  "riskLevel": "LOW" | "MODERATE" | "HIGH" | "EXTREME",
  "suggestedPositionSize": 0-100,
  "suggestedStopDistance": number,
  "riskRewardRatio": number,
  "volatilityAssessment": "LOW" | "NORMAL" | "HIGH" | "EXTREME",
  "tradeViability": true | false,
  "evidence": ["evidence1", "evidence2"],
  "warnings": ["warning1", "warning2"]
}`,
    };
  }

  protected buildPrompt(context: AnalysisContext): string {
    const parts: string[] = [];

    parts.push(this.formatIndicators(context));

    // ATR-based risk context
    const ind = context.chartData.indicators;
    if (ind.atr !== undefined) {
      const atrPercent =
        ind.atrPercent ??
        (ind.atr / context.chartData.currentPrice) * 100;
      parts.push('');
      parts.push(`ATR: ${ind.atr} (${atrPercent.toFixed(2)}% of price)`);
      parts.push(
        `Suggested 1.5x ATR Stop: ${(context.chartData.currentPrice - 1.5 * ind.atr).toFixed(2)} (long) / ${(context.chartData.currentPrice + 1.5 * ind.atr).toFixed(2)} (short)`,
      );
    }

    // User risk profile
    if (context.userProfile) {
      parts.push('');
      parts.push('User Risk Profile:');
      parts.push(`  Experience: ${context.userProfile.experience}`);
      parts.push(`  Risk Tolerance: ${context.userProfile.riskTolerance}`);
      if (context.userProfile.maxRiskPerTrade)
        parts.push(
          `  Max Risk Per Trade: ${context.userProfile.maxRiskPerTrade}%`,
        );
      if (context.userProfile.accountSize)
        parts.push(
          `  Account Size: $${context.userProfile.accountSize.toLocaleString()}`,
        );
    }

    // Memory — especially psychology markers
    parts.push(this.formatMemory(context));

    // Upcoming economic events (risk of slippage/gaps)
    if (
      context.marketData?.economicCalendar &&
      context.marketData.economicCalendar.length > 0
    ) {
      parts.push('');
      parts.push('⚠ Upcoming High-Impact Events:');
      for (const ev of context.marketData.economicCalendar
        .filter((e) => e.impact === 'HIGH')
        .slice(0, 5)) {
        parts.push(
          `  [${ev.impact}] ${ev.title} — ${ev.date.toISOString().split('T')[0]}`,
        );
      }
    }

    parts.push('');
    parts.push(
      'Assess the risk profile and provide your analysis as JSON. Be conservative.',
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    _context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<RiskOutput>(rawResponse);

    if (!parsed) {
      // If risk assessment fails, default to cautious
      return {
        signal: SignalType.NEUTRAL,
        strength: SignalStrength.WEAK,
        confidence: 50,
        reasoning: [
          'Risk assessment could not be parsed. Defaulting to cautious.',
        ],
        data: { riskLevel: 'HIGH', tradeViability: false },
        warnings: ['Risk analysis unavailable — exercise caution'],
      };
    }

    return {
      signal: this.parseSignal(parsed.signal),
      strength: this.parseStrength(parsed.strength),
      confidence: this.clamp(Number(parsed.confidence) || 50, 0, 100),
      reasoning: this.ensureStringArray(parsed.reasoning),
      data: {
        riskLevel: parsed.riskLevel || 'MODERATE',
        suggestedPositionSize: this.clamp(
          Number(parsed.suggestedPositionSize) || 50,
          0,
          100,
        ),
        suggestedStopDistance: parsed.suggestedStopDistance,
        riskRewardRatio: parsed.riskRewardRatio,
        volatilityAssessment: parsed.volatilityAssessment || 'NORMAL',
        tradeViability: parsed.tradeViability !== false,
      },
      evidence: this.ensureStringArray(parsed.evidence),
      warnings: this.ensureStringArray(parsed.warnings),
    };
  }
}

interface RiskOutput {
  signal?: string;
  strength?: string;
  confidence?: number;
  reasoning?: string[];
  riskLevel?: string;
  suggestedPositionSize?: number;
  suggestedStopDistance?: number;
  riskRewardRatio?: number;
  volatilityAssessment?: string;
  tradeViability?: boolean;
  evidence?: string[];
  warnings?: string[];
}
