/**
 * TradingAI Terminal — Professional Edition Popup
 * Bloomberg/Terminal-inspired UI for AI Trading Copilot
 */

import { parseApiError, getPasswordRequirements } from '../api/error-parser';

let currentRecommendation: string = 'HOLD';
let currentConfidence: number = 0;
let currentAnalysisResult: any = null;
let currentChartSymbol: string | null = null;
let currentChartTimeframe: string | null = null;

// ── Validation ──
function validateAnalysisResponse(r: any): string[] {
  const errors: string[] = [];
  if (!r || typeof r !== 'object') { errors.push('root: not an object'); return errors; }
  const requiredFields = ['symbol', 'recommendation', 'confidence'];
  for (const f of requiredFields) {
    if (r[f] === undefined || r[f] === null) errors.push(`missing '${f}'`);
  }
  if (typeof r.confidence === 'number' && !Number.isFinite(r.confidence)) {
    errors.push('confidence: not finite');
  }
  const engines = ['technical','pattern','trend','supportResistance','volume','momentum','risk','tradePlanning','aiExplanation'];
  if (r.engines) {
    for (const e of engines) {
      if (!r.engines[e]) errors.push(`engines.${e}: missing`);
    }
  } else {
    errors.push('engines: missing');
  }
  return errors;
}

