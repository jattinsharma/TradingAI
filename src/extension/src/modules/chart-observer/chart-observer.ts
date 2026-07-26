// Chart Observer Module
// Observes chart/data updates on trading platforms and triggers analysis

import { WebsiteDetector } from '../website-detector/website-detector';
import { sendMessageToPopup } from '../../utils/messaging';

export class ChartObserver {
  private observationInterval: number | null = null;
  private lastUpdateTime: number = 0;
  private readonly MIN_UPDATE_INTERVAL = 2000; // Minimum 2 seconds between updates
  private observer: MutationObserver | null = null;

  constructor() {
    // Bind methods to maintain correct 'this' context
    this.handleChartUpdate = this.handleChartUpdate.bind(this);
    this.startObserving = this.startObserving.bind(this);
    this.stopObserving = this.stopObserving.bind(this);
  }

  /**
   * Start observing chart/DOM changes for the detected platform
   */
  startObserving(): void {
    // Stop any existing observation
    this.stopObserving();

    // Check if we're on a trading page
    if (!WebsiteDetector.isTradingPage()) {
      console.log('Not on a trading page, not starting chart observation');
      return;
    }

    const platform = WebsiteDetector.detectPlatform();
    console.log(`Starting chart observation for platform: ${platform}`);

    // Get platform-specific selector
    const capabilities = WebsiteDetector.getPlatformCapabilities();
    const selector = capabilities.chartSelector;

    if (!selector) {
      console.warn(`No chart selector defined for platform: ${platform}`);
      // Fallback: observe document body for changes
      this.observeDomChanges();
      return;
    }

    // Try to find the chart element
    const chartElement = document.querySelector(selector);
    if (chartElement) {
      this.observeElement(chartElement);
    } else {
      console.warn(`Chart element not found with selector: ${selector}`);
      // Fallback: observe document body
      this.observeDomChanges();
    }

    // Also set up periodic checks as backup
    this.setupPeriodicChecks();
  }

  /**
   * Stop observing chart/DOM changes
   */
  stopObserving(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.observationInterval) {
      clearInterval(this.observationInterval);
      this.observationInterval = null;
    }
  }

  /**
   * Observe a specific element for changes
   * @param element - DOM element to observe
   */
  private observeElement(element: Element): void {
    // Disconnect existing observer if any
    if (this.observer) {
      this.observer.disconnect();
    }

    // Create new observer
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Start observing
    this.observer.observe(element, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true
    });

    console.log(`Started observing element: ${element.tagName}`);
  }

  /**
   * Observe DOM changes on document body (fallback)
   */
  private observeDomChanges(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true
    });

    console.log('Started observing DOM changes on body');
  }

  /**
   * Handle mutation events
   * @param mutations - List of mutation records
   */
  private handleMutations(mutations: MutationRecord[]): void {
    const now = Date.now();

    // Throttle updates to prevent too frequent triggering
    if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) {
      return;
    }

    // Check if any mutations might indicate chart/data updates
    const hasPotentialChartUpdate = mutations.some(mutation => {
      // Look for changes that might indicate new data
      return (
        mutation.type === 'childList' &&
        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
      ) ||
      mutation.type === 'attributes' &&
      mutation.attributeName !== null &&
      // Check for common attribute changes that might indicate updates
      (mutation.attributeName === 'data-update' ||
       mutation.attributeName === 'data-recalculate' ||
       mutation.attributeName.includes('price') ||
       mutation.attributeName.includes('update'))
    });

    if (hasPotentialChartUpdate) {
      this.lastUpdateTime = now;
      this.handleChartUpdate();
    }
  }

  /**
   * Handle chart update - trigger analysis
   */
  private handleChartUpdate(): void {
    try {
      // Get current symbol and timeframe from the page
      const symbol = WebsiteDetector.getSymbol();
      const timeframe = WebsiteDetector.getTimeframe();

      console.log(`Chart update detected for ${symbol} on ${timeframe} timeframe`);

      // Notify popup that chart data has updated
      sendMessageToPopup({
        type: 'CHART_UPDATE',
        payload: {
          symbol,
          timeframe,
          timestamp: Date.now()
        }
      });

      // Trigger analysis (this would typically be done via background script)
      // For now, we'll just notify the popup which can request analysis
    } catch (error) {
      console.error('Error handling chart update:', error);
    }
  }

  /**
   * Set up periodic checks as a backup mechanism
   */
  private setupPeriodicChecks(): void {
    // Clear any existing interval
    if (this.observationInterval) {
      clearInterval(this.observationInterval);
      this.observationInterval = null;
    }

    // Check every 5 seconds for chart updates
    this.observationInterval = window.setInterval(() => {
      this.checkForChartUpdates();
    }, 5000);
  }

  /**
   * Check for chart updates manually
   */
  private checkForChartUpdates(): void {
    // In a more sophisticated implementation, this would check
    // for specific indicators that the chart has updated
    // For now, we'll just do a basic check

    const now = Date.now();

    // Only check if enough time has passed
    if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL * 2) {
      return;
    }

    try {
      // Check if we're still on a trading page
      if (!WebsiteDetector.isTradingPage()) {
        this.stopObserving();
        return;
      }

      // Simple heuristic: check if common chart elements have changed
      // This would be enhanced with platform-specific checks
      const priceElements = document.querySelectorAll(
        '[class*="price"], [class*="quote"], [data-price]'
      );

      if (priceElements.length > 0) {
        // In a real implementation, we'd compare current vs previous values
        // For now, we'll just trigger an update check periodically
        this.lastUpdateTime = now;

        // Notify of potential update
        sendMessageToPopup({
          type: 'CHART_CHECK',
          payload: {
            timestamp: now,
            url: window.location.href
          }
        });
      }
    } catch (error) {
      console.error('Error in periodic chart check:', error);
    }
  }

  /**
   * Destroy the observer and clean up resources
   */
  destroy(): void {
    this.stopObserving();
  }
}

// Export a singleton instance
export const chartObserver = new ChartObserver();