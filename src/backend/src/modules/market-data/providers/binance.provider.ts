import { Injectable, Logger } from '@nestjs/common';
import { MarketQuote, CandleData } from './yahoo-finance.provider';

@Injectable()
export class BinanceProvider {
  private readonly logger = new Logger(BinanceProvider.name);
  private readonly baseUrl = 'https://api.binance.com/api/v3';

  private toBinanceSymbol(symbol: string): string {
    const upper = symbol.toUpperCase().replace('-', '');
    if (upper.endsWith('USD') && !upper.endsWith('USDT')) {
      return upper + 'T';
    }
    if (!upper.endsWith('USDT') && !upper.endsWith('BTC') && !upper.endsWith('ETH')) {
      return upper + 'USDT';
    }
    return upper;
  }

  private fromBinanceSymbol(binanceSymbol: string): string {
    if (binanceSymbol.endsWith('USDT')) {
      return binanceSymbol.slice(0, -4) + '-USD';
    }
    if (binanceSymbol.endsWith('BTC')) {
      return binanceSymbol.slice(0, -3) + '-BTC';
    }
    return binanceSymbol;
  }

  async getQuote(symbol: string): Promise<MarketQuote | null> {
    try {
      const binanceSymbol = this.toBinanceSymbol(symbol);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const [tickerRes, dayTickerRes] = await Promise.all([
        fetch(`${this.baseUrl}/ticker/price?symbol=${binanceSymbol}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }),
        fetch(`${this.baseUrl}/ticker/24hr?symbol=${binanceSymbol}`, {
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }),
      ]);
      clearTimeout(timeout);

      if (!tickerRes.ok || !dayTickerRes.ok) return null;

      const ticker = await tickerRes.json();
      const dayTicker = await dayTickerRes.json();

      const price = parseFloat(ticker.price);

      return {
        symbol: this.fromBinanceSymbol(binanceSymbol),
        price,
        change: parseFloat(dayTicker.priceChange),
        changePercent: parseFloat(dayTicker.priceChangePercent),
        volume: parseFloat(dayTicker.quoteVolume),
        high: parseFloat(dayTicker.highPrice),
        low: parseFloat(dayTicker.lowPrice),
        open: parseFloat(dayTicker.openPrice),
        previousClose: parseFloat(dayTicker.prevClosePrice),
        timestamp: Date.now(),
      };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        this.logger.warn(`Binance request timed out for ${symbol}`);
      } else {
        this.logger.error(`Binance error for ${symbol}: ${(err as Error).message}`);
      }
      return null;
    }
  }

  async getCandles(
    symbol: string,
    interval: string = '1d',
    limit: number = 30,
  ): Promise<CandleData[]> {
    try {
      const binanceSymbol = this.toBinanceSymbol(symbol);
      const intervalMap: Record<string, string> = {
        '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
        '1h': '1h', '4h': '4h', '1d': '1d', '1w': '1w',
      };
      const binInterval = intervalMap[interval] || '1d';

      const url = `${this.baseUrl}/klines?symbol=${binanceSymbol}&interval=${binInterval}&limit=${limit}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) return [];

      const klines = await response.json();
      return klines.map((k: number[]) => ({
        time: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
      }));
    } catch (err) {
      this.logger.error(`Binance candle error for ${symbol}: ${(err as Error).message}`);
      return [];
    }
  }
}
