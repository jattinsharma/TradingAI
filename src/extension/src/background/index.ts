// Background service worker for the Universal AI Trading Copilot extension
// Handles messaging, alarms, background operations, and auto-saving to backend

// Import necessary modules
import { StorageManager } from '../storage/storage-manager';
import { AlarmManager } from '../alarms/alarm-manager';
import { AnalysisOrchestrator } from '../analysis/analysis-orchestrator';
import { tradingCopilotApi } from '../api/trading-copilot-api';
import { getBackendUrl, saveBackendUrl, setBackendUrl as setCachedBackendUrl } from '../api/config';

// ── Chart State Cache ──
// The latest ChartState per tab ID, updated by content script via CHART_STATE_UPDATED
import {
  ChartState,
  CHART_STATE_MESSAGES,
  createSuccessfulChartState,
  createFailedChartState,
  type ChartDetectionFailure,
} from '../modules/chart-state/chart-state.types';

const MAX_CHART_STATE_AGE_MS = 2000; // 2 second freshness threshold
const CHART_REFRESH_TIMEOUT_MS = 3000; // 3 second timeout for content script refresh
const chartStateCache = new Map<number, ChartState>();

// Initialize managers
let storage: StorageManager | null = null;
let alarmManager: AlarmManager | null = null;
let analysisOrchestrator: AnalysisOrchestrator | null = null;
let isInitialized = false;

// Initialize everything when the service worker starts
// Maximum initialization retries to handle transient storage failures
const MAX_INIT_RETRIES = 3;
const INIT_RETRY_DELAY_MS = 2000;

async function initialize(): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt++) {
    try {
      // Create managers
      storage = new StorageManager();
      alarmManager = new AlarmManager();
      analysisOrchestrator = new AnalysisOrchestrator();

      // Load backend URL from storage (defaults to production Render URL)
      try {
        const backendUrl = await getBackendUrl();
        tradingCopilotApi.setBaseUrl(backendUrl);
        console.log('[Background] Backend URL configured:', backendUrl);
      } catch {
        console.log('[Background] Using default backend URL');
      }

      // Restore tokens from storage if available
      try {
        const auth = await storage.get('backendAuth');
        if (auth?.jwtToken) {
          tradingCopilotApi.setJwtToken(auth.jwtToken);
          console.log('[Background] JWT token restored from storage');
        }
        if (auth?.refreshToken) {
          tradingCopilotApi.setRefreshToken(auth.refreshToken);
          console.log('[Background] Refresh token restored from storage');
        }
      } catch {
        // Non-critical - user can re-login
      }

      // Attempt silent re-auth if we have a refresh token
      if (tradingCopilotApi.getRefreshToken()) {
        silentReAuth().catch(() => {
          // Silent re-auth failed — user may need to log in again
        });
      }

      // Register callback for when token refresh fails
      tradingCopilotApi.setOnRefreshFailed(() => {
        console.log('[Background] Token refresh failed — clearing stored auth');
        storage?.remove('backendAuth').catch(() => {});
        // Notify popup if open
        chrome.runtime.sendMessage({ type: 'AUTH_EXPIRED' }, () => {
          if (chrome.runtime.lastError) { /* popup closed — ignore */ }
        });
      });

      console.log('[Background] Service initialized');
      isInitialized = true;
      return true;
    } catch (error) {
      console.error(`[Background] Failed to initialize (attempt ${attempt}/${MAX_INIT_RETRIES}):`, error);
      isInitialized = false;
      if (attempt < MAX_INIT_RETRIES) {
        // Wait before retrying — MV3 service worker may still be starting up
        await new Promise(r => setTimeout(r, INIT_RETRY_DELAY_MS));
      }
    }
  }
  console.error('[Background] All initialization attempts failed');
  return false;
}

// Set up alarms
async function setupAlarms(): Promise<void> {
  if (!alarmManager) {
    console.error('[Background] Alarm manager not initialized');
    return;
  }

  try {
    // Alarm for periodic analysis (every 5 minutes)
    await alarmManager.createAlarm('periodicAnalysis', 5);
    console.log('[Background] Periodic alarm set up');
  } catch (error) {
    console.error('[Background] Failed to set up alarms:', error);
  }
}

// ── Listeners tracking to prevent double registration ──
let listenersRegistered = false;

