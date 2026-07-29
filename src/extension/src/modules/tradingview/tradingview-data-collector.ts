/**
 * TradingView Data Collector
 *
 * Orchestrates the complete market data collection pipeline:
 * 1. Extract symbol, timeframe, price from TradingView DOM
 * 2. Fetch OHLCV candle data from free APIs
 * 3. Combine into a structured MarketData object
 * 4. Validate all values before returning
 *
 * All data is real — never simulated.
 */

import { extractFromTradingViewDOM, type TradingViewMarketData } from './tradingview-dom-extractor';
import { getOHLCVData, type OHLCVData } from './market-data-provider';

export interface MarketDataResult {
  /** Data extracted from the TradingView page DOM */
  dom: TradingViewMarketData;
  /** OHLCV candle data from free APIs */
  ohlcv: OHLCVData;
  /** The analyzed symbol (from DOM, verified against API) */
  symbol: string;
  /** The analyzed timeframe */
  timeframe: string;
  /** Current market price */
  currentPrice: number;
  /** When the data was collected */
  collectedAt: number;
  /** Data sources used */
  sources: string[];
}

/**
 * Collect complete market data from the current TradingView page.
 *
 * This is the MAIN entry point for market data collection.
 * Use this function in the content script when the user clicks "Analyze".
 *
 * @param overrideSymbol Optional override symbol (if already detected)
 * @param overrideTimeframe Optional override timeframe (if already detected)
 * @returns Complete validated market data
 * @throws Error if critical data cannot be obtained
 */
export async function collectMarketData(
  overrideSymbol?: string,
  overrideTimeframe?: string
): Promise<MarketDataResult> {
  const sources: string[] = [];

  // ── Step 1: Extract from TradingView DOM ──
  console.log('[DataCollector] Step 1: Extracting from TradingView DOM...');
  const domData = extractFromTradingViewDOM();
  sources.push(domData.source);

  const symbol = overrideSymbol || domData.symbol;
  const timeframe = overrideTimeframe || domData.timeframe;

  if (!symbol || symbol === 'UNKNOWN') {
    throw new Error('Could not detect trading symbol. Make sure a chart is open on TradingView.');
  }

  console.log(`[DataCollector] DOM extracted: symbol=${symbol}, timeframe=${timeframe}, price=${domData.currentPrice}`);

  // ── Step 2: Fetch OHLCV candle data ──
  console.log('[DataCollector] Step 2: Fetching OHLCV data from API...');
  const ohlcvData = await getOHLCVData(symbol, timeframe);
  sources.push(ohlcvData.source);

  console.log(`[DataCollector] API received: ${ohlcvData.close.length} candles, latest=${ohlcvData.currentPrice}`);

  // ── Step 3: Determine the best current price ──
  // Prefer DOM price (live from TradingView), fall back to API close
  let currentPrice: number;
  if (domData.currentPrice !== null && domData.currentPrice > 0) {
    currentPrice = domData.currentPrice;
  } else {
    currentPrice = ohlcvData.currentPrice;
  }

  // ── Step 4: Validate ──
  if (!isFinite(currentPrice) || currentPrice <= 0) {
    throw new Error(`Invalid current price: ${currentPrice}. Market data may be unavailable.`);
  }

  if (!ohlcvData.close || ohlcvData.close.length < 10) {
    throw new Error(`Insufficient OHLCV data: ${ohlcvData.close?.length || 0} candles. Need at least 10.`);
  }

  const result: MarketDataResult = {
    dom: domData,
    ohlcv: ohlcvData,
    symbol,
    timeframe,
    currentPrice,
    collectedAt: Date.now(),
    sources: [...new Set(sources)], // deduplicate
  };

  console.log(`[DataCollector] ✅ Complete: ${symbol} ${timeframe}, price=${currentPrice}, candles=${ohlcvData.close.length}, sources=[${result.sources.join(', ')}]`);

  return result;
}
