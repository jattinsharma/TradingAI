import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';

const DEFAULT_CACHE_TTL = {
  MARKET_DATA: 60,          // 1 minute
  NEWS: 300,                // 5 minutes
  AI_RESPONSE: 600,         // 10 minutes
  SESSION: 3600,            // 1 hour
  JWT_BLACKLIST: 86400,     // 24 hours
  INDICATORS: 120,          // 2 minutes
  QUOTE: 30,                // 30 seconds
};

interface CacheEntry {
  data: string;
  expiresAt: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private memoryStore: Map<string, CacheEntry> | null = null;
  private mode: 'redis' | 'memory' = 'memory';

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const redisUrl = process.env.REDIS_URL?.trim();
    if (redisUrl) {
      this.initRedis(redisUrl);
    } else {
      this.logger.log('REDIS_URL not set — using in-memory cache');
      this.memoryStore = new Map();
      this.mode = 'memory';
    }
  }

  private async initRedis(redisUrl: string): Promise<void> {
    try {
      const { default: IORedis } = await import('ioredis');
      this.redisClient = new IORedis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          if (times > 10) {
            this.logger.error('Max Redis reconnection attempts reached');
            return null;
          }
          const delay = Math.min(times * 2000, 30000);
          this.logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
          return delay;
        },
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Connected to Redis');
      });

      this.redisClient.on('error', (err) => {
        this.logger.error(`Redis error: ${err.message}`);
      });

      this.redisClient.on('close', () => {
        this.logger.warn('Redis connection closed');
      });

      this.redisClient.on('reconnecting', () => {
        this.logger.warn('Redis reconnecting...');
      });

      await this.redisClient.connect();
      this.mode = 'redis';
    } catch (err) {
      this.logger.warn(`Redis connection failed: ${(err as Error).message}. Falling back to in-memory cache.`);
      this.redisClient = null;
      this.mode = 'memory';
      this.memoryStore = new Map();
    }
  }

  isReady(): boolean {
    if (this.mode === 'memory') {
      return this.memoryStore !== null;
    }
    return this.redisClient !== null && this.redisClient.status === 'ready';
  }

  // --- Private helpers ---

  private isExpired(entry: CacheEntry): boolean {
    return entry.expiresAt > 0 && Date.now() > entry.expiresAt;
  }

  // --- Generic Cache ---

  async get<T>(key: string): Promise<T | null> {
    if (!this.isReady()) return null;

    if (this.mode === 'memory') {
      const entry = this.memoryStore!.get(key);
      if (!entry) return null;
      if (this.isExpired(entry)) {
        this.memoryStore!.delete(key);
        return null;
      }
      try {
        return JSON.parse(entry.data) as T;
      } catch {
        return null;
      }
    }

    try {
      const value = await this.redisClient!.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.error(`Cache get error for ${key}: ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    if (!this.isReady()) return false;

    if (this.mode === 'memory') {
      const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : 0;
      this.memoryStore!.set(key, {
        data: JSON.stringify(value),
        expiresAt,
      });
      return true;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redisClient!.setex(key, ttlSeconds, serialized);
      } else {
        await this.redisClient!.set(key, serialized);
      }
      return true;
    } catch (err) {
      this.logger.error(`Cache set error for ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.isReady()) return false;

    if (this.mode === 'memory') {
      return this.memoryStore!.delete(key);
    }

    try {
      await this.redisClient!.del(key);
      return true;
    } catch (err) {
      this.logger.error(`Cache del error for ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isReady()) return false;

    if (this.mode === 'memory') {
      const entry = this.memoryStore!.get(key);
      if (!entry) return false;
      if (this.isExpired(entry)) {
        this.memoryStore!.delete(key);
        return false;
      }
      return true;
    }

    try {
      const result = await this.redisClient!.exists(key);
      return result === 1;
    } catch {
      return false;
    }
  }

  async clearPattern(pattern: string): Promise<boolean> {
    if (!this.isReady()) return false;

    if (this.mode === 'memory') {
      const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
      let count = 0;
      for (const key of this.memoryStore!.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryStore!.delete(key);
          count++;
        }
      }
      if (count > 0) {
        this.logger.log(`Cleared ${count} in-memory cache keys matching ${pattern}`);
      }
      return true;
    }

    try {
      const keys = await this.redisClient!.keys(pattern);
      if (keys.length > 0) {
        await this.redisClient!.del(...keys);
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

  private readonly memoryQueues: Map<string, unknown[]> = new Map();

  async pushToQueue(queueName: string, payload: unknown): Promise<boolean> {
    if (!this.isReady()) return false;

    if (this.mode === 'memory') {
      if (!this.memoryQueues.has(queueName)) {
        this.memoryQueues.set(queueName, []);
      }
      this.memoryQueues.get(queueName)!.push(payload);
      return true;
    }

    try {
      await this.redisClient!.rpush(`queue:${queueName}`, JSON.stringify(payload));
      return true;
    } catch (err) {
      this.logger.error(`Queue push error: ${(err as Error).message}`);
      return false;
    }
  }

  async popFromQueue<T>(queueName: string): Promise<T | null> {
    if (!this.isReady()) return null;

    if (this.mode === 'memory') {
      const queue = this.memoryQueues.get(queueName);
      if (!queue || queue.length === 0) return null;
      return queue.shift() as T;
    }

    try {
      const item = await this.redisClient!.lpop(`queue:${queueName}`);
      if (item === null) return null;
      return JSON.parse(item) as T;
    } catch (err) {
      this.logger.error(`Queue pop error: ${(err as Error).message}`);
      return null;
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    if (!this.isReady()) return 0;

    if (this.mode === 'memory') {
      return this.memoryQueues.get(queueName)?.length ?? 0;
    }

    try {
      return await this.redisClient!.llen(`queue:${queueName}`);
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

    if (this.mode === 'memory') {
      return true;
    }

    try {
      const result = await this.redisClient!.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  // --- Cleanup (called by framework on shutdown) ---

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      this.redisClient.disconnect();
      this.redisClient = null;
    }
    if (this.memoryStore) {
      this.memoryStore.clear();
    }
  }
}