// Set up listeners (idempotent — only registers once)
function setupListeners(): void {
  if (listenersRegistered) {
    console.log('[Background] Listeners already registered, skipping');
    return;
  }
  if (!isInitialized) {
    console.error('[Background] Cannot set up listeners: service not initialized');
    return;
  }

  // Listen for alarm events
  chrome.alarms.onAlarm.addListener((alarm) => {
    handleAlarm(alarm).catch(error => {
      console.error('[Background] Error handling alarm:', error);
    });
  });

  // Listen for messages from popup, content script, or options page
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Will respond asynchronously
  });

  // Listen for when Chrome starts (service worker restart in MV3)
  chrome.runtime.onStartup.addListener(() => {
    console.log('[Background] Trading Copilot extension started (onStartup)');
    // Re-initialize state — listeners don't survive service worker restart
    // but onStartup fires BEFORE the first onMessage, so we re-init state only
    listenersRegistered = false; // Reset flag — we will register fresh listeners
    initialize().then(success => {
      if (success) {
        setupAlarms();
        setupListeners(); // Re-register after state init
      }
    }).catch(error => {
      console.error('[Background] Failed to initialize on startup:', error);
    });
  });

  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      console.log('[Background] Trading Copilot installed');
      initializeDefaultSettings().catch(error => {
        console.error('[Background] Failed to initialize default settings:', error);
      });
    } else if (details.reason === 'update') {
      console.log('[Background] Trading Copilot updated from', details.previousVersion);
    }
    // Ensure context menu is created on install AND update (stale menus are cleared first)
    ensureContextMenu();
  });

  // Set up context menus (separate from onInstalled to avoid double creation)
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'analyze-selection' && tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'REQUEST_ANALYSIS',
        payload: { text: info.selectionText }
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Background] contextMenus sendMessage error:', chrome.runtime.lastError.message);
        }
      });
    }
  });

  // Mark as registered — this prevents double registration
  listenersRegistered = true;
  console.log('[Background] Listeners registered');
}

// Ensure context menu is created exactly once
function ensureContextMenu(): void {
  // Remove any stale menu items first, then create fresh
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.warn('[Background] Could not clear context menus:', chrome.runtime.lastError.message);
    }
    chrome.contextMenus.create({
      id: 'analyze-selection',
      title: 'Analyze selected text for trading',
      contexts: ['selection']
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Background] Could not create context menu:', chrome.runtime.lastError.message);
      }
    });
  });
}

// Handle alarm events
async function handleAlarm(alarm: any): Promise<void> {
  if (!isInitialized) {
    console.error('[Background] Cannot handle alarm: service not initialized');
    return;
  }

  if (alarm.name === 'periodicAnalysis') {
    // Trigger periodic analysis for active tabs
    try {
      const tabs = await new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(tabs);
          }
        });
      });

      if (tabs[0] && tabs[0].id) {
        // Send message to content script to trigger analysis
        chrome.tabs.sendMessage(tabs[0].id, { type: 'TRIGGER_ANALYSIS' });
      }
    } catch (error) {
      console.error('[Background] Error handling periodic alarm:', error);
    }
  }
}

