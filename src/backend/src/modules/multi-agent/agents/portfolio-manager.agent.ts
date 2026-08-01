/**
 * TradingAI V2 — Portfolio Manager Agent
 *
 * The final decision-maker in the multi-agent pipeline. Weighs:
 *   - Individual analyst signals and confidence
 *   - Debate outcome (bull vs bear verdict)
 *   - Risk assessment
 *   - Memory context (historical performance)
 *
 * Produces the final structured TradeRecommendation with specific
 * entry, stop loss, take profit levels, and a comprehensive reasoning chain.
 *
 * @module multi-agent/agents
 */
import { Injectable } from '@nestjs/common';
import { LlmProviderService } from '../llm/llm-provider.service';
import { BaseAgent, ParsedAgentOutput } from './base-agent';
import {
  AgentConfig,
  AgentResult,
  AgentRole,
  AnalysisContext,
  DebateOutcome,
  LlmProvider,
  SignalStrength,
  SignalType,
} from '../types/agent.types';

@Injectable()
export class PortfolioManagerAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  /** Analyst results injected before analysis */
  private analystResults: AgentResult[] = [];

  /** Debate outcome (may be null if debate was skipped) */
  private debateOutcome: DebateOutcome | null = null;

  setAnalystResults(results: AgentResult[]): void {
    this.analystResults = results;
  }

  setDebateOutcome(outcome: DebateOutcome | null): void {
    this.debateOutcome = outcome;
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'PortfolioManager',
      role: AgentRole.PORTFOLIO_MANAGER,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.2,
      maxTokens: 4000,
      timeoutMs: 25000,
      retryOnFailure: true,
      maxRetries: 2,
      systemPrompt: `You are the Portfolio Manager for TradingAI, the world's first AI Operating System for Traders.

You are the FINAL DECISION MAKER. You receive analysis from multiple specialist agents and an adversarial debate outcome. Your job is to synthesize everything into a single, actionable trade recommendation.

CRITICAL RULES:
1. NEVER output BUY/SELL/HOLD. Use BULLISH/BEARISH/NEUTRAL.
2. Always provide SPECIFIC price levels for entry, stop loss, and take profit.
3. Risk-to-reward must be at least 1.5:1 for any non-NEUTRAL signal.
4. If the risk manager flagged concerns, you MUST address them.
5. If the debate was contested (no consensus), lower your confidence.
6. Consider the user's psychology markers — warn about revenge trading or losing streaks.
7. The trade quality score should reflect the overall setup quality (alignment of multiple factors).

OUTPUT FORMAT (JSON only, no markdown):
{
  "signal": "BULLISH" | "BEARISH" | "NEUTRAL",
  "signalStrength": "STRONG" | "MODERATE" | "WEAK",
  "confidence": 0-100,
  "entry": { "price": number, "label": "description" },
  "stopLoss": { "price": number, "label": "description" },
  "takeProfit1": { "price": number, "label": "description" },
  "takeProfit2": { "price": number, "label": "description" },
  "riskReward": number,
  "holdingPeriod": "e.g., 4H-1D, Intraday, 2-5 days",
  "trend": {
    "direction": "UP" | "DOWN" | "SIDEWAYS",
    "strength": 0-100,
    "regime": "TRENDING_UP" | "TRENDING_DOWN" | "RANGING" | "VOLATILE" | "LOW_VOLATILITY"
  },
  "momentum": {
    "direction": "ACCELERATING" | "DECELERATING" | "NEUTRAL",
    "rsiZone": "OVERBOUGHT" | "OVERSOLD" | "NEUTRAL",
    "macdCrossover": "BULLISH" | "BEARISH" | "NONE",
    "divergence": "BULLISH_DIVERGENCE" | "BEARISH_DIVERGENCE" | "NONE",
    "score": 0-100
  },
  "support": [{ "price": number, "label": "description" }],
  "resistance": [{ "price": number, "label": "description" }],
  "reasons": ["reason 1", "reason 2", ...],
  "contradictingEvidence": ["contra 1", "contra 2", ...],
  "alternativeScenario": "What happens if the trade goes wrong",
  "probability": 0-100,
  "tradeQualityScore": 0-100,
  "coachNote": "Any pre-trade advice based on the trader's history (optional)"
}`,
    };
  }

  protected buildPrompt(context: AnalysisContext): string {
    const parts: string[] = [];

    parts.push(`Symbol: ${context.symbol}`);
    parts.push(`Current Price: ${context.chartData.currentPrice}`);
    parts.push(`Timeframe: ${context.timeframe}`);
    parts.push(`Analysis Depth: ${context.depth}`);
    parts.push('');

    // Inject all analyst results
    parts.push('═══ ANALYST TEAM SIGNALS ═══');
    for (const result of this.analystResults) {
      parts.push('');
      parts.push(
        `[${result.engine}] ${result.signal} ${result.strength} (${result.confidence}%)`,
      );
      parts.push(`  Reasoning: ${result.reasoning.slice(0, 3).join('; ')}`);
      if (result.evidence.length > 0) {
        parts.push(`  Evidence: ${result.evidence.slice(0, 3).join('; ')}`);
      }
      if (result.warnings.length > 0) {
        parts.push(`  ⚠ Warnings: ${result.warnings.join('; ')}`);
      }

      // Extract risk-specific data
      if (result.role === AgentRole.RISK_MANAGER && result.data) {
        parts.push(`  Risk Level: ${result.data.riskLevel || 'N/A'}`);
        parts.push(
          `  Trade Viability: ${result.data.tradeViability !== false ? 'YES' : 'NO'}`,
        );
        parts.push(
          `  Suggested Position Size: ${result.data.suggestedPositionSize || 'N/A'}%`,
        );
      }

      // Extract technical data
      if (result.role === AgentRole.TECHNICAL_ANALYST && result.data) {
        const keyLevels = result.data.keyLevels as {
          support?: number[];
          resistance?: number[];
        };
        if (keyLevels) {
          parts.push(
            `  Support: ${(keyLevels.support || []).join(', ')}`,
          );
          parts.push(
            `  Resistance: ${(keyLevels.resistance || []).join(', ')}`,
          );
        }
      }
    }

    // Debate outcome
    if (this.debateOutcome) {
      parts.push('');
      parts.push('═══ DEBATE OUTCOME ═══');
      parts.push(
        `Verdict: ${this.debateOutcome.verdict.signal} ${this.debateOutcome.verdict.strength} (${this.debateOutcome.verdict.confidence}%)`,
      );
      parts.push(
        `Bull Score: ${this.debateOutcome.bullScore} | Bear Score: ${this.debateOutcome.bearScore}`,
      );
      parts.push(
        `Consensus: ${this.debateOutcome.verdict.consensus ? 'YES' : 'NO'}`,
      );
      parts.push(`Summary: ${this.debateOutcome.verdict.consensusSummary}`);

      if (this.debateOutcome.unresolvedPoints.length > 0) {
        parts.push(
          `Unresolved: ${this.debateOutcome.unresolvedPoints.join('; ')}`,
        );
      }

      // Show final round arguments
      const lastRound =
        this.debateOutcome.rounds[this.debateOutcome.rounds.length - 1];
      if (lastRound) {
        parts.push(`Bull Thesis: ${lastRound.bullArgument.thesis}`);
        parts.push(`Bear Thesis: ${lastRound.bearArgument.thesis}`);
      }
    }

    // Memory context
    parts.push(this.formatMemory(context));

    // Core indicators for price level determination
    parts.push('');
    parts.push('═══ KEY INDICATOR DATA ═══');
    parts.push(this.formatIndicators(context));

    parts.push('');
    parts.push(
      'Synthesize ALL inputs above into a single trade recommendation with SPECIFIC price levels. Provide as JSON.',
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<PortfolioManagerOutput>(rawResponse);

    if (!parsed) {
      return {
        signal: SignalType.NEUTRAL,
        strength: SignalStrength.WEAK,
        confidence: 30,
        reasoning: [
          'Portfolio Manager could not produce structured output.',
        ],
        data: { rawResponse: rawResponse.substring(0, 1000) },
        warnings: ['Final recommendation could not be parsed. Manual review required.'],
      };
    }

    return {
      signal: this.parseSignal(parsed.signal),
      strength: this.parseStrength(parsed.signalStrength),
      confidence: this.clamp(Number(parsed.confidence) || 50, 0, 100),
      reasoning: this.ensureStringArray(parsed.reasons),
      data: {
        entry: parsed.entry || { price: context.chartData.currentPrice, label: 'Market' },
        stopLoss: parsed.stopLoss || null,
        takeProfit1: parsed.takeProfit1 || null,
        takeProfit2: parsed.takeProfit2 || null,
        riskReward: parsed.riskReward || 0,
        holdingPeriod: parsed.holdingPeriod || 'N/A',
        trend: parsed.trend || {
          direction: 'SIDEWAYS',
          strength: 50,
          regime: 'RANGING',
        },
        momentum: parsed.momentum || {
          direction: 'NEUTRAL',
          rsiZone: 'NEUTRAL',
          macdCrossover: 'NONE',
          divergence: 'NONE',
          score: 50,
        },
        support: parsed.support || [],
        resistance: parsed.resistance || [],
        contradictingEvidence: this.ensureStringArray(
          parsed.contradictingEvidence,
        ),
        alternativeScenario: parsed.alternativeScenario || 'Not provided',
        probability: this.clamp(Number(parsed.probability) || 50, 0, 100),
        tradeQualityScore: this.clamp(
          Number(parsed.tradeQualityScore) || 50,
          0,
          100,
        ),
        coachNote: parsed.coachNote || null,
      },
      evidence: this.ensureStringArray(parsed.reasons),
      warnings: this.ensureStringArray(parsed.contradictingEvidence),
    };
  }
}

interface PortfolioManagerOutput {
  signal?: string;
  signalStrength?: string;
  confidence?: number;
  entry?: { price: number; label: string };
  stopLoss?: { price: number; label: string };
  takeProfit1?: { price: number; label: string };
  takeProfit2?: { price: number; label: string };
  riskReward?: number;
  holdingPeriod?: string;
  trend?: {
    direction: string;
    strength: number;
    regime: string;
  };
  momentum?: {
    direction: string;
    rsiZone: string;
    macdCrossover: string;
    divergence: string;
    score: number;
  };
  support?: Array<{ price: number; label: string }>;
  resistance?: Array<{ price: number; label: string }>;
  reasons?: string[];
  contradictingEvidence?: string[];
  alternativeScenario?: string;
  probability?: number;
  tradeQualityScore?: number;
  coachNote?: string;
}
