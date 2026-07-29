/**
 * TradingView DOM Observer
 *
 * Efficient MutationObservers that watch for changes on the TradingView page:
 * - Symbol changes (user switches asset)
 * - Timeframe changes (user changes interval)
 * - Price updates (new candle forms, real-time price movements)
 *
 * Uses targeted observers instead of watching the entire document body.
 * Automatically detects which DOM elements to observe based on TradingView's layout.
 */

import { extractFromTradingViewDOM, isTradingViewPage } from './tradingview-dom-extractor';

export type ChangeType = 'symbol' | 'timeframe' | 'price' | 'candle' | 'unknown';

export interface ChartChangeEvent {
  type: ChangeType;
  symbol: string;
  timeframe: string;
  currentPrice: number | null;
  timestamp: number;
}

type ChangeCallback = (event: ChartChangeEvent) => void;

/**
 * Watch for TradingView chart changes using efficient DOM observation.
 */
export class TradingViewObserver {
  private symbolObserver: MutationObserver | null = null;
  private priceObserver: MutationObserver | null = null;
  private intervalObserver: MutationObserver | null = null;
  private pollingInterval: number | null = null;
  private callback: ChangeCallback | null = null;
  private lastSymbol = '';
  private lastTimeframe = '';
  private lastPrice: number | null = null;
  private lastPollTime = 0;
  private readonly POLL_INTERVAL_MS = 3000; // 3 seconds for price changes
  private isRunning = false;

  /**
   * Start observing TradingView chart changes.
   */
  start(callback: ChangeCallback): void {
    if (this.isRunning) return;
    if (!isTradingViewPage()) {
      console.warn('[TVObserver] Not on TradingView — not starting');
      return;
    }

    this.callback = callback;
    this.isRunning = true;
    this.captureBaseline();

    // Set up targeted MutationObservers
    this.observeSymbolChanges();
    this.observePriceChanges();
    this.observeIntervalChanges();

    // Fallback polling for price updates (catches canvas-rendered changes)
    this.startPolling();

    console.log('[TVObserver] Started watching TradingView chart changes');
  }

  /**
   * Stop observing and clean up resources.
   */
  stop(): void {
    this.isRunning = false;

    if (this.symbolObserver) { this.symbolObserver.disconnect(); this.symbolObserver = null; }
    if (this.priceObserver) { this.priceObserver.disconnect(); this.priceObserver = null; }
    if (this.intervalObserver) { this.intervalObserver.disconnect(); this.intervalObserver = null; }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    this.callback = null;
    console.log('[TVObserver] Stopped');
  }

  /**
   * Capture the current symbol, timeframe, and price as baselines.
   */
  private captureBaseline(): void {
    const data = extractFromTradingViewDOM();
    this.lastSymbol = data.symbol;
    this.lastTimeframe = data.timeframe;
    this.lastPrice = data.currentPrice;
    console.log(`[TVObserver] Baseline: ${this.lastSymbol} ${this.lastTimeframe} @ ${this.lastPrice}`);
  }

  /**
   * Watch the symbol element in the header for changes.
   */
  private observeSymbolChanges(): void {
    // Try multiple possible locations for the symbol display
    const symbolElements = [
      document.querySelector('[data-name="header-token-symbol"]'),
      document.querySelector('[class*="header-token"]'),
      document.querySelector('[class*="symbol"] [class*="text"]'),
      document.querySelector('[class*="ticker"]'),
    ].filter(Boolean) as Element[];

    for (const el of symbolElements) {
      try {
        const observer = new MutationObserver(() => {
          this.handleChange('symbol');
        });
        observer.observe(el, {
          characterData: true,
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-value', 'title', 'aria-label'],
        });
        this.symbolObserver = observer;

        // Stop after the first successful observation setup
        console.log('[TVObserver] Symbol observer attached to', el.tagName, el.className?.slice(0, 40));
        return;
      } catch {
        continue;
      }
    }

    // Fallback: use a MutationObserver on the header toolbar
    try {
      const toolbar = document.querySelector('[class*="header-chart-panel"]') ||
                      document.querySelector('[class*="toolbar"]');
      if (toolbar) {
        const observer = new MutationObserver(() => {
          this.handleChange('symbol');
        });
        observer.observe(toolbar, { childList: true, subtree: true, characterData: true });
        this.symbolObserver = observer;
        console.log('[TVObserver] Symbol observer (fallback) attached to toolbar');
      }
    } catch {
      console.warn('[TVObserver] Could not attach symbol observer');
    }
  }