// Handle messages from other parts of the extension
async function handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    console.error('[Background] Cannot handle message: service not initialized');
    sendResponse({ error: 'Service not initialized' });
    return;
  }

  try {
    console.log('[Background] Received message:', message.type, message.payload || '');

    // Handle different message types
    switch (message.type) {
      case 'REQUEST_ANALYSIS':
        // Compute analysis and return the result directly via sendResponse
        try {
          const analysisResult = await handleAnalysisRequest(sender.tab?.id, message.payload);
          console.log('[Background] Analysis complete, returning result to caller');
          sendResponse(analysisResult);
        } catch (analysisError: any) {
          console.error('[Background] Analysis failed:', analysisError);
          sendResponse({ error: analysisError.message || 'Analysis failed' });
        }
        break;
      case 'GET_STATUS':
        await handleStatusRequest(sender.tab?.id, sendResponse);
        return;
      case 'BACKEND_LOGIN':
        await handleBackendLogin(message.payload, sendResponse);
        return;
      case 'UPDATE_BACKEND_URL':
        handleUpdateBackendUrl(message.payload, sendResponse);
        return;
      case 'BACKEND_LOGOUT':
        handleBackendLogout(sendResponse);
        return;
      case 'GET_BACKEND_STATUS':
        handleBackendStatus(sendResponse);
        return;
      case 'SAVE_SETTINGS':
        await handleSaveSettings(message.payload, sendResponse);
        return;
      case 'GET_SETTINGS':
        await handleGetSettings(sendResponse);
        return;
      case 'CHART_STATE_UPDATED':
        // Content script published updated chart state — cache it by tab ID
        if (sender.tab?.id && message.payload) {
          const state = message.payload as ChartState;
          state.cachedAt = Date.now();
          chartStateCache.set(sender.tab.id, state);
          console.log('[Background] ChartState cached for tab', sender.tab.id, ':',
            state.isDetected ? `${state.symbol} ${state.timeframe}` : 'no chart');
        }
        sendResponse({ success: true });
        break;

      case 'CONNECT_WALLET':
        await handleWalletConnection(message.payload, sendResponse);
        return;
      case 'DISCONNECT_WALLET':
        await handleWalletDisconnection(sendResponse);
        return;
      case 'SAVE_TRADE_JOURNAL':
        await handleSaveTradeJournal(message.payload, sendResponse);
        return;
      case 'ADD_TO_WATCHLIST':
        await handleAddToWatchlist(message.payload, sendResponse);
        return;
      case 'REMOVE_FROM_WATCHLIST':
        await handleRemoveFromWatchlist(message.payload, sendResponse);
        return;
      case 'GET_WATCHLIST':
        await handleGetWatchlist(sendResponse);
        return;
      case 'ANALYSIS_FETCH_REQUEST':
        await handleAnalysisFetch(message.payload, sendResponse);
        return;
      case 'GET_CHART_STATE':
      case 'GET_CHART_INFO':
        // Centralized chart state request with freshness check.
        // Returns cached state if < 2s old; otherwise requests a refresh from content script.
        const tabId = sender.tab?.id;
        if (tabId) {
          handleGetChartState(tabId, sendResponse);
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTabId = tabs[0]?.id;
            if (activeTabId) {
              handleGetChartState(activeTabId, sendResponse);
            } else {
              sendResponse({
                symbol: null,
                timeframe: null,
                price: null,
                platform: null,
                isDetected: false,
                failureReason: 'CONTENT_SCRIPT_MISSING',
                failureSuggestion: 'No active tab found. Open a trading chart first.',
                status: 'No active tab',
              });
            }
          });
        }
        return;
      default:
        console.warn('[Background] Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[Background] Error handling message:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendResponse({ error: errorMessage });
    return;
  }
}

// Handle analysis request from content script or popup
// Returns the analysis result object directly
async function handleAnalysisRequest(tabId: number | undefined, payload: any): Promise<any> {
  if (!isInitialized) {
    throw new Error('Service not initialized');
  }

  // ── Require symbol in payload — never hardcode a default symbol ──
  if (!payload || !payload.symbol) {
    console.error('[Background] ANALYSIS REJECTED: no symbol provided in payload');
    throw new Error(
      'Cannot analyze without a symbol. ' +
      'Make sure Trading Copilot is active on a supported trading chart ' +
      '(tradingview.com, binance.com, bybit.com, etc.) and the content script ' +
      'has loaded successfully.'
    );
  }

  let symbol = payload.symbol;
  let timeframe = payload.timeframe || '1D';
  let platform = payload.platform || '';
  let currentPrice = payload.price || payload.currentPrice || 0;

  console.log('[Background] Analyzing:', { symbol, timeframe, platform });

  // Validate that we're on a supported platform before analyzing
  if (!platform || platform === 'generic') {
    console.warn('[Background] Cannot analyze: unsupported platform', platform ? platform : 'unknown');
    throw new Error('Cannot analyze: unsupported website. Trading Copilot only works on tradingview.com, binance.com, bybit.com, coinbase.com, zerodha.com, upstox.com, angelone.in, and groww.in.');
  }

  console.log('[Background] Selected platform adapter:', platform);

  let analysis: any = null;

  // ── 1. Try V2 Multi-Agent Backend Pipeline if Authenticated ──
  if (tradingCopilotApi.isAuthenticated()) {
    try {
      console.log('[Background] Attempting V2 Multi-Agent AI Engine backend request...');
      const v2Response = await tradingCopilotApi.analyzeV2({
        symbol,
        timeframe,
        depth: payload.depth || 'STANDARD',
        chartData: {
          currentPrice: currentPrice || 100,
          exchange: platform,
          indicators: payload.indicators || {},
        },
      });

      if (v2Response && (v2Response.signal || v2Response.recommendation)) {
        console.log('[Background] V2 Multi-Agent AI Engine response received successfully!');
        analysis = mapV2RecommendationToAnalysisResult(v2Response, symbol, timeframe, currentPrice);
      }
    } catch (v2Error: any) {
      console.warn('[Background] V2 AI Engine call failed, falling back to client-side engine:', v2Error.message || v2Error);
    }
  }

  // ── 2. Fallback: Perform local client-side analysis if V2 failed or user unauthenticated ──
  if (!analysis) {
    if (!analysisOrchestrator) {
      throw new Error('Analysis orchestrator not initialized');
    }
    console.log('[Background] Running client-side analysis engine...');
    analysis = await analysisOrchestrator.analyze(symbol, timeframe, platform);
  }

  console.log('[Background] Analysis result:', {
    symbol: analysis.symbol,
    recommendation: analysis.recommendation,
    confidence: analysis.confidence
  });

  // ── Auto-save analysis to backend ──
  if (tradingCopilotApi.isAuthenticated()) {
    autoSaveAnalysis(analysis).catch((err: any) =>
      console.warn('[Background] Auto-save analysis failed (non-critical):', err)
    );
  }

  // ── Notify content script of results (async, non-blocking) ──
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: 'UPDATE_OVERLAY',
      payload: { analysisResult: analysis }
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Background] UPDATE_OVERLAY sendMessage error:', chrome.runtime.lastError.message);
      }
    });
  }

  // Also notify popup if open
  chrome.runtime.sendMessage({
    type: 'ANALYSIS_UPDATE',
    data: analysis
  }, () => {
    if (chrome.runtime.lastError) {
      // Popup closed — ignore
    }
  });

  return analysis;
}

