/**
 * TradingAI V2 — LLM Provider Service
 *
 * Unified abstraction layer for all LLM providers (Ollama, OpenAI, Gemini, Anthropic).
 * Every agent in the multi-agent system routes LLM calls through this service,
 * enabling provider-agnostic agent code, automatic fallback, token tracking,
 * and cost management.
 *
 * @module multi-agent/llm
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmProvider,
  LlmProviderConfig,
  LlmRequest,
  LlmResponse,
  HealthStatus,
} from '../types/agent.types';

/** Provider health record */
export interface ProviderHealth {
  status: HealthStatus;
  lastChecked: Date;
  consecutiveFailures: number;
  avgLatencyMs: number;
}

@Injectable()
export class LlmProviderService implements OnModuleInit {
  private readonly logger = new Logger(LlmProviderService.name);
  private providers: Map<LlmProvider, LlmProviderConfig> = new Map();
  private healthMap: Map<LlmProvider, ProviderHealth> = new Map();
  private primaryProvider: LlmProvider = LlmProvider.OLLAMA;
  private fallbackChain: LlmProvider[] = [];

  /** Cumulative token usage for cost tracking */
  private tokenUsage = {
    prompt: 0,
    completion: 0,
    total: 0,
    requestCount: 0,
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.initializeProviders();
    await this.healthCheckAll();
  }

  /**
   * Initialize all configured LLM providers from environment variables.
   */
  private initializeProviders(): void {
    // Ollama (local, always configured)
    const ollamaUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      'http://localhost:11434',
    );
    const ollamaModel = this.configService.get<string>(
      'OLLAMA_MODEL',
      'llama3.1:latest',
    );
    this.providers.set(LlmProvider.OLLAMA, {
      provider: LlmProvider.OLLAMA,
      model: ollamaModel,
      baseUrl: ollamaUrl,
      maxTokens: 4096,
      temperature: 0.3,
      timeoutMs: 30000,
    });

