// Content Script for Universal AI Trading Copilot
// Responsible for interacting with the webpage, extracting chart data,
// and displaying analysis results

// Import necessary modules
import { sendMessageToBackend } from '../utils/messaging';
import { WebsiteDetector } from '../modules/website-detector/website-detector';
import { ChartOverlay } from '../overlay/chart-overlay';
import { isTradingViewPage, extractFromTradingViewDOM } from '../modules/tradingview';
import { TradingViewObserver } from '../modules/tradingview/tradingview-observer';

// Initialize variables
let chartOverlay: ChartOverlay | null = null;
let tvObserver: TradingViewObserver | null = null; // TradingView DOM observer (module-level for cleanup)
let isInitialized = false;
let lastAnalysisTime = 0;
const ANALYSIS_COOLDOWN = 30000; // 30 seconds between automatic analyses
let analysisInterval: NodeJS.Timeout | null = null;
let isInitializing = false; // Prevent recursive initialization

// Initialize when the page loads
async function initialize(): Promise<void> {
  // Prevent multiple simultaneous initializations
  if (isInitialized || isInitializing) return;

  isInitializing = true;

  try {
    const currentUrl = window.location.hostname;
    console.log('[Content Script] Initializing on:', currentUrl);

    // Detect the trading platform
    const platform = WebsiteDetector.detectPlatform();
    console.log('[Content Script] Platform detected:', platform);

    // If not a supported platform, exit gracefully without side effects
    if (platform === 'generic') {
      console.log('[Content Script] ❌ Not a supported trading platform. Skipping initialization.');
      console.log('[Content Script] Supported platforms: tradingview.com, binance.com, bybit.com, coinbase.com, zerodha.com, upstox.com, angelone.in, groww.in');
      console.log('[Content Script] Current URL:', currentUrl);
      return;
    }

    console.log('[Content Script] ✅ Supported platform detected:', platform);
    console.log('[Content Script] Initializing Trading Copilot for', platform);

    // Create chart overlay
    const overlay = new ChartOverlay();
    await overlay.initialize();
    chartOverlay = overlay;
    isInitialized = true;

    // Set up message listeners
    setupMessageListeners();

    // Set up periodic analysis (if enabled)
    setupPeriodicAnalysis();

    // Set up SPA navigation observer (re-creates if already exists from cleanup)
    setupSpaObserver();

    // If on TradingView, start DOM observer for auto-detection
    if (isTradingViewPage()) {
      console.log('[Content Script] Starting TradingView DOM observer...');
      tvObserver = new TradingViewObserver();
      tvObserver.start((changeEvent) => {
        console.log('[Content Script] TradingView chart change detected:', changeEvent);
        // When symbol or timeframe changes, auto-request analysis
        if (changeEvent.type === 'symbol' || changeEvent.type === 'timeframe') {
          setTimeout(() => {
            requestAnalysisIfNeeded();
          }, 2000);
        }
      });
      console.log('[Content Script] TradingView observer active');
    }

    // Notify background script that content script is ready
    try {
      await sendMessageToBackend({
        type: 'CONTENT_SCRIPT_READY',
        payload: {
          platform,
          url: window.location.href,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.warn('[Content Script] Failed to notify background script:', error);
    }

    // Trigger initial analysis after a short delay. The TradingView observer's
    // own dedup (captureBaseline → compare) won't fire on the first poll because
    // baseline matches current values. Without this call, the user would need to
    // manually click Analyze or wait 60s for the periodic interval.
    setTimeout(() => {
      requestAnalysisIfNeeded();
    }, 4000);
  } catch (error) {
    console.error('[Content Script] Failed to initialize content script:', error);
    chartOverlay = null;
    isInitialized = false;
  } finally {
    isInitializing = false;
  }
}

// Set up listeners for messages from background script or popup
function setupMessageListeners(): void {
  // Listen for messages from background/popup
  chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    // Only process messages from our own extension (background/popup)
    if (sender.id !== chrome.runtime.id) {
      sendResponse({ error: 'Unknown sender' });
      return false;
    }

    // Only process messages if initialized
    if (!isInitialized) {
      sendResponse({ error: 'Content script not initialized' });
      return true;
    }

    handleMessage(message, sendResponse);
    return true; // Keep message channel open for async response
  });
}

// Handle incoming messages
async function handleMessage(message: any, sendResponse: (response?: any) => void): Promise<void> {
  try {
    console.log('[Content Script] Received message:', message.type, message.payload || message.data || '');

    switch (message.type) {
      case 'REQUEST_ANALYSIS':
        // Request from popup or background to perform analysis
        await performAnalysis(message.payload);
        sendResponse({ success: true });
        break;

      case 'UPDATE_OVERLAY':
        // Update the overlay with new data (from background after analysis completes)
        if (chartOverlay) {
          console.log('[Content Script] Updating overlay with analysis data');
          await chartOverlay.update(message.payload);
        } else {
          console.warn('[Content Script] Cannot update overlay: not initialized');
        }
        sendResponse({ success: true });
        break;

      case 'ANALYSIS_UPDATE':
        // Direct analysis update from background (alternative message type)
        if (chartOverlay && message.data) {
          console.log('[Content Script] Received ANALYSIS_UPDATE, updating overlay');
          await chartOverlay.update({ analysisResult: message.data });
          lastAnalysisTime = Date.now();
        }
        sendResponse({ success: true });
        break;

      case 'ANALYSIS_ERROR':
        // Error from background
        if (chartOverlay) {
          console.error('[Content Script] Analysis error from background:', message.error);
          await chartOverlay.showError('Analysis failed: ' + (message.error || 'Unknown error'));
        }
        sendResponse({ success: true });
        break;

      case 'HIDE_OVERLAY':
        // Hide the overlay
        if (chartOverlay) {
          await chartOverlay.hide();
        }
        sendResponse({ success: true });
        break;

      case 'SHOW_OVERLAY':
        // Show the overlay
        if (chartOverlay) {
          await chartOverlay.show();
        }
        sendResponse({ success: true });
        break;

      case 'GET_CHART_INFO':
        // Return current chart symbol, timeframe, and price from DOM
        try {
          if (isTradingViewPage()) {
            const domData = extractFromTradingViewDOM();
            sendResponse({
              symbol: domData.symbol !== 'UNKNOWN' ? domData.symbol : null,
              timeframe: domData.timeframe,
              price: domData.currentPrice,
              platform: 'tradingview',
            });
          } else {
            const platform = WebsiteDetector.detectPlatform();
            sendResponse({
              symbol: WebsiteDetector.getSymbol() || null,
              timeframe: WebsiteDetector.getTimeframe() || null,
              platform,
            });
          }
        } catch (error) {
          sendResponse({ error: String(error), symbol: null, timeframe: null });
        }
        break;

      case 'GET_STATUS':
        // Return current status
        sendResponse({
          initialized: isInitialized,
          platform: WebsiteDetector.detectPlatform(),
          lastAnalysisTime: lastAnalysisTime
        });
        break;

      default:
        console.warn('[Content Script] Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[Content Script] Error handling message:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);
    sendResponse({ error: errorMsg });
  }
}

/**
 * Perform analysis — collect real market data from TradingView and send to background.
 * This is the MAIN entry point for market analysis from the content script.
 */
async function performAnalysis(payload = {}): Promise<void> {
  if (!isInitialized) {
    await initialize();
    if (!isInitialized) {
      throw new Error('Failed to initialize');
    }
  }
  if (!chartOverlay) {
    throw new Error('Chart overlay not initialized');
  }

  try {
    const { force = false } = payload as { force?: boolean };

    // Check cooldown (unless forced)
    const now = Date.now();
    if (!force && (now - lastAnalysisTime) < ANALYSIS_COOLDOWN) {
      console.log('[Content Script] Analysis cooldown active, skipping');
      return;
    }

    // Get symbol, timeframe, and platform from the page
    const platform = WebsiteDetector.detectPlatform();
    let symbol: string;
    let timeframe: string;

    // If on TradingView, use the dedicated DOM extractor for best accuracy
    // Only extract symbol/timeframe/price from DOM — background handles all API calls
    if (isTradingViewPage()) {
      const domData = extractFromTradingViewDOM();
      symbol = domData.symbol;
      timeframe = domData.timeframe;
      console.log(`[Content Script] DOM extracted: ${symbol} ${timeframe}, price=${domData.currentPrice}`);
    } else {
      // Fallback for other platforms
      symbol = WebsiteDetector.getSymbol();
      timeframe = WebsiteDetector.getTimeframe();
      console.log(`[Content Script] Using platform detection: ${symbol} ${timeframe} on ${platform}`);
    }

    console.log(`[Content Script] Requesting analysis for ${symbol} (${timeframe}) on ${platform}`);

    // Show loading state in overlay
    await chartOverlay.showLoading(`Analyzing ${symbol}...`);

    // Request analysis from background script
    let analysisResult: any;
    try {
      analysisResult = await sendMessageToBackend({
        type: 'REQUEST_ANALYSIS',
        payload: {
          symbol,
          timeframe,
          platform,
          force: true
        }
      });
    } catch (messageError: any) {
      console.warn('[Content Script] sendMessageToBackend failed:', messageError.message || messageError);
      return;
    }

    console.log('[Content Script] Received analysis result:', analysisResult ? {
      recommendation: analysisResult.recommendation,
      confidence: analysisResult.confidence,
      hasData: !!(analysisResult && analysisResult.indicators)
    } : 'null/undefined');

    // Update overlay with results
    if (analysisResult && !analysisResult.error) {
      if (analysisResult.recommendation && typeof analysisResult.confidence === 'number') {
        console.log('[Content Script] Valid analysis result, updating overlay');
        await chartOverlay.updateAnalysis(analysisResult);
        lastAnalysisTime = Date.now();
      } else if (analysisResult.success === true) {
        console.log('[Content Script] Legacy response, waiting for UPDATE_OVERLAY');
      } else {
        console.warn('[Content Script] Unexpected response format:', analysisResult);
      }
    } else if (analysisResult && analysisResult.error) {
      throw new Error(analysisResult.error);
    }
  } catch (error) {
    console.error('[Content Script] Analysis failed:', error);
    if (chartOverlay) {
      await chartOverlay.showError('Analysis failed: ' + (error instanceof Error ? error.message : String(error)));
    }
    throw error;
  }
}

// Request analysis if needed (called periodically)
function requestAnalysisIfNeeded(): void {
  // Only proceed if initialized
  if (!isInitialized) return;

  const now = Date.now();
  if ((now - lastAnalysisTime) > ANALYSIS_COOLDOWN) {
    performAnalysis({ force: false }).catch(error => {
      console.error('[Content Script] Periodic analysis failed:', error);
    });
  }
}

// Set up periodic analysis based on settings
function setupPeriodicAnalysis(): void {
  // Don't setup if not initialized
  if (!isInitialized) return;

  // Clear existing interval
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }

  // Get settings from storage to determine analysis interval
  // For now, use a default interval - in a real implementation,
  // this would come from storage/settings
  const analysisIntervalMs = 60000; // Default to 1 minute

  analysisInterval = setInterval(() => {
    requestAnalysisIfNeeded();
  }, analysisIntervalMs);
}

// Initialize when DOM is ready
function domReadyInit(): void {
  // initialize() will call setupSpaObserver() internally
  initialize();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(domReadyInit, 500);
  });
} else {
  // DOM already loaded — initialize immediately after a short delay
  // to allow other page scripts to settle
  setTimeout(domReadyInit, 1000);
}

