/**
 * TradingAI V2 — Bear Researcher Agent
 *
 * Takes the combined analyst outputs and constructs the strongest
 * possible BEARISH case with supporting evidence. Participates in
 * the adversarial debate with the Bull Researcher.
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
export class BearResearcherAgent extends BaseAgent {
  constructor(llmProvider: LlmProviderService) {
    super(llmProvider);
  }

  /** Analyst results are injected before analysis */
  private analystResults: AgentResult[] = [];

  /** Previous bull argument to rebut (if in debate round > 1) */
  private previousBullArgument: string | null = null;

  setAnalystResults(results: AgentResult[]): void {
    this.analystResults = results;
  }

  setPreviousBullArgument(argument: string | null): void {
    this.previousBullArgument = argument;
  }

  protected getAgentConfig(): AgentConfig {
    return {
      name: 'BearResearcher',
      role: AgentRole.BEAR_RESEARCHER,
      llmProvider: LlmProvider.OLLAMA,
      model: 'llama3.1:latest',
      temperature: 0.4,
      maxTokens: 3000,
      timeoutMs: 20000,
      retryOnFailure: true,
      maxRetries: 1,
      systemPrompt: `You are the Bear Researcher for TradingAI's adversarial debate system.

Your role: Construct the STRONGEST possible BEARISH case against this trade, using evidence from the analyst team.

RULES:
1. You MUST argue for the bearish case, even if evidence is mixed.
2. Use specific data points and evidence from the analyst outputs to support your thesis.
3. Highlight every risk, weakness, and negative indicator the bulls might overlook.
4. If provided with a previous bull argument, REBUT it point by point.
5. Assign a confidence score that reflects how strong the bearish case actually is.
6. Do not fabricate data — only use evidence provided by the analysts.

OUTPUT FORMAT (JSON only, no markdown):
{
  "thesis": "Clear, concise bearish thesis statement",
  "confidence": 0-100,
  "evidence": ["specific evidence point 1", "specific evidence point 2", ...],
  "rebuttal": "Point-by-point rebuttal of bull argument (if applicable)",
  "weaknesses": ["acknowledged weakness in the bear case 1"],
  "keyRisk": "The single biggest risk to the bearish case (i.e., what could make the bulls right)"
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
    if (this.previousBullArgument) {
      parts.push('');
      parts.push('=== BULL RESEARCHER ARGUMENT TO REBUT ===');
      parts.push(this.previousBullArgument);
      parts.push('');
      parts.push(
        'Rebut the bull argument above while strengthening your bearish thesis.',
      );
    }

    parts.push('');
    parts.push(
      'Construct the strongest possible BEARISH case using the analyst evidence. Provide as JSON.',
    );

    return parts.join('\n');
  }

  protected parseResult(
    rawResponse: string,
    _context: AnalysisContext,
  ): ParsedAgentOutput {
    const parsed = this.safeParseJson<BearOutput>(rawResponse);

    if (!parsed) {
      return {
        signal: SignalType.BEARISH,
        strength: SignalStrength.WEAK,
        confidence: 30,
        reasoning: ['Bear case could not be parsed.'],
        data: {},
        warnings: ['LLM response could not be parsed as JSON'],
      };
    }

    return {
      signal: SignalType.BEARISH,
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

interface BearOutput {
  thesis?: string;
  confidence?: number;
  evidence?: string[];
  rebuttal?: string;
  weaknesses?: string[];
  keyRisk?: string;
}
