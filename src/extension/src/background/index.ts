// Background service worker for the Universal AI Trading Copilot extension
// Handles messaging, alarms, background operations, and auto-saving to backend

// Import necessary modules
import { StorageManager } from '../storage/storage-manager';
import { AlarmManager } from '../alarms/alarm-manager';
import { AnalysisOrchestrator } from '../analysis/analysis-orchestrator';
import { tradingCopilotApi } from '../api/trading-copilot-api';

// Initialize managers
let storage: StorageManager | null = null;
let alarmManager: AlarmManager | null = null;
let analysisOrchestrator: AnalysisOrchestrator | null = null;
let isInitialized = false;

// Initialize everything when the service worker starts
async function initialize(): Promise<boolean> {
  try {
    // Create managers
    storage = new StorageManager();
    alarmManager = new AlarmManager();
    analysisOrchestrator = new AnalysisOrchestrator();

    // Restore JWT token from storage if available
    try {
      const auth = await storage.get('backendAuth');
      if (auth?.jwtToken) {
        tradingCopilotApi.setJwtToken(auth.jwtToken);
        console.log('[Background] JWT token restored from storage');
      }
    } catch {
      // Non-critical - user can re-login
    }

    console.log('[Background] Service initialized');
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[Background] Failed to initialize background service:', error);
    isInitialized = false;
    return false;
  }
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

  if (!tabId) {
    console.warn('[Background] No tab ID provided for analysis request, using default symbol');
    // Still attempt analysis with default symbol
  }    try {
      let symbol = 'BTC-USD';
      let timeframe = '1D';
      let platform = '';  // Platform from content script (e.g. 'tradingview')

      // Try to get symbol/timeframe/platform from payload first
      if (payload && payload.symbol) {
        symbol = payload.symbol;
      }
      if (payload && payload.timeframe) {
        timeframe = payload.timeframe;
      }
      if (payload && payload.platform) {
        platform = payload.platform;
      }

      // If no platform from payload, try to extract from tab URL
      if (!platform && tabId) {
        try {
          const tab: chrome.tabs.Tab = await new Promise<chrome.tabs.Tab>((resolve, reject) => {
            chrome.tabs.get(tabId, (tab) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
              } else {
                resolve(tab);
              }
            });
          });

          if (typeof tab.url === 'string') {
            const url = new URL(tab.url);
            symbol = extractSymbolFromURL(url) || symbol;
            timeframe = extractTimeframeFromURL(url) || timeframe;
            // Detect platform from URL
            const hostname = url.hostname.toLowerCase();
            if (hostname.includes('tradingview.com')) platform = 'tradingview';
          }
        } catch (tabError) {
          console.warn('[Background] Could not get tab info, using defaults:', tabError);
        }
      }

      console.log('[Background] Analyzing:', { symbol, timeframe, platform });

      // Validate that we're on a supported platform before analyzing
      if (!platform || platform === 'generic') {
        console.warn('[Background] Cannot analyze: unsupported platform', platform ? platform : 'unknown');
        throw new Error('Cannot analyze: unsupported website. Trading Copilot only works on tradingview.com, binance.com, bybit.com, coinbase.com, zerodha.com, upstox.com, angelone.in, and groww.in.');
      }

      console.log('[Background] Selected platform adapter:', platform);

      // Perform analysis via background services
      if (!analysisOrchestrator) {
        throw new Error('Analysis orchestrator not initialized');
      }
      const analysis = await analysisOrchestrator.analyze(symbol, timeframe, platform);

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
    // The primary response is sent back via sendResponse() to the originating message.
    // These additional notifications are fire-and-forget with proper error callbacks.
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'UPDATE_OVERLAY',
        payload: { analysisResult: analysis }
      }, () => {
        if (chrome.runtime.lastError) {
          // Tab might have navigated or content script context invalidated — non-critical
          console.warn('[Background] UPDATE_OVERLAY sendMessage error:', chrome.runtime.lastError.message);
        }
      });
    }

    // Also notify popup if open (fire-and-forget with callback to prevent unhandled errors)
    chrome.runtime.sendMessage({
      type: 'ANALYSIS_UPDATE',
      data: analysis
    }, () => {
      if (chrome.runtime.lastError) {
        // Popup likely closed — ignore, this is expected
        // LastError: "Could not establish connection. Receiving end does not exist."
      }
    });

    // Return the analysis result directly to the caller
    return analysis;
  } catch (error: any) {
    console.error('[Background] Analysis failed:', error);
    // Notify content script of error (with proper callback to prevent context invalidated)
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'UPDATE_OVERLAY',
        payload: { error: 'Analysis failed: ' + (error.message || String(error)) }
      }, () => {
        if (chrome.runtime.lastError) { /* tab closed or navigated — ignore */ }
      });
    }
    // Notify popup of error (with callback)
    chrome.runtime.sendMessage({ type: 'ANALYSIS_ERROR', error: error.message }, () => {
      if (chrome.runtime.lastError) { /* popup closed — ignore */ }
    });
    throw error;
  }
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

    // Use the current price from technical indicators or fall back to 0
    const techIndicators = analysis.engines?.technical?.indicators;
    const currentPrice = (techIndicators && typeof techIndicators.atr === 'number' && isFinite(techIndicators.atr))
      ? techIndicators.atr
      : 0;

    const payload = {
      symbol: analysis.symbol,
      timeframe: analysis.timeframe,
      currentPrice,
      recommendation: analysis.recommendation,
      confidence: analysis.confidence,
      entryPrice: tradePlan?.entryPrice,
      stopLoss: tradePlan?.stopLoss,
      takeProfit: tradePlan?.takeProfit,
      riskRewardRatio: tradePlan?.riskRewardRatio,
      reasoning: analysis.reasoning,
      indicators: analysis.indicators,
      signals: analysis.engines,
      risks: aiExplanation?.risks || [],
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

// Handle backend logout
function handleBackendLogout(sendResponse: (response?: any) => void): void {
  tradingCopilotApi.setJwtToken(null);
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

// Helper function to extract symbol from URL (simplified)
function extractSymbolFromURL(url: URL): string {
  // This would be implemented per-platform in the website-detector module
  // For now, return a default
  return 'BTC-USD';
}

// Helper function to extract timeframe from URL (simplified)
function extractTimeframeFromURL(url: URL): string {
  // This would be implemented per-platform in the website-detector module
  // For now, return default
  return '1D';
}

// Initialize the service worker when it starts
initialize().then(success => {
  if (success) {
    setupAlarms();
    setupListeners();
  }
});
