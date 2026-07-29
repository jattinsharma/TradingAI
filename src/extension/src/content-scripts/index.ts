// Content Script for Universal AI Trading Copilot
// Responsible for interacting with the webpage, extracting chart data,
// and displaying analysis results
//
// CHART DETECTION ARCHITECTURE:
// The ONLY component that reads the DOM is this content script.
// Chart state is published to the background via ChartStateManager.
// The popup, overlay, and background NEVER read the DOM directly.

import { sendMessageToBackend } from '../utils/messaging';
import { WebsiteDetector } from '../modules/website-detector/website-detector';
import { ChartOverlay } from '../overlay/chart-overlay';
import { isTradingViewPage, extractFromTradingViewDOM } from '../modules/tradingview';
import { ChartStateManager } from '../modules/chart-state/chart-state-manager';
import { ChartState, createSuccessfulChartState, createFailedChartState, CHART_STATE_MESSAGES } from '../modules/chart-state/chart-state.types';

// ── State ──
let chartOverlay: ChartOverlay | null = null;
let chartStateManager: ChartStateManager | null = null;
let isInitialized = false;
let isInitializing = false;
let lastAnalysisTime = 0;
const ANALYSIS_COOLDOWN = 30000;
let analysisInterval: ReturnType<typeof setInterval> | null = null;

// ── Initialize ──
async function initialize(): Promise<void> {
  if (isInitialized || isInitializing) return;
  isInitializing = true;

  try {
    const currentUrl = window.location.hostname;
    console.log('[Content Script] Initializing on:', currentUrl);

    const platform = WebsiteDetector.detectPlatform();
    console.log('[Content Script] Platform detected:', platform);

    if (platform === 'generic') {
      console.log('[Content Script] ❌ Not a supported trading platform. Skipping initialization.');
      console.log('[Content Script] Supported platforms: tradingview.com, binance.com, bybit.com, coinbase.com, zerodha.com, upstox.com, angelone.in, groww.in');
      console.log('[Content Script] Current URL:', currentUrl);
      // Still notify background so the popup knows content script is active but platform is unsupported
      sendMessageToBackend({
        type: CHART_STATE_MESSAGES.CHART_STATE_UPDATED,
        payload: createFailedChartState('UNSUPPORTED_PLATFORM'),
      }).catch(() => {});
      return;
    }

    console.log('[Content Script] ✅ Supported platform detected:', platform);

    // Create chart overlay
    const overlay = new ChartOverlay();
    await overlay.initialize();
    chartOverlay = overlay;
    isInitialized = true;

    // Set up message listeners
    setupMessageListeners();

    // Set up SPA navigation observer
    setupSpaObserver();

    // ── Start ChartStateManager (single chart detection path) ──
    chartStateManager = new ChartStateManager();
    chartStateManager.start();

    console.log('[Content Script] ChartStateManager started');

    // Trigger initial analysis after a short delay
    setTimeout(() => {
      requestAnalysisIfNeeded();
    }, 4000);
  } catch (error) {
    console.error('[Content Script] Failed to initialize:', error);
    chartOverlay = null;
    isInitialized = false;
  } finally {
    isInitializing = false;
  }
}

// ── Message Listeners ──
function setupMessageListeners(): void {
  chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
    if (sender.id !== chrome.runtime.id) {
      sendResponse({ error: 'Unknown sender' });
      return false;
    }

    if (!isInitialized && message.type !== 'GET_CHART_INFO') {
      sendResponse({ error: 'Content script not initialized' });
      return true;
    }

    handleMessage(message, sendResponse);
    return true;
  });
}

