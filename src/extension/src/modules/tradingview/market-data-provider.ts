/**
 * Market Data Provider
 *
 * Fetches live OHLCV candle data from multiple free APIs with automatic failover.
 * - Crypto: Binance public API (free, no auth)
 * - Stocks: Yahoo Finance (via unofficial API, no auth)
 * - Forex/Indices: Yahoo Finance or Twelve Data free tier
 *
 * All providers require zero authentication for read-only OHLCV data.
 * No simulated data is ever returned — if all providers fail, an error is thrown.
 */

// ── Timeframe mapping: our format → API format ──
const BINANCE_INTERVAL_MAP: Record<string, string> = {
  '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m',
  '30m': '30m', '1H': '1h', '2H': '2h',
  '4H': '4h', '6H': '6h', '12H': '12h',
  '1D': '1d', '1W': '1w', '1M': '1M',
};

const YAHOO_INTERVAL_MAP: Record<string, string> = {
  '1m': '1m', '2m': '2m', '5m': '5m', '15m': '15m',
  '30m': '30m', '1H': '60m', '2H': '60m', '4H': '60m',
  '1D': '1d', '1W': '1wk', '1M': '1mo',
};

// ── Timeframe → data points needed for indicators (SMA50 needs 50+ candles) ──
const MIN_CANDLES = 200; // Enough for SMA 50, EMA 26, MACD calculations

// ── Crypto symbol normalization for Binance ──
const SYMBOL_TO_BINANCE: Record<string, string> = {
  'BTCUSD': 'BTCUSDT', 'ETHUSD': 'ETHUSDT', 'SOLUSD': 'SOLUSDT',
  'XRPUSD': 'XRPUSDT', 'ADAUSD': 'ADAUSDT', 'DOGEUSD': 'DOGEUSDT',
  'DOTUSD': 'DOTUSDT', 'AVAXUSD': 'AVAXUSDT', 'LINKUSD': 'LINKUSDT',
  'MATICUSD': 'POLUSDT', 'UNIUSD': 'UNIUSDT', 'ATOMUSD': 'ATOMUSDT',
  'LTCUSD': 'LTCUSDT', 'BCHUSD': 'BCHUSDT', 'ETCUSD': 'ETCUSDT',
  'FILUSD': 'FILUSDT', 'APTUSD': 'APTUSDT', 'SUIUSD': 'SUIUSDT',
  'ARBUSD': 'ARBUSDT', 'OPUSD': 'OPUSDT', 'AAVEUSD': 'AAVEUSDT',
  'CRVUSD': 'CRVUSDT', 'NEARUSD': 'NEARUSDT', 'TRXUSD': 'TRXUSDT',
  'FTMUSD': 'FTMUSDT', 'ALGOUSD': 'ALGOUSDT', 'SANDUSD': 'SANDUSDT',
  'AXSUSD': 'AXSUSDT', 'GRTUSD': 'GRTUSDT', 'HBARUSD': 'HBARUSDT',
  'ICPUSD': 'ICPUSDT', 'FETUSD': 'FETUSDT', 'XLMUSD': 'XLMUSDT',
  'VETUSD': 'VETUSDT', 'THETAUSD': 'THETAUSDT', 'HNTUSD': 'HNTUSDT',
  'CHZUSD': 'CHZUSDT', 'GALAUSD': 'GALAUSDT', 'IMXUSD': 'IMXUSDT',
  'DYDXUSD': 'DYDXUSDT', 'ENSUSD': 'ENSUSDT', 'APEUSD': 'APEUSDT',
  'BONKUSD': 'BONKUSDT', 'WIFUSD': 'WIFUSDT', 'PEPEUSD': '1000PEPEUSDT',
  'FLOKIUSD': 'FLOKIUSDT', 'RNDRUSD': 'RNDRUSDT', 'SEIUSD': 'SEIUSDT',
  'TIAUSD': 'TIAUSDT', 'PENDLEUSD': 'PENDLEUSDT', 'ENAUSD': 'ENAUSDT',
  'WLDUSD': 'WLDUSDT', 'ONDOUSD': 'ONDOUSDT', 'JUPUSD': 'JUPUSDT',
  'PYTHUSD': 'PYTHUSDT',
};

