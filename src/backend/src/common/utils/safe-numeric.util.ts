/**
 * Safely formats a numeric value to a fixed number of decimal places.
 * Returns 0 for null, undefined, NaN, Infinity, or non-finite values.
 * Prevents runtime crashes from calling .toFixed() on invalid values.
 *
 * Use this EVERYWHERE instead of:
 *   parseFloat(value.toFixed(1))       ← crashes if value is undefined
 *   parseFloat((num).toFixed(2))       ← crashes if num is NaN/Infinity
 *
 * @param value  The value to format (any type — safe for unknown/number)
 * @param decimals  Number of decimal places (default 2)
 * @returns A safe number rounded to the specified decimals, or 0.
 */
export function safeToFixed(value: unknown, decimals: number = 2): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return parseFloat(value.toFixed(decimals));
}
