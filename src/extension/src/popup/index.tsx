/**
 * Premium Popup Dashboard for AI Trading Copilot
 * Displays current analysis, history, watchlist, stats, and one-click analyze.
 */

import { parseApiError, getPasswordRequirements, isPasswordValid, PasswordRequirement } from '../api/error-parser';

let currentRecommendation: string = 'HOLD';
let currentConfidence: number = 0;
let currentAnalysisResult: any = null;

// Import analysis response validation
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
  const mainContent = document.getElementById('main-content')!;
  const loadingState = document.getElementById('loading-state')!;
  const loginPrompt = document.getElementById('login-prompt')!;
  const dashboard = document.getElementById('dashboard')!;
  const loginError = document.getElementById('login-error')!;

  // Get elements
  const statusDot = document.getElementById('status-dot')!;
  const statusText = document.getElementById('status-text')!;
  const analyzeBtn = document.getElementById('analyze-btn') as HTMLButtonElement;
  const settingsBtn = document.getElementById('settings-btn')!;
  const journalBtn = document.getElementById('journal-btn')!;
  const refreshBtn = document.getElementById('refresh-btn')!;
  const themeToggle = document.getElementById('theme-toggle')!;
  const loginBtn = document.getElementById('login-btn')!;
  const loginEmail = document.getElementById('login-email') as HTMLInputElement;
  const loginPassword = document.getElementById('login-password') as HTMLInputElement;
  const viewAllBtn = document.getElementById('view-all-btn')!;

  // Current analysis elements
  const currentSymbol = document.getElementById('current-symbol')!;
  const currentTimeframe = document.getElementById('current-timeframe')!;
  const currentRec = document.getElementById('current-rec')!;
  const currentPrice = document.getElementById('current-price')!;
  const currentConf = document.getElementById('current-confidence')!;
  const confidenceFill = document.getElementById('confidence-fill')!;
  const tradeSetupContainer = document.getElementById('trade-setup-container')!;
  const reasoningText = document.getElementById('reasoning-text')!;
  const entryPrice = document.getElementById('entry-price')!;
  const stopLoss = document.getElementById('stop-loss')!;
  const takeProfit = document.getElementById('take-profit')!;
  const riskReward = document.getElementById('risk-reward')!;

  // Stats elements
  const statAnalysesToday = document.getElementById('stat-analyses-today')!;
  const statWinRate = document.getElementById('stat-win-rate')!;
  const statAvgConf = document.getElementById('stat-avg-conf')!;

  // History & Watchlist
  const historyList = document.getElementById('history-list')!;
  const watchlistList = document.getElementById('watchlist-list')!;
  const tabRecent = document.getElementById('tab-recent')!;
  const tabWatchlist = document.getElementById('tab-watchlist')!;

  // ── Initialize state ──
  async function initialize() {
    try {
      loadingState.style.display = 'flex';
      loginPrompt.classList.add('section-hidden');
      dashboard.classList.add('section-hidden');

      // Check backend connection
      const response = await sendMessage({ type: 'GET_BACKEND_STATUS' });
      const auth = response as any;

      if (auth?.authenticated) {
        dashboard.classList.remove('section-hidden');
        await refreshDashboard();
      } else {
        loginPrompt.classList.remove('section-hidden');
      }
    } catch {
      loginPrompt.classList.remove('section-hidden');
    } finally {
      loadingState.style.display = 'none';
    }

    // Check if we have a cached analysis result
    chrome.storage.local.get(['lastAnalysisResult'], (result) => {
      if (result.lastAnalysisResult) {
        updateCurrentAnalysis(result.lastAnalysisResult);
      }
    });
  }

  // ── Dashboard refresh ──
  async function refreshDashboard() {
    try {
      // Get analysis stats
      const statsResponse = await sendMessage({ type: 'GET_BACKEND_STATUS' });
      const stats = (statsResponse as any)?.stats;

      if (stats) {
        statAnalysesToday.textContent = String(stats.totalAnalyses || stats.total || 0);
        const winRate = stats.winRate ?? stats.winrate;
        statWinRate.textContent = winRate != null ? `${Math.round(winRate * 100)}%` : '--%';
        const avgConf = stats.avgConfidence ?? stats.averageconfidence;
        statAvgConf.textContent = avgConf != null ? `${Math.round(avgConf)}%` : '--%';
      }

      // Get recent analyses
      try {
        const analysesResponse = await sendMessage({
          type: 'ANALYSIS_FETCH_REQUEST',
          payload: { limit: 5, sort: 'createdAt:DESC' },
        });
        // This needs a proxy in background to call the API
        // For now, show locally stored history
      } catch { /* background may not have this handler yet */ }
    } catch (error) {
      console.warn('[Popup] Refresh failed:', error);
    }
  }

  // ── Update current analysis display ──
  function updateCurrentAnalysis(result: any) {
    // Validate critical fields; log any issues before processing
    if (!result) {
      console.warn('[Popup] updateCurrentAnalysis: result is null/undefined');
      return;
    }

    console.log('[Popup] RAW analysis result:', JSON.stringify(result, null, 2));

    // Run structural validation
    const validationErrors = validateAnalysisResponse(result);
    if (validationErrors.length > 0) {
      console.warn('[Popup] Analysis response validation FAILED:', validationErrors);
    } else {
      console.log('[Popup] Analysis response validation PASSED');
    }

    console.log('[Popup] updateCurrentAnalysis processed:', {
      recommendation: result.recommendation,
      confidence: result.confidence,
      hasEngines: !!result.engines,
      hasTradePlan: !!(result.engines?.tradePlanning?.tradeSetup),
      symbol: result.symbol,
      timeframe: result.timeframe
    });

    // Validate analysis response structure
    if (!result.recommendation) {
      console.warn('[Popup] updateCurrentAnalysis: missing recommendation');
    }
    if (typeof result.confidence !== 'number' || !Number.isFinite(result.confidence)) {
      console.warn('[Popup] updateCurrentAnalysis: confidence is not a finite number:', result.confidence);
    }

    currentAnalysisResult = result;
    currentRecommendation = result.recommendation || 'HOLD';
    currentConfidence = result.confidence ?? 50;

    const symbol = result.symbol || '---';
    const timeframe = result.timeframe || '---';
    const price = result.currentPrice ?? result.engines?.technical?.indicators?.atr;

    currentSymbol.textContent = symbol;
    currentTimeframe.textContent = timeframe;
    currentPrice.textContent = price ? formatPrice(price) : '---';
    currentConf.textContent = `${Math.round(currentConfidence)}%`;

    // Recommendation badge
    const recClass = getRecClass(currentRecommendation);
    currentRec.textContent = currentRecommendation;
    currentRec.className = `recommendation-badge ${recClass}`;

    // Confidence bar
    const fill = confidenceFill as HTMLElement;
    fill.style.width = `${Math.round(currentConfidence)}%`;
    fill.className = `confidence-fill ${recClass}`;

    // Trade setup
    const tradePlan = result.engines?.tradePlanning?.tradeSetup;
    if (tradePlan && isValidTradeSetup(tradePlan)) {
      tradeSetupContainer.classList.remove('section-hidden');
      entryPrice.textContent = formatPrice(tradePlan.entryPrice);
      stopLoss.textContent = formatPrice(tradePlan.stopLoss);
      takeProfit.textContent = formatPrice(tradePlan.takeProfit);
      const rr = tradePlan.riskRewardRatio;
      riskReward.textContent = typeof rr === 'number' && Number.isFinite(rr)
        ? `${rr.toFixed(2)}:1`
        : '---';
    } else {
      tradeSetupContainer.classList.add('section-hidden');
    }

    // Reasoning
    reasoningText.textContent = result.reasoning || 'No reasoning available.';
    reasoningText.title = result.reasoning || '';
    reasoningText.classList.remove('expanded');

    // Toggle expand on click
    reasoningText.onclick = () => {
      reasoningText.classList.toggle('expanded');
    };

    // Save to local storage
    chrome.storage.local.set({ lastAnalysisResult: result });
  }

  // ── Analyze button ──
  analyzeBtn.addEventListener('click', async () => {
    (analyzeBtn as HTMLButtonElement).disabled = true;
    analyzeBtn.textContent = '⏳ Analyzing...';
    statusDot.className = 'status-dot analyzing';
    statusText.textContent = 'Analyzing...';

    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'REQUEST_ANALYSIS' }, (response) => {
            if (chrome.runtime.lastError) {
              // Try via background as fallback
              sendMessage({ type: 'REQUEST_ANALYSIS', payload: { force: true } })
                .then((result: any) => {
                  if (result && (result as any).recommendation) {
                    updateCurrentAnalysis(result);
                  }
                })
                .catch((err) => console.warn('[Popup] Analysis fallback failed:', err))
                .finally(() => resetAnalyzeBtn());
            } else {
              resetAnalyzeBtn();
            }
          });
        } else {
          sendMessage({ type: 'REQUEST_ANALYSIS', payload: { force: true } })
            .then((result: any) => {
              if (result?.recommendation) updateCurrentAnalysis(result);
            })
            .finally(() => resetAnalyzeBtn());
        }
      });
    } catch (error) {
      console.warn('[Popup] Analysis error:', error);
      resetAnalyzeBtn();
    }
  });

  function resetAnalyzeBtn(): void {
    (analyzeBtn as HTMLButtonElement).disabled = false;
    analyzeBtn.textContent = '⚡ Analyze Market';
    statusDot.className = 'status-dot online';
    statusText.textContent = 'Connected';
  }

  // ── Password Requirements (live validation) ──
  const passwordInput = loginPassword;
  const pwReqContainer = document.getElementById('password-requirements')!;
  const pwReqLength = document.getElementById('pw-req-length')!;
  const pwReqUpper = document.getElementById('pw-req-upper')!;
  const pwReqLower = document.getElementById('pw-req-lower')!;
  const pwReqNumber = document.getElementById('pw-req-number')!;

  let pwValidationTimer: ReturnType<typeof setTimeout> | null = null;

  function updatePasswordRequirements(password: string): void {
    const reqs = getPasswordRequirements(password);
    const elements = [pwReqLength, pwReqUpper, pwReqLower, pwReqNumber];
    reqs.forEach((req, i) => {
      elements[i].textContent = (req.met ? '✓' : '✗') + ' ' + req.label;
      elements[i].className = 'pw-req' + (req.met ? ' met' : '');
    });
  }

  passwordInput.addEventListener('focus', () => {
    if (passwordInput.value.length > 0) {
      pwReqContainer.style.display = 'block';
      updatePasswordRequirements(passwordInput.value);
    }
  });

  passwordInput.addEventListener('blur', () => {
    // Keep visible if there's a value
    if (!passwordInput.value) {
      pwReqContainer.style.display = 'none';
    }
  });

  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    if (password.length > 0) {
      pwReqContainer.style.display = 'block';
      // Debounce live validation
      if (pwValidationTimer) clearTimeout(pwValidationTimer);
      pwValidationTimer = setTimeout(() => {
        updatePasswordRequirements(password);
      }, 100);
    } else {
      pwReqContainer.style.display = 'none';
    }
  });

  // ── Login ──
  function showLoginError(error: unknown): void {
    const parsed = parseApiError(error);
    loginError.textContent = parsed.message;
    loginError.style.display = 'block';
  }

  loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
      showLoginError({ message: 'Email and password are required.', isKnown: true });
      return;
    }

    (loginBtn as HTMLButtonElement).disabled = true;
    loginBtn.textContent = 'Connecting...';
    loginError.style.display = 'none';

    try {
      const result = await sendMessage({
        type: 'BACKEND_LOGIN',
        payload: { email, password },
      });

      if ((result as any)?.success) {
        loginPrompt.classList.add('section-hidden');
        dashboard.classList.remove('section-hidden');
        await refreshDashboard();
      } else {
        showLoginError((result as any)?.error || 'Login failed');
      }
    } catch (error: any) {
      showLoginError(error);
    } finally {
      (loginBtn as HTMLButtonElement).disabled = false;
      loginBtn.textContent = 'Login / Register';
    }
  });

  // ── Tabs ──
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const tabName = (tab as HTMLElement).dataset.tab;
      tabRecent.classList.toggle('section-hidden', tabName !== 'recent');
      tabWatchlist.classList.toggle('section-hidden', tabName !== 'watchlist');
    });
  });

  // ── Footer buttons ──
  settingsBtn.addEventListener('click', () => {
    const optPage = chrome.runtime.openOptionsPage;
    if (optPage) {
      optPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  journalBtn.addEventListener('click', () => {
    const optPage = chrome.runtime.openOptionsPage;
    if (optPage) {
      optPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  refreshBtn.addEventListener('click', () => { refreshDashboard(); });

  viewAllBtn.addEventListener('click', () => {
    const optPage = chrome.runtime.openOptionsPage;
    if (optPage) {
      optPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  themeToggle.addEventListener('click', () => {
    document.body.style.filter = document.body.style.filter === 'invert(1)' ? 'none' : 'invert(1)';
  });

  // ── Message listener from background ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYSIS_UPDATE' && message.data) {
      updateCurrentAnalysis(message.data);
      sendResponse({ success: true });
    }
    if (message.type === 'ANALYSIS_ERROR') {
      statusDot.className = 'status-dot offline';
      statusText.textContent = 'Analysis failed';
      resetAnalyzeBtn();
      sendResponse({ success: true });
    }
    return true;
  });

  // ── Initialize ──
  initialize();

  // ── Utility functions ──
  function sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  function isValidTradeSetup(setup: any): boolean {
    return (
      setup &&
      typeof setup === 'object' &&
      typeof setup.entryPrice === 'number' && Number.isFinite(setup.entryPrice) &&
      typeof setup.stopLoss === 'number' && Number.isFinite(setup.stopLoss) &&
      typeof setup.takeProfit === 'number' && Number.isFinite(setup.takeProfit)
    );
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
