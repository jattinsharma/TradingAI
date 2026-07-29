// TradingView module — data extraction utilities
// NOTE: Only dom-extractor and market-data-provider are actively used.
// The observer and data-collector modules have been replaced by ChartStateManager.
export { extractFromTradingViewDOM, isTradingViewPage } from './tradingview-dom-extractor';
export type { TradingViewMarketData } from './tradingview-dom-extractor';
export { getOHLCVData } from './market-data-provider';
export type { OHLCVData } from './market-data-provider';
