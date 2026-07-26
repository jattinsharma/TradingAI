// Shared utilities for the extension

/**
 * Safe version of toFixed that guards against undefined, null, NaN, and Infinity.
 */
export function safeToFixed(value: any, decimals: number = 2, fallback: string = 'N/A'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    console.warn('[Utils] safeToFixed: invalid value:', { value, type: typeof value });
    return fallback;
  }
  return value.toFixed(decimals);
}

/**
 * Safe version of formatNumber that guards against undefined, null, NaN, and Infinity.
 */
export function formatNumber(num: any, decimals: number = 2): string {
  return safeToFixed(num, decimals, 'N/A');
}

/**
 * Safe version of formatPercentage that guards against undefined, null, NaN, and Infinity.
 */
export function formatPercentage(num: any, decimals: number = 2): string {
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    console.warn('[Utils] formatPercentage: invalid value:', { value: num, type: typeof num });
    return 'N/A%';
  }
  return `${(num * 100).toFixed(decimals)}%`;
}

export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (this: any, ...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return function executedFunction(this: any, ...args: Parameters<T>) {
    let result: any;
    const later = () => {
      clearTimeout(timeout);
      result = func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    return result;
  };
}

export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (this: any, ...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return function executedFunction(this: any, ...args: Parameters<T>) {
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

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (let key of keys1) {
    if (!(key in obj2)) return false;
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }
  return true;
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substr(0, maxLength) + '...';
}
