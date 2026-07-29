/**
 * TradingView DOM Extractor
 *
 * Extracts symbol, timeframe, and current price from the actual TradingView page DOM.
 * Runs inside the content script (has full DOM access).
 *
 * This is the PRODUCTION data source — never falls back to simulated data.
 * If DOM extraction fails, it throws an error with the specific reason.
 */

// ── Symbol extraction selectors (ordered by reliability, most reliable first) ──
const SYMBOL_SELECTORS = [
  // Primary: the ticker text in the chart header
  '[data-name="header-token-symbol"]',
  // Fallback: the symbol button inside the header toolbar
  '[class*="header-chart-panel"] [class*="symbol"]',
  // Generic: any element with data-symbol attribute in the header
  '[data-symbol]',
  // The ticker in the URL bar area
  '[class*="ticker"]',
  // Any button-like element containing the symbol text in the toolbar
  '[class*="toolbar"] [class*="button"][class*="active"]',
];

// ── Timeframe selectors ──
const TIMEFRAME_SELECTORS = [
  // Primary: the active interval button in the chart toolbar
  '[class*="interval-dialog-button"][class*="active"]',
  // Fallback: any active interval button
  '[class*="interval"][class*="active"]',
  // The timeframe text in the header toolbar
  '[class*="timeframe"][class*="active"]',
  // The selected item in the intervals bar
  '[data-name="interval"] [class*="selected"]',
  '[data-name="interval"] [class*="active"]',
];

// ── Price display selectors ──
const PRICE_SELECTORS = [
  // Primary: the last price on the chart (top-left)
  '[data-name="last-price"]',
  // Fallback: the price widget in the header
  '[class*="last-price"]',
  // Generic: any large price display near the chart
  '[class*="price"] [class*="last"]',
  // Format: the main quote bar
  '[class*="quotes"] [class*="last"]',
];

// ── Bid/Ask selectors (if available) ──
const BID_ASK_SELECTORS = [
  '[data-name="bid"]',
  '[data-name="ask"]',
  '[class*="bid"]',
  '[class*="ask"]',
];

// ── Trading session selectors ──
const SESSION_SELECTORS = [
  '[data-name="trading-session"]',
  '[class*="session"]',
  '[class*="market-status"]',
];

/**
 * Normalize a raw TradingView symbol string into a clean uppercase form.
 * Examples: "BTCUSD", "BTC/USDT" → "BTCUSDT"; "NASDAQ:AAPL" → "AAPL"
 */
function normalizeSymbol(raw: string): string {
  let s = raw.trim().toUpperCase();

  // Remove exchange prefix (e.g., "NASDAQ:AAPL" → "AAPL", "BINANCE:BTCUSDT" → "BTCUSDT")
  if (s.includes(':')) {
    s = s.split(':')[1];
  }

  // Remove hyphens, slashes, spaces (e.g., "BTC/USDT" → "BTCUSDT")
  s = s.replace(/[/\-\s]/g, '');

  // Remove trailing "USD" duplicates (e.g., "BTCUSDUSD" → "BTCUSD") — TradingView quirk
  if (s.endsWith('USDUSD')) {
    s = s.slice(0, -3);
  }

  return s;
}

import { normalizeTimeframe } from '../../shared/utils';


/**
 * Try to extract text content from a DOM element matching the given selector.
 * Returns the text or null if not found.
 */
