// TradingView Platform Adapter
// Fetches live OHLCV market data using public APIs
// Symbol and timeframe are passed from the content script (which detects them from the live TradingView page)
// This adapter runs in the background service worker - NO DOM/Browser APIs available
import { BaseAdapter, PlatformAdapter } from './base-adapter';

// Map our timeframe strings to API interval strings
const TIMEFRAME_MAP: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '45': '45m',
  '1H': '1h',
  '2H': '2h',
  '4H': '4h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1M'
};

// Common crypto symbol mappings for Binance API
const SYMBOL_MAP: Record<string, string> = {
  'BTCUSD': 'BTCUSDT',
  'ETHUSD': 'ETHUSDT',
  'SOLUSD': 'SOLUSDT',
  'ADAUSD': 'ADAUSDT',
  'XRPUSD': 'XRPUSDT',
  'DOTUSD': 'DOTUSDT',
  'DOGEUSD': 'DOGEUSDT',
  'AVAXUSD': 'AVAXUSDT',
  'LINKUSD': 'LINKUSDT',
  'MATICUSD': 'POLUSDT',
  'BTCUSDT': 'BTCUSDT',
  'ETHUSDT': 'ETHUSDT',
  'SOLUSDT': 'SOLUSDT',
};

/**
 * Parse a symbol from various formats (e.g. 'BTC-USD', 'BTCUSD', 'BINANCE:BTCUSDT')
 * into a normalized format suitable for API calls.
 */
function normalizeSymbol(rawSymbol: string): string {
  let sym = rawSymbol.toUpperCase().trim();

  // Remove exchange prefixes like "BINANCE:" or "TVC:"
  if (sym.includes(':')) {
    sym = sym.split(':')[1];
  }

  // Remove hyphens: BTC-USD → BTCUSD
  sym = sym.replace(/-/g, '');

  // Direct mapping
  if (SYMBOL_MAP[sym]) {
    return SYMBOL_MAP[sym];
  }

  // If it already ends with USDT, use as-is
  if (sym.endsWith('USDT')) {
    return sym;
  }

  // Replace USD suffix with USDT (BTCUSD → BTCUSDT)
  if (sym.endsWith('USD')) {
    return sym.replace(/USD$/, 'USDT');
  }

  // Final fallback: append USDT
  return sym + 'USDT';
}

export class TradingViewAdapter extends BaseAdapter implements PlatformAdapter {
  /**
   * Fetch live OHLCV candle data for the given symbol and timeframe.
   * Runs in the background service worker — no DOM access.
   * Uses Binance public API (free, no auth) with CoinGecko fallback.
   */
  async getChartData(symbol?: string, timeframe?: string): Promise<any> {
    const targetSymbol = symbol || 'BTCUSDT';
    const targetTimeframe = timeframe || '1D';

    console.log(`[TradingView Adapter] Fetching market data: symbol=${targetSymbol}, timeframe=${targetTimeframe}`);

    // Normalize symbol for the API
    const apiSymbol = normalizeSymbol(targetSymbol);
    const apiInterval = TIMEFRAME_MAP[targetTimeframe] || '1d';

    console.log(`[TradingView Adapter] API params: symbol=${apiSymbol}, interval=${apiInterval}`);

    // Try Binance API first (free, no auth, works in service worker)
    try {
      return await this.fetchFromBinance(apiSymbol, apiInterval, targetSymbol, targetTimeframe);
    } catch (binanceError: any) {
      console.warn(`[TradingView Adapter] Binance failed for ${apiSymbol}, trying CoinGecko:`, binanceError.message);
      // Fallback to CoinGecko
      try {
        return await this.fetchFromCoinGecko(targetSymbol, targetTimeframe);
      } catch (geckoError: any) {
        throw new Error(
          `Failed to fetch market data for ${targetSymbol}/${targetTimeframe}. ` +
          `Binance: ${binanceError.message}. CoinGecko: ${geckoError.message}`
        );
      }
    }
  }

  /**
   * Fetch OHLCV data from Binance public API.
   * Kline format: [openTime, open, high, low, close, volume, ...]
   */
  private async fetchFromBinance(
    apiSymbol: string,
    apiInterval: string,
    originalSymbol: string,
    originalTimeframe: string
  ): Promise<any> {
    const limit = 100; // Need enough candles for SMA 50, EMA 26, etc.
    const url = `https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${apiInterval}&limit=${limit}`;
    console.log(`[TradingView Adapter] Binance URL: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Binance API ${response.status}: ${response.statusText}`);
    }

    const klines: any[] = await response.json();
    if (!klines || klines.length === 0) {
      throw new Error('Empty response from Binance API');
    }

    console.log(`[TradingView Adapter] Received ${klines.length} candles from Binance`);

    // Parse klines into separate arrays
    const timestamps: number[] = [];
    const open: number[] = [];
    const high: number[] = [];
    const low: number[] = [];
    const close: number[] = [];
    const volume: number[] = [];

    for (const k of klines) {
      timestamps.push(k[0]);
      open.push(parseFloat(k[1]));
      high.push(parseFloat(k[2]));
      low.push(parseFloat(k[3]));
      close.push(parseFloat(k[4]));
      volume.push(parseFloat(k[5]));
    }