/** Helper to convert V2 TradeRecommendation to extension's AnalysisResult shape */
function mapV2RecommendationToAnalysisResult(rec: any, symbol: string, timeframe: string, currentPrice?: number): any {
  const signalMap: Record<string, string> = {
    'STRONG_BUY': 'STRONG_BUY',
    'BUY': 'BUY',
    'BULLISH': 'BUY',
    'STRONG_BULLISH': 'STRONG_BUY',
    'NEUTRAL': 'HOLD',
    'HOLD': 'HOLD',
    'BEARISH': 'SELL',
    'STRONG_BEARISH': 'STRONG_SELL',
    'SELL': 'SELL',
    'STRONG_SELL': 'STRONG_SELL',
  };

  const recSignal = signalMap[rec.signal] || 'HOLD';
  const entryPrice = rec.entry?.price || currentPrice || 0;
  const stopLoss = rec.stopLoss?.price || 0;
  const takeProfit = rec.takeProfit1?.price || 0;

  const reasoningText = Array.isArray(rec.reasons)
    ? rec.reasons.join(' ')
    : (typeof rec.reasons === 'string' ? rec.reasons : 'Multi-agent consensus analysis complete.');

  return {
    symbol,
    timeframe,
    timestamp: Date.now(),
    recommendation: recSignal,
    confidence: typeof rec.confidence === 'number' ? rec.confidence : 50,
    currentPrice: currentPrice || rec.currentPrice,
    entryPrice,
    stopLoss,
    takeProfit,
    riskRewardRatio: rec.riskReward || 0,
    reasoning: reasoningText,
    indicators: {
      trend: { signal: rec.trend?.direction === 'UP' ? 'UP' : rec.trend?.direction === 'DOWN' ? 'DOWN' : 'NEUTRAL', strength: (rec.trend?.strength || 50) / 100 },
      momentum: { signal: rec.momentum?.direction === 'ACCELERATING' ? 'UP' : rec.momentum?.direction === 'DECELERATING' ? 'DOWN' : 'NEUTRAL', strength: (rec.momentum?.score || 50) / 100 },
      volume: { signal: 'NEUTRAL', strength: 0.5 },
      volatility: { signal: 'NEUTRAL', strength: 0.5 },
    },
    engines: {
      technical: { signal: recSignal, strength: (rec.confidence || 50) / 100, indicators: {} },
      pattern: { signal: 'NEUTRAL', strength: 0.5, pattern: 'Multi-Agent Analysis', confidence: rec.confidence || 50 },
      trend: { signal: rec.trend?.direction || 'NEUTRAL', strength: (rec.trend?.strength || 50) / 100 },
      supportResistance: {
        signal: 'NEUTRAL',
        strength: 0.5,
        levels: {
          resistance1: rec.resistance?.[0]?.price || 0,
          resistance2: rec.resistance?.[1]?.price || 0,
          support1: rec.support?.[0]?.price || 0,
          support2: rec.support?.[1]?.price || 0,
          currentPrice: currentPrice || rec.currentPrice || 0,
        },
      },
      volume: { signal: 'NEUTRAL', strength: 0.5 },
      momentum: { signal: rec.momentum?.direction || 'NEUTRAL', strength: (rec.momentum?.score || 50) / 100 },
      news: { signal: 'NEUTRAL', strength: 0.5, articles: [], sentiment: 0.5 },
      sentiment: { signal: 'NEUTRAL', strength: 0.5 },
      risk: {
        signal: 'NEUTRAL',
        strength: 0.5,
        riskLevel: rec.tradeQualityScore > 75 ? 'LOW' : rec.tradeQualityScore > 50 ? 'MEDIUM' : 'HIGH',
        riskScore: 100 - (rec.tradeQualityScore || 50),
        metrics: { volatility: 0.02, maxDrawdown: 0.1, sharpeRatio: 1.5, valueAtRisk95: 0.05, beta: 1, correlationToMarket: 0.8 }
      },
      portfolio: { signal: recSignal, strength: (rec.confidence || 50) / 100 },
      tradePlanning: {
        signal: recSignal,
        strength: (rec.confidence || 50) / 100,
        confidence: rec.confidence || 50,
        tradeSetup: {
          entryPrice,
          stopLoss,
          takeProfit,
          riskRewardRatio: rec.riskReward || 0,
          positionSizeSuggestion: 1,
          maxHoldTime: rec.holdingPeriod || '1D',
        },
        reasoning: reasoningText,
      },
      aiExplanation: {
        signal: recSignal,
        strength: (rec.confidence || 50) / 100,
        explanation: reasoningText,
        confidence: rec.confidence || 50,
        keyFactors: rec.reasons || [],
        risks: rec.contradictingEvidence || [],
        timeframeSuitability: 'HIGH',
      },
    },
    v2: rec,
  };
}

