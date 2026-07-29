// TradingView Platform Adapter
// Fetches live OHLCV market data using the multi-API market data provider.
// Symbol and timeframe are passed from the content script (detected from the live TradingView page).
// This adapter runs in the background service worker — no DOM/Browser APIs available.
import { BaseAdapter, PlatformAdapter } from './base-adapter';
import { getOHLCVData } from '../modules/tradingview/market-data-provider';

export class TradingViewAdapter extends BaseAdapter implements PlatformAdapter {
  /**
   * Fetch live OHLCV candle data for the given symbol and timeframe.
   * Uses the multi-API market data provider with automatic failover:
   *   - Crypto → Binance API (free, no auth)
   *   - Stocks/Forex/Indices → Yahoo Finance API (free, no auth)
   */
  async getChartData(symbol?: string, timeframe?: string): Promise<any> {
    const targetSymbol = symbol || 'BTCUSDT';
    const targetTimeframe = timeframe || '1D';

    console.log(`[TradingView Adapter] Fetching live market data: symbol=${targetSymbol}, timeframe=${targetTimeframe}`);

    // Use the multi-API market data provider
    // This handles Binance for crypto, Yahoo Finance for stocks/forex/indices
    // with automatic failover — no simulated data ever
    try {
      const data = await getOHLCVData(targetSymbol, targetTimeframe);

      console.log(`[TradingView Adapter] ✅ Received ${data.close.length} candles from ${data.source}, latest close: ${data.currentPrice}`);

      return {
        timestamps: data.timestamps,
        open: data.open,
        high: data.high,
        low: data.low,
        close: data.close,
        volume: data.volume,
        symbol: data.symbol,
        timeframe: data.timeframe,
        currentPrice: data.currentPrice,
        source: data.source
      };
    } catch (error: any) {
      console.error(`[TradingView Adapter] ❌ Failed to fetch market data:`, error.message);
      throw new Error(
        `Failed to fetch market data for ${targetSymbol}/${targetTimeframe}. ` +
        error.message
      );
    }
  }

  async getAvailableIndicators(): Promise<string[]> {
    return ['SMA', 'EMA', 'RSI', 'MACD', 'Bollinger', 'ADX', 'ATR', 'VWAP'];
  }

  async applyIndicator(indicatorName: string, parameters: any): Promise<void> {
    console.warn(`[TradingView Adapter] Indicator "${indicatorName}" cannot be applied from background context`);
    return;
  }

  async destroy(): Promise<void> {
    console.log('[TradingView Adapter] Destroyed');
    return;
  }
}