document.addEventListener('DOMContentLoaded', () => {
  // ── DOM Elements ──
  const loadingScreen = document.getElementById('loading-screen')!;
  const loginPrompt = document.getElementById('login-prompt')!;
  const dashboard = document.getElementById('dashboard')!;
  const loginError = document.getElementById('login-error')!;

  // Header
  const connDot = document.getElementById('conn-dot')!;
  const connText = document.getElementById('conn-text')!;

  // Symbol bar
  const symTicker = document.getElementById('sym-ticker')!;
  const symTf = document.getElementById('sym-tf')!;
  const symExch = document.getElementById('sym-exch')!;
  const symPrice = document.getElementById('sym-price')!;

  // Signal panel
  const signalPanel = document.getElementById('signal-panel')!;
  const signalBg = document.getElementById('signal-bg')!;
  const sigRec = document.getElementById('sig-rec')!;
  const confFill = document.getElementById('conf-fill')!;
  const confLabel = document.getElementById('conf-label')!;

  // Trade setup
  const tradeSetupPanel = document.getElementById('trade-setup-panel')!;
  const tradeEntry = document.getElementById('trade-entry')!;
  const tradeSl = document.getElementById('trade-sl')!;
  const tradeTp = document.getElementById('trade-tp')!;
  const tradeRr = document.getElementById('trade-rr')!;

  // Reasoning
  const reasoningPanel = document.getElementById('reasoning-panel')!;
  const reasoningBox = document.getElementById('reasoning-box')!;

  // Stats
  const statToday = document.getElementById('stat-today')!;
  const statWinrate = document.getElementById('stat-winrate')!;
  const statAvgconf = document.getElementById('stat-avgconf')!;

  // History & tabs
  const historyList = document.getElementById('history-list')!;
  const watchlistList = document.getElementById('watchlist-list')!;
  const tabRecent = document.getElementById('tab-recent')!;
  const tabWatchlist = document.getElementById('tab-watchlist')!;

  // Actions
  const analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
  const settingsBtn = document.getElementById('settings-btn')!;

  // Login
  const loginBtn = document.getElementById('login-btn')!;
  const loginEmail = document.getElementById('login-email') as HTMLInputElement;
  const loginPassword = document.getElementById('login-password') as HTMLInputElement;

  // Password requirements
  const pwReqs = document.getElementById('pw-reqs')!;
  const pwReqLength = document.getElementById('pw-req-length')!;
  const pwReqUpper = document.getElementById('pw-req-upper')!;
  const pwReqLower = document.getElementById('pw-req-lower')!;
  const pwReqNumber = document.getElementById('pw-req-number')!;

  // Status bar
  const statusPlatform = document.getElementById('status-platform')!;
  const statusTime = document.getElementById('status-time')!;

  // ── Initialize ──
  async function initialize() {
    try {
      loadingScreen.classList.remove('section-hidden');
      loginPrompt.classList.add('section-hidden');
      dashboard.classList.add('section-hidden');

      const response = await sendMessage({ type: 'GET_BACKEND_STATUS' });
      const auth = response as any;

      if (auth?.authenticated) {
        setConnected(true);
        dashboard.classList.remove('section-hidden');
        fetchChartInfo();
        await refreshDashboard();
        startClock();
      } else {
        loginPrompt.classList.remove('section-hidden');
      }
    } catch {
      loginPrompt.classList.remove('section-hidden');
    } finally {
      loadingScreen.classList.add('section-hidden');
    }
  }

  // ── Connection ──
  function setConnected(connected: boolean): void {
    connDot.className = 'conn-dot ' + (connected ? 'online' : 'offline');
    connText.textContent = connected ? 'CONNECTED' : 'OFFLINE';
    statusPlatform.innerHTML = connected
      ? '<span class="dot online"></span> Connected'
      : '<span class="dot offline"></span> Disconnected';
  }

  // ── Clock ──
  let clockInterval: number | null = null;
  function startClock(): void {
    function tick() {
      const now = new Date();
      statusTime.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }
    tick();
    if (clockInterval) clearInterval(clockInterval);
    clockInterval = window.setInterval(tick, 1000);
  }

  // ── Fetch Chart State (uses cached state from background, never reads DOM) ──
  async function fetchChartInfo(): Promise<void> {
    try {
      const response = await sendMessage({ type: 'GET_CHART_STATE' });

      if (response && response.isDetected && response.symbol) {
        currentChartSymbol = response.symbol;
        currentChartTimeframe = response.timeframe || null;
        symTicker.textContent = response.symbol;
        symTicker.classList.remove('dim');
        if (response.timeframe) symTf.textContent = response.timeframe;
        if (response.price) symPrice.textContent = formatPrice(response.price);
        symPrice.classList.remove('dim');

        if (currentAnalysisResult && currentAnalysisResult.symbol !== response.symbol) {
          clearCurrentAnalysis();
        }
        updateAnalyzeButton(currentChartSymbol, currentChartTimeframe);
        // Set exchange/platform info without overwriting connection status dot
        if (response.platform) {
          symExch.textContent = response.platform.toUpperCase();
        }
      } else if (response && !response.isDetected) {
        // Show detailed failure message instead of generic 'No chart detected'
        const failureMsg = response.failureSuggestion || response.status || 'Chart not detected';
        const reason = response.failureReason || 'UNKNOWN';
        setNoChart(reason, failureMsg);
      } else {
        setNoChart('CONTENT_SCRIPT_MISSING', 'Content script not available. Try refreshing the page.');
      }
    } catch {
      setNoChart('MESSAGING_ERROR', 'Could not communicate with the extension. Try reloading.');
    }
  }

  function setNoChart(reason?: string, suggestion?: string): void {
    symTicker.textContent = '---';
    symTicker.classList.add('dim');
    symTf.textContent = '---';
    symPrice.textContent = '---';
    symPrice.classList.add('dim');
    currentChartSymbol = null;
    currentChartTimeframe = null;
    updateAnalyzeButton(null, null, reason, suggestion);
  }

  // ── Dashboard Refresh ──
  async function refreshDashboard() {
    try {
      const statsRes = await sendMessage({ type: 'GET_BACKEND_STATUS' });
      const stats = (statsRes as any)?.stats;
      if (stats) {
        statToday.textContent = String(stats.totalAnalyses || stats.total || 0);
        const winRate = stats.winRate ?? stats.winrate;
        statWinrate.textContent = winRate != null ? `${Math.round(winRate * 100)}%` : '--%';
        const avgConf = stats.avgConfidence ?? stats.averageconfidence;
        statAvgconf.textContent = avgConf != null ? `${Math.round(avgConf)}%` : '--%';
      }
    } catch { /* non-critical */ }
  }

  // ── Update Analysis ──
  function updateCurrentAnalysis(result: any) {
    if (!result) return;
    console.log('[Popup] Analysis result:', {
      symbol: result.symbol,
      recommendation: result.recommendation,
      confidence: result.confidence,
    });

    currentAnalysisResult = result;
    currentRecommendation = result.recommendation || 'HOLD';
    currentConfidence = result.confidence ?? 50;

    const symbol = result.symbol || '---';
    const timeframe = result.timeframe || '---';
    const price = result.currentPrice ?? result.engines?.technical?.indicators?.atr;

    symTicker.textContent = symbol;
    symTicker.classList.remove('dim');
    symTf.textContent = timeframe;
    symPrice.textContent = formatPrice(price);
    symPrice.classList.remove('dim');

    // Signal recommendation
    const recClass = getRecClass(currentRecommendation);
    sigRec.textContent = currentRecommendation;
    sigRec.className = 'signal-recommendation ' + recClass;
    signalBg.className = 'signal-bg ' + recClass;

    // Confidence
    confFill.style.width = `${Math.round(currentConfidence)}%`;
    confFill.className = 'conf-fill ' + recClass;
    confLabel.textContent = `${Math.round(currentConfidence)}%`;
    confLabel.className = 'conf-label ' + recClass;

    // Trade setup
    const tradePlan = result.engines?.tradePlanning?.tradeSetup;
    if (tradePlan && isValidTradeSetup(tradePlan)) {
      tradeSetupPanel.classList.remove('section-hidden');
      tradeEntry.textContent = formatPrice(tradePlan.entryPrice);
      tradeEntry.className = 'trade-cell-value muted';
      tradeSl.textContent = formatPrice(tradePlan.stopLoss);
      tradeSl.className = 'trade-cell-value sell';
      tradeTp.textContent = formatPrice(tradePlan.takeProfit);
      tradeTp.className = 'trade-cell-value buy';
      const rr = tradePlan.riskRewardRatio;
      tradeRr.textContent = typeof rr === 'number' && Number.isFinite(rr) ? `${rr.toFixed(2)}:1` : '---';
      tradeRr.className = 'trade-cell-value hold';
    } else {
      tradeSetupPanel.classList.add('section-hidden');
    }

    // Reasoning
    reasoningPanel.classList.remove('section-hidden');
    reasoningBox.textContent = result.reasoning || 'No reasoning available.';
    reasoningBox.className = 'reasoning-box';
    reasoningBox.classList.remove('expanded');
    reasoningBox.onclick = () => {
      reasoningBox.classList.toggle('expanded');
      reasoningBox.style.maxHeight = reasoningBox.classList.contains('expanded') ? 'none' : '52px';
    };

    // Save
    chrome.storage.local.set({ lastAnalysisResult: result });
  }

  // ── Clear Analysis ──
  function clearCurrentAnalysis(): void {
    currentAnalysisResult = null;
    currentRecommendation = 'HOLD';
    currentConfidence = 0;
    sigRec.textContent = 'HOLD';
    sigRec.className = 'signal-recommendation hold';
    signalBg.className = 'signal-bg hold';
    confFill.style.width = '0%';
    confFill.className = 'conf-fill hold';
    confLabel.textContent = '0%';
    confLabel.className = 'conf-label hold';
    tradeSetupPanel.classList.add('section-hidden');
    reasoningPanel.classList.add('section-hidden');
  }

  // ── Analyze Button ──
  function updateAnalyzeButton(symbol: string | null, timeframe: string | null, failureReason?: string, failureSuggestion?: string): void {
    if (symbol && timeframe) {
      (analyzeBtn as HTMLButtonElement).disabled = false;
      analyzeBtn.textContent = `⚡ ANALYZE ${symbol} (${timeframe})`;
      analyzeBtn.className = 'analyze-btn ready';
      analyzeBtn.title = '';
    } else if (symbol) {
      (analyzeBtn as HTMLButtonElement).disabled = false;
      analyzeBtn.textContent = `⚡ ANALYZE ${symbol}`;
      analyzeBtn.className = 'analyze-btn ready';
      analyzeBtn.title = '';
    } else if (failureReason === 'UNSUPPORTED_PLATFORM') {
      (analyzeBtn as HTMLButtonElement).disabled = true;
      analyzeBtn.textContent = '🚫 NOT A TRADING APP';
      analyzeBtn.className = 'analyze-btn error';
      analyzeBtn.title = failureSuggestion || 'Trading Copilot only works on supported trading websites (TradingView, Binance, Bybit, Coinbase, Zerodha, Upstox, AngelOne, Groww)';
    } else {
      (analyzeBtn as HTMLButtonElement).disabled = false;
      analyzeBtn.textContent = '⚠ NO CHART DETECTED';
      analyzeBtn.className = 'analyze-btn error';
      analyzeBtn.title = failureSuggestion || 'Open a supported trading chart first';
      if (failureReason) {
        console.log('[Popup] Chart detection failed:', failureReason, '-', failureSuggestion);
      }
    }
  }

  function resetAnalyzeBtn(): void {
    (analyzeBtn as HTMLButtonElement).disabled = false;
    setConnected(true);
    updateAnalyzeButton(currentChartSymbol, currentChartTimeframe);
  }

  analyzeBtn.addEventListener('click', async () => {
    (analyzeBtn as HTMLButtonElement).disabled = true;
    analyzeBtn.textContent = '⏳ ANALYZING...';
    analyzeBtn.className = 'analyze-btn analyzing';
    connDot.className = 'conn-dot analyzing';
    connText.textContent = 'ANALYZING...';

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_ANALYSIS' }, (response) => {
            if (chrome.runtime.lastError) {
              sendFallbackAnalysis();
            } else {
              resetAnalyzeBtn();
            }
          });
        } else {
          sendFallbackAnalysis();
        }
      });
    } catch {
      resetAnalyzeBtn();
    }
  });

  function sendFallbackAnalysis(): void {
    const payload: any = { force: true };
    if (currentChartSymbol) payload.symbol = currentChartSymbol;
    if (currentChartTimeframe) payload.timeframe = currentChartTimeframe;
    payload.platform = 'tradingview';

    sendMessage({ type: 'REQUEST_ANALYSIS', payload })
      .then((result: any) => {
        if (result?.recommendation) updateCurrentAnalysis(result);
      })
      .catch(() => { /* fallback failed */ })
      .finally(() => resetAnalyzeBtn());
  }

  // ── Password Requirements ──
  let pwTimer: ReturnType<typeof setTimeout> | null = null;

  function updatePwReqs(password: string): void {
    const reqs = getPasswordRequirements(password);
    const elements = [pwReqLength, pwReqUpper, pwReqLower, pwReqNumber];
    reqs.forEach((req, i) => {
      elements[i].textContent = (req.met ? '✓' : '✗') + ' ' + req.label;
      elements[i].className = 'pw-req' + (req.met ? ' met' : '');
    });
  }

  loginPassword.addEventListener('focus', () => {
    if (loginPassword.value.length > 0) {
      pwReqs.style.display = 'block';
      updatePwReqs(loginPassword.value);
    }
  });
  loginPassword.addEventListener('blur', () => {
    if (!loginPassword.value) pwReqs.style.display = 'none';
  });
  loginPassword.addEventListener('input', () => {
    const pw = loginPassword.value;
    if (pw.length > 0) {
      pwReqs.style.display = 'block';
      if (pwTimer) clearTimeout(pwTimer);
      pwTimer = setTimeout(() => updatePwReqs(pw), 100);
    } else {
      pwReqs.style.display = 'none';
    }
  });

  // ── Login ──
  loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
      showLoginError('Email and password are required.');
      return;
    }

    (loginBtn as HTMLButtonElement).disabled = true;
    loginBtn.textContent = 'CONNECTING...';
    loginError.style.display = 'none';

    // Update text if connecting takes > 3 seconds (Render free tier cold start)
    const connectTimer = setTimeout(() => {
      loginBtn.textContent = 'SERVER WAKING UP...';
    }, 3000);

    try {
      const result = await sendMessage({
        type: 'BACKEND_LOGIN',
        payload: { email, password },
      });

      clearTimeout(connectTimer);

      if ((result as any)?.success) {
        setConnected(true);
        loginPrompt.classList.add('section-hidden');
        dashboard.classList.remove('section-hidden');
        fetchChartInfo();
        await refreshDashboard();
        startClock();
      } else {
        showLoginError((result as any)?.error || 'Login failed');
      }
    } catch (error: any) {
      clearTimeout(connectTimer);
      showLoginError(error);
    } finally {
      clearTimeout(connectTimer);
      (loginBtn as HTMLButtonElement).disabled = false;
      loginBtn.textContent = 'SIGN IN / REGISTER';
    }
  });

  // ── Google Login ──
  const googleBtn = document.getElementById('google-login-btn') as HTMLButtonElement | null;
  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      googleBtn.disabled = true;
      googleBtn.style.opacity = '0.7';
      loginError.style.display = 'none';

      try {
        let email: string | undefined;
        let name: string | undefined;

        if (typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getAuthToken === 'function') {
          try {
            const token = await new Promise<string>((resolve, reject) => {
              chrome.identity.getAuthToken({ interactive: true }, (t) => {
                if (chrome.runtime.lastError || !t) {
                  reject(chrome.runtime.lastError || new Error('Auth token empty'));
                } else {
                  resolve(t);
                }
              });
            });

            if (token) {
              const res = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`);
              const userInfo = await res.json();
              if (userInfo.email) {
                email = userInfo.email;
                name = userInfo.name;
              }
            }
          } catch {
            // Identity API fallback prompt if OAuth client ID is not configured locally
          }
        }

        if (!email) {
          const userEmail = prompt('Enter your Google email address to continue with Google:');
          if (!userEmail) {
            googleBtn.disabled = false;
            googleBtn.style.opacity = '1';
            return;
          }
          email = userEmail.trim();
        }

        const result = await sendMessage({
          type: 'GOOGLE_LOGIN',
          payload: { email, name },
        });

        if ((result as any)?.success) {
          setConnected(true);
          loginPrompt.classList.add('section-hidden');
          dashboard.classList.remove('section-hidden');
          fetchChartInfo();
          await refreshDashboard();
          startClock();
        } else {
          showLoginError((result as any)?.error || 'Google Login failed');
        }
      } catch (err: any) {
        showLoginError(err);
      } finally {
        if (googleBtn) {
          googleBtn.disabled = false;
          googleBtn.style.opacity = '1';
        }
      }
    });
  }

  function showLoginError(error: unknown): void {
    const parsed = parseApiError(error);
    loginError.textContent = parsed.message;
    loginError.style.display = 'block';
  }

  // ── Tabs ──
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = (tab as HTMLElement).dataset.tab;
      tabRecent.classList.toggle('section-hidden', tabName !== 'recent');
      tabWatchlist.classList.toggle('section-hidden', tabName !== 'watchlist');
    });
  });

  // ── Settings ──
  settingsBtn.addEventListener('click', () => {
    const optPage = chrome.runtime.openOptionsPage;
    if (optPage) optPage();
    else window.open(chrome.runtime.getURL('options.html'));
  });

  // ── Message Listener ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYSIS_UPDATE' && message.data) {
      updateCurrentAnalysis(message.data);
      sendResponse({ success: true });
    }
    if (message.type === 'ANALYSIS_ERROR') {
      connDot.className = 'conn-dot offline';
      connText.textContent = 'ERROR';
      resetAnalyzeBtn();
      sendResponse({ success: true });
    }
    return true;
  });

  // ── Keyboard shortcut ──
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      analyzeBtn.click();
    }
  });

  // ── Init ──
  initialize();

  // ── Utilities ──
  function sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(response);
      });
    });
  }

  function isValidTradeSetup(setup: any): boolean {
    return setup && typeof setup === 'object' &&
      typeof setup.entryPrice === 'number' && Number.isFinite(setup.entryPrice) &&
      typeof setup.stopLoss === 'number' && Number.isFinite(setup.stopLoss) &&
      typeof setup.takeProfit === 'number' && Number.isFinite(setup.takeProfit);
  }

  function formatPrice(price: number): string {
    if (typeof price !== 'number' || !isFinite(price)) return '---';
    if (price < 1) return price.toFixed(6);
    if (price < 100) return price.toFixed(4);
    if (price < 10000) return price.toFixed(2);
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function getRecClass(rec: string): string {
    const r = (rec || '').toUpperCase();
    if (r === 'STRONG_BUY' || r === 'BUY') return 'buy';
    if (r === 'STRONG_SELL' || r === 'SELL') return 'sell';
    return 'hold';
  }
});
