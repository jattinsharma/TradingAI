// Base adapter classes to break circular dependency
export class BaseAdapter {
  async initialize(): Promise<void> {
    // Default implementation - can be overridden
  }

  async destroy(): Promise<void> {
    // Default implementation - can be overridden
    return;
  }
}

// Platform adapter interface
export interface PlatformAdapter {
  /**
   * Fetch chart/OHLCV data for a given symbol and timeframe.
   * @param symbol Trading symbol (e.g. 'BTCUSDT', 'ETHUSD')
   * @param timeframe Timeframe string (e.g. '1D', '4H', '1H')
   */
  getChartData(symbol?: string, timeframe?: string): Promise<any>;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}