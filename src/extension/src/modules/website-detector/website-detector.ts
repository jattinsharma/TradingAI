// Website Detector Module
// Identifies which trading platform the user is currently on

export class WebsiteDetector {
  /**
   * Detects the trading platform from the current URL
   * @returns {string} Platform identifier (tradingview, binance, bybit, coinbase, kraken, zerodha, upstox, angelone, metatrader, generic)
   */
  static detectPlatform(): string {
    try {
      if (typeof window === 'undefined' || !window.location) {
        return 'generic';
      }

      const hostname = window.location.hostname.toLowerCase();

      // TradingView
      if (hostname.includes('tradingview.com')) {
        return 'tradingview';
      }

      // Binance
      if (hostname.includes('binance.com') || hostname.includes('binance.us')) {
        return 'binance';
      }

      // Bybit
      if (hostname.includes('bybit.com')) {
        return 'bybit';
      }

      // Coinbase
      if (hostname.includes('coinbase.com') || hostname.includes('exchange.coinbase.com')) {
        return 'coinbase';
      }

      // Kraken
      if (hostname.includes('kraken.com')) {
        return 'kraken';
      }

      // Zerodha
      if (hostname.includes('zerodha.com') || hostname.includes('kite.zerodha.com')) {
        return 'zerodha';
      }

      // Upstox
      if (hostname.includes('upstox.com')) {
        return 'upstox';
      }

      // Angel One
      if (hostname.includes('angelone.in') || hostname.includes('angelbroking.com')) {
        return 'angelone';
      }

      // Groww
      if (hostname.includes('groww.in')) {
        return 'groww';
      }

      // Default to generic for unknown platforms
      console.log('[WebsiteDetector] Unsupported platform detected:', hostname);
      return 'generic';
    } catch (error) {
      console.error('Website detection failed:', error);
      return 'generic';
    }
  }

