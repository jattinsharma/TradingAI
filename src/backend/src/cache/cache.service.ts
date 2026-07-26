import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export interface CacheOptions {
  ttlSeconds: number;
  prefix?: string;
}

const DEFAULT_CACHE_TTL = {
  MARKET_DATA: 60,          // 1 minute
  NEWS: 300,                // 5 minutes
  AI_RESPONSE: 600,         // 10 minutes
  SESSION: 3600,            // 1 hour
  JWT_BLACKLIST: 86400,     // 24 hours
  INDICATORS: 120,          // 2 minutes
  QUOTE: 30,                // 30 seconds
};

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelayMs = 2000;

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
      this.client = null;
    }
  }

  private connect() {
    try {
      const host = process.env.REDIS_HOST || 'localhost';
      const port = parseInt(process.env.REDIS_PORT || '6379', 10);
      const password = process.env.REDIS_PASSWORD || undefined;
      const db = parseInt(process.env.REDIS_DB || '0', 10);

      this.client = new Redis({
        host,
        port,
        password,
        db,
        retryStrategy: (times: number) => {
          if (times > this.maxReconnectAttempts) {
            this.logger.error('Max Redis reconnection attempts reached');
            return null;
          }
          const delay = Math.min(times * this.reconnectDelayMs, 30000);
          this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
          return delay;
        },
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.logger.error(`Redis error: ${err.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.logger.warn('Redis connection closed');
      });

      this.client.on('reconnecting', () => {
        this.reconnectAttempts++;
        this.logger.warn(`Redis reconnecting (attempt ${this.reconnectAttempts})`);
      });

      (async () => {
        try {
          await this.client!.connect();
        } catch (err) {
          this.logger.warn(`Redis connection failed: ${(err as Error).message}. Caching disabled.`);
        }
      })();
    } catch (err) {
      this.logger.warn(`Redis initialization failed: ${(err as Error).message}. Caching disabled.`);
    }
  }

  isReady(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  // --- Generic Cache ---

  async get<T>(key: string): Promise<T | null> {
    if (!this.isReady()) return null;
    try {
      const value = await this.client!.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.error(`Cache get error for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client!.setex(key, ttlSeconds, serialized);
      } else {
        await this.client!.set(key, serialized);
      }
      return true;
    } catch (err) {
      this.logger.error(`Cache set error for ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      await this.client!.del(key);
      return true;
    } catch (err) {
      this.logger.error(`Cache del error for ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      const result = await this.client!.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async clearPattern(pattern: string): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      const keys = await this.client!.keys(pattern);
      if (keys.length > 0) {
        await this.client!.del(...keys);
        this.logger.log(`Cleared ${keys.length} cache keys matching ${pattern}`);
      }
      return true;
    } catch (err) {
      this.logger.error(`Cache clear pattern error: ${(err as Error).message}`);
      return false;
    }
  }

  // --- Domain-Specific Cache Methods ---

  async getMarketData<T>(symbol: string): Promise<T | null> {
    return this.get<T>(`market:${symbol}`);
  }

  async setMarketData<T>(symbol: string, data: T): Promise<boolean> {
    return this.set(`market:${symbol}`, data, DEFAULT_CACHE_TTL.MARKET_DATA);
  }

  async getNews(cacheKey: string): Promise<unknown[] | null> {
    return this.get<unknown[]>(`news:${cacheKey}`);
  }

  async setNews(cacheKey: string, data: unknown[]): Promise<boolean> {
    return this.set(`news:${cacheKey}`, data, DEFAULT_CACHE_TTL.NEWS);
  }

  async getAiResponse<T>(cacheKey: string): Promise<T | null> {
    return this.get<T>(`ai:${cacheKey}`);
  }

  async setAiResponse<T>(cacheKey: string, data: T): Promise<boolean> {
    return this.set(`ai:${cacheKey}`, data, DEFAULT_CACHE_TTL.AI_RESPONSE);
  }

  // --- Session Storage ---

  async setSession(userId: string, data: Record<string, unknown>): Promise<boolean> {
    return this.set(`session:${userId}`, data, DEFAULT_CACHE_TTL.SESSION);
  }

  async getSession<T>(userId: string): Promise<T | null> {
    return this.get<T>(`session:${userId}`);
  }

  async delSession(userId: string): Promise<boolean> {
    return this.del(`session:${userId}`);
  }

  // --- JWT Blacklist ---

  async blacklistJwt(jwtId: string, expiresInSeconds: number = DEFAULT_CACHE_TTL.JWT_BLACKLIST): Promise<boolean> {
    return this.set(`jwt-blacklist:${jwtId}`, true, expiresInSeconds);
  }

  async isJwtBlacklisted(jwtId: string): Promise<boolean> {
    return this.exists(`jwt-blacklist:${jwtId}`);
  }

  // --- Background Queue ---

  async pushToQueue(queueName: string, payload: unknown): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      await this.client!.rpush(`queue:${queueName}`, JSON.stringify(payload));
      return true;
    } catch (err) {
      this.logger.error(`Queue push error: ${(err as Error).message}`);
      return false;
    }
  }

  async popFromQueue<T>(queueName: string): Promise<T | null> {
    if (!this.isReady()) return null;
    try {
      const item = await this.client!.lpop(`queue:${queueName}`);
      if (item === null) return null;
      return JSON.parse(item) as T;
    } catch (err) {
      this.logger.error(`Queue pop error: ${(err as Error).message}`);
      return null;
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    if (!this.isReady()) return 0;
    try {
      return await this.client!.llen(`queue:${queueName}`);
    } catch {
      return 0;
    }
  }

  // --- Cache Invalidation ---

  async invalidateMarketData(symbol: string): Promise<boolean> {
    return this.del(`market:${symbol}`);
  }

  async invalidateAllMarketData(): Promise<boolean> {
    return this.clearPattern('market:*');
  }

  async invalidateNews(): Promise<boolean> {
    return this.clearPattern('news:*');
  }

  async invalidateAiCache(): Promise<boolean> {
    return this.clearPattern('ai:*');
  }

  // --- Health Check ---

  async ping(): Promise<boolean> {
    if (!this.isReady()) return false;
    try {
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