/**
 * Auto-save analysis to backend (standalone function)
 */
async function autoSaveAnalysis(analysis: any): Promise<void> {
  if (!analysis || !analysis.symbol) {
    console.warn('[Background] Cannot auto-save: invalid analysis result');
    return;
  }

  try {
    const tradePlan = analysis.engines?.tradePlanning?.tradeSetup;
    const aiExplanation = analysis.engines?.aiExplanation;

    // Use direct fields from the AnalysisResult
    const currentPrice = typeof analysis.currentPrice === 'number' && isFinite(analysis.currentPrice)
      ? analysis.currentPrice
      : (tradePlan?.entryPrice || 0);

    const payload = {
      symbol: analysis.symbol,
      timeframe: analysis.timeframe,
      currentPrice,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      entryPrice: analysis.entryPrice || tradePlan?.entryPrice,
      stopLoss: analysis.stopLoss || tradePlan?.stopLoss,
      takeProfit: analysis.takeProfit || tradePlan?.takeProfit,
      riskRewardRatio: analysis.riskRewardRatio || tradePlan?.riskRewardRatio,
      reasoning: analysis.reasoning,
      indicators: analysis.indicators,
      signals: analysis.engines,
      risks: aiExplanation?.risks || analysis.engines?.aiExplanation?.risks || [],
      alternativeScenario: '',
      invalidationLevel: '',
      tradeDuration: tradePlan?.maxHoldTime,
      platform: 'tradingview',
    };

    const saved = await tradingCopilotApi.saveAnalysis(payload);
    console.log('[Background] Analysis auto-saved to backend:', saved.id);
  } catch (error) {
    console.warn('[Background] Auto-save failed (will retry later):', error);
    try {
      const pending = (await storage?.get('pendingAnalysisSaves')) || [];
      pending.push({ analysis, timestamp: Date.now() });
      await storage?.set('pendingAnalysisSaves', pending.slice(-20));
    } catch { /* ignore */ }
  }
}

// Handle status request from popup
async function handleStatusRequest(tabId: number | undefined, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ error: 'Service not initialized' });
    return;
  }

  try {
    if (!storage) {
      throw new Error('Storage not initialized');
    }
    const status = await storage.get('connectionStatus') || { connected: false };
    sendResponse({ status });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    sendResponse({ error: message });
  }
}

// Handle settings save from popup/options
async function handleSaveSettings(settings: any, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ success: false, error: 'Service not initialized' });
    return;
  }

  try {
    if (!storage) {
      throw new Error('Storage not initialized');
    }
    await storage.set('userSettings', settings);
    sendResponse({ success: true });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: message });
  }
}

