// Content Script for Universal AI Trading Copilot
// Responsible for interacting with the webpage, extracting chart data,
// and displaying analysis results

// Import necessary modules
import { sendMessageToBackend, sendMessageToPopup, onMessage } from '../utils/messaging';
import { WebsiteDetector } from '../modules/website-detector/website-detector';
import { ChartOverlay } from '../overlay/chart-overlay';

// Initialize variables
let chartOverlay: ChartOverlay | null = null;
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
    // Get current URL for logging
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

    // If we get here, initialization succeeded
    chartOverlay = overlay;
    isInitialized = true;

    // Set up message listeners
    setupMessageListeners();

    // Set up periodic analysis (if enabled)
    setupPeriodicAnalysis();

    // Notify background script that content script is ready
    try {
      await sendMessageToBackend({
        type: 'CONTENT_SCRIPT_READY',
        payload: {
          platform: WebsiteDetector.detectPlatform(),
          url: window.location.href,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.warn('[Content Script] Failed to notify background script:', error);
    }

    // Perform initial analysis after a short delay
    setTimeout(() => {
      requestAnalysisIfNeeded();
    }, 3000);
  } catch (error) {
    console.error('[Content Script] Failed to initialize content script:', error);
    chartOverlay = null; // ensure it's null on failure
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

// Perform analysis and update UI
async function performAnalysis(payload = {}): Promise<void> {
  // Check if we're ready
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
      return; // Still in cooldown period
    }

    // Get current symbol, timeframe, and platform from the page
    const symbol = WebsiteDetector.getSymbol();
    const timeframe = WebsiteDetector.getTimeframe();
    const platform = WebsiteDetector.detectPlatform();

    console.log(`[Content Script] Requesting analysis for ${symbol} (${timeframe}) on ${platform}`);

    // Show loading state in overlay
    await chartOverlay.showLoading(`Analyzing ${symbol}...`);

    // Request analysis from background script
    // Include the platform so the adapter manager can select the right adapter
    let analysisResult: any;
    try {
      analysisResult = await sendMessageToBackend({
        type: 'REQUEST_ANALYSIS',
        payload: {
          symbol,
          timeframe,
          platform,  // ← critical: tells background which adapter to use
          force: true
        }
      });
    } catch (messageError: any) {
      // sendMessageToBackend rejects on chrome.runtime.lastError — this happens when:
      // 1. Service worker restarted mid-request ("Extension context invalidated")
      // 2. Message channel timed out
      // 3. No receiving extension endpoint
      console.warn('[Content Script] sendMessageToBackend failed (non-critical if UPDATE_OVERLAY arrives separately):', messageError.message || messageError);
      // The background also broadcasts results via UPDATE_OVERLAY,
      // so the analysis may still display even if the direct response is lost.
      // Return without error — UPDATE_OVERLAY handler will process the result.
      return;
    }

    console.log('[Content Script] Received analysis result:', analysisResult ? {
      recommendation: analysisResult.recommendation,
      confidence: analysisResult.confidence,
      hasData: !!(analysisResult && analysisResult.indicators)
    } : 'null/undefined');

    // Update overlay with results
    if (analysisResult && !analysisResult.error) {
      // Check if the result has the expected structure
      if (analysisResult.recommendation && typeof analysisResult.confidence === 'number') {
        console.log('[Content Script] Valid analysis result, updating overlay');
        await chartOverlay.updateAnalysis(analysisResult);
        lastAnalysisTime = Date.now();
      } else if (analysisResult.success === true) {
        // Legacy response format - background still sends the result via UPDATE_OVERLAY
        console.log('[Content Script] Legacy response received, waiting for UPDATE_OVERLAY');
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
    throw error; // Re-throw so handleMessage can send error response
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      initialize();
    }, 500);
  });
} else {
  setTimeout(() => {
    initialize();
  }, 1000);
}

// Also initialize when DOM content is loaded (backup)
// This ensures initialization even if the script runs before DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    initialize();
  }, 500);
});

// Handle SPA (Single Page Application) route changes
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Re-initialize for new page state
    const wasInitialized = isInitialized;
    isInitialized = false;
    if (chartOverlay) {
      chartOverlay.destroy();
      chartOverlay = null;
    }
    setTimeout(() => {
      initialize();
    }, 1000);
  }
}).observe(document.body, { childList: true, subtree: true });

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