    // OpenAI (if API key is set)
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set(LlmProvider.OPENAI, {
        provider: LlmProvider.OPENAI,
        model: this.configService.get<string>('OPENAI_MODEL', 'gpt-4o'),
        baseUrl: 'https://api.openai.com/v1',
        apiKey: openaiKey,
        maxTokens: 4096,
        temperature: 0.3,
        timeoutMs: 30000,
      });
    }

    // Google Gemini (if API key is set)
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (geminiKey) {
      this.providers.set(LlmProvider.GEMINI, {
        provider: LlmProvider.GEMINI,
        model: this.configService.get<string>(
          'GEMINI_MODEL',
          'gemini-2.5-flash',
        ),
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: geminiKey,
        maxTokens: 4096,
        temperature: 0.3,
        timeoutMs: 30000,
      });
    }

    // Anthropic Claude (if API key is set)
    const anthropicKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.providers.set(LlmProvider.ANTHROPIC, {
        provider: LlmProvider.ANTHROPIC,
        model: this.configService.get<string>(
          'ANTHROPIC_MODEL',
          'claude-sonnet-4-20250514',
        ),
        baseUrl: 'https://api.anthropic.com/v1',
        apiKey: anthropicKey,
        maxTokens: 4096,
        temperature: 0.3,
        timeoutMs: 30000,
      });
    }

    // Determine primary provider and fallback chain
    const primary = this.configService.get<string>(
      'LLM_PRIMARY_PROVIDER',
      'OLLAMA',
    );
    this.primaryProvider =
      LlmProvider[primary as keyof typeof LlmProvider] || LlmProvider.OLLAMA;

    // Build fallback chain: primary → others in order
    const allProviders = Array.from(this.providers.keys());
    this.fallbackChain = [
      this.primaryProvider,
      ...allProviders.filter((p) => p !== this.primaryProvider),
    ].filter((p) => this.providers.has(p));

    this.logger.log(
      `LLM providers initialized. Primary: ${this.primaryProvider}, Fallback chain: [${this.fallbackChain.join(' → ')}]`,
    );
  }

  /**
   * Send a request to the LLM. Automatically falls back to the next provider
   * in the chain if the primary fails.
   */
  async complete(
    request: LlmRequest,
    preferredProvider?: LlmProvider,
  ): Promise<LlmResponse> {
    const chain = preferredProvider
      ? [
          preferredProvider,
          ...this.fallbackChain.filter((p) => p !== preferredProvider),
        ]
      : [...this.fallbackChain];

    let lastError: Error | null = null;

    for (const provider of chain) {
      const config = this.providers.get(provider);
      if (!config) continue;

      const health = this.healthMap.get(provider);
      if (health && health.status === HealthStatus.UNHEALTHY) {
        this.logger.warn(
          `Skipping unhealthy provider: ${provider}`,
        );
        continue;
      }

      try {
        const startTime = Date.now();
        const response = await this.callProvider(config, request);
        const latencyMs = Date.now() - startTime;

        // Update health
        this.updateHealth(provider, true, latencyMs);

        // Track tokens
        this.tokenUsage.prompt += response.tokensUsed.prompt;
        this.tokenUsage.completion += response.tokensUsed.completion;
        this.tokenUsage.total += response.tokensUsed.total;
        this.tokenUsage.requestCount++;

        return { ...response, latencyMs };
      } catch (error) {
        lastError = error as Error;
        this.updateHealth(provider, false, 0);
        this.logger.warn(
          `Provider ${provider} failed: ${lastError.message}. Trying next...`,
        );
      }
    }

    throw new Error(
      `All LLM providers failed. Last error: ${lastError?.message ?? 'No providers available'}`,
    );
  }

  /**
   * Route the request to the correct provider-specific implementation.
   */
  private async callProvider(
    config: LlmProviderConfig,
    request: LlmRequest,
  ): Promise<LlmResponse> {
    switch (config.provider) {
      case LlmProvider.OLLAMA:
        return this.callOllama(config, request);
      case LlmProvider.OPENAI:
        return this.callOpenAI(config, request);
      case LlmProvider.GEMINI:
        return this.callGemini(config, request);
      case LlmProvider.ANTHROPIC:
        return this.callAnthropic(config, request);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  OLLAMA (local models via ollama serve)
  // ─────────────────────────────────────────────────────────────────────────

  private async callOllama(
    config: LlmProviderConfig,
    request: LlmRequest,
  ): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.timeoutMs,
    );

    try {
      const response = await fetch(`${config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          prompt: `${request.systemPrompt}\n\n${request.userPrompt}`,
          stream: false,
          ...(request.jsonMode && { format: 'json' }),
          options: {
            temperature: request.temperature ?? config.temperature,
            num_predict: request.maxTokens ?? config.maxTokens,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(
          `Ollama error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();

      return {
        content: result.response,
        tokensUsed: {
          prompt: result.prompt_eval_count || 0,
          completion: result.eval_count || 0,
          total: (result.prompt_eval_count || 0) + (result.eval_count || 0),
        },
        model: config.model,
        latencyMs: 0, // Will be set by caller
        cached: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  OPENAI (GPT-4o, GPT-5, etc.)
  // ─────────────────────────────────────────────────────────────────────────

  private async callOpenAI(
    config: LlmProviderConfig,
    request: LlmRequest,
  ): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.timeoutMs,
    );

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.userPrompt },
          ],
          temperature: request.temperature ?? config.temperature,
          max_tokens: request.maxTokens ?? config.maxTokens,
          ...(request.jsonMode && {
            response_format: { type: 'json_object' },
          }),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenAI error: ${response.status} ${errBody}`);
      }

      const result = await response.json();
      const choice = result.choices?.[0];

      return {
        content: choice?.message?.content || '',
        tokensUsed: {
          prompt: result.usage?.prompt_tokens || 0,
          completion: result.usage?.completion_tokens || 0,
          total: result.usage?.total_tokens || 0,
        },
        model: config.model,
        latencyMs: 0,
        cached: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  GOOGLE GEMINI
  // ─────────────────────────────────────────────────────────────────────────

  private async callGemini(
    config: LlmProviderConfig,
    request: LlmRequest,
  ): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.timeoutMs,
    );

    try {
      const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.systemPrompt }] },
          contents: [
            { role: 'user', parts: [{ text: request.userPrompt }] },
          ],
          generationConfig: {
            temperature: request.temperature ?? config.temperature,
            maxOutputTokens: request.maxTokens ?? config.maxTokens,
            ...(request.jsonMode && { responseMimeType: 'application/json' }),
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Gemini error: ${response.status} ${errBody}`);
      }

      const result = await response.json();
      const content =
        result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const usage = result.usageMetadata || {};

      return {
        content,
        tokensUsed: {
          prompt: usage.promptTokenCount || 0,
          completion: usage.candidatesTokenCount || 0,
          total: usage.totalTokenCount || 0,
        },
        model: config.model,
        latencyMs: 0,
        cached: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ANTHROPIC CLAUDE
  // ─────────────────────────────────────────────────────────────────────────

  private async callAnthropic(
    config: LlmProviderConfig,
    request: LlmRequest,
  ): Promise<LlmResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      config.timeoutMs,
    );

    try {
      const response = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          system: request.systemPrompt,
          messages: [{ role: 'user', content: request.userPrompt }],
          max_tokens: request.maxTokens ?? config.maxTokens,
          temperature: request.temperature ?? config.temperature,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(
          `Anthropic error: ${response.status} ${errBody}`,
        );
      }

      const result = await response.json();
      const content =
        result.content?.[0]?.text || '';

      return {
        content,
        tokensUsed: {
          prompt: result.usage?.input_tokens || 0,
          completion: result.usage?.output_tokens || 0,
          total:
            (result.usage?.input_tokens || 0) +
            (result.usage?.output_tokens || 0),
        },
        model: config.model,
        latencyMs: 0,
        cached: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  HEALTH & STATUS
  // ─────────────────────────────────────────────────────────────────────────

  private updateHealth(
    provider: LlmProvider,
    success: boolean,
    latencyMs: number,
  ): void {
    const current = this.healthMap.get(provider) || {
      status: HealthStatus.HEALTHY,
      lastChecked: new Date(),
      consecutiveFailures: 0,
      avgLatencyMs: 0,
    };

    if (success) {
      current.status = HealthStatus.HEALTHY;
      current.consecutiveFailures = 0;
      current.avgLatencyMs =
        current.avgLatencyMs === 0
          ? latencyMs
          : current.avgLatencyMs * 0.7 + latencyMs * 0.3;
    } else {
      current.consecutiveFailures++;
      if (current.consecutiveFailures >= 3) {
        current.status = HealthStatus.UNHEALTHY;
      } else {
        current.status = HealthStatus.DEGRADED;
      }
    }

    current.lastChecked = new Date();
    this.healthMap.set(provider, current);
  }

  /** Run health checks on all configured providers */
  async healthCheckAll(): Promise<void> {
    for (const [provider, config] of this.providers) {
      try {
        if (provider === LlmProvider.OLLAMA) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(`${config.baseUrl}/api/tags`, {
            signal: controller.signal,
          });
          clearTimeout(timeout);
          this.updateHealth(provider, res.ok, 0);
          if (res.ok) {
            this.logger.log(`✓ ${provider} is available`);
          }
        } else {
          // For cloud providers, assume healthy if configured
          this.updateHealth(provider, true, 0);
          this.logger.log(`✓ ${provider} configured (API key present)`);
        }
      } catch {
        this.updateHealth(provider, false, 0);
        this.logger.warn(`✗ ${provider} not available`);
      }
    }
  }

  /** Get the health status of all providers */
  getHealthStatus(): Record<string, ProviderHealth> {
    const result: Record<string, ProviderHealth> = {};
    for (const [provider, health] of this.healthMap) {
      result[provider] = { ...health };
    }
    return result;
  }

  /** Get cumulative token usage for cost tracking */
  getTokenUsage() {
    return { ...this.tokenUsage };
  }

  /** Get the primary provider name */
  getPrimaryProvider(): LlmProvider {
    return this.primaryProvider;
  }

  /** Get all configured provider names */
  getConfiguredProviders(): LlmProvider[] {
    return Array.from(this.providers.keys());
  }
}