// ── Forex symbols for Yahoo Finance ──
function yahooSymbol(rawSymbol: string): string {
  let s = rawSymbol.toUpperCase();
  // Remove exchange prefix
  if (s.includes(':')) s = s.split(':')[1];
  s = s.replace(/-/g, '');

  // Check if it's a known crypto → use USDT pair
  if (SYMBOL_TO_BINANCE[s] && !s.endsWith('USDT')) {
    return s; // Let the caller handle it; Yahoo uses a different convention
  }

  // Forex pairs: EURUSD, GBPUSD, etc.
  if (s === 'EURUSD') return 'EURUSD=X';
  if (s === 'GBPUSD') return 'GBPUSD=X';
  if (s === 'USDJPY') return 'USDJPY=X';
  if (s === 'USDCAD') return 'USDCAD=X';
  if (s === 'USDCHF') return 'USDCHF=X';
  if (s === 'AUDUSD') return 'AUDUSD=X';
  if (s === 'NZDUSD') return 'NZDUSD=X';
  if (s === 'GBPJPY') return 'GBPJPY=X';
  if (s === 'EURJPY') return 'EURJPY=X';

  // Major indices
  if (s === 'SPX' || s === 'SP500') return '^GSPC';
  if (s === 'NDX' || s === 'NASDAQ') return '^IXIC';
  if (s === 'DJI' || s === 'DOW') return '^DJI';
  if (s === 'RUT' || s === 'RUSSELL') return '^RUT';
  if (s === 'VIX') return '^VIX';
  if (s === 'FTSE' || s === 'UK100') return '^FTSE';
  if (s === 'DAX' || s === 'GER40') return '^GDAXI';
  if (s === 'N225' || s === 'NIKKEI') return '^N225';
  if (s === 'HSI' || s === 'HONGKONG') return '^HSI';

  // Gold, Silver, Oil
  if (s === 'XAUUSD' || s === 'GOLD') return 'GC=F';
  if (s === 'XAGUSD' || s === 'SILVER') return 'SI=F';
  if (s === 'USOIL' || s === 'WTI') return 'CL=F';
  if (s === 'BRENT') return 'BZ=F';

  // If ends with USD or USDT, keep for Binance
  return s;
}

/**
 * Determine if a symbol is likely a crypto (tradable on Binance).
 */
function isCryptoSymbol(symbol: string): boolean {
  const s = symbol.toUpperCase().replace(/[:\-]/g, '');
  // Known crypto symbols
  if (SYMBOL_TO_BINANCE[s]) return true;
  // Patterns: anything ending in BTC, ETH, USDT
  if (s.endsWith('USDT') || s.endsWith('BTC') || s.endsWith('ETH')) return true;
  return false;
}

export interface OHLCVData {
  timestamps: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  symbol: string;
  timeframe: string;
  currentPrice: number;
  source: string;
}

/**
 * Get normalized symbol for Binance API.
 */
function toBinanceSymbol(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[:\-]/g, '');
  if (SYMBOL_TO_BINANCE[s]) return SYMBOL_TO_BINANCE[s];
  if (s.endsWith('USDT') && s.length > 4) return s;
  if (s.endsWith('USD')) return s.replace(/USD$/, 'USDT');
  // Check if it's a common crypto pair
  const base = s.replace(/USDT$/, '').replace(/USD$/, '').replace(/BTC$/, '').replace(/ETH$/, '');
  if (base && base.length <= 10) return base + 'USDT';
  return null;
}

/**
 * Fetch OHLCV from Binance public API (crypto, free, no auth).
 */
async function fetchFromBinance(apiSymbol: string, timeframe: string, _originalSymbol: string): Promise<OHLCVData> {
  const interval = BINANCE_INTERVAL_MAP[timeframe] || '1d';
  const limit = Math.max(MIN_CANDLES, 500);
  const url = `https://api.binance.com/api/v3/klines?symbol=${apiSymbol}&interval=${interval}&limit=${limit}`;

  console.log(`[MarketData] Binance: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API ${response.status}: ${response.statusText}`);
  }

  const klines: any[] = await response.json();
  if (!klines || klines.length < 30) {
    throw new Error(`Binance returned insufficient data: ${klines?.length || 0} candles`);
  }

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

  return {
    timestamps, open, high, low, close, volume,
    symbol: _originalSymbol,
    timeframe,
    currentPrice: close[close.length - 1],
    source: 'binance'
  };
}

/**
 * Fetch OHLCV from Yahoo Finance (stocks, forex, indices, free, no auth).
 * Uses the free Yahoo Finance API endpoint.
 */
