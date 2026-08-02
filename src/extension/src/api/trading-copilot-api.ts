/**
 * Backend API client for the AI Trading Copilot extension.
 * Handles JWT authentication, auto-saving analyses, fetching history/stats.
 *
 * The backend URL is centrally configured in config.ts.
 * Default: https://tradingai-4dq2.onrender.com (production)
 */
import { PRODUCTION_BACKEND_URL } from './config';

export interface BackendConfig {
  baseUrl: string;
  apiKey?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AnalysisPayload {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  recommendation: string;
  confidence: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio?: number;
  reasoning?: string;
  indicators?: Record<string, unknown>;
  signals?: Record<string, unknown>;
  risks?: string[];
  alternativeScenario?: string;
  invalidationLevel?: string;
  tradeDuration?: string;
  platform?: string;
}

export interface AnalysisListItem {
  id: string;
  symbol: string;
  timeframe: string;
  currentPrice: number;
  recommendation: string;
  confidence: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface TradeJournalPayload {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice?: number;
  quantity?: number;
  pnl?: number;
  pnlPercent?: number;
  entryDate?: string;
  exitDate?: string;
  reason?: string;
  emotion?: string;
  mistakes?: string;
  lessons?: string;
  aiRecommendation?: string;
  aiConfidence?: number;
  screenshotUrls?: string[];
  rating?: number;
}

export interface TradeJournalListItem {
  id: string;
  symbol: string;
  side: string;
  entryPrice: number;
  pnl?: number;
  pnlPercent?: number;
  createdAt: string;
}

export interface StatsResponse {
  total: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface V2AnalysisPayload {
  symbol: string;
  timeframe: string;
  depth?: 'QUICK' | 'STANDARD' | 'DEEP';
  chartData: {
    currentPrice: number;
    exchange?: string;
    indicators: Record<string, unknown>;
    candles?: Array<{
      timestamp: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>;
  };
}

export class TradingCopilotApi {
  private baseUrl: string;
  private jwtToken: string | null = null;
  private refreshToken: string | null = null;
  private onRefreshFailed: (() => void) | null = null;

  constructor(config?: BackendConfig) {
    this.baseUrl = config?.baseUrl
      ? config.baseUrl.replace(/\/+$/, '')
      : PRODUCTION_BACKEND_URL;
  }

  /**
   * Update the backend URL at runtime.
   * Called when the user configures a custom URL via the Options page,
   * or when the background service worker loads stored settings.
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url.trim().replace(/\/+$/, '');
  }

  /**
   * Get the current backend URL (used by background logout).
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Register a callback for when token refresh fails.
   * The background service worker uses this to clear stored tokens and force re-login.
   */
  setOnRefreshFailed(callback: () => void): void {
    this.onRefreshFailed = callback;
  }

  setJwtToken(token: string | null): void {
    this.jwtToken = token;
  }

  getJwtToken(): string | null {
    return this.jwtToken;
  }

  setRefreshToken(token: string | null): void {
    this.refreshToken = token;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  isAuthenticated(): boolean {
    return this.jwtToken !== null;
  }

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Returns true if the refresh succeeded.
   */
  async tryRefreshToken(): Promise<boolean> {
    if (!this.refreshToken) return false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(
        `${this.baseUrl}/auth/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: this.refreshToken }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        this.jwtToken = null;
        this.refreshToken = null;
        if (this.onRefreshFailed) this.onRefreshFailed();
        return false;
      }

      const data = await response.json();
      this.jwtToken = data.access_token;
      if (data.refresh_token) {
        this.refreshToken = data.refresh_token;
      }
      return true;
    } catch {
      this.jwtToken = null;
      this.refreshToken = null;
      if (this.onRefreshFailed) this.onRefreshFailed();
      return false;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retries = 2,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        // 45s timeout to allow Render free tier instances to spin up on cold start
        const timeoutId = setTimeout(() => controller.abort(), 45000);

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Auto-refresh on 401: try to refresh the token and retry the request
        if (response.status === 401 && this.refreshToken && attempt < retries) {
          const refreshed = await this.tryRefreshToken();
          if (refreshed) {
            // Update the authorization header with the new token
            headers['Authorization'] = `Bearer ${this.jwtToken}`;
            continue; // Retry the original request with the new token
          }
          // Refresh failed — don't retry auth-required requests
          throw new Error('API 401: Unauthorized. Token refresh failed. Please log in again.');
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`API ${response.status}: ${errorText}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt < retries) {
          // Don't retry if the error was a 401 with failed refresh
          if (error instanceof Error && error.message.includes('Token refresh failed')) {
            throw error;
          }
          // Exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
          continue;
        }

        // Transform common network errors into clear user-facing messages
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw new Error(
            `Cannot connect to backend at ${this.baseUrl}. ` +
            'The backend server may be down or unreachable. ' +
            'Check your internet connection and ensure the backend URL is correct in Settings → Connection.'
          );
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error(
            `Request to ${path} timed out. The backend at ${this.baseUrl} did not respond within 10 seconds. ` +
            'The server may be under heavy load or experiencing network issues.'
          );
        }

        throw error;
      }
    }

    throw new Error('Request failed after retries');
  }

