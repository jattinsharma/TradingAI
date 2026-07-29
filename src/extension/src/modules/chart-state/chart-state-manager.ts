/**
 * ChartStateManager — the SINGLE source of truth for TradingView chart detection.
 *
 * ── Design ──
 * - Runs inside the content script (only component allowed to read DOM)
 * - Uses ONE MutationObserver on TradingView header toolbar elements
 * - Uses lightweight polling (3s) as fallback for canvas-rendered price changes
 * - On every state change, publishes CHART_STATE_UPDATED to the background
 * - On every state change, stores latest state in module variable for GET_CHART_STATE
 * - Handles TradingView SPA re-renders by re-attaching observers
 * - Provides detailed failure reasons when detection fails
 *
 * ── Removes ──
 * - TradingViewObserver (tradingview-observer.ts) — replaced by this class
 * - ChartObserver (chart-observer.ts) — replaced for TradingView
 * - Duplicate DOM reads from WebsiteDetector for TV pages
 * - Duplicate GET_CHART_INFO message flow
 *
 * ── Data Flow ──
 *   DOM → ChartStateManager → CHART_STATE_UPDATED → Background (cache)
 *                                                    → Popup (GET_CHART_STATE)
 *                                                    → Overlay (auto-update)
 */

import {
  ChartState,
  ChartDetectionFailure,
  createFailedChartState,
  createSuccessfulChartState,
  CHART_STATE_MESSAGES,
} from './chart-state.types';
import { extractFromTradingViewDOM, isTradingViewPage } from '../tradingview/tradingview-dom-extractor';
import { WebsiteDetector } from '../website-detector/website-detector';
import { sendMessageToBackend } from '../../utils/messaging';

export class ChartStateManager {
  // ── Observers ──
  private mutationObserver: MutationObserver | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  // ── State ──
  private currentState: ChartState | null = null;
  private lastSymbol = '';
  private lastTimeframe = '';
  private lastPrice: number | null = null;
  private lastPollTime = 0;

  // ── Lifetime ──
  private isRunning = false;
  private platform = '';

  // ── Config ──
  private readonly POLL_INTERVAL_MS = 3000;
  private readonly DEBOUNCE_MS = 300;

  // ── Debounce ──
  private publishTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Start observing the TradingView page for chart changes.
   * Must be called from content script context (DOM accessible).
   */
  start(): void {
    if (this.isRunning) return;

    this.platform = WebsiteDetector.detectPlatform();

    if (this.platform === 'generic') {
      console.log('[ChartStateManager] Not on a supported platform — not starting');
      this.publishFailure('NOT_TRADING_PAGE');
      return;
    }

    if (!isTradingViewPage()) {
      console.log('[ChartStateManager] Not on TradingView — using fallback platform detection');
      this.startFallbackDetection();
      return;
    }

    this.isRunning = true;
    console.log('[ChartStateManager] Starting TradingView chart observation');

    // Read initial state
    this.readAndPublish();

    // Set up MutationObserver for structural changes (symbol/timeframe)
    this.setupMutationObserver();

    // Set up polling for canvas-rendered price changes
    this.startPolling();
  }

  /**
   * Stop observing and clean up all resources.
   */
  stop(): void {
    this.isRunning = false;

    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
      this.publishTimer = null;
    }