async function fetchFromYahooFinance(rawSymbol: string, timeframe: string): Promise<OHLCVData> {
  const yahooSym = yahooSymbol(rawSymbol);
  const interval = YAHOO_INTERVAL_MAP[timeframe] || '1d';
  const range = timeframeToYahooRange(timeframe);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?interval=${interval}&range=${range}&includePrePost=false`;

  console.log(`[MarketData] Yahoo Finance: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance API ${response.status}: ${response.statusText}`);
  }

  const data: any = await response.json();

  // Check for errors from Yahoo API
  if (data.error) {
    throw new Error(`Yahoo Finance error: ${data.error.description || JSON.stringify(data.error)}`);
  }

  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error('Yahoo Finance returned no data');
  }

  const timestamps: number[] = result.timestamp || [];
  const quotes = result.indicators?.quote?.[0];
  const adjclose = result.indicators?.adjclose?.[0];

  if (!timestamps.length || !quotes) {
    throw new Error('Yahoo Finance returned empty OHLCV data');
  }

  const open: number[] = quotes.open || [];
  const high: number[] = quotes.high || [];
  const low: number[] = quotes.low || [];
  const close: number[] = quotes.close || [];
  const volume: number[] = quotes.volume || [];

  // Filter out null values that Yahoo sometimes returns
  const cleanTimestamps: number[] = [];
  const cleanOpen: number[] = [];
  const cleanHigh: number[] = [];
  const cleanLow: number[] = [];
  const cleanClose: number[] = [];
  const cleanVolume: number[] = [];

  // Use adjclose if available (accounting for dividends/splits)
  const adjcloseValues: number[] = adjclose?.adjclose || [];

  for (let i = 0; i < timestamps.length; i++) {
    const o = open[i];
    const h = high[i];
    const l = low[i];
    const c = close[i];
    // Use adjclose for closing price if available
    const cc = adjcloseValues?.[i] ?? c;

    if (c !== null && h !== null && l !== null && o !== null && c !== undefined) {
      cleanTimestamps.push(timestamps[i] * 1000); // Yahoo uses seconds, convert to ms
      cleanOpen.push(o);
      cleanHigh.push(h);
      cleanLow.push(l);
      cleanClose.push(cc ?? c);
      cleanVolume.push(volume[i] ?? 0);
    }
  }

  if (cleanClose.length < 10) {
    throw new Error(`Yahoo Finance returned too few valid candles: ${cleanClose.length}`);
  }

  return {
    timestamps: cleanTimestamps,
    open: cleanOpen,
    high: cleanHigh,
    low: cleanLow,
    close: cleanClose,
    volume: cleanVolume,
    symbol: rawSymbol,
    timeframe,
    currentPrice: cleanClose[cleanClose.length - 1],
    source: 'yahoo_finance'
  };
}

function timeframeToYahooRange(timeframe: string): string {
  // Map our timeframe to Yahoo Finance range parameter
  switch (timeframe) {
    case '1m': case '2m': case '5m': case '15m': case '30m':
      return '7d'; // 7 days of 5/15/30 min data
    case '1H': case '2H':
      return '1mo'; // 1 month of hourly data
    case '4H': case '6H': case '12H':
      return '3mo'; // 3 months of 4h data
    case '1D':
      return '1y'; // 1 year of daily data
    case '1W':
      return '5y'; // 5 years of weekly data
    case '1M':
      return '10y'; // 10 years of monthly data
    default:
      return '1y';
  }
}

/**
 * Fetch OHLCV market data using the best available free provider.
 *
 * Strategy:
 * 1. Crypto (USDT pairs, known crypto) → Binance API
 * 2. Stocks, Forex, Indices → Yahoo Finance
 *
 * Each provider is tried in order with automatic failover to the next.
 * Never returns simulated data.
 *
 * @param symbol Raw symbol (e.g., 'BTCUSD', 'AAPL', 'EURUSD')
 * @param timeframe Timeframe string (e.g., '1D', '4H', '1H')
 * @throws Error if all providers fail
 */
export async function getOHLCVData(symbol: string, timeframe: string): Promise<OHLCVData> {
  const errors: string[] = [];

  if (!symbol || symbol === 'UNKNOWN') {
    throw new Error(`Cannot fetch market data: invalid symbol "${symbol}"`);
  }

  const normalizedTimeframe = normalizeTimeframe(timeframe);
  console.log(`[MarketData] Fetching ${symbol} ${normalizedTimeframe}`);

  // ── Try 1: Binance (for crypto) ──
  const binanceSym = toBinanceSymbol(symbol);
  if (binanceSym) {
    try {
      const data = await fetchFromBinance(binanceSym, normalizedTimeframe, symbol);
      console.log(`[MarketData] ✅ Binance: ${data.close.length} candles, latest: ${data.currentPrice}`);
      return data;
    } catch (e: any) {
      errors.push(`Binance: ${e.message}`);
      console.warn(`[MarketData] Binance failed for ${symbol}: ${e.message}`);
    }
  }

  // ── Try 2: Yahoo Finance (stocks, forex, indices, fallback for crypto) ──
  try {
    const data = await fetchFromYahooFinance(symbol, normalizedTimeframe);
    console.log(`[MarketData] ✅ Yahoo Finance: ${data.close.length} candles, latest: ${data.currentPrice}`);
    return data;
  } catch (e: any) {
    errors.push(`Yahoo Finance: ${e.message}`);
    console.warn(`[MarketData] Yahoo Finance failed for ${symbol}: ${e.message}`);
  }

  // ── All providers failed ──
  const errorMsg = `Failed to fetch market data for ${symbol}/${normalizedTimeframe}. All providers failed: ${errors.join(' | ')}`;
  console.error(`[MarketData] ❌ ${errorMsg}`);
  throw new Error(errorMsg);
}

import { normalizeTimeframe } from '../../shared/utils';