  // ─── Multi-Agent V2 AI Engine ──────────────────────────

  async analyzeV2(payload: V2AnalysisPayload): Promise<any> {
    const endpoint = payload.depth === 'QUICK' ? '/v2/analyze/quick' : payload.depth === 'DEEP' ? '/v2/analyze/deep' : '/v2/analyze';
    return this.request<any>('POST', endpoint, payload);
  }

  // ─── Auth ──────────────────────────────────────────────

  async login(email: string, password: string): Promise<AuthResponse> {
    const result = await this.request<AuthResponse>(
      'POST',
      '/auth/login',
      { email, password },
    );
    this.jwtToken = result.access_token;
    this.refreshToken = result.refresh_token;
    return result;
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    const result = await this.request<AuthResponse>(
      'POST',
      '/auth/register',
      { email, password, name },
    );
    this.jwtToken = result.access_token;
    this.refreshToken = result.refresh_token;
    return result;
  }

  async loginWithGoogle(payload: { credential?: string; email?: string; name?: string; googleId?: string; picture?: string }): Promise<AuthResponse> {
    const result = await this.request<AuthResponse>(
      'POST',
      '/auth/google',
      payload,
    );
    this.jwtToken = result.access_token;
    this.refreshToken = result.refresh_token;
    return result;
  }

  // ─── Analysis History ──────────────────────────────────

  async saveAnalysis(data: AnalysisPayload): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/analysis', data);
  }

  async getAnalyses(filters?: {
    symbol?: string;
    recommendation?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<PaginatedResponse<AnalysisListItem>> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.set('symbol', filters.symbol);
    if (filters?.recommendation) params.set('recommendation', filters.recommendation);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    if (filters?.sort) params.set('sort', filters.sort);
    const qs = params.toString();
    return this.request<PaginatedResponse<AnalysisListItem>>('GET', `/analysis${qs ? `?${qs}` : ''}`);
  }

  async getAnalysisStats(symbol?: string): Promise<StatsResponse> {
    const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
    return this.request<StatsResponse>('GET', `/analysis/stats${qs}`);
  }

  async updateAnalysisOutcome(id: string, outcome: 'WIN' | 'LOSS' | 'PENDING'): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('PATCH', `/analysis/${id}/outcome`, { outcome });
  }

  // ─── Trade Journal ─────────────────────────────────────

  async saveTradeJournalEntry(data: TradeJournalPayload): Promise<{ id: string }> {
    return this.request<{ id: string }>('POST', '/trade-journal', data);
  }

  async getTradeJournalEntries(filters?: {
    symbol?: string;
    side?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<TradeJournalListItem>> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.set('symbol', filters.symbol);
    if (filters?.side) params.set('side', filters.side);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return this.request<PaginatedResponse<TradeJournalListItem>>('GET', `/trade-journal${qs ? `?${qs}` : ''}`);
  }

  async getTradeJournalStats(): Promise<StatsResponse> {
    return this.request<StatsResponse>('GET', '/trade-journal/stats');
  }
}

// Singleton that gets configured at runtime
// Default: PRODUCTION_BACKEND_URL (https://tradingai-4dq2.onrender.com)
// The background service worker calls initFromStorage() on startup.
// Users can customize the URL via Settings → Connection if they run their own backend.
export const tradingCopilotApi = new TradingCopilotApi();
