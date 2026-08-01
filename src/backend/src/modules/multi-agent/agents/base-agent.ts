/**
 * TradingAI V2 — Base Agent Abstract Class
 *
 * Every LLM-powered agent in the multi-agent system extends this class.
 * It provides:
 *   - Standardized LLM communication via LlmProviderService
 *   - Structured JSON output parsing with validation and fallback
 *   - Retry logic with exponential backoff
 *   - Token counting and latency tracking
 *   - Consistent logging
 *
 * Agents only need to implement:
 *   1. getAgentConfig() — their role-specific configuration
 *   2. buildPrompt()    — their analysis prompt from context
 *   3. parseResult()    — their output parser (with validation)
 *
 * @module multi-agent/agents
 */
import { Logger } from '@nestjs/common';
import { LlmProviderService } from '../llm/llm-provider.service';
import {
  IAnalysisEngine,
  AgentConfig,
  AgentResult,
  AgentRole,
  AnalysisContext,
  EngineResult,
  HealthStatus,
  LlmProvider,
  LlmResponse,
  SignalStrength,
  SignalType,
} from '../types/agent.types';

/**
 * Abstract base class for all LLM-powered agents in the multi-agent system.
 */
export abstract class BaseAgent implements IAnalysisEngine {
  protected readonly logger: Logger;
  private consecutiveFailures = 0;
  private lastHealthCheck: Date = new Date();

