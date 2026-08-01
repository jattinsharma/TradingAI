/**
 * TradingAI V2 — Bull Researcher Agent
 *
 * Takes the combined analyst outputs and constructs the strongest
 * possible BULLISH case with supporting evidence. Participates in
 * the adversarial debate with the Bear Researcher.
 *
 * @module multi-agent/agents
 */
import { Injectable } from '@nestjs/common';
import { LlmProviderService } from '../llm/llm-provider.service';
import { BaseAgent, ParsedAgentOutput } from './base-agent';
import {
  AgentConfig,
  AgentRole,
  AgentResult,
  AnalysisContext,
  LlmProvider,
  SignalStrength,
  SignalType,
} from '../types/agent.types';

@Injectable()
export class BullResearcherAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  /** Analyst results are injected before analysis */
  private analystResults: AgentResult[] = [];

  /** Previous bear argument to rebut (if in debate round > 1) */
  private previousBearArgument: string | null = null;

  setAnalystResults(results: AgentResult[]): void {
    this.analystResults = results;
  }

  setPreviousBearArgument(argument: string | null): void {
    this.previousBearArgument = argument;
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'BullResearcher',
      role: AgentRole.BULL_RESEARCHER,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.4,
      maxTokens: 3000,
      timeoutMs: 20000,
      retryOnFailure: true,
      maxRetries: 1,
      systemPrompt: `You are the Bull Researcher for TradingAI's adversarial debate system.

Your role: Construct the STRONGEST possible BULLISH case for this trade, using evidence from the analyst team.

RULES:
1. You MUST argue for the bullish case, even if evidence is mixed.
2. Use specific data points and evidence from the analyst outputs to support your thesis.
3. Acknowledge weaknesses honestly but explain why they don't invalidate the bullish thesis.
4. If provided with a previous bear argument, REBUT it point by point.
5. Assign a confidence score that reflects how strong the bullish case actually is.
6. Do not fabricate data — only use evidence provided by the analysts.

OUTPUT FORMAT (JSON only, no markdown):
{
  "thesis": "Clear, concise bullish thesis statement",
  "confidence": 0-100,
  "evidence": ["specific evidence point 1", "specific evidence point 2", ...],
  "rebuttal": "Point-by-point rebuttal of bear argument (if applicable)",
  "weaknesses": ["acknowledged weakness 1", "acknowledged weakness 2"],
  "keyRisk": "The single biggest risk to the bullish case"
}`,
    };
  }

  protected buildPrompt(context: AnalysisContext): string {
    const parts: string[] = [];

    parts.push(`Symbol: ${context.symbol}`);
    parts.push(`Current Price: ${context.chartData.currentPrice}`);
    parts.push(`Timeframe: ${context.timeframe}`);
    parts.push('');

    // Inject analyst results
    parts.push('=== ANALYST TEAM OUTPUTS ===');
    for (const result of this.analystResults) {
      parts.push('');
      parts.push(`[${result.engine}] Signal: ${result.signal} (${result.confidence}%)`);
      parts.push(`Reasoning: ${result.reasoning.join('; ')}`);
      if (result.evidence.length > 0) {
        parts.push(`Evidence: ${result.evidence.join('; ')}`);
      }
      if (result.warnings.length > 0) {
        parts.push(`Warnings: ${result.warnings.join('; ')}`);
      }
    }

    // If this is a rebuttal round
    if (this.previousBearArgument) {
      parts.push('');
      parts.push('=== BEAR RESEARCHER ARGUMENT TO REBUT ===');
      parts.push(this.previousBearArgument);
      parts.push('');
      parts.push(
        'Rebut the bear argument above while strengthening your bullish thesis.',
      );
    }

    parts.push('');
    parts.push(
      'Construct the strongest possible BULLISH case using the analyst evidence. Provide as JSON.',
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    _context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<BullOutput>(rawResponse);

    if (!parsed) {
      return {
        signal: SignalType.BULLISH,
        strength: SignalStrength.WEAK,
        confidence: 30,
        reasoning: ['Bull case could not be parsed.'],
        data: {},
        warnings: ['LLM response could not be parsed as JSON'],
      };
    }

    return {
      signal: SignalType.BULLISH,
      strength:
        Number(parsed.confidence) >= 70
          ? SignalStrength.STRONG
          : Number(parsed.confidence) >= 40
            ? SignalStrength.MODERATE
            : SignalStrength.WEAK,
      confidence: this.clamp(Number(parsed.confidence) || 50, 0, 100),
      reasoning: [
        parsed.thesis || 'No thesis provided',
        ...(parsed.rebuttal ? [`Rebuttal: ${parsed.rebuttal}`] : []),
      ],
      data: {
        thesis: parsed.thesis || '',
        weaknesses: this.ensureStringArray(parsed.weaknesses),
        keyRisk: parsed.keyRisk || '',
        rebuttal: parsed.rebuttal || null,
      },
      evidence: this.ensureStringArray(parsed.evidence),
      warnings: this.ensureStringArray(parsed.weaknesses),
    };
  }
}

interface BullOutput {
  thesis?: string;
  confidence?: number;
  evidence?: string[];
  rebuttal?: string;
  weaknesses?: string[];
  keyRisk?: string;
}
