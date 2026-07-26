import { Injectable, Logger } from '@nestjs/common';

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Injectable()
export class YahooFinanceProvider {
  private readonly logger = new Logger(YahooFinanceProvider.name);
  private readonly baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    try {
      const url = `${this.baseUrl}/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`Yahoo Finance API error for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json();
      const quote = data?.chart?.result?.[0];
      const meta = quote?.meta;

      if (!meta) return null;

      return {
        symbol: meta.symbol || symbol,
        price: meta.regularMarketPrice ?? 0,
        change: meta.chartPreviousClose ? meta.regularMarketPrice - meta.chartPreviousClose : 0,
        changePercent: meta.chartPreviousClose
          ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100
          : 0,
        volume: meta.regularMarketVolume ?? 0,
        high: meta.regularMarketDayHigh ?? meta.regularMarketPrice,
        low: meta.regularMarketDayLow ?? meta.regularMarketPrice,
        open: meta.regularMarketOpen ?? meta.regularMarketPrice,
        previousClose: meta.chartPreviousClose ?? meta.regularMarketPrice,
        timestamp: Date.now(),
      };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.warn(`Yahoo Finance request timed out for ${symbol}`);
      } else {
        this.logger.error(`Yahoo Finance error for ${symbol}: ${(err as Error).message}`);
      }
      return null;
    }
  }

  async getCandles(symbol: string, interval: string = '1d', range: string = '1mo'): Promise<CandleData[]> {
    try {
      const url = `${this.baseUrl}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return [];

      const data = await response.json();
      const result = data?.chart?.result?.[0];

      if (!result) return [];

      const timestamps: number[] = result.timestamp || [];
      const quotes = result.indicators?.quote?.[0];
      const adjclose = result.indicators?.adjclose?.[0];

      return timestamps.map((time: number, i: number) => ({
        time: time * 1000,
        open: quotes?.open?.[i] ?? 0,
        high: quotes?.high?.[i] ?? 0,
        low: quotes?.low?.[i] ?? 0,
        close: quotes?.close?.[i] ?? 0,
        volume: quotes?.volume?.[i] ?? 0,
      })).filter((c: CandleData) => c.close > 0);
    } catch (err) {
      this.logger.error(`Yahoo Finance candle error for ${symbol}: ${(err as Error).message}`);
      return [];
    }
  }
}
