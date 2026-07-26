// Generic adapter for unsupported platforms
import { BaseAdapter, PlatformAdapter } from './base-adapter';

export class GenericAdapter extends BaseAdapter implements PlatformAdapter {
  async getChartData(symbol?: string, timeframe?: string): Promise<any> {
    console.log('[Generic Adapter] getChartData called - no chart data available (generic platform)');
    // Return empty or mock data for unsupported platforms
    return {
      error: 'Chart data not available for this platform',
      symbol: symbol || 'UNKNOWN',
      timeframe: timeframe || '1D',
      timestamp: Date.now()
    };
  }

  async getSymbol(): Promise<string> {
    console.log('[TradingView Adapter] getSymbol called, returning UNKNOWN');
    return 'UNKNOWN';
  }

  async getTimeframe(): Promise<string> {
    console.log('[TradingView Adapter] getTimeframe called, returning 1D');
    return '1D';
  }

  async getAvailableIndicators(): Promise<string[]> {
    console.log('[TradingView Adapter] getAvailableIndicators called - no indicators available');
    return [];
  }

  async applyIndicator(indicatorName: string, parameters: any): Promise<void> {
    // No-op for generic adapter
    console.warn(`[Generic Adapter] Indicator ${indicatorName} not supported on this platform`);
    return;
  }

  async destroy(): Promise<void> {
    // Clean up if needed
    return;
  }
}