/**
 * TradingAI V2 — Debate Orchestrator
 *
 * Orchestrates multi-round adversarial debates between the Bull and Bear
 * researchers. Each round:
 *   1. Bull presents/rebuts
 *   2. Bear presents/rebuts
 *   3. Quality is scored
 *
 * The debate produces a balanced verdict with confidence scores from both
 * sides, enabling the Portfolio Manager to make a more informed decision.
 *
 * Inspired by TradingAgents' debate architecture, rewritten for NestJS/TypeScript.
 *
 * @module multi-agent/debate
 */
import { Injectable, Logger } from '@nestjs/common';
import {
  AgentResult,
  AnalysisContext,
  DebateOutcome,
  DebateRound,
  SignalStrength,
  SignalType,
} from '../types/agent.types';
import { BullResearcherAgent } from '../agents/bull-researcher.agent';
import { BearResearcherAgent } from '../agents/bear-researcher.agent';

@Injectable()
export class DebateOrchestratorService {
  private readonly logger = new Logger(DebateOrchestratorService.name);

  constructor(
    private readonly bullResearcher: BullResearcherAgent,
    private readonly bearResearcher: BearResearcherAgent,
  ) {}

  /**
   * Run the multi-round debate between bull and bear researchers.
   *
   * @param context   The analysis context
   * @param results   Combined analyst results to feed to both researchers
   * @param maxRounds Maximum debate rounds (1-3)
   */
  async runDebate(
    context: AnalysisContext,
    results: AgentResult[],
    maxRounds: number = 2,
  ): Promise<DebateOutcome> {
    const startTime = Date.now();
    const rounds: DebateRound[] = [];
    let totalTokens = 0;

    this.logger.log(
      `Starting ${maxRounds}-round debate for ${context.symbol} on ${context.timeframe}`,
    );

    // Inject analyst results into both researchers
    this.bullResearcher.setAnalystResults(results);
    this.bearResearcher.setAnalystResults(results);

    // Reset previous arguments
    this.bullResearcher.setPreviousBearArgument(null);
    this.bearResearcher.setPreviousBullArgument(null);

    for (let round = 1; round <= maxRounds; round++) {
      this.logger.log(`Debate Round ${round}/${maxRounds}`);

      // Bull argues first
      const bullResult = await this.bullResearcher.analyze(context);
      totalTokens += bullResult.tokensUsed.total;

      // Bear argues second (and can respond to bull's argument)
      this.bearResearcher.setPreviousBullArgument(
        this.extractThesis(bullResult),
      );
      const bearResult = await this.bearResearcher.analyze(context);
      totalTokens += bearResult.tokensUsed.total;

      // Set up next round's rebuttal context
      this.bullResearcher.setPreviousBearArgument(
        this.extractThesis(bearResult),
      );

      // Record this round
      rounds.push({
        round,
        bullArgument: {
          thesis:
            (bullResult.data.thesis as string) || bullResult.reasoning[0] || '',
          evidence: bullResult.evidence,
          rebuttal: (bullResult.data.rebuttal as string) || undefined,
          confidence: bullResult.confidence,
        },
        bearArgument: {
          thesis:
            (bearResult.data.thesis as string) || bearResult.reasoning[0] || '',
          evidence: bearResult.evidence,
          rebuttal: (bearResult.data.rebuttal as string) || undefined,
          confidence: bearResult.confidence,
        },
      });

      this.logger.log(
        `Round ${round}: Bull ${bullResult.confidence}% vs Bear ${bearResult.confidence}%`,
      );

      // Early termination if one side clearly dominates (30+ point gap)
      if (
        round > 1 &&
        Math.abs(bullResult.confidence - bearResult.confidence) > 30
      ) {
        this.logger.log(
          `Early termination: clear winner after round ${round}`,
        );
        break;
      }
    }

    // Score and synthesize
    const outcome = this.synthesizeDebate(rounds, totalTokens, startTime);

    this.logger.log(
      `Debate complete: ${outcome.verdict.signal} (${outcome.verdict.confidence}%) — Bull: ${outcome.bullScore}, Bear: ${outcome.bearScore} — ${Date.now() - startTime}ms`,
    );

    return outcome;
  }