    this.currentState = null;
    console.log('[ChartStateManager] Stopped');
  }

  /**
   * Get the latest known ChartState (synchronous, no DOM read).
   */
  getCurrentState(): ChartState | null {
    return this.currentState;
  }

  /**
   * Force a fresh DOM read and publish update.
   * Used when the background requests a chart refresh (e.g. popup opened).
   */
  refresh(): ChartState {
    const state = this.readDOM();
    this.currentState = state;
    this.publishToBackground(state);
    return state;
  }

  // ── Private: DOM Read ──

  /**
   * Read current chart data from DOM and publish if changed.
   */
  private readAndPublish(): void {
    const state = this.readDOM();
    this.currentState = state;
    this.publishToBackground(state);
  }

  /**
   * Read chart data from the DOM.
   * Uses TradingView DOM extractor for TV pages, WebsiteDetector for others.
   */
  private readDOM(): ChartState {
    const now = Date.now();

    if (isTradingViewPage()) {
      try {
        const domData = extractFromTradingViewDOM();

        const rawSymbol = domData.symbol !== 'UNKNOWN' ? domData.symbol : '';

    // Check for specific failures before creating state
    if (!rawSymbol) {
      return createFailedChartState('TICKER_NOT_FOUND', now);
    }

    const state = createSuccessfulChartState(
      rawSymbol,
      domData.timeframe || '1D',
      null, // exchange — not extracted from DOM yet
      domData.currentPrice,
      'tradingview',
      now,
    );

    // Update tracking variables
    this.lastSymbol = rawSymbol;
    this.lastTimeframe = domData.timeframe || '1D';
    this.lastPrice = state.currentPrice;

        return state;
      } catch (error) {
        console.error('[ChartStateManager] DOM extraction error:', error);
        return createFailedChartState('UNKNOWN_ERROR', now);
      }
    }

    // Non-TradingView platform — use platform detection
    try {
      const symbol = WebsiteDetector.getSymbol();
      const timeframe = WebsiteDetector.getTimeframe();

      if (!symbol) {
        return createFailedChartState('TICKER_NOT_FOUND', now);
      }

      const state = createSuccessfulChartState(
        symbol,
        timeframe || '1D',
        null,
        null,
        this.platform,
        now,
      );

      this.lastSymbol = state.symbol ?? '';
      this.lastTimeframe = state.timeframe ?? '';
      return state;
    } catch (error) {
      console.error('[ChartStateManager] Platform detection error:', error);
      return createFailedChartState('UNKNOWN_ERROR', now);
    }
  }

  // ── Private: Publish ──

  /**
   * Debounced publish of chart state to background.
   * Prevents flooding the message bus during rapid DOM changes.
   */
  private publishToBackground(state: ChartState): void {
    // Don't publish non-fatal failures repeatedly
    if (!state.isDetected && state.failureReason === 'TICKER_NOT_FOUND') {
      // Only publish non-detected state once
      if (this.publishTimer) return;
    }

    if (this.publishTimer) {
      clearTimeout(this.publishTimer);
    }

    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;

      // Send to background — fire and forget (background will cache it)
      sendMessageToBackend({
        type: CHART_STATE_MESSAGES.CHART_STATE_UPDATED,
        payload: state,
      }).catch(() => {
        // Background not available — state will be synced on next refresh
      });
    }, this.DEBOUNCE_MS);
  }

  /**
   * Publish a failure state immediately (no debounce).
   */
  private publishFailure(reason: ChartDetectionFailure): void {
    const state = createFailedChartState(reason);
    this.currentState = state;

    sendMessageToBackend({
      type: CHART_STATE_MESSAGES.CHART_STATE_UPDATED,
      payload: state,
    }).catch(() => {});
  }

  // ── Private: MutationObserver ──

  /**
   * Set up a single targeted MutationObserver on key TradingView elements.
   * When the DOM changes (symbol switch, timeframe change), re-read and publish.
   */
  private setupMutationObserver(): void {
    // Disconnect any previous observer
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    // Target elements to watch for changes
    const targetElements: Element[] = [];

    // Watch symbol/header area
    const symbolElements = document.querySelectorAll(
      '[data-name="header-token-symbol"], ' +
      '[class*="header-chart-panel"], ' +
      '[class*="header-toolbar"], ' +
      '[data-name="interval"]'
    );
    symbolElements.forEach(el => {
      if (el && !targetElements.includes(el)) {
        targetElements.push(el);
      }
    });

    // If no specific elements found, watch the body (fallback)
    if (targetElements.length === 0) {
      console.log('[ChartStateManager] No specific TV elements found, observing document body');
      targetElements.push(document.body);
    }

    this.mutationObserver = new MutationObserver(() => {
      this.handlePotentialChange();
    });

    // Use a single observer with subtree to catch any structural changes
    const config: MutationObserverInit = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'class',
        'data-value',
        'data-symbol',
        'aria-pressed',
        'aria-selected',
        'title',
      ],
    };

    for (const el of targetElements) {
      try {
        this.mutationObserver.observe(el, config);
      } catch {
        // ignore elements that don't support observation
      }
    }

    console.log(`[ChartStateManager] MutationObserver watching ${targetElements.length} element(s)`);
  }

  /**
   * Handle a potential chart change debounced.
   * Reads DOM and compares with last known values.
   */
  private handlePotentialChange(): void {
    // Debounce: skip rapid mutations
    if (this.publishTimer) return;

    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      this.readAndPublish();
    }, this.DEBOUNCE_MS);
  }

  // ── Private: Polling ──

  /**
   * Fallback polling to detect canvas-rendered price changes
   * that DOM observers cannot capture.
   */
  private startPolling(): void {
    this.pollingInterval = setInterval(() => {
      if (!this.isRunning) return;

      const now = Date.now();
      if (now - this.lastPollTime < this.POLL_INTERVAL_MS) return;
      this.lastPollTime = now;

      if (!isTradingViewPage()) {
        console.log('[ChartStateManager] No longer on TradingView — stopping');
        this.stop();
        return;
      }

      // Only check for price changes (symbol/timeframe handled by MutationObserver)
      if (this.currentState?.isDetected) {
        const domData = extractFromTradingViewDOM();
        const newPrice = domData.currentPrice;

        if (newPrice !== null && this.lastPrice !== null) {
          if (Math.abs(newPrice - this.lastPrice) > 0.00001) {
            this.lastPrice = newPrice;
            this.currentState = createSuccessfulChartState(
              this.lastSymbol || domData.symbol,
              this.lastTimeframe || domData.timeframe,
              null,
              newPrice,
              'tradingview',
              now,
            );
            this.publishToBackground(this.currentState);
            return;
          }
        }

        // Also check for symbol/timeframe changes that observer might have missed
        if (domData.symbol !== 'UNKNOWN' && domData.symbol !== this.lastSymbol) {
          this.lastSymbol = domData.symbol;
          this.readAndPublish();
          return;
        }
        if (domData.timeframe && domData.timeframe !== this.lastTimeframe) {
          this.lastTimeframe = domData.timeframe;
          this.readAndPublish();
          return;
        }
      }
    }, this.POLL_INTERVAL_MS);
  }

  /**
   * Fallback detection for non-TradingView platforms.
   */
  private startFallbackDetection(): void {
    if (this.platform === 'generic') return;

    this.isRunning = true;
    console.log('[ChartStateManager] Starting fallback detection for:', this.platform);

    // Read initial state
    this.readAndPublish();

    // Poll for changes
    this.pollingInterval = setInterval(() => {
      if (!this.isRunning) return;

      const newPlatform = WebsiteDetector.detectPlatform();
      if (newPlatform === 'generic') {
        this.publishFailure('NOT_TRADING_PAGE');
        this.stop();
        return;
      }

      const symbol = WebsiteDetector.getSymbol();
      const timeframe = WebsiteDetector.getTimeframe();

      if (symbol && (symbol !== this.lastSymbol || timeframe !== this.lastTimeframe)) {
        this.lastSymbol = symbol;
        this.lastTimeframe = timeframe || '1D';
        this.readAndPublish();
      }
    }, this.POLL_INTERVAL_MS);
  }
}