  /**
   * Watch the price display element for changes.
   */
  private observePriceChanges(): void {
    const priceElements = [
      document.querySelector('[data-name="last-price"]'),
      document.querySelector('[class*="last-price"]'),
      document.querySelector('[class*="price"] [class*="last"]'),
    ].filter(Boolean) as Element[];

    for (const el of priceElements) {
      try {
        const observer = new MutationObserver(() => {
          this.handleChange('price');
        });
        observer.observe(el, {
          characterData: true,
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-value', 'data-price', 'title'],
        });
        this.priceObserver = observer;
        console.log('[TVObserver] Price observer attached to', el.tagName, el.className?.slice(0, 40));
        return;
      } catch {
        continue;
      }
    }
    console.log('[TVObserver] Could not attach price observer (relying on polling)');
  }

  /**
   * Watch the interval/timeframe buttons for changes.
   */
  private observeIntervalChanges(): void {
    const intervalElements = [
      document.querySelector('[data-name="interval"]'),
      document.querySelector('[class*="interval-dialog-button"]'),
      document.querySelector('[class*="timeframe"]'),
      document.querySelector('[class*="intervals"]'),
      document.querySelectorAll('[class*="interval"][class*="button"], [class*="timeframe"][class*="button"]'),
    ].flat().filter(Boolean) as Element[];

    for (const el of intervalElements) {
      try {
        const observer = new MutationObserver(() => {
          this.handleChange('timeframe');
        });
        observer.observe(el, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ['class', 'data-value', 'aria-pressed', 'aria-selected'],
        });
        this.intervalObserver = observer;
        console.log('[TVObserver] Interval observer attached');
        return;
      } catch {
        continue;
      }
    }
    console.log('[TVObserver] Could not attach interval observer');
  }

  /**
   * Fallback polling to detect price and candle updates that DOM observers miss
   * (e.g., canvas-rendered price changes, streaming updates).
   */
  private startPolling(): void {
    this.pollingInterval = window.setInterval(() => {
      if (!this.isRunning) return;

      const now = Date.now();
      if (now - this.lastPollTime < this.POLL_INTERVAL_MS) return;
      this.lastPollTime = now;

      const data = extractFromTradingViewDOM();

      // Check for price changes
      if (data.currentPrice !== null && this.lastPrice !== null) {
        if (Math.abs(data.currentPrice - this.lastPrice) > 0.00001) {
          this.lastPrice = data.currentPrice;
          this.emitChange('price', data.symbol, data.timeframe, data.currentPrice);
          return;
        }
      }

      // Check for symbol changes (missed by observer)
      if (data.symbol !== this.lastSymbol) {
        this.lastSymbol = data.symbol;
        this.emitChange('symbol', data.symbol, data.timeframe, data.currentPrice);
        return;
      }

      // Check for timeframe changes (missed by observer)
      if (data.timeframe !== this.lastTimeframe) {
        this.lastTimeframe = data.timeframe;
        this.emitChange('timeframe', data.symbol, data.timeframe, data.currentPrice);
        return;
      }
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Handle a detected change — verify it's a real change, then emit.
   */
  private handleChange(type: ChangeType): void {
    const data = extractFromTradingViewDOM();
    this.emitChange(type, data.symbol, data.timeframe, data.currentPrice);
  }

  /**
   * Emit a change event to the registered callback.
   * Only emits if the value actually changed (dedup).
   */
  private emitChange(type: ChangeType, symbol: string, timeframe: string, price: number | null): void {
    if (!this.callback || !this.isRunning) return;

    // Dedup: skip if nothing meaningful changed
    const symbolChanged = symbol !== this.lastSymbol && symbol && symbol !== 'UNKNOWN';
    const timeframeChanged = timeframe !== this.lastTimeframe && timeframe !== '';
    const priceChanged = price !== null && this.lastPrice !== null &&
      Math.abs(price - this.lastPrice) > 0.0001;

    if (!symbolChanged && !timeframeChanged && !priceChanged) return;

    // Update baselines
    if (symbolChanged) this.lastSymbol = symbol;
    if (timeframeChanged) this.lastTimeframe = timeframe;
    if (priceChanged) this.lastPrice = price;

    const changeType: ChangeType = symbolChanged ? 'symbol' : timeframeChanged ? 'timeframe' : 'candle';

    console.log(`[TVObserver] Change detected: ${changeType} — ${symbol} ${timeframe} @ ${price}`);

    this.callback({
      type: changeType,
      symbol: this.lastSymbol,
      timeframe: this.lastTimeframe,
      currentPrice: this.lastPrice,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if the observer is currently running.
   */
  get isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get the last known market state.
   */
  getLastKnownState(): { symbol: string; timeframe: string; price: number | null } {
    return {
      symbol: this.lastSymbol,
      timeframe: this.lastTimeframe,
      price: this.lastPrice,
    };
  }
}