async function handleMessage(message: any, sendResponse: (response?: any) => void): Promise<void> {
  try {
    console.log('[Content Script] Received message:', message.type, message.payload || message.data || '');

    switch (message.type) {
      case 'REQUEST_ANALYSIS':
        await performAnalysis(message.payload);
        sendResponse({ success: true });
        break;

      case 'UPDATE_OVERLAY':
        if (chartOverlay) {
          await chartOverlay.update(message.payload);
        }
        sendResponse({ success: true });
        break;

      case 'ANALYSIS_UPDATE':
        if (chartOverlay && message.data) {
          await chartOverlay.update({ analysisResult: message.data });
          lastAnalysisTime = Date.now();
        }
        sendResponse({ success: true });
        break;

      case 'ANALYSIS_ERROR':
        if (chartOverlay) {
          await chartOverlay.showError('Analysis failed: ' + (message.error || 'Unknown error'));
        }
        sendResponse({ success: true });
        break;

      case 'HIDE_OVERLAY':
        if (chartOverlay) await chartOverlay.hide();
        sendResponse({ success: true });
        break;

      case 'SHOW_OVERLAY':
        if (chartOverlay) await chartOverlay.show();
        sendResponse({ success: true });
        break;

      case 'GET_CHART_INFO':
        // Return current chart state from ChartStateManager (no DOM read)
        // This is the ONLY path for popup chart info requests
        try {
          const state = chartStateManager?.getCurrentState();
          if (state && state.isDetected) {
            sendResponse({
              symbol: state.symbol,
              timeframe: state.timeframe,
              price: state.currentPrice,
              platform: state.platform,
              isDetected: true,
            });
          } else if (state) {
            // Return failure details so popup can show helpful error
            sendResponse({
              symbol: null,
              timeframe: null,
              price: null,
              platform: null,
              isDetected: false,
              failureReason: state.failureReason,
              failureSuggestion: state.failureSuggestion,
              status: state.status,
            });
          } else {
            sendResponse({
              symbol: null,
              timeframe: null,
              price: null,
              platform: null,
              isDetected: false,
              failureReason: 'CONTENT_SCRIPT_MISSING',
              failureSuggestion: 'Trading Copilot content script is not yet initialized. Try again in a moment.',
              status: 'Content script not initialized',
            });
          }
        } catch (error) {
          sendResponse({ error: String(error), symbol: null, timeframe: null, isDetected: false });
        }
        break;

      case 'GET_STATUS':
        sendResponse({
          initialized: isInitialized,
          platform: WebsiteDetector.detectPlatform(),
          lastAnalysisTime,
        });
        break;

      default:
        console.warn('[Content Script] Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[Content Script] Error handling message:', error);
    sendResponse({ error: error instanceof Error ? error.message : String(error) });
  }
}

// ── Analysis ──
async function performAnalysis(payload = {}): Promise<void> {
  if (!isInitialized) {
    await initialize();
    if (!isInitialized) throw new Error('Failed to initialize');
  }
  if (!chartOverlay) throw new Error('Chart overlay not initialized');

  try {
    const { force = false } = payload as { force?: boolean };

    const now = Date.now();
    if (!force && (now - lastAnalysisTime) < ANALYSIS_COOLDOWN) {
      console.log('[Content Script] Analysis cooldown active, skipping');
      return;
    }

    // Get chart state from ChartStateManager (no direct DOM read)
    const state = chartStateManager?.getCurrentState();

    if (!state || !state.isDetected || !state.symbol) {
      const reason = state?.failureSuggestion || 'Could not detect chart. Make sure a trading chart is open.';
      await chartOverlay.showError(reason);
      return;
    }

    const symbol = state.symbol;
    const timeframe = state.timeframe || '1D';
    const platform = state.platform || 'tradingview';

    console.log(`[Content Script] Requesting analysis for ${symbol} (${timeframe}) on ${platform}`);

    await chartOverlay.showLoading(`Analyzing ${symbol}...`);

    let analysisResult: any;
    try {
      analysisResult = await sendMessageToBackend({
        type: 'REQUEST_ANALYSIS',
        payload: { symbol, timeframe, platform, force: true },
      });
    } catch (messageError: any) {
      console.warn('[Content Script] sendMessageToBackend failed:', messageError.message || messageError);
      return;
    }

    console.log('[Content Script] Received analysis result:', analysisResult ? {
      recommendation: analysisResult.recommendation,
      confidence: analysisResult.confidence,
    } : 'null/undefined');

    if (analysisResult && !analysisResult.error) {
      if (analysisResult.recommendation && typeof analysisResult.confidence === 'number') {
        await chartOverlay.updateAnalysis(analysisResult);
        lastAnalysisTime = Date.now();
      } else if (analysisResult.success === true) {
        console.log('[Content Script] Legacy response, waiting for UPDATE_OVERLAY');
      } else {
        console.warn('[Content Script] Unexpected response format:', analysisResult);
      }
    } else if (analysisResult?.error) {
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

function requestAnalysisIfNeeded(): void {
  if (!isInitialized) return;
  const now = Date.now();
  if ((now - lastAnalysisTime) > ANALYSIS_COOLDOWN) {
    performAnalysis({ force: false }).catch(error => {
      console.error('[Content Script] Periodic analysis failed:', error);
    });
  }
}

function setupPeriodicAnalysis(): void {
  if (!isInitialized) return;
  if (analysisInterval) {
    clearInterval(analysisInterval);
    analysisInterval = null;
  }
  analysisInterval = setInterval(() => {
    requestAnalysisIfNeeded();
  }, 60000);
}

// ── SPA Observer ──
let lastUrl = location.href;
let spaDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let spaObserver: MutationObserver | null = null;

function setupSpaObserver(): void {
  if (spaObserver) {
    spaObserver.disconnect();
    spaObserver = null;
  }
  lastUrl = location.href;

  spaObserver = new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      if (spaDebounceTimer) clearTimeout(spaDebounceTimer);
      spaDebounceTimer = setTimeout(() => {
        isInitialized = false;
        isInitializing = false;
        if (chartOverlay) {
          chartOverlay.destroy();
          chartOverlay = null;
        }
        if (chartStateManager) {
          chartStateManager.stop();
          chartStateManager = null;
        }
        spaLegacyIconCleanup();
        if (spaObserver) {
          spaObserver.disconnect();
          spaObserver = null;
        }
        initialize();
      }, 500);
    }
  });

  spaObserver.observe(document.body, { childList: true, subtree: true });
}

function spaLegacyIconCleanup(): void {
  document.querySelectorAll('#trading-copilot-overlay, [id^="trading-copilot-"], .trading-copilot-icon').forEach(el => el.remove());
}

// ── Visibility ──
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (analysisInterval) {
      clearInterval(analysisInterval);
      analysisInterval = null;
    }
  } else {
    setupPeriodicAnalysis();
  }
});

// ── Init ──
function domReadyInit(): void {
  initialize();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(domReadyInit, 500);
  });
} else {
  setTimeout(domReadyInit, 1000);
}

// ── Global export ──
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
  initialize,
};
