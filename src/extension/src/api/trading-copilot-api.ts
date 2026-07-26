/**
 * Backend API client for the AI Trading Copilot extension.
 * Handles JWT authentication, auto-saving analyses, fetching history/stats.
 */
export interface BackendConfig {
  baseUrl: string;
  apiKey?: string;
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

export class TradingCopilotApi {
  private baseUrl: string;
  private jwtToken: string | null = null;

  constructor(config: BackendConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }

  setJwtToken(token: string | null): void {
    this.jwtToken = token;
  }

  getJwtToken(): string | null {
    return this.jwtToken;
  }

  isAuthenticated(): boolean {
    return this.jwtToken !== null;
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
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`API ${response.status}: ${errorText}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt < retries) {
          // Exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
          continue;
        }

        // Transform common network errors into clear user-facing messages
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
          throw new Error(
            `Cannot connect to backend at ${this.baseUrl}. ` +
            'Make sure the backend server is running (npm run start:dev). ' +
            'If it is running, check that CORS is configured to allow requests from the extension.'
          );
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new Error(
            `Request to ${path} timed out. The backend at ${this.baseUrl} did not respond within 10 seconds. ` +
            'Make sure the backend is running and reachable.'
          );
        }

        throw error;
      }
    }

    throw new Error('Request failed after retries');
  }

  // ─── Auth ──────────────────────────────────────────────

  async login(email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: any }> {
    const result = await this.request<{ access_token: string; refresh_token: string; user: any }>(
      'POST',
      '/auth/login',
      { email, password },
    );
    this.jwtToken = result.access_token;
    return result;
  }

  async register(email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: any }> {
    const result = await this.request<{ access_token: string; refresh_token: string; user: any }>(
      'POST',
      '/auth/register',
      { email, password },
    );
    this.jwtToken = result.access_token;
    return result;
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
    const result = await this.request<{ access_token: string; refresh_token: string }>(
      'POST',
      '/auth/refresh',
      { refreshToken },
    );
    this.jwtToken = result.access_token;
    return result;
  }

  // ─── Analysis History ──────────────────────────────────

  async saveAnalysis(data: AnalysisPayload): Promise<any> {
    return this.request('POST', '/analysis', data);
  }

  async getAnalyses(filters?: {
    symbol?: string;
    recommendation?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    sort?: string;
  }): Promise<{ items: any[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.set('symbol', filters.symbol);
    if (filters?.recommendation) params.set('recommendation', filters.recommendation);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    if (filters?.sort) params.set('sort', filters.sort);
    const qs = params.toString();
    return this.request('GET', `/analysis${qs ? `?${qs}` : ''}`);
  }

  async getAnalysisStats(symbol?: string): Promise<any> {
    const qs = symbol ? `?symbol=${encodeURIComponent(symbol)}` : '';
    return this.request('GET', `/analysis/stats${qs}`);
  }

  async updateAnalysisOutcome(id: string, outcome: 'WIN' | 'LOSS' | 'PENDING'): Promise<any> {
    return this.request('PATCH', `/analysis/${id}/outcome`, { outcome });
  }

  // ─── Trade Journal ─────────────────────────────────────

  async saveTradeJournalEntry(data: TradeJournalPayload): Promise<any> {
    return this.request('POST', '/trade-journal', data);
  }

  async getTradeJournalEntries(filters?: {
    symbol?: string;
    side?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: any[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.symbol) params.set('symbol', filters.symbol);
    if (filters?.side) params.set('side', filters.side);
    if (filters?.startDate) params.set('startDate', filters.startDate);
    if (filters?.endDate) params.set('endDate', filters.endDate);
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return this.request('GET', `/trade-journal${qs ? `?${qs}` : ''}`);
  }

  async getTradeJournalStats(): Promise<any> {
    return this.request('GET', '/trade-journal/stats');
  }
}

// Singleton that gets configured at runtime
export const tradingCopilotApi = new TradingCopilotApi({
  baseUrl: 'http://localhost:3000',
});
