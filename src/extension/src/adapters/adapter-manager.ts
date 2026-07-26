// Adapter manager to manage different platform adapters
import { GenericAdapter } from './generic-adapter';
import { TradingViewAdapter } from './tradingview-adapter';
import { BaseAdapter, PlatformAdapter } from './base-adapter';

export class AdapterManager {
  private adapters: Map<string, PlatformAdapter> = new Map();
  private currentAdapter: PlatformAdapter | null = null;

  constructor() {
    // Register default adapters
    this.registerDefaultAdapters();
  }

  /**
   * Register an adapter for a platform
   * @param platform - Platform identifier (e.g., 'tradingview', 'binance')
   * @param adapter - Adapter instance
   */
  registerAdapter(platform: string, adapter: PlatformAdapter): void {
    this.adapters.set(platform, adapter);
  }

  /**
   * Get the adapter for the given platform.
   * @param platform - Optional platform override (e.g. 'tradingview'). If omitted, auto-detects.
   * @returns Adapter instance or null if not found
   */
  async getCurrentAdapter(platform?: string): Promise<PlatformAdapter | null> {
    // If platform is provided and we have a matching cached adapter, return it
    if (platform && this.currentAdapter && this.adapters.get(platform) === this.currentAdapter) {
      return this.currentAdapter;
    }

    // If platform is provided, use it directly (no auto-detection needed)
    // This is the primary path when called from the background service worker
    if (platform && this.adapters.has(platform)) {
      const adapter = this.adapters.get(platform)!;
      if (adapter.initialize) {
        // For background-context adapters (TradingView), initialize with symbol/timeframe context
        await adapter.initialize();
      }
      this.currentAdapter = adapter;
      console.log(`[AdapterManager] Using adapter for platform: ${platform}`);
      return adapter;
    }

    // If no platform provided, auto-detect
    const detectedPlatform = this.detectPlatform();
    const detectedAdapter = this.adapters.get(detectedPlatform);

    if (detectedAdapter) {
      if (detectedAdapter.initialize) {
        await detectedAdapter.initialize();
      }
      this.currentAdapter = detectedAdapter;
      return detectedAdapter;
    }

    // Fallback to generic adapter if no specific adapter found
    const genericAdapter = this.adapters.get('generic');
    if (genericAdapter) {
      if (genericAdapter.initialize) {
        await genericAdapter.initialize();
      }
      this.currentAdapter = genericAdapter;
      return genericAdapter;
    }

    return null;
  }

  /**
   * Register default adapters
   */
  private registerDefaultAdapters(): void {
    // Register platform-specific adapters
    this.registerAdapter('tradingview', new TradingViewAdapter());
    // Register generic adapter as fallback
    this.registerAdapter('generic', new GenericAdapter());
    // In the future, we would register additional platform adapters here:
    // this.registerAdapter('binance', new BinanceAdapter());
    // etc.
  }

  /**
   * Detect the current platform
   * This would typically use the website-detector module
   * For now, we'll return a placeholder that can be overridden
   */
  protected detectPlatform(): string {
    // Try to detect the current platform from the page URL
    try {
      if (typeof window !== 'undefined' && window.location) {
        const hostname = window.location.hostname.toLowerCase();
        if (hostname.includes('tradingview.com')) {
          return 'tradingview';
        }
      }
    } catch (e) {
      console.warn('[AdapterManager] Could not detect platform:', e);
    }
    return 'generic';
  }

  /**
   * Get all registered adapters
   */
  getAdapters(): Map<string, PlatformAdapter> {
    return this.adapters;
  }

  /**
   * Clean up all adapters
   */
  async destroyAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      if (adapter.destroy) {
        await adapter.destroy();
      }
    }
    this.adapters.clear();
    this.currentAdapter = null;
  }
}

// Export a singleton instance
export const adapterManager = new AdapterManager();