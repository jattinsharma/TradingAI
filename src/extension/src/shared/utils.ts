// Shared utilities for the extension

/**
 * Safe version of toFixed that guards against undefined, null, NaN, and Infinity.
 */
export function safeToFixed(value: unknown, decimals: number = 2, fallback: string = 'N/A'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    console.warn('[Utils] safeToFixed: invalid value:', { value, type: typeof value });
    return fallback;
  }
  return value.toFixed(decimals);
}

/**
 * Safe version of formatNumber that guards against undefined, null, NaN, and Infinity.
 */
export function formatNumber(num: unknown, decimals: number = 2): string {
  return safeToFixed(num, decimals, 'N/A');
}

/**
 * Safe version of formatPercentage that guards against undefined, null, NaN, and Infinity.
 */
export function formatPercentage(num: unknown, decimals: number = 2): string {
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    console.warn('[Utils] formatPercentage: invalid value:', { value: num, type: typeof num });
    return 'N/A%';
  }
  return `${(num * 100).toFixed(decimals)}%`;
}

export function debounce<T extends (...args: unknown[]) => ReturnType<T>>(func: T, wait: number): (this: unknown, ...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(this: unknown, ...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: unknown[]) => void>(func: T, limit: number): (this: unknown, ...args: Parameters<T>) => void {
  let inThrottle = false;
  return function executedFunction(this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize a timeframe string from TradingView format to the canonical format.
 * Examples: "60" → "1H", "D" → "1D", "5" → "5m", "W" → "1W"
 */
export function normalizeTimeframe(raw: string): string {
  const s = raw.trim().toUpperCase();

  const MAP: Record<string, string> = {
    '60': '1H', '120': '2H', '180': '3H', '240': '4H',
    '360': '6H', '720': '12H',
    'D': '1D', '1D': '1D', 'W': '1W', '1W': '1W', 'M': '1M', '1M': '1M',
  };

  if (MAP[s]) return MAP[s];

  // Patterns like "1", "5", "15", "30" (minutes)
  if (/^\d+$/.test(s)) return s + 'm';

  // Patterns like "1H", "4H"
  if (/^\d+[Hh]$/.test(s)) return s.toUpperCase();

  return s;
}