// Handle settings retrieval
async function handleGetSettings(sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ error: 'Service not initialized' });
    return;
  }

  try {
    if (!storage) {
      throw new Error('Storage not initialized');
    }
    const storageResult = await storage.get('userSettings') || {};
    sendResponse({ settings: storageResult });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    sendResponse({ error: message });
  }
}

/**
 * Attempt silent re-authentication using the stored refresh token.
 * Called on background service worker startup.
 */
async function silentReAuth(): Promise<void> {
  try {
    const success = await tradingCopilotApi.tryRefreshToken();
    if (success) {
      console.log('[Background] Silent re-auth succeeded');
      // Update stored tokens
      const auth = await storage?.get('backendAuth');
      if (auth && storage) {
        await storage.set('backendAuth', {
          ...auth,
          jwtToken: tradingCopilotApi.getJwtToken(),
          refreshToken: tradingCopilotApi.getRefreshToken(),
          connectedAt: Date.now(),
        });
      }
    } else {
      console.log('[Background] Silent re-auth failed (refresh token expired or invalid)');
      // Tokens are already cleared by tryRefreshToken
      storage?.remove('backendAuth').catch(() => {});
    }
  } catch (error) {
    console.warn('[Background] Silent re-auth error:', error);
  }
}

// Handle backend login
async function handleBackendLogin(payload: any, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ success: false, error: 'Service not initialized' });
    return;
  }

  try {
    const { email, password } = payload || {};
    if (!email || !password) {
      sendResponse({ success: false, error: 'Email and password required' });
      return;
    }

    const result = await tradingCopilotApi.login(email, password);

    // Store tokens in chrome.storage
    if (storage) {
      await storage.set('backendAuth', {
        jwtToken: result.access_token,
        refreshToken: result.refresh_token,
        user: result.user,
        connectedAt: Date.now(),
      });

      // Log the stored refresh token status
      console.log('[Background] Login successful, refresh token stored:', !!result.refresh_token);

      // Also cache recent analyses
      try {
        const stats = await tradingCopilotApi.getAnalysisStats();
        await storage.set('cachedStats', stats);
      } catch { /* ignore */ }
    }

    sendResponse({ success: true, user: result.user });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: message });
  }
}

// Handle backend URL update from Options page
async function handleUpdateBackendUrl(payload: any, sendResponse: (response?: any) => void): Promise<void> {
  const url = payload?.url?.trim();
  if (!url) {
    sendResponse({ success: false, error: 'URL required' });
    return;
  }
  // Update both the API client and the config cache
  tradingCopilotApi.setBaseUrl(url);
  setCachedBackendUrl(url);
  console.log('[Background] Backend URL updated to:', url);
  sendResponse({ success: true });
}

// Handle backend logout
async function handleBackendLogout(sendResponse: (response?: any) => void): Promise<void> {
  // Call backend to invalidate server-side tokens (fire-and-forget)
  try {
    const jwt = tradingCopilotApi.getJwtToken();
    if (jwt) {
      await fetch(`${tradingCopilotApi.getBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${jwt}` },
      });
    }
  } catch {
    // Server-side logout is best-effort
  }

  tradingCopilotApi.setJwtToken(null);
  tradingCopilotApi.setRefreshToken(null);
  if (storage) {
    storage.remove('backendAuth').catch(() => {});
  }
  sendResponse({ success: true });
}

// Handle backend status
async function handleBackendStatus(sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ authenticated: false });
    return;
  }

  try {
    const auth = await storage?.get('backendAuth');
    const stats = await storage?.get('cachedStats');
    sendResponse({
      authenticated: !!auth?.jwtToken,
      user: auth?.user || null,
      stats: stats || null,
    });
  } catch {
    sendResponse({ authenticated: false });
  }
}

// Handle save trade journal
async function handleSaveTradeJournal(payload: any, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ success: false, error: 'Service not initialized' });
    return;
  }

  try {
    if (!tradingCopilotApi.isAuthenticated()) {
      // Save locally if not connected to backend
      if (storage) {
        const entries = (await storage.get('localTradeJournal')) || [];
        entries.push({ ...payload, id: Date.now().toString(), createdAt: new Date().toISOString() });
        await storage.set('localTradeJournal', entries.slice(-100));
      }
      sendResponse({ success: true, savedLocally: true });
      return;
    }

    const result = await tradingCopilotApi.saveTradeJournalEntry(payload);
    sendResponse({ success: true, data: result });
  } catch (error: any) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle add to watchlist