  /**
   * Synthesize all debate rounds into a final verdict.
   */
  private synthesizeDebate(
    rounds: DebateRound[],
    totalTokens: number,
    startTime: number,
  ): DebateOutcome {
    // Calculate weighted scores (later rounds get more weight)
    let bullScore = 0;
    let bearScore = 0;
    let totalWeight = 0;

    for (const round of rounds) {
      const weight = round.round; // Later rounds are weighted more
      bullScore += round.bullArgument.confidence * weight;
      bearScore += round.bearArgument.confidence * weight;
      totalWeight += weight;
    }

    bullScore = totalWeight > 0 ? bullScore / totalWeight : 50;
    bearScore = totalWeight > 0 ? bearScore / totalWeight : 50;

    // Determine verdict
    const gap = bullScore - bearScore;
    let signal: SignalType;
    let strength: SignalStrength;
    let consensus: boolean;

    if (Math.abs(gap) < 10) {
      // Very close debate — effectively a tie
      signal = SignalType.NEUTRAL;
      strength = SignalStrength.WEAK;
      consensus = false;
    } else if (gap >= 30) {
      signal = SignalType.BULLISH;
      strength = SignalStrength.STRONG;
      consensus = true;
    } else if (gap >= 10) {
      signal = SignalType.BULLISH;
      strength = SignalStrength.MODERATE;
      consensus = false;
    } else if (gap <= -30) {
      signal = SignalType.BEARISH;
      strength = SignalStrength.STRONG;
      consensus = true;
    } else {
      signal = SignalType.BEARISH;
      strength = SignalStrength.MODERATE;
      consensus = false;
    }

    // Build consensus summary
    const lastRound = rounds[rounds.length - 1];
    const consensusSummary = consensus
      ? `Clear ${signal.toLowerCase()} consensus with ${Math.abs(gap).toFixed(0)} point advantage.`
      : `Contested debate: Bull ${bullScore.toFixed(0)}% vs Bear ${bearScore.toFixed(0)}%. ${signal === SignalType.NEUTRAL ? 'No clear direction.' : `Slight ${signal.toLowerCase()} edge.`}`;

    // Collect unresolved points
    const unresolvedPoints: string[] = [];
    if (lastRound) {
      const bullWeaknesses =
        (lastRound.bullArgument as unknown as { weaknesses?: string[] })
          ?.weaknesses || [];
      const bearWeaknesses =
        (lastRound.bearArgument as unknown as { weaknesses?: string[] })
          ?.weaknesses || [];
      unresolvedPoints.push(
        ...bullWeaknesses.slice(0, 2),
        ...bearWeaknesses.slice(0, 2),
      );
    }

    // Confidence is based on the winning side's score, modulated by the gap
    const confidence = Math.min(
      95,
      Math.max(
        20,
        Math.max(bullScore, bearScore) * (1 - 0.3 / (1 + Math.abs(gap) / 20)),
      ),
    );

    return {
      rounds,
      verdict: {
        signal,
        strength,
        confidence: Math.round(confidence),
        consensus,
        consensusSummary,
      },
      bullScore: Math.round(bullScore),
      bearScore: Math.round(bearScore),
      unresolvedPoints,
      totalTokens,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Extract a human-readable thesis from an agent result for rebuttal context.
   */
  private extractThesis(result: AgentResult): string {
    const parts: string[] = [];

    if (result.data.thesis) {
      parts.push(`Thesis: ${result.data.thesis}`);
    }

    if (result.evidence.length > 0) {
      parts.push(`Evidence: ${result.evidence.join('; ')}`);
    }

    if (result.reasoning.length > 0) {
      parts.push(`Reasoning: ${result.reasoning.join('; ')}`);
    }

    return parts.join('\n');
  }
}
