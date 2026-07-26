import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { YahooFinanceProvider, MarketQuote, CandleData } from './providers/yahoo-finance.provider';
import { BinanceProvider } from './providers/binance.provider';

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: number;
  volume?: number;
  change24h?: number;
  high24h?: number;
  low24h?: number;
  open24h?: number;
  provider?: string;
}

@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);
  private priceCache: Map<string, MarketData> = new Map();

  constructor(
    private readonly yahooFinance: YahooFinanceProvider,
    private readonly binance: BinanceProvider,
  ) {}

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    // Try Yahoo Finance first (best for stocks/ETFs), fall back to Binance (best for crypto)
    const quote = await this.yahooFinance.getQuote(symbol);
    if (quote) {
      this.logger.log(`Got ${symbol} price from Yahoo Finance: $${quote.price}`);
      this.cachePrice(symbol, quote.price, 'yahoo');
      return quote;
    }

    // Try Binance as fallback
    const binanceQuote = await this.binance.getQuote(symbol);
    if (binanceQuote) {
      this.logger.log(`Got ${symbol} price from Binance: $${binanceQuote.price}`);
      this.cachePrice(symbol, binanceQuote.price, 'binance');
      return binanceQuote;
    }

    // Check cache for stale data
    const cached = this.priceCache.get(symbol);
    if (cached) {
      this.logger.warn(`All providers failed for ${symbol}, using cached price: $${cached.price}`);
      return {
        symbol,
        price: cached.price,
        change: 0,
        changePercent: 0,
        volume: 0,
        high: cached.price,
        low: cached.price,
        open: cached.price,
        previousClose: cached.price,
        timestamp: cached.timestamp,
      };
    }

    this.logger.error(`No data available for ${symbol} from any provider`);
    return null;
  }

  async getCandles(symbol: string, interval: string = '1d', limit: number = 100): Promise<CandleData[]> {
    // Try Binance first (best candle data), fall back to Yahoo Finance
    const binanceCandles = await this.binance.getCandles(symbol, interval, limit);
    if (binanceCandles.length > 0) {
      return binanceCandles;
    }

    const yahooRange = interval === '1d' ? '1mo' : interval === '1w' ? '3mo' : '1d';
    const yahooInterval = interval;
    const yahooCandles = await this.yahooFinance.getCandles(symbol, yahooInterval, yahooRange);
    if (yahooCandles.length > 0) {
      return yahooCandles;
    }

    this.logger.warn(`No candle data available for ${symbol} from any provider`);
    return [];
  }

  getCurrentPrice(symbol: string): MarketData | null {
    return this.priceCache.get(symbol) || null;
  }

  private cachePrice(symbol: string, price: number, provider: string) {
    const existing = this.priceCache.get(symbol);
    const change24h = existing && existing.price > 0
      ? ((price - existing.price) / existing.price) * 100
      : 0;

    this.priceCache.set(symbol, {
      symbol,
      price,
      timestamp: Date.now(),
      change24h,
      provider,
    });
  }

  // Refresh cache every minute for commonly tracked symbols
  @Cron(CronExpression.EVERY_MINUTE)
  async refreshPrices() {
    const symbols = Array.from(this.priceCache.keys());
    for (const symbol of symbols) {
      await this.getQuote(symbol).catch(() => {
        // Individual symbol failure shouldn't block others
      });
    }
  }
}