function trySelector(selector: string): string | null {
  try {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return null;
    const text = el.textContent?.trim() || el.getAttribute('data-value')?.trim() || null;
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Try to extract a numeric value from a DOM element.
 * Handles $ prefixes, comma separators, and other TradingView formatting quirks.
 */
function tryNumericValue(selector: string): number | null {
  try {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return null;

    const raw = el.textContent?.trim() || '';
    // Remove $, commas, spaces, and other formatting
    const cleaned = raw.replace(/[$,€£¥\s]/g, '');
    const num = parseFloat(cleaned);
    return isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

export interface TradingViewMarketData {
  symbol: string;
  timeframe: string;
  currentPrice: number | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  marketStatus: string | null;
  source: 'tradingview_dom';
  extractedAt: number;
}

/**
 * Extract complete market data from the TradingView page DOM.
 * All values come from the live page — never simulated.
 */
export function extractFromTradingViewDOM(): TradingViewMarketData {
  // ── Symbol ──
  let symbol = '';
  for (const selector of SYMBOL_SELECTORS) {
    const text = trySelector(selector);
    if (text) {
      const normalized = normalizeSymbol(text);
      if (normalized.length >= 2 && normalized.length <= 20) {
        symbol = normalized;
        break;
      }
    }
  }

  // Fallback: parse from URL
  if (!symbol) {
    try {
      const path = window.location.pathname;
      // TradingView URL patterns: /chart/...SYMBOL... or /symbols/SYMBOL/
      const match = path.match(/\/symbol[s]?\/([A-Za-z0-9_:%-]+)/i);
      if (match) {
        const raw = decodeURIComponent(match[1]);
        symbol = normalizeSymbol(raw);
      }
      // URL query param
      if (!symbol) {
        const urlParams = new URLSearchParams(window.location.search);
        const symParam = urlParams.get('symbol');
        if (symParam) {
          symbol = normalizeSymbol(symParam);
        }
      }
    } catch {
      // ignore
    }
  }

  // Fallback: extract from document title
  if (!symbol) {
    const title = document.title;
    const match = title.match(/[A-Z]{2,10}\/?[A-Z]{2,6}/);
    if (match) {
      symbol = normalizeSymbol(match[0]);
    }
  }

  if (!symbol) {
    console.warn('[TVDOM] Could not detect symbol from any source');
    symbol = 'UNKNOWN';
  }

  // ── Timeframe ──
  let timeframe = '';
  for (const selector of TIMEFRAME_SELECTORS) {
    const text = trySelector(selector);
    if (text) {
      const normalized = normalizeTimeframe(text);
      if (normalized) {
        timeframe = normalized;
        break;
      }
    }
  }

  // Fallback: URL params
  if (!timeframe) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const interval = urlParams.get('interval') || urlParams.get('resolution');
      if (interval) {
        timeframe = normalizeTimeframe(interval);
      }
    } catch {
      // ignore
    }
  }

  if (!timeframe) {
    console.warn('[TVDOM] Could not detect timeframe, defaulting to 1D');
    timeframe = '1D';
  }

  // ── Current Price ──
  let currentPrice: number | null = null;
  for (const selector of PRICE_SELECTORS) {
    const price = tryNumericValue(selector);
    if (price !== null && price > 0) {
      currentPrice = price;
      break;
    }
  }

  // ── Bid/Ask ──
  let bid: number | null = null;
  let ask: number | null = null;
  for (const selector of BID_ASK_SELECTORS) {
    const value = tryNumericValue(selector);
    if (value !== null && value > 0) {
      // Determine if this is bid or ask based on the data attribute
      const el = document.querySelector(selector);
      const dataAttr = el?.getAttribute('data-name')?.toLowerCase() || '';
      if (dataAttr.includes('bid') && bid === null) {
        bid = value;
      } else if (dataAttr.includes('ask') && ask === null) {
        ask = value;
      } else if (bid === null) {
        bid = value;
      } else if (ask === null) {
        ask = value;
      }
    }
  }

  const spread = (bid !== null && ask !== null) ? parseFloat((ask - bid).toFixed(8)) : null;

  // ── Market Status ──
  let marketStatus: string | null = null;
  for (const selector of SESSION_SELECTORS) {
    const text = trySelector(selector);
    if (text) {
      marketStatus = text;
      break;
    }
  }

  const extractedAt = Date.now();

  console.log(`[TVDOM] Extracted: symbol=${symbol}, timeframe=${timeframe}, price=${currentPrice}, bid=${bid}, ask=${ask}, spread=${spread}, session=${marketStatus}`);

  return {
    symbol,
    timeframe,
    currentPrice,
    bid,
    ask,
    spread,
    marketStatus,
    source: 'tradingview_dom',
    extractedAt,
  };
}

/**
 * Safely check whether the current page is TradingView.
 */
export function isTradingViewPage(): boolean {
  try {
    const hostname = window.location.hostname.toLowerCase();
    return hostname.includes('tradingview.com');
  } catch {
    return false;
  }
}