async function handleAddToWatchlist(payload: any, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ success: false, error: 'Service not initialized' });
    return;
  }

  try {
    if (!storage) {
      sendResponse({ success: false, error: 'Storage not initialized' });
      return;
    }
    const watchlist = (await storage.get('watchlist')) || [];
    const symbol = (payload?.symbol || '').toUpperCase().trim();
    if (symbol && !watchlist.includes(symbol)) {
      watchlist.push(symbol);
      await storage.set('watchlist', watchlist);
    }
    sendResponse({ success: true, watchlist });
  } catch (error: any) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle remove from watchlist
async function handleRemoveFromWatchlist(payload: any, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ success: false, error: 'Service not initialized' });
    return;
  }

  try {
    if (!storage) {
      sendResponse({ success: false, error: 'Storage not initialized' });
      return;
    }
    const watchlist = (await storage.get('watchlist')) || [];
    const symbol = (payload?.symbol || '').toUpperCase().trim();
    const updated = watchlist.filter((s: string) => s !== symbol);
    await storage.set('watchlist', updated);
    sendResponse({ success: true, watchlist: updated });
  } catch (error: any) {
    sendResponse({ success: false, error: error.message });
  }
}

// Handle get watchlist
async function handleGetWatchlist(sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ items: [] });
    return;
  }

  try {
    if (!storage) {
      sendResponse({ items: [] });
      return;
    }
    const watchlist = (await storage.get('watchlist')) || [];
    sendResponse({ items: watchlist.map((s: string) => ({ symbol: s })) });
  } catch {
    sendResponse({ items: [] });
  }
}

// Handle analysis fetch from options page / popup
async function handleAnalysisFetch(payload: any, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ items: [], total: 0 });
    return;
  }

  try {
    if (tradingCopilotApi.isAuthenticated()) {
      const result = await tradingCopilotApi.getAnalyses(payload || {});
      sendResponse(result);
    } else {
      // Return locally cached analyses
      const local = (await storage?.get('localAnalyses')) || [];
      sendResponse({ items: local, total: local.length });
    }
  } catch (error: any) {
    sendResponse({ items: [], total: 0, error: error.message });
  }
}

// Handle wallet connection (placeholder for actual wallet integration)
async function handleWalletConnection(payload: any, sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ success: false, error: 'Service not initialized' });
    return;
  }

  try {
    if (!storage) {
      throw new Error('Storage not initialized');
    }
    // In a real implementation, this would connect to MetaMask, WalletConnect, etc.
    await storage.set('walletConnected', true);
    await storage.set('walletAddress', payload.address);
    sendResponse({ success: true });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: message });
  }
}

// Handle wallet disconnection
async function handleWalletDisconnection(sendResponse: (response?: any) => void): Promise<void> {
  if (!isInitialized) {
    sendResponse({ success: false, error: 'Service not initialized' });
    return;
  }

  try {
    if (!storage) {
      throw new Error('Storage not initialized');
    }
    await storage.remove('walletConnected');
    await storage.remove('walletAddress');
    sendResponse({ success: true });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    sendResponse({ success: false, error: message });
  }
}

// Initialize default settings
async function initializeDefaultSettings(): Promise<void> {
  if (!isInitialized) {
    console.error('[Background] Cannot initialize default settings: service not initialized');
    return;
  }

  try {
    if (!storage) {
      throw new Error('Storage not initialized');
    }
    await storage.set('userSettings', {
      theme: 'dark',
      notifications: { email: true, push: true, sound: false },
      tradingPreferences: { defaultTimeframe: '1D', defaultChartType: 'candlestick', riskTolerance: 'medium' }
    });
  } catch (error) {
    console.error('[Background] Failed to initialize default settings:', error);
  }
}

/**
 * GET_CHART_STATE handler — returns cached ChartState with freshness check.
 *
 * Freshness policy:
 * - If cached state is < 2 seconds old, return immediately.
 * - If cached state is ≥ 2 seconds old, forward REQUEST_CHART_REFRESH to content script.
 *   Wait up to 3 seconds for response; if timeout, return stale cached state if available,
 *   otherwise return a failure state with detailed error.
 */