    console.log(`[TradingView Adapter] Parsed ${close.length} candles, latest close: ${close[close.length - 1]}`);

    return {
      timestamps,
      open,
      high,
      low,
      close,
      volume,
      symbol: originalSymbol,
      timeframe: originalTimeframe,
      currentPrice: close[close.length - 1],
      source: 'binance_live'
    };
  }

  /**
   * Fallback: Fetch OHLCV data from CoinGecko public API.
   * CoinGecko format: [timestamp, open, high, low, close]
   * NOTE: CoinGecko does not provide volume in OHLC endpoint.
   */
  private async fetchFromCoinGecko(
    originalSymbol: string,
    originalTimeframe: string
  ): Promise<any> {
    // Normalize symbol for CoinGecko (remove USD suffix, lowercase)
    const baseSymbol = originalSymbol
      .toLowerCase()
      .replace(/-/g, '')
      .replace(/usd(t)?$/i, '');

    const days = this.timeframeToDays(originalTimeframe);
    const geckoId = this.getCoinGeckoId(baseSymbol);
    const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/ohlc?vs_currency=usd&days=${days}`;

    console.log(`[TradingView Adapter] CoinGecko URL: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`CoinGecko API ${response.status}: ${response.statusText}`);
    }

    const data: any[] = await response.json();
    if (!data || data.length === 0) {
      throw new Error('Empty response from CoinGecko');
    }

    console.log(`[TradingView Adapter] Received ${data.length} candles from CoinGecko`);

    const timestamps: number[] = [];
    const open: number[] = [];
    const high: number[] = [];
    const low: number[] = [];
    const close: number[] = [];

    for (const c of data) {
      timestamps.push(c[0]);
      open.push(c[1]);
      high.push(c[2]);
      low.push(c[3]);
      close.push(c[4]);
    }

    return {
      timestamps,
      open,
      high,
      low,
      close,
      volume: Array(close.length).fill(0), // CoinGecko OHLC lacks volume
      symbol: originalSymbol,
      timeframe: originalTimeframe,
      currentPrice: close[close.length - 1],
      source: 'coingecko_fallback'
    };
  }

  private timeframeToDays(timeframe: string): number {
    switch (timeframe) {
      case '1': case '3': case '5': case '15': case '30': return 1;
      case '1H': case '2H': return 7;
      case '4H': return 30;
      case '1D': return 90;
      case '1W': return 365;
      case '1M': return 730;
      default: return 90;
    }
  }

  /**
   * Map a base symbol to a CoinGecko coin ID.
   */
  private getCoinGeckoId(baseSymbol: string): string {
    const coinMap: Record<string, string> = {
      'btc': 'bitcoin',
      'eth': 'ethereum',
      'sol': 'solana',
      'ada': 'cardano',
      'xrp': 'ripple',
      'dot': 'polkadot',
      'doge': 'dogecoin',
      'avax': 'avalanche-2',
      'link': 'chainlink',
      'matic': 'polygon',
      'pol': 'polygon-ecosystem-token',
      'uni': 'uniswap',
      'atom': 'cosmos',
      'ltc': 'litecoin',
      'bch': 'bitcoin-cash',
      'etc': 'ethereum-classic',
      'fil': 'filecoin',
      'apt': 'aptos',
      'sui': 'sui',
      'arb': 'arbitrum',
      'op': 'optimism',
      'aave': 'aave',
      'crv': 'curve-dao-token',
      'near': 'near',
      'trx': 'tron',
      'ftm': 'fantom',
      'algo': 'algorand',
      'sand': 'the-sandbox',
      'mana': 'decentraland',
      'axs': 'axie-infinity',
      'grt': 'the-graph',
      'egld': 'elrond-erd-2',
      'hbar': 'hedera-hashgraph',
      'icp': 'internet-computer',
      'fet': 'fetch-ai',
      'rune': 'thorchain',
      'xlm': 'stellar',
      'vet': 'vechain',
      'theta': 'theta-token',
      'hnt': 'helium',
      'chz': 'chiliz',
      'gala': 'gala',
      'imx': 'immutable-x',
      'dydx': 'dydx-chain',
      'ens': 'ethereum-name-service',
      'ape': 'apecoin',
      'bonk': 'bonk',
      'wif': 'dogwifcoin',
      'pepe': 'pepe',
      'floki': 'floki',
      'rndr': 'render-token',
      'sei': 'sei-network',
      'tia': 'celestia',
      'pendle': 'pendle',
      'jup': 'jupiter-exchange-solana',
      'pyth': 'pyth-network',
      'ena': 'ethena',
      'wld': 'worldcoin-wld',
      'ondo': 'ondo-finance',
    };
    return coinMap[baseSymbol] || baseSymbol;
  }

  async getAvailableIndicators(): Promise<string[]> {
    return ['SMA', 'EMA', 'RSI', 'MACD', 'Bollinger', 'ADX', 'ATR', 'VWAP'];
  }

  async applyIndicator(indicatorName: string, parameters: any): Promise<void> {
    console.warn(`[TradingView Adapter] Indicator \"${indicatorName}\" cannot be applied from background context`);
    return;
  }

  async destroy(): Promise<void> {
    console.log('[TradingView Adapter] Destroyed');
    return;
  }
}