  /**
   * Gets the symbol/instrument from the current page.
   * Runs in the content script (DOM available).
   * Tries: DOM extraction → URL params → URL path → fallback
   * @returns {string} Symbol or instrument being viewed
   */
  static getSymbol(): string {
    try {
      if (typeof window === 'undefined' || !window.location) {
        console.log('[WebsiteDetector] Window not available, cannot detect symbol');
        return '';
      }

      const platform = WebsiteDetector.detectPlatform(); // Dynamic platform detection

      // === Method 1: DOM extraction (works on live TradingView page) ===
      try {
        // TradingView shows the symbol in the header toolbar as a clickable button
        // The text content is the ticker name (e.g. "BTCUSD", "BTCUSDT", "BTC/USDT")
        const symbolSelectors = [
          '[data-name="symbol-search-items"]',     // TradingView v3/v4 header items
          '[data-name="symbol-search"]',           // TradingView v3+ symbol search button
          '[data-symbol]',                           // Elements with data-symbol attribute
          '.symbol-edit',                            // TradingView symbol edit input
          '[class*="symbol"] [class*="text"]',     // Generic symbol text in toolbar
          '[class*="ticker"]',                      // Ticker display element
          // Fallback: find any element in the header toolbar containing a ticker pattern
        ];

        for (const sel of symbolSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = (el.getAttribute('data-symbol') || el.textContent || '').trim();
            if (text && text.length < 30 && text.length > 1) {
              // Clean up: remove spaces, separator dots, and slashes
              const clean = text.replace(/[/\s]/g, '').toUpperCase();
              if (/^[A-Z]{2,20}$/.test(clean)) {
                console.log('[WebsiteDetector] Symbol from DOM:', clean, '(selector:', sel, ')');
                return clean;
              }
            }
          }
        }

        // Method 1b: Look for symbol text in interval toolbar area (when we're on a chart)
        const activeButtons = document.querySelectorAll('[class*="button"][class*="active"], [aria-pressed="true"]');
        for (const btn of Array.from(activeButtons)) {
          // Check nearby sibling/parent elements for symbol text
          const parent = btn.closest('[class*="toolbar"]') || btn.closest('[class*="header"]');
          if (parent) {
            const allText = parent.textContent || '';
            const symbolMatch = allText.match(/[A-Z]{2,10}\/?(?:USD|USDT|EUR|JPY|GBP|BTC|ETH)/i);
            if (symbolMatch) {
              const clean = symbolMatch[0].replace(/[/\s]/g, '').toUpperCase();
              console.log('[WebsiteDetector] Symbol from toolbar context:', clean);
              return clean;
            }
          }
        }
      } catch (e) {
        console.warn('[WebsiteDetector] DOM extraction failed:', e);
      }

      // === Method 2: URL search params ===
      try {
        const url = new URL(window.location.href);
        const symbolParam = url.searchParams.get('symbol');
        if (symbolParam && symbolParam.trim().length > 0) {
          const clean = symbolParam.trim().toUpperCase().replace(/-/g, '');
          console.log('[WebsiteDetector] Symbol from URL param:', clean);
          return clean;
        }
      } catch (e) { /* ignore */ }

      // === Method 3: URL path pattern ===
      try {
        const pathname = window.location.pathname;
        // Match /chart/SYM/ or /symbols/SYM/ or /chart/?symbol=SYM
        const pathMatch = pathname.match(/\/(?:chart|symbols)\/([A-Za-z0-9:_-]+)/i);
        if (pathMatch && pathMatch[1]) {
          const sym = pathMatch[1].replace(/-/g, '').toUpperCase();
          console.log('[WebsiteDetector] Symbol from URL path:', sym);
          return sym;
        }
        // Match format like /trade/BTCUSDT
        const tradeMatch = pathname.match(/\/trade\/([A-Za-z0-9_-]+)/i);
        if (tradeMatch && tradeMatch[1]) {
          const sym = tradeMatch[1].replace(/-/g, '').toUpperCase();
          console.log('[WebsiteDetector] Symbol from trade URL:', sym);
          return sym;
        }
      } catch (e) { /* ignore */ }

      console.warn('[WebsiteDetector] Could not detect symbol from DOM or URL, using default BTCUSD');
      return 'BTCUSD';
    } catch (error) {
      console.error('[WebsiteDetector] Error getting symbol:', error);
      return 'BTCUSD';
    }
  }

  /**
   * Gets the timeframe/resolution from the current page.
   * Runs in the content script (DOM available).
   * Tries: DOM extraction → URL params → fallback
   * @returns {string} Timeframe (1m, 5m, 1h, 1D, etc.)
   */
  static getTimeframe(): string {
    try {
      if (typeof window === 'undefined' || !window.location) {
        return '1D';
      }

      // === Method 1: DOM extraction (active interval button on TradingView) ===
      try {
        const intervalSelectors = [
          '[class*="interval"][class*="active"]',
          '[class*="timeframe"][class*="active"]',
          '[class*="intervals"] [class*="active"]',
          '[aria-pressed="true"]',
          '[data-name*="interval"][class*="active"]',
        ];

        for (const sel of intervalSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            const text = (el.textContent || '').trim();
            // Match patterns like "1", "5", "15", "1H", "4H", "1D", "1W", "1M"
            if (/^\d+[mHhDWwM]?$/.test(text)) {
              console.log('[WebsiteDetector] Timeframe from DOM:', text, '(selector:', sel, ')');
              return text.toUpperCase();
            }
          }
        }
      } catch (e) {
        console.warn('[WebsiteDetector] DOM timeframe extraction failed:', e);
      }

      // === Method 2: URL params ===
      try {
        const url = new URL(window.location.href);
        const interval = url.searchParams.get('interval') || url.searchParams.get('resolution');
        if (interval) {
          const clean = interval.toUpperCase().replace(/MIN$/i, '');
          console.log('[WebsiteDetector] Timeframe from URL:', clean);
          return clean;
        }
      } catch (e) { /* ignore */ }

      console.warn('[WebsiteDetector] Could not detect timeframe, using default 1D');
      return '1D';
    } catch (error) {
      console.error('[WebsiteDetector] Error getting timeframe:', error);
      return '1D';
    }
  }

  /**
   * Checks if the current page is a trading/charts page
   * @returns {boolean} True if on a trading/relevant page
   */
  static isTradingPage(): boolean {
    try {
      if (typeof window === 'undefined' || !window.location) {
        return false;
      }

      const hostname = window.location.hostname.toLowerCase();

      // List of known trading domains
      const tradingDomains = [
        'tradingview.com',
        'binance.com',
        'binance.us',
        'bybit.com',
        'coinbase.com',
        'exchange.coinbase.com',
        'kraken.com',
        'zerodha.com',
        'kite.zerodha.com',
        'upstox.com',
        'angelone.in',
        'angelbroking.com',
        'groww.in',
        'metatrader5.com',
        'mt5.com'
      ];

      return tradingDomains.some(domain => hostname.includes(domain));
    } catch (error) {
      console.error('Error checking if trading page:', error);
      return false;
    }
  }

  /**
   * Gets platform-specific configuration or features
   * @returns {Object} Platform-specific capabilities
   */
  static getPlatformCapabilities(): any {
    const platform = this.detectPlatform();

    // Define capabilities per platform
    const capabilities: Record<string, any> = {
      tradingview: {
        supportsIntervals: true,
        supportsDrawingTools: true,
        supportsIndicators: true,
        supportsAlerts: true,
        supportsTrading: false, // TradingView doesn't allow direct trading via extension
        chartSelector: '#header-chart-container',
        symbolSelector: '.symbol-search-input__input',
        timeframeSelector: '.intervals-menu-item'
      },
      binance: {
        supportsIntervals: true,
        supportsDrawingTools: false,
        supportsIndicators: true,
        supportsAlerts: false,
        supportsTrading: true,
        chartSelector: '.chart-container',
        symbolSelector: '.select-symbol',
        timeframeSelector: '.intervals-menu-item'
      },
      bybit: {
        supportsIntervals: true,
        supportsDrawingTools: false,
        supportsIndicators: true,
        supportsAlerts: true,
        supportsTrading: true,
        chartSelector: '.chart-container',
        symbolSelector: '.symbol-select',
        timeframeSelector: '.timeframe-select'
      },
      coinbase: {
        supportsIntervals: true,
        supportsDrawingTools: false,
        supportsIndicators: true,
        supportsAlerts: false,
        supportsTrading: true,
        chartSelector: '.price-chart',
        symbolSelector: '.trading-pair-selector',
        timeframeSelector: '.timeframe-selector'
      },
      kraken: {
        supportsIntervals: true,
        supportsDrawingTools: false,
        supportsIndicators: true,
        supportsAlerts: false,
        supportsTrading: true,
        chartSelector: '.chart-wrapper',
        symbolSelector: '.pair-selector',
        timeframeSelector: '.interval-selector'
      },
      zerodha: {
        supportsIntervals: true,
        supportsDrawingTools: true,
        supportsIndicators: true,
        supportsAlerts: true,
        supportsTrading: true,
        chartSelector: '.chart-container',
        symbolSelector: '.tradingsymbol',
        timeframeSelector: '.timeframe-selection'
      },
      upstox: {
        supportsIntervals: true,
        supportsDrawingTools: true,
        supportsIndicators: true,
        supportsAlerts: true,
        supportsTrading: true,
        chartSelector: '.chart-container',
        symbolSelector: '.scrip-search-input',
        timeframeSelector: '.timeframe-option'
      },
      angelone: {
        supportsIntervals: true,
        supportsDrawingTools: true,
        supportsIndicators: true,
        supportsAlerts: true,
        supportsTrading: true,
        chartSelector: '.main-chart-container',
        symbolSelector: '.search-box-input',
        timeframeSelector: '.timeframe-btn'
      },
      groww: {
        supportsIntervals: true,
        supportsDrawingTools: false,
        supportsIndicators: true,
        supportsAlerts: true,
        supportsTrading: true,
        chartSelector: '.chart-container',
        symbolSelector: '.search-input',
        timeframeSelector: '.timeframe-selector'
      },
      metatrader: {
        supportsIntervals: true,
        supportsDrawingTools: true,
        supportsIndicators: true,
        supportsAlerts: true,
        supportsTrading: true,
        chartSelector: '#chart-container',
        symbolSelector: '.symbol-input',
        timeframeSelector: '.period-dropdown'
      },
      generic: {
        supportsIntervals: false,
        supportsDrawingTools: false,
        supportsIndicators: false,
        supportsAlerts: false,
        supportsTrading: false,
        chartSelector: '',
        symbolSelector: '',
        timeframeSelector: ''
      }
    };

    return capabilities[platform] || capabilities.generic;
  }
}