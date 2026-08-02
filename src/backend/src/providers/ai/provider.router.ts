import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AnalysisRequest,
  AnalysisResult,
  SummarizeNewsRequest,
  CoachRequest,
  CoachResult,
  AIProvider
} from './ai-provider.interface';
import { NvidiaProvider } from './nvidia.provider';
import { LocalProvider } from './local.provider';

@Injectable()
export class AIProviderRouter implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AIProviderRouter.name);
  private providers: AIProvider[] = [];
  private currentProviderIndex = 0;
  private readonly HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private configService: ConfigService
  ) {}

  /**
   * Set the providers array - called by the module after dependency injection
   */
  setProviders(providers: AIProvider[]) {
    this.providers = providers;
    // Ensure NVIDIA is first (primary) and Local is second (fallback)
    this.providers.sort((a, b) => {
      // NVIDIA provider should come first
      if (a.name.includes('NVIDIA')) return -1;
      if (b.name.includes('NVIDIA')) return 1;
      return 0;
    });

    this.logger.log(`Providers configured: ${this.providers.map(p => p.name).join(' -> ')}`);
  }

  async onModuleInit() {
    // Perform initial health check
    await this.performHealthCheck();
    this.logger.log('AI Provider Router initialized');
  }

  onModuleDestroy() {
    this.logger.log('AI Provider Router destroyed');
  }

  private async performHealthCheck(): Promise<boolean> {
    const now = Date.now();
    // Avoid checking too frequently
    if (this.lastHealthCheck && now - this.lastHealthCheck < 30000) { // Minimum 30 seconds between checks
      return this.isPrimaryHealthy();
    }

    this.lastHealthCheck = now;

    try {
      const isHealthy = await this.checkPrimaryProviderHealth();
      if (isHealthy && this.currentProviderIndex !== 0) {
        // Switch back to primary if it's healthy and we're not already using it
        this.logger.log('Primary provider (NVIDIA) is healthy. Switching back.');
        this.currentProviderIndex = 0;
      } else if (!isHealthy && this.currentProviderIndex === 0) {
        // Switch to fallback if primary is unhealthy
        this.logger.warn('Primary provider (NVIDIA) is unhealthy. Switching to fallback.');
        this.currentProviderIndex = 1;
      }

      return isHealthy;
    } catch (error) {
      this.logger.warn(`Health check failed: ${error.message}`);
      return false;
    }
  }

  private async checkPrimaryProviderHealth(): Promise<boolean> {
    if (this.providers.length === 0) return false;

    try {
      const health = await this.providers[0].isHealthy();
      return health;
    } catch (error) {
      this.logger.warn(`Primary provider health check failed: ${error.message}`);
      return false;
    }
  }

  private isPrimaryHealthy(): boolean {
    return this.lastHealthCheck ? Date.now() - this.lastHealthCheck < this.HEALTH_CHECK_INTERVAL_MS : false;
  }

  private getCurrentProvider(): AIProvider | null {
    return this.providers[this.currentProviderIndex] || null;
  }

  /**
   * Get the provider name for logging/display
   */
  getActiveProviderName(): string {
    const provider = this.getCurrentProvider();
    return provider ? provider.name : 'Unknown';
  }

  /**
   * Get UI status indicator
   */
  getProviderStatus(): { icon: string; label: string } {
    const provider = this.getCurrentProvider();
    if (!provider) return { icon: '⚪', label: 'No Provider' };

    if (this.currentProviderIndex === 0) { // NVIDIA (assuming it's first)
      const isHealthy = this.isPrimaryHealthy();
      return isHealthy
        ? { icon: '🟢', label: 'NVIDIA Cloud' }
        : { icon: '🔴', label: 'NVIDIA Cloud (Unhealthy)' };
    } else { // Local or other fallback
      return { icon: '🟡', label: `${provider.name}` };
    }
  }

  /**
   * Analyze market data with automatic failover
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    if (this.providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    // Check if we should perform a health check
    await this.performHealthCheck();

    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = this.providers.length;

    while (attempts < maxAttempts) {
      const provider = this.getCurrentProvider();
      if (!provider) {
        throw new Error('No provider available at current index');
      }

      try {
        this.logger.debug(`Attempting analysis with provider: ${provider.name}`);
        const result = await provider.analyze(request);

        // If we succeeded and we're not on the primary provider, log the failover
        if (provider !== this.providers[0]) {
          this.logger.warn(`Failed over to ${provider.name} for AI analysis`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Provider ${provider.name} failed for analysis: ${(error as Error).message}`
        );

        // Check if we should failover to the next provider
        if (provider.shouldFailover && provider.shouldFailover(error)) {
          // Move to next provider
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          this.logger.log(`Failing over to provider: ${this.getCurrentProvider()?.name}`);
          attemptedProviders++;

          // If we've tried all providers, break
          if (attemptedProviders >= this.providers.length) {
            break;
          }
        } else {
          // Don't failover on this error (e.g., authentication error)
          throw error;
        }
      }

      attempts++;
    }

    // If we exhausted all providers
    throw lastError || new Error('All AI providers failed');
  }

  /**
   * Summarize news with automatic failover
   */
  async summarizeNews(request: SummarizeNewsRequest): Promise<string> {
    if (this.providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    // Check if we should perform a health check
    await this.performHealthCheck();

    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = this.providers.length;

    while (attempts < maxAttempts) {
      const provider = this.getCurrentProvider();
      if (!provider) {
        throw new Error('No provider available at current index');
      }

      try {
        this.logger.debug(`Attempting news summarization with provider: ${provider.name}`);
        const result = await provider.summarizeNews(request);

        // If we succeeded and we're not on the primary provider, log the failover
        if (provider !== this.providers[0]) {
          this.logger.warn(`Failed over to ${provider.name} for news summarization`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Provider ${provider.name} failed for news summarization: ${(error as Error).message}`
        );

        // Check if we should failover to the next provider
        if (provider.shouldFailover && provider.shouldFailover(error)) {
          // Move to next provider
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          this.logger.log(`Failing over to provider: ${this.getCurrentProvider()?.name}`);
          attemptedProviders++;

          // If we've tried all providers, break
          if (attemptedProviders >= this.providers.length) {
            break;
          }
        } else {
          // Don't failover on this error (e.g., authentication error)
          throw error;
        }
      }

      attempts++;
    }

    // If we exhausted all providers
    throw lastError || new Error('All AI providers failed');
  }

  /**
   * Provide trade coaching with automatic failover
   */
  async coachTrade(request: CoachRequest): Promise<CoachResult> {
    if (this.providers.length === 0) {
      throw new Error('No AI providers configured');
    }

    // Check if we should perform a health check
    await this.performHealthCheck();

    let lastError: Error | null = null;
    let attempts = 0;
    const maxAttempts = this.providers.length;

    while (attempts < maxAttempts) {
      const provider = this.getCurrentProvider();
      if (!provider) {
        throw new Error('No provider available at current index');
      }

      try {
        this.logger.debug(`Attempting trade coaching with provider: ${provider.name}`);
        const result = await provider.coachTrade(request);

        // If we succeeded and we're not on the primary provider, log the failover
        if (provider !== this.providers[0]) {
          this.logger.warn(`Failed over to ${provider.name} for trade coaching`);
        }

        return result;
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Provider ${provider.name} failed for trade coaching: ${(error as Error).message}`
        );

        // Check if we should failover to the next provider
        if (provider.shouldFailover && provider.shouldFailover(error)) {
          // Move to next provider
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          this.logger.log(`Failing over to provider: ${this.getCurrentProvider()?.name}`);
          attemptedProviders++;

          // If we've tried all providers, break
          if (attemptedProviders >= this.providers.length) {
            break;
          }
        } else {
          // Don't failover on this error (e.g., authentication error)
          throw error;
        }
      }

      attempts++;
    }

    // If we exhausted all providers
    throw lastError || new Error('All AI providers failed');
  }

  /**
   * Get the current active provider
   */
  private getCurrentProvider(): AIProvider | null {
    return this.providers[this.currentProviderIndex] || null;
  }

  /**
   * Periodic health check using cron (every 5 minutes)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleHealthCheck() {
    await this.performHealthCheck();
  }
}