async function handleGetChartState(tabId: number, sendResponse: (response?: any) => void): Promise<void> {
  const now = Date.now();
  const cached = chartStateCache.get(tabId);

  // Case 1: Fresh cache (< 2s old)
  if (cached && cached.cachedAt && (now - cached.cachedAt) < MAX_CHART_STATE_AGE_MS) {
    console.log('[Background] ChartState cache FRESH (< 2s), returning cached:',
      cached.isDetected ? `${cached.symbol} ${cached.timeframe}` : 'no chart');
    sendResponse(chartStateToDisplay(cached, tabId));
    return;
  }

  // Case 2: Stale cache or no cache — request refresh from content script
  console.log('[Background] ChartState cache STALE or MISSING, requesting refresh from tab', tabId);

  try {
    const response = await new Promise<any>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ timeout: true });
      }, CHART_REFRESH_TIMEOUT_MS);

      chrome.tabs.sendMessage(tabId, { type: 'GET_CHART_INFO' }, (result) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          resolve({ messagingError: chrome.runtime.lastError.message });
        } else {
          resolve(result);
        }
      });
    });

    if (response?.symbol && response.symbol !== 'UNKNOWN') {
      // Content script responded with valid chart data
      const state = createSuccessfulChartState(
        response.symbol,
        response.timeframe || '1D',
        null,
        response.price || null,
        response.platform || 'tradingview',
      );
      state.cachedAt = Date.now();
      chartStateCache.set(tabId, state);
      sendResponse(chartStateToDisplay(state, tabId));
      return;
    }

    if (response?.timeout) {
      // Timeout — content script didn't respond
      if (cached) {
        // Return stale cached state with timeout warning
        const staleState = { ...cached, status: 'Using cached data (content script did not respond)' };
        sendResponse(chartStateToDisplay(staleState, tabId));
      } else {
        sendResponse({
          symbol: null, timeframe: null, price: null, platform: null,
          isDetected: false,
          failureReason: 'CONTENT_SCRIPT_TIMEOUT',
          failureSuggestion: 'The content script did not respond within the time limit. Try refreshing the page.',
          status: 'Content script timeout',
          extractedAt: now,
        });
      }
      return;
    }

    if (response?.messagingError) {
      console.warn('[Background] Content script messaging error:', response.messagingError);
      if (cached) {
        const staleState = { ...cached, status: 'Using cached data (messaging error: ' + response.messagingError + ')' };
        sendResponse(chartStateToDisplay(staleState, tabId));
      } else {
        sendResponse({
          symbol: null, timeframe: null, price: null, platform: null,
          isDetected: false,
          failureReason: 'CONTENT_SCRIPT_MISSING',
          failureSuggestion: 'Trading Copilot content script is not loaded. Try refreshing the page.',
          status: 'Content script unavailable',
          extractedAt: now,
        });
      }
      return;
    }

    // Content script responded but chart not detected — pass through failure details
    if (response && !response.isDetected && response.failureReason) {
      const failureState = createFailedChartState(response.failureReason);
      failureState.failureSuggestion = response.failureSuggestion || failureState.failureSuggestion;
      failureState.status = response.status || failureState.status;
      failureState.cachedAt = Date.now();
      chartStateCache.set(tabId, failureState);
      sendResponse(chartStateToDisplay(failureState, tabId));
      return;
    }

    // Unknown response format
    sendResponse({
      symbol: null, timeframe: null, price: null, platform: null,
      isDetected: false,
      failureReason: 'UNKNOWN_ERROR',
      failureSuggestion: 'Unexpected response from content script. Try refreshing the page.',
      status: 'Unknown error',
      extractedAt: now,
    });
  } catch (error: any) {
    console.error('[Background] handleGetChartState error:', error);
    sendResponse({
      symbol: null, timeframe: null, price: null, platform: null,
      isDetected: false,
      failureReason: 'MESSAGING_ERROR',
      failureSuggestion: 'An error occurred while reading the chart. Try refreshing the page.',
      status: error.message || 'Messaging error',
      extractedAt: Date.now(),
    });
  }
}

/**
 * Convert a ChartState to the display format expected by the popup.
 * Also handles the backward-compatible 'GET_CHART_INFO' response shape.
 */
function chartStateToDisplay(state: ChartState, tabId?: number): Record<string, unknown> {
  return {
    symbol: state.symbol,
    timeframe: state.timeframe,
    price: state.currentPrice,
    platform: state.platform,
    isDetected: state.isDetected,
    failureReason: state.failureReason,
    failureSuggestion: state.failureSuggestion,
    status: state.status,
    extractedAt: state.extractedAt,
    cachedAt: state.cachedAt,
    tabId,
  };
}

// createSuccessfulChartState and createFailedChartState are imported
// from '../modules/chart-state/chart-state.types'

// Initialize the service worker when it starts
initialize().then(success => {
  if (success) {
    setupAlarms();
    setupListeners();
  }
});
