/**
 * ChartState types — the single source of truth for current chart information.
 *
 * ChartState is produced ONLY by the content script (which has DOM access).
 * It is consumed by the background (cache) and popup/overlay (display).
 * No component other than the content script may read the TradingView DOM.
 *
 * ── Data Flow ──
 * Content Script (DOM) → CHART_STATE_UPDATED → Background (cache)
 *                                               → GET_CHART_STATE → Popup / Overlay
 *                                                               → Analysis Engine
 */

/** Possible detection failure reasons. */
export type ChartDetectionFailure =
  | 'CONTENT_SCRIPT_MISSING'
  | 'NOT_TRADING_PAGE'
  | 'UNSUPPORTED_PLATFORM'
  | 'TICKER_NOT_FOUND'
  | 'TIMEFRAME_NOT_FOUND'
  | 'EXCHANGE_NOT_FOUND'
  | 'PRICE_NOT_FOUND'
  | 'SERVICE_WORKER_UNAVAILABLE'
  | 'CONTENT_SCRIPT_TIMEOUT'
  | 'MESSAGING_ERROR'
  | 'UNKNOWN_ERROR';

/** Human-readable explanations for each failure type. */
export const CHART_DETECTION_ERROR_MESSAGES: Record<ChartDetectionFailure, string> = {
  CONTENT_SCRIPT_MISSING:
    'Trading Copilot content script is not loaded on this page. Try refreshing the page.',
  NOT_TRADING_PAGE:
    'This is not a supported trading website. Open TradingView or another supported platform first.',
  UNSUPPORTED_PLATFORM:
    'The current website is not a supported trading platform. Supported: tradingview.com, binance.com, bybit.com, coinbase.com, zerodha.com, upstox.com, angelone.in, groww.in.',
  TICKER_NOT_FOUND:
    'Could not detect the trading symbol. Make sure a chart is open and the ticker is visible.',
  TIMEFRAME_NOT_FOUND:
    'Could not detect the chart timeframe. Make sure a timeframe is selected on the chart toolbar.',
  EXCHANGE_NOT_FOUND:
    'Could not detect the exchange. This is non-critical; analysis will proceed without exchange info.',
  PRICE_NOT_FOUND:
    'Could not detect the current price. The chart may still be loading.',
  SERVICE_WORKER_UNAVAILABLE:
    'The background service worker is not responding. Try reloading the extension.',
  CONTENT_SCRIPT_TIMEOUT:
    'The content script did not respond within the time limit. Try refreshing the page.',
  MESSAGING_ERROR:
    'A communication error occurred between extension components. Try reloading the extension.',
  UNKNOWN_ERROR:
    'An unexpected error occurred while reading the chart. Try refreshing the page.',
};

/** Full chart state — the single source of truth. */
export interface ChartState {
  /** Trading symbol (e.g. "BTCUSDT", "AAPL", "EURUSD") */
  symbol: string | null;
  /** Timeframe (e.g. "1m", "5m", "1H", "1D") */
  timeframe: string | null;
  /** Exchange name (e.g. "BINANCE", "NASDAQ") or null if not detected */
  exchange: string | null;
  /** Current market price */
  currentPrice: number | null;
  /** Platform identifier (e.g. "tradingview", "binance") */
  platform: string | null;
  /** Human-readable status (e.g. "Connected", "No chart", error message) */
  status: string;
  /** Whether chart detection succeeded */
  isDetected: boolean;
  /** If detection failed, the specific reason */
  failureReason: ChartDetectionFailure | null;
  /** Human-readable suggestion for fixing the issue */
  failureSuggestion: string | null;
  /** Timestamp when this state was extracted from the DOM */
  extractedAt: number;
  /** Timestamp when this state was received by the background cache */
  cachedAt?: number;
}

/** Minimal state for popup display — a subset of ChartState. */
export interface ChartStateDisplay {
  symbol: string | null;
  timeframe: string | null;
  exchange: string | null;
  currentPrice: number | null;
  platform: string | null;
  isDetected: boolean;
  status: string;
  failureReason: ChartDetectionFailure | null;
  failureSuggestion: string | null;
  extractedAt: number;
}

/** Message types related to chart state. */
export const CHART_STATE_MESSAGES = {
  /** Content script → Background: chart state has changed */
  CHART_STATE_UPDATED: 'CHART_STATE_UPDATED',
  /** Popup/Overlay → Background: request current chart state */
  GET_CHART_STATE: 'GET_CHART_STATE',
  /** Background → Content script: please re-read the DOM and report */
  REQUEST_CHART_REFRESH: 'REQUEST_CHART_REFRESH',
} as const;

export type ChartStateMessageType =
  (typeof CHART_STATE_MESSAGES)[keyof typeof CHART_STATE_MESSAGES];

/**
 * Create an empty/failed ChartState with a specific failure reason.
 */
export function createFailedChartState(
  failureReason: ChartDetectionFailure,
  extractedAt: number = Date.now(),
): ChartState {
  return {
    symbol: null,
    timeframe: null,
    exchange: null,
    currentPrice: null,
    platform: null,
    status: CHART_DETECTION_ERROR_MESSAGES[failureReason],
    isDetected: false,
    failureReason,
    failureSuggestion: CHART_DETECTION_ERROR_MESSAGES[failureReason],
    extractedAt,
  };
}

/**
 * Create a successful ChartState from DOM data.
 */
export function createSuccessfulChartState(
  symbol: string,
  timeframe: string,
  exchange: string | null,
  currentPrice: number | null,
  platform: string,
  extractedAt: number = Date.now(),
): ChartState {
  return {
    symbol,
    timeframe,
    exchange,
    currentPrice,
    platform,
    status: 'Connected',
    isDetected: true,
    failureReason: null,
    failureSuggestion: null,
    extractedAt,
  };
}