// Handle SPA (Single Page Application) route changes
// Uses a single MutationObserver that debounces URL changes.
// Store observer reference so it can be cleaned up on SPA re-init.
let lastUrl = location.href;
let spaDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let spaObserver: MutationObserver | null = null;

function setupSpaObserver(): void {
  // Disconnect any existing SPA observer before creating a new one
  if (spaObserver) {
    spaObserver.disconnect();
    spaObserver = null;
  }

  // Reset url tracking
  lastUrl = location.href;

  spaObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      // Debounce: wait 500ms after last URL change before re-initializing
      if (spaDebounceTimer) clearTimeout(spaDebounceTimer);
      spaDebounceTimer = setTimeout(() => {
        // Clean up old state
        isInitialized = false;
        isInitializing = false;
        if (chartOverlay) {
          chartOverlay.destroy();
          chartOverlay = null;
        }
        if (tvObserver) {
          tvObserver.stop();
          tvObserver = null;
        }
        spaLegacyIconCleanup();
        // Disconnect and re-create SPA observer after cleanup
        if (spaObserver) {
          spaObserver.disconnect();
          spaObserver = null;
        }
        // Re-initialize for new page state (setupSpaObserver will be called by initialize)
        initialize();
      }, 500);
    }
  });

  // Use a lightweight observer config — only watch body's child list for URL changes
  // Subtree is needed to catch SPA navigation events that don't change body's children
  spaObserver.observe(document.body, { childList: true, subtree: true });
}

// Call setupSpaObserver after DOM is ready (alongside the main initialize call)
// The observer will be created once the content script first runs.

/**
 * Clean up any stale overlay icon elements that may remain in the DOM
 * from a previous page load or SPA navigation.
 */
function spaLegacyIconCleanup(): void {
  document.querySelectorAll('#trading-copilot-overlay, [id^="trading-copilot-"], .trading-copilot-icon').forEach(el => el.remove());
}

// Handle visibility change (tab switching)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Page is hidden, pause frequent updates
    if (analysisInterval) {
      clearInterval(analysisInterval);
      analysisInterval = null;
    }
  } else {
    // Page is visible, resume updates
    setupPeriodicAnalysis();
  }
});

// Export for debugging
declare global {
  interface Window {
    tradingCopilot: {
      isInitialized: boolean;
      chartOverlay: ChartOverlay | null;
      initialize: () => Promise<void>;
    };
  }
}

window.tradingCopilot = {
  get isInitialized() { return isInitialized; },
  get chartOverlay() { return chartOverlay; },
  initialize: initialize
};