  constructor(protected readonly llmProvider: LlmProviderService) {
    const config = this.getAgentConfig();
    this.logger = new Logger(`Agent:${config.name}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  IAnalysisEngine interface implementation
  // ─────────────────────────────────────────────────────────────────────────

  get name(): string {
    return this.getAgentConfig().name;
  }

  get version(): string {
    return '2.0.0';
  }

  get role(): AgentRole {
    return this.getAgentConfig().role;
  }

  requiresLlm(): boolean {
    return true;
  }

  getHealth(): HealthStatus {
    if (this.consecutiveFailures >= 3) return HealthStatus.UNHEALTHY;
    if (this.consecutiveFailures >= 1) return HealthStatus.DEGRADED;
    return HealthStatus.HEALTHY;
  }

  /**
   * Main analysis entry point. Handles the full lifecycle:
   * prompt construction → LLM call → parsing → validation → retry.
   */
  async analyze(context: AnalysisContext): Promise<AgentResult> {
    const config = this.getAgentConfig();
    const startTime = Date.now();

    this.logger.log(
      `Analyzing ${context.symbol} on ${context.timeframe} (depth: ${context.depth})`,
    );

    let lastError: Error | null = null;
    const maxAttempts = config.retryOnFailure ? config.maxRetries + 1 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // 1. Build the prompt
        const userPrompt = this.buildPrompt(context);

        // 2. Call LLM
        const llmResponse = await this.llmProvider.complete(
          {
            systemPrompt: config.systemPrompt,
            userPrompt,
            temperature: config.temperature,
            maxTokens: config.maxTokens,
            jsonMode: true,
          },
          LlmProvider[config.llmProvider as keyof typeof LlmProvider],
        );

        // 3. Parse and validate the response
        const parsed = this.parseResult(llmResponse.content, context);

        // 4. Build the AgentResult
        const result: AgentResult = {
          engine: config.name,
          role: config.role,
          confidence: this.clamp(parsed.confidence, 0, 100),
          signal: parsed.signal,
          strength: parsed.strength || SignalStrength.MODERATE,
          reasoning: parsed.reasoning,
          data: parsed.data,
          evidence: parsed.evidence || [],
          warnings: parsed.warnings || [],
          tokensUsed: llmResponse.tokensUsed,
          model: llmResponse.model,
          cached: llmResponse.cached,
          latencyMs: Date.now() - startTime,
          timestamp: new Date(),
        };

        // Reset failure counter on success
        this.consecutiveFailures = 0;

        this.logger.log(
          `✓ ${context.symbol}: ${result.signal} (${result.confidence}%) in ${result.latencyMs}ms [${result.tokensUsed.total} tokens]`,
        );

        return result;
      } catch (error) {
        lastError = error as Error;
        this.consecutiveFailures++;

        if (attempt < maxAttempts) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          this.logger.warn(
            `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${backoffMs}ms...`,
          );
          await this.sleep(backoffMs);
        }
      }
    }

    // All attempts failed — return a degraded result
    this.logger.error(
      `All ${maxAttempts} attempts failed for ${context.symbol}: ${lastError?.message}`,
    );

    return this.buildFallbackResult(context, startTime, lastError);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Abstract methods (implemented by each specific agent)
  // ─────────────────────────────────────────────────────────────────────────

  /** Returns the agent's configuration (role, model, prompts, etc.) */
  protected abstract getAgentConfig(): AgentConfig;

  /**
   * Builds the user prompt from the analysis context.
   * Each agent constructs a prompt relevant to its specialty.
   */
  protected abstract buildPrompt(context: AnalysisContext): string;

  /**
   * Parses the raw LLM response into a structured result.
   * Each agent validates its domain-specific output.
   */
  protected abstract parseResult(
    rawResponse: string,
    context: AnalysisContext,
  ): ParsedAgentOutput;

  // ─────────────────────────────────────────────────────────────────────────
  //  Shared utilities for subclasses
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Safely parse a JSON string from the LLM response.
   * Handles code fences, trailing commas, and partial JSON.
   */
  protected safeParseJson<T = Record<string, unknown>>(raw: string): T | null {
    try {
      // Strip markdown code fences
      let cleaned = raw
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

      // Remove trailing commas before closing brackets/braces
      cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

      return JSON.parse(cleaned) as T;
    } catch {
      // Try to extract JSON object from surrounding text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const cleaned = jsonMatch[0].replace(/,\s*([\]}])/g, '$1');
          return JSON.parse(cleaned) as T;
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  /**
   * Parse a signal string into the SignalType enum.
   */
  protected parseSignal(value: string | undefined): SignalType {
    if (!value) return SignalType.NEUTRAL;
    const upper = value.toUpperCase().trim();
    if (upper.includes('BULL') || upper === 'LONG' || upper === 'BUY')
      return SignalType.BULLISH;
    if (upper.includes('BEAR') || upper === 'SHORT' || upper === 'SELL')
      return SignalType.BEARISH;
    return SignalType.NEUTRAL;
  }

  /**
   * Parse a strength string into the SignalStrength enum.
   */
  protected parseStrength(value: string | undefined): SignalStrength {
    if (!value) return SignalStrength.MODERATE;
    const upper = value.toUpperCase().trim();
    if (upper === 'STRONG' || upper === 'HIGH') return SignalStrength.STRONG;
    if (upper === 'WEAK' || upper === 'LOW') return SignalStrength.WEAK;
    return SignalStrength.MODERATE;
  }

  /**
   * Ensure a value is an array of strings.
   */
  protected ensureStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((v) => typeof v === 'string');
    }
    if (typeof value === 'string') return [value];
    return [];
  }

  /**
   * Clamp a number between min and max.
   */
  protected clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Format indicator data as a readable block for prompt injection.
   */
  protected formatIndicators(context: AnalysisContext): string {
    const ind = context.chartData.indicators;
    const lines: string[] = [];

    lines.push(`Symbol: ${context.symbol}`);
    lines.push(`Timeframe: ${context.timeframe}`);
    lines.push(`Current Price: ${context.chartData.currentPrice}`);
    lines.push('');
    lines.push('Technical Indicators:');

    if (ind.rsi !== undefined) lines.push(`  RSI(14): ${ind.rsi}`);
    if (ind.ema20 !== undefined) lines.push(`  EMA 20: ${ind.ema20}`);
    if (ind.ema50 !== undefined) lines.push(`  EMA 50: ${ind.ema50}`);
    if (ind.ema200 !== undefined) lines.push(`  EMA 200: ${ind.ema200}`);
    if (ind.sma20 !== undefined) lines.push(`  SMA 20: ${ind.sma20}`);
    if (ind.sma50 !== undefined) lines.push(`  SMA 50: ${ind.sma50}`);
    if (ind.sma200 !== undefined) lines.push(`  SMA 200: ${ind.sma200}`);
    if (ind.atr !== undefined) lines.push(`  ATR: ${ind.atr}`);
    if (ind.atrPercent !== undefined) lines.push(`  ATR%: ${ind.atrPercent}%`);
    if (ind.volume !== undefined) lines.push(`  Volume: ${ind.volume}`);
    if (ind.volumeRatio !== undefined)
      lines.push(`  Volume Ratio (vs avg): ${ind.volumeRatio}`);
    if (ind.adx !== undefined) lines.push(`  ADX: ${ind.adx}`);
    if (ind.vwap !== undefined) lines.push(`  VWAP: ${ind.vwap}`);

    if (ind.macd) {
      lines.push(`  MACD Line: ${ind.macd.macd}`);
      lines.push(`  MACD Signal: ${ind.macd.signal}`);
      lines.push(`  MACD Histogram: ${ind.macd.histogram}`);
    }

    if (ind.bollingerBands) {
      lines.push(`  Bollinger Upper: ${ind.bollingerBands.upper}`);
      lines.push(`  Bollinger Middle: ${ind.bollingerBands.middle}`);
      lines.push(`  Bollinger Lower: ${ind.bollingerBands.lower}`);
    }

    if (ind.stochastic) {
      lines.push(`  Stochastic K: ${ind.stochastic.k}`);
      lines.push(`  Stochastic D: ${ind.stochastic.d}`);
    }

    if (ind.ichimoku) {
      lines.push(`  Ichimoku Tenkan: ${ind.ichimoku.tenkan}`);
      lines.push(`  Ichimoku Kijun: ${ind.ichimoku.kijun}`);
      lines.push(`  Ichimoku Senkou A: ${ind.ichimoku.senkouA}`);
      lines.push(`  Ichimoku Senkou B: ${ind.ichimoku.senkouB}`);
    }

    return lines.join('\n');
  }

  /**
   * Format memory context for prompt injection.
   */
  protected formatMemory(context: AnalysisContext): string {
    if (!context.memory) return '';

    const lines: string[] = ['', 'Historical Memory:'];
    const mem = context.memory;

    if (mem.symbolHistory) {
      const sh = mem.symbolHistory;
      lines.push(`  Past trades on ${context.symbol}: ${sh.totalTrades}`);
      lines.push(`  Win rate: ${sh.winRate.toFixed(1)}%`);
      lines.push(`  Avg PnL: ${sh.avgPnlPercent.toFixed(2)}%`);
      if (sh.lastTradeResult)
        lines.push(`  Last trade: ${sh.lastTradeResult}`);
      if (sh.bestSetup) lines.push(`  Best setup: ${sh.bestSetup}`);
      if (sh.worstMistake) lines.push(`  Common mistake: ${sh.worstMistake}`);
    }

    if (mem.psychologyMarkers) {
      const pm = mem.psychologyMarkers;
      if (pm.isOnLosingStreak)
        lines.push(
          `  ⚠ LOSING STREAK: ${pm.streakLength} consecutive losses`,
        );
      if (pm.recentOvertradingDetected)
        lines.push('  ⚠ OVERTRADING DETECTED in recent sessions');
      if (pm.revengeTradeRisk && pm.revengeTradeRisk > 50)
        lines.push(
          `  ⚠ REVENGE TRADE RISK: ${pm.revengeTradeRisk}%`,
        );
    }

    if (
      mem.patternEffectiveness &&
      mem.patternEffectiveness.length > 0
    ) {
      lines.push('  Pattern performance:');
      for (const p of mem.patternEffectiveness.slice(0, 5)) {
        lines.push(
          `    ${p.pattern}: ${p.winRate.toFixed(0)}% win (${p.sampleSize} trades)`,
        );
      }
    }

    return lines.join('\n');
  }

  /**
   * Format news items for prompt injection.
   */
  protected formatNews(context: AnalysisContext): string {
    const news = context.marketData?.news;
    if (!news || news.length === 0) return '';

    const lines = ['', 'Recent News:'];
    for (const item of news.slice(0, 10)) {
      lines.push(
        `  - [${item.sentiment}] ${item.title} (${item.source})`,
      );
      if (item.summary) lines.push(`    ${item.summary}`);
    }
    return lines.join('\n');
  }

  /**
   * Format market context for prompt injection.
   */
  protected formatMarketContext(context: AnalysisContext): string {
    const md = context.marketData;
    if (!md) return '';

    const lines: string[] = ['', 'Market Context:'];

    if (md.fearGreedIndex !== undefined)
      lines.push(`  Fear & Greed Index: ${md.fearGreedIndex}`);
    if (md.btcDominance !== undefined)
      lines.push(`  BTC Dominance: ${md.btcDominance}%`);
    if (md.volume24h !== undefined)
      lines.push(`  24h Volume: ${md.volume24h}`);

    if (md.economicCalendar && md.economicCalendar.length > 0) {
      lines.push('  Upcoming Economic Events:');
      for (const ev of md.economicCalendar.slice(0, 5)) {
        lines.push(
          `    [${ev.impact}] ${ev.title} (${ev.country}) — ${ev.date.toISOString().split('T')[0]}`,
        );
      }
    }

    if (md.correlatedAssets && md.correlatedAssets.length > 0) {
      lines.push('  Correlated Assets:');
      for (const ca of md.correlatedAssets.slice(0, 5)) {
        lines.push(
          `    ${ca.symbol}: ${ca.price} (correlation: ${ca.correlation.toFixed(2)})`,
        );
      }
    }

    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build a fallback result when all LLM attempts fail.
   */
  private buildFallbackResult(
    context: AnalysisContext,
    startTime: number,
    error: Error | null,
  ): AgentResult {
    return {
      engine: this.name,
      role: this.role,
      confidence: 0,
      signal: SignalType.NEUTRAL,
      strength: SignalStrength.WEAK,
      reasoning: [
        `Agent ${this.name} failed to produce analysis: ${error?.message ?? 'Unknown error'}`,
      ],
      data: {},
      evidence: [],
      warnings: [
        `This agent's analysis is unavailable. The recommendation should not rely on this agent's input.`,
      ],
      tokensUsed: { prompt: 0, completion: 0, total: 0 },
      model: 'none',
      cached: false,
      latencyMs: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Parsed output type (returned by each agent's parseResult method)
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedAgentOutput {
  signal: SignalType;
  strength?: SignalStrength;
  confidence: number;
  reasoning: string[];
  data: Record<string, unknown>;
  evidence?: string[];
  warnings?: string[];
}
